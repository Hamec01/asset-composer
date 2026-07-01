import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  Entity, Project, EntityType, PaletteTokens, SlotAssignment,
  AnimationClip, EntityVisual, AttachmentOverride,
  CanvasMode, EditorSelection, LocalTransform, Template, SlotEditorState, Item, ItemFitProfile,
  BodyMorphValues, BodyMorphRegionId, FaceCustomization, FaceFeatureConfig, FaceOverlay, SpriteEditorDocument, ItemPart, FaceFeatureKey,
  FaceAuthoringState, FaceAuthoringTool, FaceCanvasFocusMode,
} from "@/domain/types";
import type { Command } from "./commands";
import {
  makeSetSlotCommand, makeSetPaletteCommand, makeRenameCommand,
  makeAddEntityVisualCommand, makeRemoveEntityVisualCommand,
  makeSetAttachmentOverrideCommand, makeSetTemplateSlotTransformCommand, makeSetItemFitProfilesCommand,
} from "./commands";
import { cloneTemplates, resolveTemplate } from "@/data/templates";
import { STYLE_SETS, DEFAULT_STYLE_SET_ID, getStyleSetById } from "@/data/styleSets";
import { DEFAULT_EXPORT_PROFILES } from "@/data/exportProfiles";
import { ITEMS } from "@/data/items";
import { ITEM_FIT_PROFILES } from "@/data/itemFitProfiles";
import { getPresetById } from "@/data/skinPresets";
import { PRESET_ANIMATIONS, getClipById } from "@/data/presetAnimations";
import { PRESET_STATE_MACHINES } from "@/data/presetStateMachines";
import { animController } from "@/core-v2/AnimationController";
import { resetItemFitProfilePartToItemDefault, upsertItemFitProfilePartTransform } from "@/lib/itemFitProfileMutations";
import { parseProjectSnapshot } from "@/lib/projectValidation";
import {
  getLoopingClipForTemplate,
  getStateMachineForTemplate,
} from "@/lib/animationCompatibility";

type ActivePanel = "library" | "inspector" | "animation" | "export" | "none";
type AnimBottomTab = "timeline" | "preview" | "statemachine" | "authoring";
type AuthoringMode = "asset-import" | "sprite-editor" | "body-morph" | "face-editor" | null;

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
  fitAuthoring: {
    scope: "template" | "family";
    entityId: string;
    slotId: string;
    itemId: string;
    partId: string;
  } | null;
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
  setEntityBodyMorphValue: (entityId: string, key: keyof BodyMorphValues, value: number) => void;
  setEntityBodyMorphPreset: (entityId: string, presetId: string | null) => void;
  setEntityBodyAuthoringFocus: (entityId: string, region: BodyMorphRegionId) => void;
  setEntityBodyAuthoringState: (entityId: string, patch: Partial<NonNullable<Entity["bodyAuthoring"]>>) => void;
  setEntityBodyAuthoringRegionPreset: (entityId: string, region: BodyMorphRegionId, presetId: string | null) => void;
  setEntityFaceFeature: (entityId: string, feature: keyof Omit<FaceCustomization, "overlays">, patch: Partial<FaceFeatureConfig>) => void;
  setEntityFaceFeatureTransform: (
    entityId: string,
    feature: keyof Omit<FaceCustomization, "overlays">,
    patch: Partial<LocalTransform>,
  ) => void;
  setEntityFaceOverlayTransform: (
    entityId: string,
    overlayId: string,
    patch: Partial<LocalTransform>,
  ) => void;
  addEntityFaceOverlay: (entityId: string, overlay: FaceOverlay) => void;
  upsertEntityFaceOverlay: (entityId: string, overlay: FaceOverlay) => void;
  removeEntityFaceOverlay: (entityId: string, overlayId: string) => void;
    setEntityFaceAuthoringState: (
      entityId: string,
      patch: Partial<FaceAuthoringState>,
    ) => void;
  addProjectItem: (item: Item) => void;
  updateProjectItemPart: (itemId: string, partId: string, patch: Partial<ItemPart>) => void;
  updateEntityVisual: (entityId: string, visualId: string, patch: Partial<EntityVisual>) => void;
  upsertSpriteEditorDocument: (doc: SpriteEditorDocument) => void;
  setActiveSpriteDocument: (documentId: string | null) => void;
    setActiveAuthoringMode: (mode: AuthoringMode) => void;
    setActiveFaceCanvasOverlay: (overlayId: string | null) => void;
    setActiveFaceCanvasTool: (tool: FaceAuthoringTool | null) => void;
    setActiveFaceCanvasFocusMode: (mode: FaceCanvasFocusMode | null) => void;
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
  beginItemPartFitAuthoring: (
    scope: "template" | "family",
    entityId: string,
    slotId: string,
    itemId: string,
    partId: string,
  ) => void;
  clearItemPartFitAuthoring: () => void;
  updateTemplateSlotTransform: (templateId: string, slotId: string, transform: LocalTransform) => void;
  previewTemplateSlotTransform: (templateId: string, slotId: string, transform: LocalTransform) => void;
  commitTemplateSlotTransform: (
    templateId: string,
    slotId: string,
    before: LocalTransform,
    after: LocalTransform,
    label?: string,
  ) => void;
  saveItemPartFitProfile: (
    item: Item,
    template: Template,
    slotId: string,
    partId: string,
    transform: LocalTransform,
    scope: "template" | "family",
    anchorId?: string | null,
  ) => void;
  resetItemPartFitProfile: (
    item: Item,
    template: Template,
    slotId: string,
    partId: string,
    scope: "template" | "family",
  ) => void;
  previewItemPartFitTransform: (
    item: Item,
    template: Template,
    slotId: string,
    partId: string,
    transform: LocalTransform,
    scope: "template" | "family",
    anchorId?: string | null,
  ) => void;
  commitItemPartFitTransform: (
    item: Item,
    template: Template,
    slotId: string,
    partId: string,
    before: LocalTransform,
    after: LocalTransform,
    scope: "template" | "family",
    anchorId?: string | null,
    label?: string,
  ) => void;
  setSlotGizmoHidden: (templateId: string, slotId: string, hidden: boolean) => void;
  setSlotGizmoLocked: (templateId: string, slotId: string, locked: boolean) => void;
  hideAllSlotGizmos: (templateId: string) => void;
  showAllSlotGizmos: (templateId: string) => void;
  unlockAllSlotGizmos: (templateId: string) => void;
  getSlotEditorState: (templateId: string) => SlotEditorState;

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

