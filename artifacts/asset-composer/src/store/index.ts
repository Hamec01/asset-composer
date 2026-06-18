import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  Entity, Project, EntityType, PaletteTokens, SlotAssignment,
  AnimationClip, EntityVisual, AttachmentOverride,
  CanvasMode, EditorSelection, LocalTransform, Template,
} from "@/domain/types";
import type { Command } from "./commands";
import {
  makeSetSlotCommand, makeSetPaletteCommand, makeRenameCommand,
  makeAddEntityVisualCommand, makeRemoveEntityVisualCommand,
  makeSetAttachmentOverrideCommand, makeSetTemplateSlotTransformCommand,
} from "./commands";
import { cloneTemplates, resolveTemplate } from "@/data/templates";
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
  setAttachmentOverride:  (entityId: string, slotId: string, override: Partial<AttachmentOverride>) => void;
  previewAttachmentOverride: (entityId: string, slotId: string, override: Partial<AttachmentOverride>) => void;
  commitAttachmentOverride: (
    entityId: string,
    slotId: string,
    beforeOverride: AttachmentOverride,
    afterOverride: AttachmentOverride,
    label?: string,
  ) => void;
  previewEntityVisualTransform: (entityId: string, visualId: string, transform: LocalTransform) => void;
  commitEntityVisualTransform: (
    entityId: string,
    visualId: string,
    before: LocalTransform,
    after: LocalTransform,
    label?: string,
  ) => void;

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
  previewTemplateSlotTransform: (templateId: string, slotId: string, transform: LocalTransform) => void;
  commitTemplateSlotTransform: (
    templateId: string,
    slotId: string,
    before: LocalTransform,
    after: LocalTransform,
    label?: string,
  ) => void;

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
  getActiveTemplate:  () => Template | undefined;
  getActiveStyleSet:  () => ReturnType<typeof getStyleSetById>;
}

function makeDefaultLicense() {
  return {
    source: "user", author: "user", licenseType: "proprietary" as const,
    aiGenerated: false, commercialUseAllowed: true,
    purchaseRef: null, derivativePolicy: "unrestricted",
  };
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function sameAttachmentOverride(
  current: Partial<AttachmentOverride> | undefined,
  next: Partial<AttachmentOverride>,
) {
  return (
    (current?.anchorId ?? "") === (next.anchorId ?? current?.anchorId ?? "") &&
    (current?.bindMode ?? "") === (next.bindMode ?? current?.bindMode ?? "") &&
    (current?.offsetX ?? 0) === (next.offsetX ?? current?.offsetX ?? 0) &&
    (current?.offsetY ?? 0) === (next.offsetY ?? current?.offsetY ?? 0) &&
    (current?.rotation ?? 0) === (next.rotation ?? current?.rotation ?? 0) &&
    (current?.scaleX ?? 1) === (next.scaleX ?? current?.scaleX ?? 1) &&
    (current?.scaleY ?? 1) === (next.scaleY ?? current?.scaleY ?? 1)
  );
}

function normalizeAttachmentOverride(
  override: Partial<AttachmentOverride> | undefined,
): AttachmentOverride {
  return {
    anchorId: override?.anchorId ?? "",
    bindMode: override?.bindMode ?? "",
    offsetX: override?.offsetX ?? 0,
    offsetY: override?.offsetY ?? 0,
    rotation: override?.rotation ?? 0,
    scaleX: override?.scaleX ?? 1,
    scaleY: override?.scaleY ?? 1,
  };
}

function sameLocalTransform(a?: LocalTransform, b?: LocalTransform) {
  if (!a || !b) return false;
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.rotation === b.rotation &&
    a.scaleX === b.scaleX &&
    a.scaleY === b.scaleY
  );
}

function normalizeLocalTransform(transform: LocalTransform | undefined): LocalTransform {
  return {
    x: transform?.x ?? 0,
    y: transform?.y ?? 0,
    rotation: transform?.rotation ?? 0,
    scaleX: transform?.scaleX ?? 1,
    scaleY: transform?.scaleY ?? 1,
  };
}

function sameEntityVisualTransform(a?: LocalTransform, b?: LocalTransform) {
  return sameLocalTransform(a, b);
}

