import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  Entity, Project, EntityType, PaletteTokens, SlotAssignment,
  AnimationClip, EntityVisual, AttachmentOverride,
  CanvasMode, EditorSelection, LocalTransform,
} from "@/domain/types";
import type { Command } from "./commands";
import {
  makeSetSlotCommand, makeSetPaletteCommand, makeRenameCommand,
  makeAddEntityVisualCommand, makeRemoveEntityVisualCommand,
  makeSetAttachmentOverrideCommand,
} from "./commands";
import { TEMPLATES, getTemplateById, resolveTemplate } from "@/data/templates";
import { STYLE_SETS, DEFAULT_STYLE_SET_ID, getStyleSetById } from "@/data/styleSets";
import { DEFAULT_EXPORT_PROFILES } from "@/data/exportProfiles";
import { ITEMS } from "@/data/items";
import { getPresetById } from "@/data/skinPresets";
import { PRESET_ANIMATIONS, getClipById } from "@/data/presetAnimations";
import { PRESET_STATE_MACHINES } from "@/data/presetStateMachines";
import { animController } from "@/core-v2/AnimationController";
import { migrateProject } from "@/lib/projectMigration";

type ActivePanel = "library" | "inspector" | "animation" | "export" | "none";
type AnimBottomTab = "timeline" | "preview" | "statemachine";

interface AnimPlayback {
  activeClipId:         string | null;
  upperClipId:          string | null;
  lowerClipId:          string | null;
  upperBlendWeight:     number;
  timeMs:               number;
  playing:              boolean;
  looping:              boolean;
  activeStateMachineId: string | null;
  selectedStateId:      string | null;
  activeTab:            AnimBottomTab;
  zoomPx:               number;
}

interface EditorState {
  appState:             "dashboard" | "ide";
  selectedSlotId:       string | null;
  activePanel:          ActivePanel;
  isWizardOpen:         boolean;
  isExportOpen:         boolean;
  isImportWizardOpen:   boolean;
  canvasMode:           CanvasMode;
  selection:            EditorSelection;
}

interface HistoryState {
  past:     Command[];
  future:   Command[];
  maxDepth: number;
}

interface AppStore {
  project:      Project;
  editor:       EditorState;
  history:      HistoryState;
  animPlayback: AnimPlayback;

  createEntity:           (entityType: EntityType, templateId: string, name: string) => void;
  deleteEntity:           (entityId: string) => void;
  setActiveEntity:        (entityId: string | null) => void;
  renameEntity:           (entityId: string, name: string) => void;
  setEntitySlot:          (entityId: string, slotId: string, itemId: string | null) => void;
  setEntityPalette:       (entityId: string, palette: PaletteTokens) => void;
  setEntityPaletteToken:  (entityId: string, token: keyof PaletteTokens, value: string) => void;
  setEntityStyleSet:      (entityId: string, styleSetId: string) => void;
  setEntityActiveAnimation: (entityId: string, clipId: string | null) => void;
  applyOutfitPreset:      (entityId: string, presetId: string) => void;
  setEntitySpecies:       (entityId: string, species: string) => void;
  setProjectStyleSet:     (styleSetId: string) => void;
  setProjectName:         (name: string) => void;
  loadProject:            (project: unknown) => void;
  newProject:             () => void;

  addEntityVisual:        (entityId: string, visual: EntityVisual) => void;
  removeEntityVisual:     (entityId: string, visualId: string) => void;
  setAttachmentOverride:  (entityId: string, slotId: string, override: AttachmentOverride) => void;

  setAppState:    (state: "dashboard" | "ide") => void;
  setSelectedSlot:(slotId: string | null) => void;
  setActivePanel: (panel: ActivePanel) => void;
  openWizard:     () => void;
  closeWizard:    () => void;
  openExport:     () => void;
  closeExport:    () => void;
  openImportWizard:  () => void;
  closeImportWizard: () => void;
  setCanvasMode:          (mode: CanvasMode) => void;
  setEditorSelection:     (sel: EditorSelection) => void;
  updateTemplateSlotTransform: (templateId: string, slotId: string, transform: LocalTransform) => void;