function makeDefaultBodyMorphs(): BodyMorphValues {
  return {
    headSize: 1,
    neckLength: 1,
    torsoHeight: 1,
    torsoWidth: 1,
    armLength: 1,
    forearmLength: 1,
    handSize: 1,
    legLength: 1,
    shinLength: 1,
    footSize: 1,
    pelvisWidth: 1,
    overallHeightScale: 1,
  };
}

function makeDefaultFaceFeature(
  presetId: string,
  color: string,
  visible: boolean,
): FaceFeatureConfig {
  return {
    presetId,
    color,
    visible,
    transform: {
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    },
  };
}

function makeDefaultFaceCustomization(): FaceCustomization {
  return {
    eyes: makeDefaultFaceFeature("round_kawaii", "#2B1D18", true),
    mouth: makeDefaultFaceFeature("soft_smile", "#1A1A1A", true),
    brows: makeDefaultFaceFeature("soft_arc", "#3B2314", false),
    beard: makeDefaultFaceFeature("none", "#3B2314", false),
    hair: makeDefaultFaceFeature("none", "#3B2314", false),
    overlays: [],
  };
}

function makeDefaultBodyAuthoringState() {
  return {
    focusRegion: "global" as BodyMorphRegionId,
    activeBoneId: null as string | null,
    activeSlotId: null as string | null,
    intent: "morph" as const,
    viewportMode: "focus_region" as const,
    regionPresetIds: {},
  };
}

function makeDefaultFaceAuthoringState() {
  return {
    activeFeatureKey: null as FaceFeatureKey | "generic" | null,
    overlayFilter: "all" as FaceFeatureKey | "generic" | "all",
    selectedOverlayId: null as string | null,
    activeBoneId: null as string | null,
    activeSlotId: null as string | null,
    workflowMode: "feature" as const,
    draftOverlayRole: "detail" as const,
    draftPaintTarget: "both" as const,
    draftSymmetryMode: "none" as const,
    overlayRoleFilter: "all" as FaceOverlay["overlayRole"] | "all",
    paintTargetFilter: "all" as FaceOverlay["paintTarget"] | "all",
    overlayGrouping: "feature" as const,
    drawMode: null as FaceAuthoringTool | null,
    focusMode: "document" as FaceCanvasFocusMode,
  };
}

function cloneItemFitProfiles(profiles: ItemFitProfile[]): ItemFitProfile[] {
  return profiles.map(profile => ({
    ...profile,
    partTransforms: Object.fromEntries(
      Object.entries(profile.partTransforms).map(([partId, transform]) => [partId, { ...transform }]),
    ),
    anchorOverrides: profile.anchorOverrides ? { ...profile.anchorOverrides } : undefined,
  }));
}

function selectionMatchesFitAuthoring(
  selection: EditorSelection,
  fitAuthoring: EditorState["fitAuthoring"],
) {
  return (
    selection.kind === "item-part" &&
    fitAuthoring != null &&
    selection.entityId === fitAuthoring.entityId &&
    selection.slotId === fitAuthoring.slotId &&
    selection.itemId === fitAuthoring.itemId &&
    selection.partId === fitAuthoring.partId
  );
}

function sameEntityVisualTransform(a?: LocalTransform, b?: LocalTransform) {
  return sameLocalTransform(a, b);
}