function makeDefaultProject(): Project {
  return {
    id:              createId(),
    version:         "2.0",
    name:            "New Project",
    description:     "",
    entities:        [],
    templates:       cloneTemplates(),
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

function applyEntityCommand(entities: Entity[], cmd: Command, direction: "do" | "undo"): Entity[] {
  if (!cmd.entityId) return entities;
  const patch = direction === "do" ? cmd.after : cmd.before;
  return entities.map(e =>
    e.id === cmd.entityId ? { ...e, ...patch, updatedAt: Date.now() } : e
  );
}

function applyTemplateCommand(templates: Template[], cmd: Command, direction: "do" | "undo"): Template[] {
  if (cmd.type !== "SET_TEMPLATE_SLOT_TRANSFORM" || !cmd.templateId || !cmd.slotId) {
    return templates;
  }
  const patch = direction === "do" ? cmd.after : cmd.before;
  return templates.map(template => {
    if (template.id !== cmd.templateId) return template;
    return {
      ...template,
      slots: template.slots.map(slot =>
        slot.id === cmd.slotId
          ? { ...slot, defaultTransform: patch.defaultTransform }
          : slot,
      ),
    };
  });
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
      const template = resolveTemplate(get().project, templateId);
      if (!template) return;
      const styleSet = STYLE_SETS.find(s => s.id === DEFAULT_STYLE_SET_ID);
      const entity: Entity = {
        id:                   createId(),
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
          const template = resolveTemplate(state.project, entity.templateId);
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
      set(state => {
        if (state.project.activeEntityId !== entityId) return;
        if (state.editor.selectedSlotId !== slotId && state.editor.selection.kind !== "equipped-item" && state.editor.selection.kind !== "item-part") {
          return;
        }
        if (itemId) {
          state.editor.selectedSlotId = slotId;
          state.editor.selection = { kind: "equipped-item", entityId, slotId, itemId };
          return;
        }
        if (
          state.editor.selection.kind === "equipped-item" ||
          (state.editor.selection.kind === "item-part" && state.editor.selection.slotId === slotId)
        ) {
          state.editor.selection = { kind: "none" };
        }
      });
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
      get().pushCommand(makeAddEntityVisualCommand(entityId, before, after, visual.id));
    },

    removeEntityVisual: (entityId, visualId) => {
      const entity = get().project.entities.find(e => e.id === entityId);
      if (!entity) return;
      const before = [...(entity.visuals ?? [])];
      const after  = before.filter(v => v.id !== visualId);
      get().pushCommand(makeRemoveEntityVisualCommand(entityId, before, after, visualId));
    },

    setAttachmentOverride: (entityId, slotId, override) => {
      const entity = get().project.entities.find(e => e.id === entityId);
      if (!entity) return;
      const slot = entity.slots.find(s => s.slotId === slotId);
      if (!slot) return;
      if (sameAttachmentOverride(slot.attachmentOverride, override)) return;
      const before: SlotAssignment[] = entity.slots.map(s => ({ ...s }));
      const after:  SlotAssignment[] = entity.slots.map(s =>
        s.slotId === slotId
          ? { ...s, attachmentOverride: { ...s.attachmentOverride, ...override } }
          : { ...s }
      );
      get().pushCommand(makeSetAttachmentOverrideCommand(entityId, before, after));
    },
    previewAttachmentOverride: (entityId, slotId, override) => {
      set(state => {
        const entity = state.project.entities.find(e => e.id === entityId);
        if (!entity) return;
        const slot = entity.slots.find(s => s.slotId === slotId);
        if (!slot) return;
        slot.attachmentOverride = { ...slot.attachmentOverride, ...override };
      });
    },
    commitAttachmentOverride: (entityId, slotId, beforeOverride, afterOverride, label = "Adjust attachment") => {
      const entity = get().project.entities.find(e => e.id === entityId);
      if (!entity) return;
      const slot = entity.slots.find(s => s.slotId === slotId);
      if (!slot) return;

      const normalizedBefore = normalizeAttachmentOverride(beforeOverride);
      const normalizedAfter = normalizeAttachmentOverride(afterOverride);
      if (sameAttachmentOverride(normalizedBefore, normalizedAfter)) return;

      const before: SlotAssignment[] = entity.slots.map(s =>
        s.slotId === slotId
          ? { ...s, attachmentOverride: { ...normalizedBefore } }
          : { ...s }
      );
      const after: SlotAssignment[] = entity.slots.map(s =>
        s.slotId === slotId
          ? { ...s, attachmentOverride: { ...normalizedAfter } }
          : { ...s }
      );

      get().pushCommand(makeSetAttachmentOverrideCommand(entityId, before, after, label));
    },
    previewEntityVisualTransform: (entityId, visualId, transform) => {
      set(state => {
        const entity = state.project.entities.find(e => e.id === entityId);
        if (!entity || !entity.visuals) return;
        const visual = entity.visuals.find(v => v.id === visualId);
        if (!visual) return;
        visual.localTransform = { ...transform };
      });
    },
    commitEntityVisualTransform: (entityId, visualId, before, after, label = "Move visual") => {
      const entity = get().project.entities.find(e => e.id === entityId);
      if (!entity || !entity.visuals) return;
      const visual = entity.visuals.find(v => v.id === visualId);
      if (!visual) return;
      const normalizedBefore = normalizeLocalTransform(before);
      const normalizedAfter = normalizeLocalTransform(after);
      if (sameEntityVisualTransform(normalizedBefore, normalizedAfter)) return;

      const beforeVisuals = entity.visuals.map(v =>
        v.id === visualId ? { ...v, localTransform: { ...normalizedBefore } } : { ...v },
      );
      const afterVisuals = entity.visuals.map(v =>
        v.id === visualId ? { ...v, localTransform: { ...normalizedAfter } } : { ...v },
      );
      get().pushCommand({
        type: "SET_ENTITY_VISUAL_TRANSFORM",
        entityId,
        before: { visuals: beforeVisuals },
        after: { visuals: afterVisuals },
        label,
      });
    },

    // ── Editor Actions ───────────────────────────────────────────────────────
    setAppState:         (appState)  => set(state => { state.editor.appState = appState; }),
    setSelectedSlot:     (slotId)    => set(state => {
      state.editor.selectedSlotId = slotId;
      const selection = state.editor.selection;
      if (slotId === null) {
        state.editor.selection = { kind: "none" };
        return;
      }

      if (selection.kind === "item-part" && selection.slotId !== slotId) {
        state.editor.selection = { kind: "none" };
        return;
      }

      if (selection.kind === "template-slot" && selection.slotId !== slotId) {
        state.editor.selection = { kind: "none" };
        return;
      }

      if (
        selection.kind === "equipped-item" &&
        selection.slotId === slotId
      ) {
        return;
      }

      const activeEntity = state.project.entities.find(entity => entity.id === state.project.activeEntityId);
      const assignment = activeEntity?.slots.find(slot => slot.slotId === slotId);
      if (activeEntity && assignment?.itemId) {
        state.editor.selection = {
          kind: "equipped-item",
          entityId: activeEntity.id,
          slotId,
          itemId: assignment.itemId,
        };
        return;
      }

      state.editor.selection = { kind: "none" };
    }),
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
      if (!slot) return;
      const beforeTransform = normalizeLocalTransform(slot.defaultTransform);
      if (sameLocalTransform(beforeTransform, transform)) return;
      const cmd = makeSetTemplateSlotTransformCommand(templateId, slotId, slot.defaultTransform, transform);
      state.project.templates = applyTemplateCommand(state.project.templates as Template[], cmd, "do");
      state.history.past.push(cmd);
      if (state.history.past.length > state.history.maxDepth) state.history.past.shift();
      state.history.future = [];
      state.project.updatedAt = Date.now();
    }),
    previewTemplateSlotTransform: (templateId, slotId, transform) => set(state => {
      const tmpl = state.project.templates.find(t => t.id === templateId);
      if (!tmpl) return;
      const slot = tmpl.slots.find(s => s.id === slotId);
      if (!slot) return;
      slot.defaultTransform = { ...transform };
    }),
    commitTemplateSlotTransform: (templateId, slotId, before, after, label = "Move slot") => set(state => {
      const tmpl = state.project.templates.find(t => t.id === templateId);
      if (!tmpl) return;
      const slot = tmpl.slots.find(s => s.id === slotId);
      if (!slot) return;
      const normalizedBefore = normalizeLocalTransform(before);
      const normalizedAfter = normalizeLocalTransform(after);
      if (sameLocalTransform(normalizedBefore, normalizedAfter)) return;
      const cmd = makeSetTemplateSlotTransformCommand(templateId, slotId, normalizedBefore, normalizedAfter, label);
      state.project.templates = applyTemplateCommand(state.project.templates as Template[], cmd, "do");
      state.history.past.push(cmd);
      if (state.history.past.length > state.history.maxDepth) state.history.past.shift();
      state.history.future = [];
      state.project.updatedAt = Date.now();
    }),

    // ── History Actions ──────────────────────────────────────────────────────
    pushCommand: (cmd) => {
      set(state => {
        state.project.entities = applyEntityCommand(state.project.entities as Entity[], cmd, "do");
        state.project.templates = applyTemplateCommand(state.project.templates as Template[], cmd, "do");
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
        state.project.entities = applyEntityCommand(state.project.entities as Entity[], cmd, "undo");
        state.project.templates = applyTemplateCommand(state.project.templates as Template[], cmd, "undo");
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
        state.project.entities = applyEntityCommand(state.project.entities as Entity[], cmd, "do");
        state.project.templates = applyTemplateCommand(state.project.templates as Template[], cmd, "do");
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

    setUpperClip:    (clipId) => {
      if (clipId && !get().animPlayback.activeClipId) {
        get().setPlaybackClip(clipId);
        return;
      }
      set(state => { state.animPlayback.upperClipId = clipId; });
    },
    setLowerClip:    (clipId) => {
      if (clipId && !get().animPlayback.activeClipId) {
        get().setPlaybackClip(clipId);
        return;
      }
      set(state => { state.animPlayback.lowerClipId = clipId; });
    },
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
  if (import.meta.env.DEV) {
    (window as typeof window & { __assetComposerStore?: typeof useStore }).__assetComposerStore = useStore;
  }

  animController.addSyncListener((timeMs) => {
    useStore.setState(state => {
      state.animPlayback.timeMs  = timeMs;
      state.animPlayback.playing = animController.isPlaying;
    });
  });
}

export type { AnimBottomTab };
export { getClipById };