  undo:        () => void;
  redo:        () => void;
  pushCommand: (cmd: Command) => void;

  setPlaybackClip:     (clipId: string | null) => void;
  setUpperClip:        (clipId: string | null) => void;
  setLowerClip:        (clipId: string | null) => void;
  setBlendWeight:      (weight: number) => void;
  setPlaybackTime:     (timeMs: number) => void;
  setPlaybackPlaying:  (playing: boolean) => void;
  setPlaybackLooping:  (looping: boolean) => void;
  setSelectedState:    (stateId: string | null) => void;
  setAnimBottomTab:    (tab: AnimBottomTab) => void;
  setTimelineZoom:     (zoomPx: number) => void;

  getActiveEntity:    () => Entity | null;
  getActiveTemplate:  () => ReturnType<typeof getTemplateById>;
  getActiveStyleSet:  () => ReturnType<typeof getStyleSetById>;
}

function makeDefaultLicense() {
  return {
    source: "user", author: "user", licenseType: "proprietary" as const,
    aiGenerated: false, commercialUseAllowed: true,
    purchaseRef: null, derivativePolicy: "unrestricted",
  };
}

function makeDefaultProject(): Project {
  return {
    id:              crypto.randomUUID(),
    version:         "2.0",
    name:            "New Project",
    description:     "",
    entities:        [],
    templates:       TEMPLATES,
    items:           [...ITEMS],
    animationClips:  PRESET_ANIMATIONS,
    stateMachines:   PRESET_STATE_MACHINES,
    styleSets:       STYLE_SETS,
    exportProfiles:  DEFAULT_EXPORT_PROFILES,
    activeEntityId:  null,
    createdAt:       Date.now(),
    updatedAt:       Date.now(),
  };
}

function applyCommand(entities: Entity[], cmd: Command, direction: "do" | "undo"): Entity[] {
  const patch = direction === "do" ? cmd.after : cmd.before;
  return entities.map(e =>
    e.id === cmd.entityId ? { ...e, ...patch, updatedAt: Date.now() } : e
  );
}

function startClipPlayback(allClips: AnimationClip[], clipId: string | null, looping: boolean) {
  const clip = clipId ? allClips.find(c => c.id === clipId) : null;
  if (clip) {
    animController.setDuration(clip.durationMs);
    animController.setLoop(looping);
    animController.seek(0);
    animController.play();
  }
}

const DEFAULT_ANIM_PLAYBACK: AnimPlayback = {
  activeClipId:         null,
  upperClipId:          null,
  lowerClipId:          null,
  upperBlendWeight:     1.0,
  timeMs:               0,
  playing:              false,
  looping:              true,
  activeStateMachineId: null,
  selectedStateId:      null,
  activeTab:            "timeline",
  zoomPx:               120,
};