function sameFaceAuthoringState(
  current: FaceAuthoringState | undefined,
  patch: Partial<FaceAuthoringState>,
) {
  const next = {
    ...makeDefaultFaceAuthoringState(),
    ...(current ?? {}),
    ...patch,
  };
  const prev = {
    ...makeDefaultFaceAuthoringState(),
    ...(current ?? {}),
  };
  return (
    prev.activeFeatureKey === next.activeFeatureKey &&
    prev.overlayFilter === next.overlayFilter &&
    (prev.selectedOverlayId ?? null) === (next.selectedOverlayId ?? null) &&
    (prev.activeBoneId ?? null) === (next.activeBoneId ?? null) &&
    (prev.activeSlotId ?? null) === (next.activeSlotId ?? null) &&
    prev.workflowMode === next.workflowMode &&
    prev.draftOverlayRole === next.draftOverlayRole &&
    prev.draftPaintTarget === next.draftPaintTarget &&
    prev.draftSymmetryMode === next.draftSymmetryMode &&
    prev.overlayRoleFilter === next.overlayRoleFilter &&
    prev.paintTargetFilter === next.paintTargetFilter &&
    prev.overlayGrouping === next.overlayGrouping &&
    (prev.drawMode ?? null) === (next.drawMode ?? null) &&
    (prev.focusMode ?? null) === (next.focusMode ?? null)
  );
}

function sameEditorSelection(a: EditorSelection, b: EditorSelection) {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case "none":
      return true;
    case "template-slot":
      return a.templateId === (b as typeof a).templateId && a.slotId === (b as typeof a).slotId;
    case "anchor":
      return (
        a.templateId === (b as typeof a).templateId &&
        a.boneId === (b as typeof a).boneId &&
        a.anchorId === (b as typeof a).anchorId
      );
    case "equipped-item":
      return (
        a.entityId === (b as typeof a).entityId &&
        a.slotId === (b as typeof a).slotId &&
        a.itemId === (b as typeof a).itemId
      );
    case "item-part":
      return (
        a.entityId === (b as typeof a).entityId &&
        a.slotId === (b as typeof a).slotId &&
        a.itemId === (b as typeof a).itemId &&
        a.partId === (b as typeof a).partId
      );
    case "face-overlay":
      return (
        a.entityId === (b as typeof a).entityId &&
        a.overlayId === (b as typeof a).overlayId &&
        a.featureKey === (b as typeof a).featureKey &&
        a.slotId === (b as typeof a).slotId
      );
    case "bone":
      return a.entityId === (b as typeof a).entityId && a.boneId === (b as typeof a).boneId;
    case "entity-visual":
      return a.entityId === (b as typeof a).entityId && a.visualId === (b as typeof a).visualId;
    default:
      return false;
  }
}

function sameBodyAuthoringState(
  current: NonNullable<Entity["bodyAuthoring"]> | undefined,
  patch: Partial<NonNullable<Entity["bodyAuthoring"]>>,
) {
  const prev = {
    ...makeDefaultBodyAuthoringState(),
    ...(current ?? {}),
    regionPresetIds: {
      ...(makeDefaultBodyAuthoringState().regionPresetIds ?? {}),
      ...((current?.regionPresetIds ?? {})),
    },
  };
  const next = {
    ...makeDefaultBodyAuthoringState(),
    ...(current ?? {}),
    ...patch,
    regionPresetIds: {
      ...(makeDefaultBodyAuthoringState().regionPresetIds ?? {}),
      ...((current?.regionPresetIds ?? {})),
      ...(((patch.regionPresetIds as Record<string, string | null | undefined> | undefined) ?? {})),
    },
  };
  const prevPresetIds = prev.regionPresetIds ?? {};
  const nextPresetIds = next.regionPresetIds ?? {};
  const presetKeys = new Set([...Object.keys(prevPresetIds), ...Object.keys(nextPresetIds)]);
  for (const key of presetKeys) {
    if ((prevPresetIds[key] ?? null) !== (nextPresetIds[key] ?? null)) {
      return false;
    }
  }
  return (
    prev.focusRegion === next.focusRegion &&
    (prev.activeBoneId ?? null) === (next.activeBoneId ?? null) &&
    (prev.activeSlotId ?? null) === (next.activeSlotId ?? null) &&
    prev.intent === next.intent &&
    prev.viewportMode === next.viewportMode
  );
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
    itemFitProfiles: [...ITEM_FIT_PROFILES],
    animationClips:  PRESET_ANIMATIONS,
    stateMachines:   PRESET_STATE_MACHINES,
    styleSets:       STYLE_SETS,
    exportProfiles:  DEFAULT_EXPORT_PROFILES,
      editorMeta:      {
        slotEditorByTemplateId: {},
        spriteEditorDocuments: [],
        activeSpriteDocumentId: null,
        activeAuthoringMode: null,
        activeFaceCanvasOverlayId: null,
        activeFaceCanvasTool: null,
        activeFaceCanvasFocusMode: null,
      },
    activeEntityId:  null,
    createdAt:       Date.now(),
    updatedAt:       Date.now(),
  };
}

function normalizeSlotEditorState(state?: Partial<SlotEditorState>): SlotEditorState {
  return {
    hiddenSlotIds: Array.isArray(state?.hiddenSlotIds) ? [...state.hiddenSlotIds] : [],
    lockedSlotIds: Array.isArray(state?.lockedSlotIds) ? [...state.lockedSlotIds] : [],
  };
}

function withSlotEditorState(
  project: Project,
  templateId: string,
  updater: (state: SlotEditorState) => SlotEditorState,
) {
  const current = normalizeSlotEditorState(project.editorMeta.slotEditorByTemplateId[templateId]);
  const next = updater(current);
  project.editorMeta = {
    ...project.editorMeta,
    slotEditorByTemplateId: {
      ...project.editorMeta.slotEditorByTemplateId,
      [templateId]: normalizeSlotEditorState(next),
    },
  };
  project.updatedAt = Date.now();
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

function applyProjectCommand(project: Project, cmd: Command, direction: "do" | "undo"): Project {
  if (cmd.type === "SET_ITEM_FIT_PROFILES") {
    return {
      ...project,
      itemFitProfiles: cloneItemFitProfiles(
        (direction === "do" ? cmd.after.itemFitProfiles : cmd.before.itemFitProfiles) ?? project.itemFitProfiles,
      ),
    };
  }

  return project;
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

function hydratePlaybackForEntity(
  project: Project,
  entityId: string | null,
  playback: AnimPlayback,
): AnimPlayback {
  const nextPlayback: AnimPlayback = { ...DEFAULT_ANIM_PLAYBACK, looping: playback.looping };
  if (!entityId) {
    animController.pause();
    return nextPlayback;
  }

  const entity = project.entities.find(candidate => candidate.id === entityId) ?? null;
  const template = entity ? resolveTemplate(project, entity.templateId) : undefined;
  if (!entity || !template) {
    animController.pause();
    return nextPlayback;
  }

  const activeStateMachineId =
    entity.activeStateMachineId ??
    getStateMachineForTemplate(template, PRESET_STATE_MACHINES)?.id ??
    null;
  const activeStateMachine = activeStateMachineId
    ? PRESET_STATE_MACHINES.find(machine => machine.id === activeStateMachineId) ?? null
    : null;

  let activeClipId = entity.activeAnimationClipId ?? null;
  let selectedStateId: string | null = null;
  let shouldPlay = false;

  if (activeStateMachine) {
    selectedStateId = activeStateMachine.entryStateId;
    const entryState = activeStateMachine.states.find(state => state.id === activeStateMachine.entryStateId) ?? null;
    if (entryState?.clipId) {
      activeClipId = entryState.clipId;
      shouldPlay = true;
    }
  }

  if (!activeClipId) {
    const firstLoop = getLoopingClipForTemplate(template, project.animationClips);
    if (firstLoop) {
      activeClipId = firstLoop.id;
      shouldPlay = true;
    }
  }

  if (activeClipId) {
    startClipPlayback(project.animationClips as AnimationClip[], activeClipId, nextPlayback.looping);
  } else {
    animController.pause();
  }

  return {
    ...nextPlayback,
    activeClipId,
    activeStateMachineId,
    selectedStateId,
    playing: shouldPlay,
    timeMs: 0,
  };
}

function debugLogProjectState(project: Project) {
  if (typeof window === "undefined" || !import.meta.env.DEV) return;
  const activeEntity = project.entities.find(entity => entity.id === project.activeEntityId) ?? null;
  const activeTemplate = activeEntity
    ? project.templates.find(template => template.id === activeEntity.templateId) ?? null
    : null;
  const payload = {
    projectId: project.id,
    projectName: project.name,
    activeEntityId: project.activeEntityId,
    activeEntity: activeEntity
      ? {
          id: activeEntity.id,
          name: activeEntity.name,
          slots: activeEntity.slots,
          visualsCount: activeEntity.visuals?.length ?? 0,
        }
      : null,
    activeTemplateSlots: activeTemplate?.slots ?? null,
    itemFitProfiles: project.itemFitProfiles,
  };

  console.info("[asset-composer][restore-debug]", JSON.stringify(payload));
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
      fitAuthoring:       null,
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
        bodyMorphs:           makeDefaultBodyMorphs(),
        bodyMorphPresetId:    null,
        bodyAuthoring:        makeDefaultBodyAuthoringState(),
        faceCustomization:    makeDefaultFaceCustomization(),
        faceAuthoring:        makeDefaultFaceAuthoringState(),
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
        const sm = getStateMachineForTemplate(template, PRESET_STATE_MACHINES);
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
          const firstLoop = getLoopingClipForTemplate(template, state.project.animationClips);
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
            const sm = getStateMachineForTemplate(template, PRESET_STATE_MACHINES);
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
              const firstLoop = getLoopingClipForTemplate(template, state.project.animationClips);
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
    setEntityBodyMorphValue: (entityId, key, value) => {
      set(state => {
        const e = state.project.entities.find(entity => entity.id === entityId);
        if (!e) return;
        const currentMorphs = { ...makeDefaultBodyMorphs(), ...(e.bodyMorphs ?? {}) };
        if (currentMorphs[key] === value && e.bodyMorphPresetId === null) return;
        e.bodyMorphs = { ...makeDefaultBodyMorphs(), ...(e.bodyMorphs ?? {}), [key]: value };
        e.bodyMorphPresetId = null;
        e.updatedAt = Date.now();
        state.project.updatedAt = Date.now();
      });
    },
    setEntityBodyMorphPreset: (entityId, presetId) => {
      set(state => {
        const e = state.project.entities.find(entity => entity.id === entityId);
        if (!e) return;
        if ((e.bodyMorphPresetId ?? null) === presetId) return;
        e.bodyMorphPresetId = presetId;
        e.updatedAt = Date.now();
        state.project.updatedAt = Date.now();
      });
    },
    setEntityBodyAuthoringFocus: (entityId, region) => {
      set(state => {
        const e = state.project.entities.find(entity => entity.id === entityId);
        if (!e) return;
        if (sameBodyAuthoringState(e.bodyAuthoring, { focusRegion: region })) return;
        e.bodyAuthoring = {
          ...makeDefaultBodyAuthoringState(),
          ...(e.bodyAuthoring ?? {}),
          focusRegion: region,
        };
        e.updatedAt = Date.now();
        state.project.updatedAt = Date.now();
      });
    },
    setEntityBodyAuthoringState: (entityId, patch) => {
      set(state => {
        const e = state.project.entities.find(entity => entity.id === entityId);
        if (!e) return;
        const current = e.bodyAuthoring ?? makeDefaultBodyAuthoringState();
        if (sameBodyAuthoringState(current, patch)) return;
        e.bodyAuthoring = {
          ...makeDefaultBodyAuthoringState(),
          ...current,
          ...patch,
          regionPresetIds: {
            ...(current.regionPresetIds ?? {}),
            ...(((patch.regionPresetIds as Record<string, string | null | undefined> | undefined) ?? {})),
          },
        };
        e.updatedAt = Date.now();
        state.project.updatedAt = Date.now();
      });
    },
    setEntityBodyAuthoringRegionPreset: (entityId, region, presetId) => {
      set(state => {
        const e = state.project.entities.find(entity => entity.id === entityId);
        if (!e) return;
        const current = e.bodyAuthoring ?? makeDefaultBodyAuthoringState();
        if ((current.regionPresetIds?.[region] ?? null) === presetId) return;
        e.bodyAuthoring = {
          ...current,
          regionPresetIds: {
            ...(current.regionPresetIds ?? {}),
            [region]: presetId,
          },
        };
        e.updatedAt = Date.now();
        state.project.updatedAt = Date.now();
      });
    },
    setEntityFaceFeature: (entityId, feature, patch) => {
      set(state => {
        const e = state.project.entities.find(entity => entity.id === entityId);
        if (!e) return;
        const current = e.faceCustomization ?? makeDefaultFaceCustomization();
        const currentFeature = current[feature];
        if (!currentFeature) return;
        e.faceCustomization = {
          ...current,
          [feature]: {
            ...currentFeature,
            ...patch,
            transform: {
              ...currentFeature.transform,
              ...(patch.transform ?? {}),
            },
          },
        };
        e.updatedAt = Date.now();
        state.project.updatedAt = Date.now();
      });
    },
    setEntityFaceFeatureTransform: (entityId, feature, patch) => {
      set(state => {
        const e = state.project.entities.find(entity => entity.id === entityId);
        if (!e) return;
        const current = e.faceCustomization ?? makeDefaultFaceCustomization();
        const currentFeature = current[feature];
        if (!currentFeature) return;
        e.faceCustomization = {
          ...current,
          [feature]: {
            ...currentFeature,
            transform: {
              ...currentFeature.transform,
              ...patch,
            },
          },
        };
        e.updatedAt = Date.now();
        state.project.updatedAt = Date.now();
      });
    },
    setEntityFaceOverlayTransform: (entityId, overlayId, patch) => {
      set(state => {
        const e = state.project.entities.find(entity => entity.id === entityId);
        if (!e) return;
        const current = e.faceCustomization ?? makeDefaultFaceCustomization();
        const nextOverlays = current.overlays.map(overlay =>
          overlay.id === overlayId
            ? {
              ...overlay,
              localTransform: {
                ...overlay.localTransform,
                ...patch,
              },
            }
            : overlay,
        );
        e.faceCustomization = {
          ...current,
          overlays: nextOverlays,
        };
        e.updatedAt = Date.now();
        state.project.updatedAt = Date.now();
      });
    },
    addEntityFaceOverlay: (entityId, overlay) => {
      set(state => {
        const e = state.project.entities.find(entity => entity.id === entityId);
        if (!e) return;
        const current = e.faceCustomization ?? makeDefaultFaceCustomization();
        e.faceCustomization = {
          ...current,
          overlays: [...current.overlays, overlay],
        };
        e.updatedAt = Date.now();
        state.project.updatedAt = Date.now();
      });
    },
    upsertEntityFaceOverlay: (entityId, overlay) => {
      set(state => {
        const e = state.project.entities.find(entity => entity.id === entityId);
        if (!e) return;
        const current = e.faceCustomization ?? makeDefaultFaceCustomization();
        const existingIndex = current.overlays.findIndex(candidate => candidate.id === overlay.id);
        const nextOverlays = existingIndex >= 0
          ? current.overlays.map(candidate => candidate.id === overlay.id ? overlay : candidate)
          : [...current.overlays, overlay];
        e.faceCustomization = {
          ...current,
          overlays: nextOverlays,
        };
        e.updatedAt = Date.now();
        state.project.updatedAt = Date.now();
      });
    },
    removeEntityFaceOverlay: (entityId, overlayId) => {
      set(state => {
        const e = state.project.entities.find(entity => entity.id === entityId);
        if (!e) return;
        const current = e.faceCustomization ?? makeDefaultFaceCustomization();
        e.faceCustomization = {
          ...current,
          overlays: current.overlays.filter(overlay => overlay.id !== overlayId),
        };
        e.updatedAt = Date.now();
        state.project.updatedAt = Date.now();
      });
    },
    setEntityFaceAuthoringState: (entityId, patch) => {
      set(state => {
        const e = state.project.entities.find(entity => entity.id === entityId);
        if (!e) return;
        if (sameFaceAuthoringState(e.faceAuthoring, patch)) return;
        e.faceAuthoring = {
          ...makeDefaultFaceAuthoringState(),
          ...(e.faceAuthoring ?? {}),
          ...patch,
        };
        e.updatedAt = Date.now();
        state.project.updatedAt = Date.now();
      });
    },
    addProjectItem: (item) => {
      set(state => {
        const existingIndex = state.project.items.findIndex(existing => existing.id === item.id);
        if (existingIndex >= 0) {
          state.project.items[existingIndex] = item;
        } else {
          state.project.items.push(item);
        }
        state.project.updatedAt = Date.now();
      });
    },
    updateProjectItemPart: (itemId, partId, patch) => {
      set(state => {
        const item = state.project.items.find(existing => existing.id === itemId);
        const part = item?.parts?.find(existing => existing.id === partId);
        if (!item || !part || !item.parts) return;
        item.parts = item.parts.map(existing => existing.id === partId ? { ...existing, ...patch } : existing);
        const updatedPart = item.parts.find(existing => existing.id === partId);
        if (updatedPart && item.svgLayers.length > 0) {
          item.svgLayers = item.svgLayers.map((layer, index) => index === 0 ? { ...layer, svgData: updatedPart.svgData } : layer);
        }
        state.project.updatedAt = Date.now();
      });
    },
    updateEntityVisual: (entityId, visualId, patch) => {
      set(state => {
        const entity = state.project.entities.find(existing => existing.id === entityId);
        if (!entity?.visuals) return;
        entity.visuals = entity.visuals.map(visual => visual.id === visualId ? { ...visual, ...patch } : visual);
        entity.updatedAt = Date.now();
        state.project.updatedAt = Date.now();
      });
    },
    upsertSpriteEditorDocument: (doc) => {
      set(state => {
        const existingIndex = state.project.editorMeta.spriteEditorDocuments.findIndex(existing => existing.id === doc.id);
        if (existingIndex >= 0) {
          state.project.editorMeta.spriteEditorDocuments[existingIndex] = doc;
        } else {
          state.project.editorMeta.spriteEditorDocuments.push(doc);
        }
        state.project.editorMeta.activeSpriteDocumentId = doc.id;
        state.project.editorMeta.activeAuthoringMode = "sprite-editor";
        state.project.updatedAt = Date.now();
      });
    },
    setActiveSpriteDocument: (documentId) => {
      set(state => {
        if (state.project.editorMeta.activeSpriteDocumentId === documentId) return;
        state.project.editorMeta.activeSpriteDocumentId = documentId;
        state.project.updatedAt = Date.now();
      });
    },
    setActiveAuthoringMode: (mode) => {
      set(state => {
        if (state.project.editorMeta.activeAuthoringMode === mode) return;
        state.project.editorMeta.activeAuthoringMode = mode;
        state.project.updatedAt = Date.now();
      });
    },
    setActiveFaceCanvasOverlay: (overlayId) => {
      set(state => {
        if (state.project.editorMeta.activeFaceCanvasOverlayId === overlayId) return;
        state.project.editorMeta.activeFaceCanvasOverlayId = overlayId;
        state.project.updatedAt = Date.now();
      });
    },
      setActiveFaceCanvasTool: (tool) => {
        set(state => {
          if (state.project.editorMeta.activeFaceCanvasTool === tool) return;
          state.project.editorMeta.activeFaceCanvasTool = tool;
          state.project.updatedAt = Date.now();
        });
      },
      setActiveFaceCanvasFocusMode: (mode) => {
        set(state => {
          if (state.project.editorMeta.activeFaceCanvasFocusMode === mode) return;
          state.project.editorMeta.activeFaceCanvasFocusMode = mode;
          state.project.updatedAt = Date.now();
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
      const migrated = parseProjectSnapshot(raw);
      debugLogProjectState(migrated as Project);
      set(state => {
        state.project = migrated as Project;
        state.history.past = [];
        state.history.future = [];
        state.editor.appState = "ide";
        state.editor.selectedSlotId = null;
        state.editor.isWizardOpen = false;
        state.editor.canvasMode = "select";
        state.editor.selection = { kind: "none" };
        state.editor.fitAuthoring = null;
        state.animPlayback = hydratePlaybackForEntity(
          migrated as Project,
          (migrated as Project).activeEntityId,
          state.animPlayback,
        );
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
        state.editor.fitAuthoring = null;
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
    setAppState:         (appState)  => set(state => {
      if (state.editor.appState === appState) return;
      state.editor.appState = appState;
    }),
    setSelectedSlot:     (slotId)    => set(state => {
      if (state.editor.selectedSlotId === slotId) {
        const selection = state.editor.selection;
        if (
          (slotId === null && selection.kind === "none") ||
          (selection.kind === "item-part" && selection.slotId === slotId) ||
          (selection.kind === "template-slot" && selection.slotId === slotId) ||
          (selection.kind === "equipped-item" && selection.slotId === slotId) ||
          (selection.kind === "face-overlay" && selection.slotId === slotId)
        ) {
          return;
        }
      }
      state.editor.selectedSlotId = slotId;
      const selection = state.editor.selection;
      if (slotId === null) {
        state.editor.selection = { kind: "none" };
        state.editor.fitAuthoring = null;
        return;
      }

      if (selection.kind === "item-part" && selection.slotId !== slotId) {
        state.editor.selection = { kind: "none" };
        state.editor.fitAuthoring = null;
        return;
      }
      if (selection.kind === "item-part" && selection.slotId === slotId) {
        return;
      }

      if (selection.kind === "template-slot" && selection.slotId !== slotId) {
        state.editor.selection = { kind: "none" };
        state.editor.fitAuthoring = null;
        return;
      }
      if (selection.kind === "template-slot" && selection.slotId === slotId) {
        return;
      }

      if (
        selection.kind === "equipped-item" &&
        selection.slotId === slotId
      ) {
        return;
      }

      if (
        selection.kind === "face-overlay" &&
        selection.slotId === slotId
      ) {
        return;
      }

      state.editor.fitAuthoring = null;

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
    setActivePanel:      (panel)     => set(state => {
      if (state.editor.activePanel === panel) return;
      state.editor.activePanel = panel;
    }),
    openWizard:          ()          => set(state => { state.editor.isWizardOpen = true; }),
    closeWizard:         ()          => set(state => { state.editor.isWizardOpen = false; }),
    openExport:          ()          => set(state => { state.editor.isExportOpen = true; }),
    closeExport:         ()          => set(state => { state.editor.isExportOpen = false; }),
    openImportWizard:    ()          => set(state => { state.editor.isImportWizardOpen = true; state.project.editorMeta.activeAuthoringMode = "asset-import"; }),
    closeImportWizard:   ()          => set(state => { state.editor.isImportWizardOpen = false; if (state.project.editorMeta.activeAuthoringMode === "asset-import") state.project.editorMeta.activeAuthoringMode = null; }),
    setCanvasMode:       (mode)      => set(state => {
      if (state.editor.canvasMode === mode && (mode === "edit-attachment" || state.editor.fitAuthoring == null)) {
        return;
      }
      state.editor.canvasMode = mode;
      if (mode !== "edit-attachment") {
        state.editor.fitAuthoring = null;
      }
    }),
    setEditorSelection:  (sel)       => set(state => {
      if (sameEditorSelection(state.editor.selection, sel)) return;
      state.editor.selection = sel;
      if (!selectionMatchesFitAuthoring(sel, state.editor.fitAuthoring)) {
        state.editor.fitAuthoring = null;
      }
    }),
    beginItemPartFitAuthoring: (scope, entityId, slotId, itemId, partId) => set(state => {
      state.editor.fitAuthoring = { scope, entityId, slotId, itemId, partId };
      state.editor.canvasMode = "edit-attachment";
      state.editor.selectedSlotId = slotId;
      state.editor.selection = { kind: "item-part", entityId, slotId, itemId, partId };
    }),
    clearItemPartFitAuthoring: () => set(state => {
      state.editor.fitAuthoring = null;
    }),
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
    previewItemPartFitTransform: (item, template, slotId, partId, transform, scope, anchorId = null) => {
      set(state => {
        state.project.itemFitProfiles = upsertItemFitProfilePartTransform(state.project.itemFitProfiles, {
          item,
          template,
          slotId,
          partId,
          transform,
          scope,
          anchorId,
        });
      });
    },
    commitItemPartFitTransform: (item, template, slotId, partId, before, after, scope, anchorId = null, label) => {
      const beforeProfiles = upsertItemFitProfilePartTransform(cloneItemFitProfiles(get().project.itemFitProfiles), {
        item,
        template,
        slotId,
        partId,
        transform: before,
        scope,
        anchorId,
      });
      const afterProfiles = upsertItemFitProfilePartTransform(cloneItemFitProfiles(get().project.itemFitProfiles), {
        item,
        template,
        slotId,
        partId,
        transform: after,
        scope,
        anchorId,
      });
      if (JSON.stringify(beforeProfiles) === JSON.stringify(afterProfiles)) return;
      get().pushCommand(makeSetItemFitProfilesCommand(
        beforeProfiles,
        afterProfiles,
        label ?? (scope === "template" ? "Adjust template fit" : "Adjust skeleton family fit"),
      ));
    },
    saveItemPartFitProfile: (item, template, slotId, partId, transform, scope, anchorId = null) => {
      const before = cloneItemFitProfiles(get().project.itemFitProfiles);
      const after = upsertItemFitProfilePartTransform(before, {
        item,
        template,
        slotId,
        partId,
        transform,
        scope,
        anchorId,
      });
      if (JSON.stringify(before) === JSON.stringify(after)) return;
      get().pushCommand(makeSetItemFitProfilesCommand(
        before,
        after,
        scope === "template" ? "Save fit for template" : "Save fit for skeleton family",
      ));
    },
    resetItemPartFitProfile: (item, template, slotId, partId, scope) => {
      const before = cloneItemFitProfiles(get().project.itemFitProfiles);
      const after = resetItemFitProfilePartToItemDefault(before, {
        item,
        template,
        slotId,
        partId,
        scope,
      });
      if (JSON.stringify(before) === JSON.stringify(after)) return;
      get().pushCommand(makeSetItemFitProfilesCommand(before, after, "Reset fit to item default"));
    },
    setSlotGizmoHidden: (templateId, slotId, hidden) => set(state => {
      withSlotEditorState(state.project, templateId, current => ({
        ...current,
        hiddenSlotIds: hidden
          ? [...new Set([...current.hiddenSlotIds, slotId])]
          : current.hiddenSlotIds.filter(id => id !== slotId),
      }));
    }),
    setSlotGizmoLocked: (templateId, slotId, locked) => set(state => {
      withSlotEditorState(state.project, templateId, current => ({
        ...current,
        lockedSlotIds: locked
          ? [...new Set([...current.lockedSlotIds, slotId])]
          : current.lockedSlotIds.filter(id => id !== slotId),
      }));
    }),
    hideAllSlotGizmos: (templateId) => set(state => {
      const tmpl = state.project.templates.find(t => t.id === templateId);
      if (!tmpl) return;
      withSlotEditorState(state.project, templateId, current => ({
        ...current,
        hiddenSlotIds: tmpl.slots.map(slot => slot.id),
      }));
    }),
    showAllSlotGizmos: (templateId) => set(state => {
      withSlotEditorState(state.project, templateId, current => ({
        ...current,
        hiddenSlotIds: [],
      }));
    }),
    unlockAllSlotGizmos: (templateId) => set(state => {
      withSlotEditorState(state.project, templateId, current => ({
        ...current,
        lockedSlotIds: [],
      }));
    }),
    getSlotEditorState: (templateId) => normalizeSlotEditorState(get().project.editorMeta.slotEditorByTemplateId[templateId]),

    pushCommand: (cmd) => {
      set(state => {
        state.project.entities = applyEntityCommand(state.project.entities as Entity[], cmd, "do");
        state.project.templates = applyTemplateCommand(state.project.templates as Template[], cmd, "do");
        state.project = applyProjectCommand(state.project, cmd, "do");
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
        state.project = applyProjectCommand(state.project, cmd, "undo");
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
        state.project = applyProjectCommand(state.project, cmd, "do");
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
  const debugHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);
  const hostname = window.location.hostname;
  const isPrivateLanHost =
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("172.");

  if (import.meta.env.DEV || debugHosts.has(hostname) || isPrivateLanHost) {
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