export const useStore = create<AppStore>()(
  immer((set, get) => ({
    project:      makeDefaultProject(),
    editor: {
      appState:           "dashboard",
      selectedSlotId:     null,
      activePanel:        "library",
      isWizardOpen:       false,
      isExportOpen:       false,
      isImportWizardOpen: false,
      canvasMode:         "select" as CanvasMode,
      selection:          { kind: "none" } as EditorSelection,
    },
    history: { past: [], future: [], maxDepth: 100 },
    animPlayback: { ...DEFAULT_ANIM_PLAYBACK },

    // ── Project Actions ────────────────────────────────────────────────────────
    createEntity: (entityType, templateId, name) => {
      const template = getTemplateById(templateId);
      if (!template) return;
      const styleSet = STYLE_SETS.find(s => s.id === DEFAULT_STYLE_SET_ID);
      const entity: Entity = {
        id:                   crypto.randomUUID(),
        name,
        entityType,
        templateId,
        styleSetId:           DEFAULT_STYLE_SET_ID,
        palette:              styleSet ? { ...styleSet.paletteDefaults } : { ...template.paletteTokens },
        species:              "",
        slots:                template.slots.map(s => ({
          slotId: s.id, itemId: s.defaultItemId, paletteOverride: {}, attachmentOverride: {},
        })),
        visuals:              [],
        activeAnimationClipId: null,
        activeStateMachineId:  null,
        licenseMeta:          makeDefaultLicense(),
        createdAt:            Date.now(),
        updatedAt:            Date.now(),
      };
      set(state => {
        state.project.entities.push(entity);
        state.project.activeEntityId = entity.id;
        state.project.updatedAt = Date.now();
        state.history.past = [];
        state.history.future = [];
        const sm = PRESET_STATE_MACHINES.find(m => m.skeletonFamily === template.skeletonFamily);
        if (sm) {
          state.animPlayback.activeStateMachineId = sm.id;
          state.animPlayback.selectedStateId = sm.entryStateId;
          const entrySt = sm.states.find(s => s.id === sm.entryStateId);
          if (entrySt) {
            state.animPlayback.activeClipId = entrySt.clipId;
            state.animPlayback.playing = true;
            state.animPlayback.timeMs = 0;
            startClipPlayback(state.project.animationClips as AnimationClip[], entrySt.clipId, state.animPlayback.looping);
          }
        } else {
          const firstLoop = state.project.animationClips.find(
            c => c.skeletonFamily === template.skeletonFamily && c.loops
          );
          if (firstLoop) {
            state.animPlayback.activeClipId = firstLoop.id;
            state.animPlayback.playing = true;
            state.animPlayback.timeMs = 0;
            startClipPlayback(state.project.animationClips as AnimationClip[], firstLoop.id, state.animPlayback.looping);
          }
        }
      });
    },

    deleteEntity: (entityId) => {
      set(state => {
        state.project.entities = state.project.entities.filter(e => e.id !== entityId);
        if (state.project.activeEntityId === entityId) {
          state.project.activeEntityId = state.project.entities[0]?.id ?? null;
        }
        state.project.updatedAt = Date.now();
        state.history.past = [];
        state.history.future = [];
      });
    },

    setActiveEntity: (entityId) => {
      set(state => {
        state.project.activeEntityId = entityId;
        state.editor.selectedSlotId = null;
        state.editor.selection = { kind: "none" };
        state.animPlayback.timeMs = 0;
        const entity = state.project.entities.find(e => e.id === entityId);
        if (entity) {
          const template = getTemplateById(entity.templateId);
          if (template) {
            const sm = PRESET_STATE_MACHINES.find(m => m.skeletonFamily === template.skeletonFamily);
            if (sm) {
              state.animPlayback.activeStateMachineId = sm.id;
              state.animPlayback.selectedStateId = sm.entryStateId;
              const entrySt = sm.states.find(s => s.id === sm.entryStateId);
              if (entrySt) {
                state.animPlayback.activeClipId = entrySt.clipId;
                state.animPlayback.playing = true;
                startClipPlayback(state.project.animationClips as AnimationClip[], entrySt.clipId, state.animPlayback.looping);
              }
            } else {
              const firstLoop = state.project.animationClips.find(
                c => c.skeletonFamily === template.skeletonFamily && c.loops
              );
              if (firstLoop) {
                state.animPlayback.activeClipId = firstLoop.id;
                state.animPlayback.playing = true;
                startClipPlayback(state.project.animationClips as AnimationClip[], firstLoop.id, state.animPlayback.looping);
              }
            }
          }
        }
      });
    },

    renameEntity: (entityId, name) => {
      const entity = get().project.entities.find(e => e.id === entityId);
      if (!entity || entity.name === name) return;
      get().pushCommand(makeRenameCommand(entityId, entity.name, name));
    },

    setEntitySlot: (entityId, slotId, itemId) => {
      const entity = get().project.entities.find(e => e.id === entityId);
      if (!entity) return;
      const beforeSlots: SlotAssignment[] = entity.slots.map(s => ({ ...s }));
      let afterSlots: SlotAssignment[];
      const existing = entity.slots.find(s => s.slotId === slotId);
      if (existing) {
        afterSlots = entity.slots.map(s => s.slotId === slotId ? { ...s, itemId } : { ...s });
      } else {
        afterSlots = [...beforeSlots, { slotId, itemId, paletteOverride: {}, attachmentOverride: {} }];
      }
      get().pushCommand(makeSetSlotCommand(entityId, beforeSlots, afterSlots));
    },

    setEntityPalette: (entityId, palette) => {
      const entity = get().project.entities.find(e => e.id === entityId);
      if (!entity) return;
      get().pushCommand(makeSetPaletteCommand(entityId, { ...entity.palette }, palette));
    },

    setEntityPaletteToken: (entityId, token, value) => {
      const entity = get().project.entities.find(e => e.id === entityId);
      if (!entity) return;
      get().pushCommand(makeSetPaletteCommand(entityId, { ...entity.palette }, { ...entity.palette, [token]: value }));
    },

    setEntityStyleSet: (entityId, styleSetId) => {
      const entity = get().project.entities.find(e => e.id === entityId);
      if (!entity || entity.styleSetId === styleSetId) return;
      const styleSet = STYLE_SETS.find(s => s.id === styleSetId);
      const afterPalette = styleSet ? { ...styleSet.paletteDefaults } : { ...entity.palette };
      const cmd: Command = {
        type: "SET_STYLE_SET", entityId,
        before: { styleSetId: entity.styleSetId, palette: { ...entity.palette } },
        after:  { styleSetId, palette: afterPalette },
        label: "Change style set",
      };
      get().pushCommand(cmd);
    },

    setEntityActiveAnimation: (entityId, clipId) => {
      set(state => {
        const e = state.project.entities.find(e => e.id === entityId);
        if (e) e.activeAnimationClipId = clipId;
      });
    },

    setEntitySpecies: (entityId, species) => {
      set(state => {
        const e = state.project.entities.find(e => e.id === entityId);
        if (e) { e.species = species; e.updatedAt = Date.now(); }
      });
    },

    applyOutfitPreset: (entityId, presetId) => {
      const preset = getPresetById(presetId);
      if (!preset) return;
      const entity = get().project.entities.find(e => e.id === entityId);
      if (!entity) return;
      const beforeSlots: SlotAssignment[] = entity.slots.map(s => ({ ...s }));
      const afterSlots: SlotAssignment[] = entity.slots.map(s => ({
        ...s, itemId: preset.slots[s.slotId] ?? null,
      }));
      for (const [slotId, itemId] of Object.entries(preset.slots)) {
        if (!afterSlots.find(s => s.slotId === slotId)) {
          afterSlots.push({ slotId, itemId, paletteOverride: {}, attachmentOverride: {} });
        }
      }
      get().pushCommand(makeSetSlotCommand(entityId, beforeSlots, afterSlots));
    },

    setProjectStyleSet: (styleSetId) => {
      const styleSet = STYLE_SETS.find(s => s.id === styleSetId);
      if (!styleSet) return;
      set(state => {
        state.project.entities.forEach(e => {
          e.styleSetId = styleSetId;
          e.palette    = { ...styleSet.paletteDefaults };
        });
        state.project.updatedAt = Date.now();
        state.history.past = [];
        state.history.future = [];
      });
    },

    setProjectName: (name) => {
      set(state => { state.project.name = name; state.project.updatedAt = Date.now(); });
    },

    loadProject: (raw: unknown) => {
      animController.pause();
      const migrated = migrateProject(raw);
      set(state => {
        state.project = migrated as Project;
        state.history.past = [];
        state.history.future = [];
        state.editor.appState = "ide";
        state.editor.selectedSlotId = null;
        state.editor.isWizardOpen = false;
        state.editor.canvasMode = "select";
        state.editor.selection = { kind: "none" };
        state.animPlayback = { ...DEFAULT_ANIM_PLAYBACK };
      });
    },

    newProject: () => {
      animController.pause();
      set(state => {
        state.project = makeDefaultProject();
        state.history.past = [];
        state.history.future = [];
        state.editor.appState = "ide";
        state.editor.selectedSlotId = null;
        state.editor.isWizardOpen = false;
        state.editor.canvasMode = "select";
        state.editor.selection = { kind: "none" };
        state.animPlayback = { ...DEFAULT_ANIM_PLAYBACK };
      });
    },

    // ── Entity Visual Actions (undo-able) ────────────────────────────────────
    addEntityVisual: (entityId, visual) => {
      const entity = get().project.entities.find(e => e.id === entityId);
      if (!entity) return;
      const before = [...(entity.visuals ?? [])];
      const after  = [...before, visual];
      get().pushCommand(makeAddEntityVisualCommand(entityId, before, after, visual.name ?? visual.id));
    },

    removeEntityVisual: (entityId, visualId) => {
      const entity = get().project.entities.find(e => e.id === entityId);
      if (!entity) return;
      const before = [...(entity.visuals ?? [])];
      const after  = before.filter(v => v.id !== visualId);
      const name   = before.find(v => v.id === visualId)?.name ?? visualId;
      get().pushCommand(makeRemoveEntityVisualCommand(entityId, before, after, name));
    },

    setAttachmentOverride: (entityId, slotId, override) => {
      const entity = get().project.entities.find(e => e.id === entityId);
      if (!entity) return;
      const before: SlotAssignment[] = entity.slots.map(s => ({ ...s }));
      const after:  SlotAssignment[] = entity.slots.map(s =>
        s.slotId === slotId
          ? { ...s, attachmentOverride: { ...s.attachmentOverride, ...override } }
          : { ...s }
      );
      get().pushCommand(makeSetAttachmentOverrideCommand(entityId, before, after));
    },

    // ── Editor Actions ───────────────────────────────────────────────────────
    setAppState:         (appState)  => set(state => { state.editor.appState = appState; }),
    setSelectedSlot:     (slotId)    => set(state => { state.editor.selectedSlotId = slotId; }),
    setActivePanel:      (panel)     => set(state => { state.editor.activePanel = panel; }),
    openWizard:          ()          => set(state => { state.editor.isWizardOpen = true; }),
    closeWizard:         ()          => set(state => { state.editor.isWizardOpen = false; }),
    openExport:          ()          => set(state => { state.editor.isExportOpen = true; }),
    closeExport:         ()          => set(state => { state.editor.isExportOpen = false; }),
    openImportWizard:    ()          => set(state => { state.editor.isImportWizardOpen = true; }),
    closeImportWizard:   ()          => set(state => { state.editor.isImportWizardOpen = false; }),
    setCanvasMode:       (mode)      => set(state => { state.editor.canvasMode = mode; }),
    setEditorSelection:  (sel)       => set(state => { state.editor.selection = sel; }),
    updateTemplateSlotTransform: (templateId, slotId, transform) => set(state => {
      const tmpl = state.project.templates.find(t => t.id === templateId);
      if (!tmpl) return;
      const slot = tmpl.slots.find(s => s.id === slotId);
      if (slot) { slot.defaultTransform = transform; state.project.updatedAt = Date.now(); }
    }),

    // ── History Actions ──────────────────────────────────────────────────────
    pushCommand: (cmd) => {
      set(state => {
        state.project.entities = applyCommand(state.project.entities as Entity[], cmd, "do");
        state.history.past.push(cmd);
        if (state.history.past.length > state.history.maxDepth) state.history.past.shift();
        state.history.future = [];
        state.project.updatedAt = Date.now();
      });
    },

    undo: () => {
      const { past } = get().history;
      if (!past.length) return;
      const cmd = past[past.length - 1];
      set(state => {
        state.project.entities = applyCommand(state.project.entities as Entity[], cmd, "undo");
        state.history.past.pop();
        state.history.future.unshift(cmd);
        state.project.updatedAt = Date.now();
      });
    },

    redo: () => {
      const { future } = get().history;
      if (!future.length) return;
      const cmd = future[0];
      set(state => {
        state.project.entities = applyCommand(state.project.entities as Entity[], cmd, "do");
        state.history.future.shift();
        state.history.past.push(cmd);
        state.project.updatedAt = Date.now();
      });
    },

    // ── Animation Playback ───────────────────────────────────────────────────
    setPlaybackClip: (clipId) => {
      const allClips = get().project.animationClips;
      const clip = clipId ? allClips.find(c => c.id === clipId) : null;
      animController.pause();
      if (clip) { animController.setDuration(clip.durationMs); animController.setLoop(get().animPlayback.looping); }
      animController.seek(0);
      set(state => {
        state.animPlayback.activeClipId = clipId;
        state.animPlayback.timeMs = 0;
        state.animPlayback.playing = false;
        const entityId = state.project.activeEntityId;
        if (entityId) {
          const e = state.project.entities.find(e => e.id === entityId);
          if (e) e.activeAnimationClipId = clipId;
        }
      });
    },

    setPlaybackTime: (timeMs) => {
      animController.seek(timeMs);
      set(state => { state.animPlayback.timeMs = timeMs; });
    },

    setPlaybackPlaying: (playing) => {
      if (playing) {
        const { activeClipId, looping } = get().animPlayback;
        const clip = activeClipId ? get().project.animationClips.find(c => c.id === activeClipId) : null;
        if (clip) { animController.setDuration(clip.durationMs); animController.setLoop(looping); }
        animController.play();
      } else {
        animController.pause();
      }
      set(state => { state.animPlayback.playing = playing; });
    },

    setPlaybackLooping: (looping) => {
      animController.setLoop(looping);
      set(state => { state.animPlayback.looping = looping; });
    },

    setSelectedState: (stateId) => {
      set(state => {
        state.animPlayback.selectedStateId = stateId;
        if (stateId) {
          const smId = state.animPlayback.activeStateMachineId;
          const sm   = state.project.stateMachines.find(m => m.id === smId);
          if (sm) {
            const st = sm.states.find(s => s.id === stateId);
            if (st) {
              state.animPlayback.activeClipId = st.clipId;
              state.animPlayback.timeMs = 0;
              state.animPlayback.playing = true;
              startClipPlayback(state.project.animationClips as AnimationClip[], st.clipId, state.animPlayback.looping);
            }
          }
        }
      });
    },

    setUpperClip:    (clipId) => set(state => { state.animPlayback.upperClipId = clipId; }),
    setLowerClip:    (clipId) => set(state => { state.animPlayback.lowerClipId = clipId; }),
    setBlendWeight:  (w)      => set(state => { state.animPlayback.upperBlendWeight = Math.max(0, Math.min(1, w)); }),
    setAnimBottomTab:(tab)    => set(state => { state.animPlayback.activeTab = tab; }),
    setTimelineZoom: (px)     => set(state => { state.animPlayback.zoomPx = Math.max(40, Math.min(600, px)); }),

    // ── Derived Helpers ──────────────────────────────────────────────────────
    getActiveEntity: () => {
      const { entities, activeEntityId } = get().project;
      return entities.find(e => e.id === activeEntityId) ?? null;
    },

    getActiveTemplate: () => {
      const entity = get().getActiveEntity();
      if (!entity) return undefined;
      return resolveTemplate(get().project, entity.templateId);
    },

    getActiveStyleSet: () => {
      const entity = get().getActiveEntity();
      if (!entity) return undefined;
      return getStyleSetById(entity.styleSetId);
    },
  }))
);

// ── Keyboard shortcuts ─────────────────────────────────────────────────────────
if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      e.preventDefault(); useStore.getState().undo();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
      e.preventDefault(); useStore.getState().redo();
    }
    if (
      e.key === " " &&
      (e.target as HTMLElement).tagName !== "INPUT" &&
      (e.target as HTMLElement).tagName !== "TEXTAREA"
    ) {
      e.preventDefault();
      const { playing } = useStore.getState().animPlayback;
      useStore.getState().setPlaybackPlaying(!playing);
    }
  });

  animController.addSyncListener((timeMs) => {
    useStore.setState(state => {
      state.animPlayback.timeMs  = timeMs;
      state.animPlayback.playing = animController.isPlaying;
    });
  });
}

export type { AnimBottomTab };
export { getClipById };
