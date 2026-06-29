import { useEffect, useRef, useState, useCallback } from "react";
import { useStore } from "@/store";
import { CanvasEngine } from "@/engine/canvasEngine";
import { resolveTemplate } from "@/data/templates";
import { createDocumentFromFaceOverlay } from "@/lib/spriteEditor";
import {
  buildMultiClipPose, evaluateSkeleton, evaluateScene,
} from "@/lib/evaluationPipeline";
import { refreshCanonicalBuiltInTypedItems } from "@/lib/canonicalItems";
import { computeSceneBounds, fitSceneToViewport } from "@/lib/sceneUtils";
import { animController } from "@/core-v2/AnimationController";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ZoomIn, ZoomOut, Maximize2, MousePointer2, Move, LayoutGrid } from "lucide-react";
import type { BodyMorphRegionId, CanvasMode, FaceAuthoringTool, FaceFeatureKey } from "@/domain/types";

interface Viewport { zoom: number; panX: number; panY: number }
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 12;

const MODE_BUTTONS: Array<{
  mode: CanvasMode;
  label: string;
  title: string;
  icon: typeof MousePointer2;
}> = [
  {
    mode: "select",
    label: "Select",
    title: "Select visuals and slots without transforming them",
    icon: MousePointer2,
  },
  {
    mode: "edit-attachment",
    label: "Attachment",
    title: "Edit the equipped item part for the selected slot",
    icon: Move,
  },
  {
    mode: "edit-template-slots",
    label: "Slots",
    title: "Edit template slot positions for the active template",
    icon: LayoutGrid,
  },
];

const BODY_REGION_LABELS: Record<BodyMorphRegionId, string> = {
  head: "Head",
  torso: "Torso",
  arms: "Arms",
  legs: "Legs",
  global: "Global",
};

const FACE_FEATURE_LABELS: Record<FaceFeatureKey, string> = {
  eyes: "Eyes",
  mouth: "Mouth",
  brows: "Brows",
  beard: "Beard",
  hair: "Hair",
};

const BODY_REGION_BONE: Record<BodyMorphRegionId, string> = {
  head: "head",
  torso: "chest",
  arms: "shoulder_l",
  legs: "hip_l",
  global: "root",
};

const FACE_FEATURE_SLOT: Record<FaceFeatureKey, string> = {
  eyes: "slot_eyes",
  mouth: "slot_face",
  brows: "slot_face",
  beard: "slot_beard",
  hair: "slot_hair",
};

function getBodyRegionFromBoneId(boneId: string | null | undefined): BodyMorphRegionId {
  if (!boneId) return "global";
  if (boneId === "head" || boneId === "neck") return "head";
  if (boneId === "root") return "global";
  if (
    boneId.includes("shoulder")
    || boneId.includes("arm")
    || boneId.includes("hand")
  ) {
    return "arms";
  }
  if (
    boneId.includes("hip")
    || boneId.includes("leg")
    || boneId.includes("knee")
    || boneId.includes("shin")
    || boneId.includes("foot")
  ) {
    return "legs";
  }
  return "torso";
}

function getFaceFeatureFromSlotId(slotId: string | null | undefined): FaceFeatureKey | null {
  if (!slotId) return null;
  const found = Object.entries(FACE_FEATURE_SLOT).find(([, candidateSlotId]) => candidateSlotId === slotId);
  return (found?.[0] as FaceFeatureKey | undefined) ?? null;
}

function visualMatchesBodyRegion(visual: { boneId?: string }, region: BodyMorphRegionId) {
  const boneId = visual.boneId ?? "";
  if (region === "global") return true;
  if (region === "head") return boneId === "head" || boneId === "neck";
  if (region === "arms") return boneId.includes("shoulder") || boneId.includes("arm") || boneId.includes("hand");
  if (region === "legs") return boneId.includes("hip") || boneId.includes("leg") || boneId.includes("knee") || boneId.includes("shin") || boneId.includes("foot");
  return boneId === "root" || boneId === "spine" || boneId === "chest" || boneId === "pelvis" || boneId === "neck";
}

export function CanvasPanel() {
  const project         = useStore(s => s.project);
  const editor          = useStore(s => s.editor);
  const animPlayback    = useStore(s => s.animPlayback);
  const setSelectedSlot           = useStore(s => s.setSelectedSlot);
  const setEntityBodyAuthoringState = useStore(s => s.setEntityBodyAuthoringState);
  const setEntityFaceAuthoringState = useStore(s => s.setEntityFaceAuthoringState);
  const setEntityFaceFeatureTransform = useStore(s => s.setEntityFaceFeatureTransform);
  const setEntityFaceOverlayTransform = useStore(s => s.setEntityFaceOverlayTransform);
  const previewAttachmentOverride = useStore(s => s.previewAttachmentOverride);
  const commitAttachmentOverride  = useStore(s => s.commitAttachmentOverride);
  const previewItemPartFitTransform = useStore(s => s.previewItemPartFitTransform);
  const commitItemPartFitTransform = useStore(s => s.commitItemPartFitTransform);
  const setCanvasMode             = useStore(s => s.setCanvasMode);
    const setEditorSelection        = useStore(s => s.setEditorSelection);
    const setActiveAuthoringMode    = useStore(s => s.setActiveAuthoringMode);
  const setActiveFaceCanvasOverlay = useStore(s => s.setActiveFaceCanvasOverlay);
  const setActiveFaceCanvasTool = useStore(s => s.setActiveFaceCanvasTool);
  const setActiveFaceCanvasFocusMode = useStore(s => s.setActiveFaceCanvasFocusMode);
  const upsertSpriteEditorDocument = useStore(s => s.upsertSpriteEditorDocument);
  const setActiveSpriteDocument = useStore(s => s.setActiveSpriteDocument);
  const setAnimBottomTab = useStore(s => s.setAnimBottomTab);
  const previewTemplateSlotTransform = useStore(s => s.previewTemplateSlotTransform);
  const commitTemplateSlotTransform  = useStore(s => s.commitTemplateSlotTransform);
  const setPlaybackPlaying        = useStore(s => s.setPlaybackPlaying);

  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef    = useRef<CanvasEngine | null>(null);
  const isPanning    = useRef(false);
  const lastMouse    = useRef({ x: 0, y: 0 });
  const [altHeld, setAltHeld]             = useState(false);
  const [initialized, setInitialized]     = useState(false);

  // Camera auto-fit: set true when entity changes so next reconcile triggers fit
  const cameraDirtyRef = useRef(true);
  const prevEntityIdRef = useRef<string | null>(null);

  // Viewport state — ref for callbacks, state for display
  const vpRef        = useRef<Viewport>({ zoom: 1, panX: 0, panY: 0 });
  const [vp, _setVp] = useState<Viewport>(vpRef.current);

  const applyViewport = useCallback((next: Viewport | ((prev: Viewport) => Viewport)) => {
    const resolved = typeof next === "function" ? next(vpRef.current) : next;
    vpRef.current = resolved;
    _setVp(resolved);
    engineRef.current?.setViewport(resolved.zoom, resolved.panX, resolved.panY);
  }, []);

  const activeEntity = project.entities.find(e => e.id === project.activeEntityId);
  const template     = activeEntity
    ? resolveTemplate(project, activeEntity.templateId)
    : undefined;
  const activeAuthoringMode = project.editorMeta.activeAuthoringMode ?? null;
  const activeFaceCanvasTool = project.editorMeta.activeFaceCanvasTool ?? null;
  const bodyAuthoring = activeEntity?.bodyAuthoring ?? { focusRegion: "global" as BodyMorphRegionId, activeBoneId: null, activeSlotId: null, intent: "morph" as const, viewportMode: "focus_region" as const, regionPresetIds: {} };
    const faceAuthoring = activeEntity?.faceAuthoring ?? {
      activeFeatureKey: null as FaceFeatureKey | "generic" | null,
      overlayFilter: "all" as FaceFeatureKey | "generic" | "all",
      selectedOverlayId: null as string | null,
      activeBoneId: "head" as string | null,
      activeSlotId: null as string | null,
      workflowMode: "feature" as const,
      draftOverlayRole: "detail" as const,
      draftPaintTarget: "both" as const,
      draftSymmetryMode: "none" as const,
      drawMode: null as FaceAuthoringTool | null,
      focusMode: "document" as const,
    };
  const activeFaceFeature = faceAuthoring.activeFeatureKey && faceAuthoring.activeFeatureKey !== "generic"
    ? faceAuthoring.activeFeatureKey
    : null;
  const faceOverlays = activeEntity?.faceCustomization?.overlays ?? [];
  const visibleFaceOverlays = faceOverlays.filter(overlay => {
    if (faceAuthoring.overlayFilter === "all") return true;
    return (overlay.featureTag ?? "generic") === faceAuthoring.overlayFilter;
  });
  const activeFaceOverlay = visibleFaceOverlays.find(overlay => overlay.id === faceAuthoring.selectedOverlayId) ?? null;
  const slotEditorState = template
    ? project.editorMeta.slotEditorByTemplateId[template.id] ?? { hiddenSlotIds: [], lockedSlotIds: [] }
    : { hiddenSlotIds: [], lockedSlotIds: [] };

  // Detect entity switch → mark camera dirty
  if (prevEntityIdRef.current !== project.activeEntityId) {
    prevEntityIdRef.current = project.activeEntityId;
    cameraDirtyRef.current  = true;
  }

  // ── Init Fabric canvas ────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current || initialized) return;
    const container = containerRef.current;
    if (!container) return;
    const w = container.clientWidth  || 600;
    const h = container.clientHeight || 500;

    engineRef.current = new CanvasEngine({
      canvasEl: canvasRef.current,
      width:    w,
      height:   h,
      onSlotClick: (slotId) => setSelectedSlot(slotId),
      onSelectionChange: (sel) => {
        setEditorSelection(sel);
        if (sel.kind === "item-part" || sel.kind === "template-slot") {
          setSelectedSlot(sel.slotId);
          return;
        }
        setSelectedSlot(null);
      },
      onItemPreview: (entityId, slotId, override) => {
        previewAttachmentOverride(entityId, slotId, override);
      },
      onItemCommit: (entityId, slotId, beforeOverride, afterOverride) => {
        commitAttachmentOverride(entityId, slotId, beforeOverride, afterOverride);
      },
      isEditingFitTransform: (entityId, slotId, itemId, partId) => {
        const fitAuthoring = useStore.getState().editor.fitAuthoring;
        return Boolean(
          fitAuthoring &&
          fitAuthoring.entityId === entityId &&
          fitAuthoring.slotId === slotId &&
          fitAuthoring.itemId === itemId &&
          fitAuthoring.partId === partId
        );
      },
      onItemFitPreview: (entityId, slotId, itemId, partId, transform) => {
        const store = useStore.getState();
        const fitAuthoring = store.editor.fitAuthoring;
        const entity = store.project.entities.find(candidate => candidate.id === entityId);
        const template = entity ? resolveTemplate(store.project, entity.templateId) : undefined;
        const item = store.project.items.find(candidate => candidate.id === itemId);
        if (!fitAuthoring || !template || !item) return;
        if (
          fitAuthoring.entityId !== entityId ||
          fitAuthoring.slotId !== slotId ||
          fitAuthoring.itemId !== itemId ||
          fitAuthoring.partId !== partId
        ) {
          return;
        }
        previewItemPartFitTransform(item, template, slotId, partId, transform, fitAuthoring.scope);
      },
      onItemFitCommit: (entityId, slotId, itemId, partId, before, after) => {
        const store = useStore.getState();
        const fitAuthoring = store.editor.fitAuthoring;
        const entity = store.project.entities.find(candidate => candidate.id === entityId);
        const template = entity ? resolveTemplate(store.project, entity.templateId) : undefined;
        const item = store.project.items.find(candidate => candidate.id === itemId);
        if (!fitAuthoring || !template || !item) return;
        if (
          fitAuthoring.entityId !== entityId ||
          fitAuthoring.slotId !== slotId ||
          fitAuthoring.itemId !== itemId ||
          fitAuthoring.partId !== partId
        ) {
          return;
        }
        commitItemPartFitTransform(item, template, slotId, partId, before, after, fitAuthoring.scope, null, "Adjust default fit");
      },
      onSlotTransformPreview: (slotId, transform) => {
        const st = useStore.getState();
        const eid = st.project.activeEntityId;
        const ent = eid ? st.project.entities.find(e => e.id === eid) : null;
        if (ent) previewTemplateSlotTransform(ent.templateId, slotId, transform);
      },
      onSlotTransformCommit: (slotId, beforeTransform, afterTransform) => {
        const st = useStore.getState();
        const eid = st.project.activeEntityId;
        const ent = eid ? st.project.entities.find(e => e.id === eid) : null;
        if (ent) commitTemplateSlotTransform(ent.templateId, slotId, beforeTransform, afterTransform);
      },
    });
    setInitialized(true);
    return () => { engineRef.current?.destroy(); engineRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialized || !engineRef.current) {
      return;
    }

    if (!engineRef.current.isTransforming) {
      engineRef.current.commitPendingEdits();
    }
    engineRef.current.setMode(editor.canvasMode);
  }, [initialized, editor.canvasMode]);

  useEffect(() => {
    if (editor.canvasMode !== "select" && animPlayback.playing) {
      setPlaybackPlaying(false);
    }
  }, [animPlayback.playing, editor.canvasMode, setPlaybackPlaying]);

  useEffect(() => {
    if (activeAuthoringMode !== "body-morph") return;
    if (bodyAuthoring.intent === "preview" && !animPlayback.playing) {
      setPlaybackPlaying(true);
      return;
    }
    if (bodyAuthoring.intent === "inspect" && animPlayback.playing) {
      setPlaybackPlaying(false);
    }
  }, [activeAuthoringMode, animPlayback.playing, bodyAuthoring.intent, setPlaybackPlaying]);

  useEffect(() => {
    if (!activeEntity || activeAuthoringMode !== "body-morph") return;
    if (!bodyAuthoring.activeBoneId) return;
    const selection = editor.selection;
    const matchesSelection = selection.kind === "bone"
      && selection.entityId === activeEntity.id
      && selection.boneId === bodyAuthoring.activeBoneId;
    if (!matchesSelection) {
      setEditorSelection({
        kind: "bone",
        entityId: activeEntity.id,
        boneId: bodyAuthoring.activeBoneId,
      });
      setSelectedSlot(bodyAuthoring.activeSlotId ?? null);
      setCanvasMode("select");
    }
  }, [
    activeAuthoringMode,
    activeEntity,
    bodyAuthoring.activeBoneId,
    bodyAuthoring.activeSlotId,
    editor.selection,
    setCanvasMode,
    setEditorSelection,
    setSelectedSlot,
  ]);

  useEffect(() => {
    if (!activeEntity || activeAuthoringMode !== "face-editor") return;
    const slotId = faceAuthoring.activeSlotId ?? (activeFaceFeature ? FACE_FEATURE_SLOT[activeFaceFeature] : null);
    if (faceAuthoring.workflowMode === "overlay" && faceAuthoring.selectedOverlayId) {
      const selection = editor.selection;
      const matchesSelection = selection.kind === "face-overlay"
        && selection.entityId === activeEntity.id
        && selection.overlayId === faceAuthoring.selectedOverlayId;
      if (!matchesSelection) {
        setEditorSelection({
          kind: "face-overlay",
          entityId: activeEntity.id,
          overlayId: faceAuthoring.selectedOverlayId,
          featureKey: activeFaceFeature ?? "generic",
          slotId,
        });
      }
      setSelectedSlot(slotId);
      setCanvasMode("select");
      return;
    }

    const selection = editor.selection;
    const matchesHeadSelection = selection.kind === "bone"
      && selection.entityId === activeEntity.id
      && selection.boneId === "head";
    if (!matchesHeadSelection) {
      setEditorSelection({
        kind: "bone",
        entityId: activeEntity.id,
        boneId: "head",
      });
    }
    setSelectedSlot(slotId);
    setCanvasMode("select");
  }, [
    activeAuthoringMode,
    activeEntity,
    activeFaceFeature,
    editor.selection,
    faceAuthoring.activeSlotId,
    faceAuthoring.selectedOverlayId,
    faceAuthoring.workflowMode,
    setCanvasMode,
    setEditorSelection,
    setSelectedSlot,
  ]);

  const nudgeActiveFaceOverlay = useCallback((patch: Partial<{ x: number; y: number; rotation: number; scaleX: number; scaleY: number }>) => {
    if (!activeEntity || !activeFaceOverlay) return;
    const featureKey = activeFaceOverlay.featureTag ?? "generic";
    const slotId = featureKey === "generic" ? null : FACE_FEATURE_SLOT[featureKey];
    setEntityFaceAuthoringState(activeEntity.id, {
      activeFeatureKey: featureKey,
      overlayFilter: featureKey,
      selectedOverlayId: activeFaceOverlay.id,
      activeSlotId: slotId,
      activeBoneId: "head",
      focusMode: "head",
    });
    setActiveFaceCanvasOverlay(activeFaceOverlay.id);
    setEditorSelection({
      kind: "face-overlay",
      entityId: activeEntity.id,
      overlayId: activeFaceOverlay.id,
      featureKey,
      slotId,
    });
    setSelectedSlot(slotId);
    setEntityFaceOverlayTransform(activeEntity.id, activeFaceOverlay.id, patch);
  }, [activeEntity, activeFaceOverlay, setActiveFaceCanvasOverlay, setEditorSelection, setEntityFaceAuthoringState, setEntityFaceOverlayTransform, setSelectedSlot]);

  const openFaceOverlayEditor = useCallback((overlayId?: string | null, tool: "select" | "pencil" | "closed-pencil" | "fill" | "eraser" | null = null, focusMode: "document" | "head" = "document") => {
      if (!activeEntity) return;
    const overlay = (overlayId
      ? faceOverlays.find(candidate => candidate.id === overlayId)
      : activeFaceOverlay) ?? null;
    if (!overlay) return;
    const featureKey = overlay.featureTag ?? "generic";
    const slotId = featureKey === "generic" ? null : FACE_FEATURE_SLOT[featureKey];
      setEntityFaceAuthoringState(activeEntity.id, {
        activeFeatureKey: featureKey,
        overlayFilter: featureKey,
        selectedOverlayId: overlay.id,
        activeBoneId: "head",
        activeSlotId: slotId,
        drawMode: tool,
        focusMode,
      });
      setActiveFaceCanvasOverlay(overlay.id);
      setActiveFaceCanvasTool(tool);
      setActiveFaceCanvasFocusMode(focusMode);
    setSelectedSlot(slotId);
    setEditorSelection({
      kind: "face-overlay",
      entityId: activeEntity.id,
      overlayId: overlay.id,
      featureKey,
      slotId,
    });
    const doc = createDocumentFromFaceOverlay(activeEntity.id, overlay);
    upsertSpriteEditorDocument(doc);
    setActiveSpriteDocument(doc.id);
    setActiveAuthoringMode("sprite-editor");
    setAnimBottomTab("authoring");
    setCanvasMode("select");
  }, [activeEntity, activeFaceOverlay, faceOverlays, setActiveAuthoringMode, setActiveFaceCanvasFocusMode, setActiveFaceCanvasOverlay, setActiveFaceCanvasTool, setActiveSpriteDocument, setAnimBottomTab, setCanvasMode, setEditorSelection, setEntityFaceAuthoringState, setSelectedSlot, upsertSpriteEditorDocument]);

  const createFaceOverlayDraftFromCanvas = useCallback((tool: "select" | "pencil" | "closed-pencil" | "fill" | "eraser" | null = "pencil", focusMode: "document" | "head" = "head") => {
      if (!activeEntity || !activeFaceFeature) return;
    const doc = createDocumentFromFaceOverlay(activeEntity.id);
    const overlayId = doc.target.overlayId ?? `face_overlay_${doc.id}`;
    const slotId = FACE_FEATURE_SLOT[activeFaceFeature];
      setEntityFaceAuthoringState(activeEntity.id, {
        activeFeatureKey: activeFaceFeature,
        overlayFilter: activeFaceFeature,
        selectedOverlayId: overlayId,
        activeBoneId: "head",
        activeSlotId: slotId,
        drawMode: tool,
        focusMode,
      });
      setActiveFaceCanvasOverlay(overlayId);
      setActiveFaceCanvasTool(tool);
      setActiveFaceCanvasFocusMode(focusMode);
    setSelectedSlot(slotId);
    setEditorSelection({
      kind: "face-overlay",
      entityId: activeEntity.id,
      overlayId,
      featureKey: activeFaceFeature,
      slotId,
    });
    upsertSpriteEditorDocument({
      ...doc,
      authoringHint: {
        ...doc.authoringHint,
        faceFeatureKey: activeFaceFeature,
        faceOverlayRole: activeFaceFeature === "hair" || activeFaceFeature === "beard"
          ? "base"
          : activeFaceFeature === "brows" || activeFaceFeature === "mouth"
            ? "line"
            : "detail",
        symmetryMode: activeFaceFeature === "eyes" || activeFaceFeature === "brows" ? "mirror_x" : "none",
        paintToolPreset: "vector_brush",
      },
    });
    setActiveSpriteDocument(doc.id);
    setActiveAuthoringMode("sprite-editor");
    setAnimBottomTab("authoring");
    setCanvasMode("select");
  }, [activeEntity, activeFaceFeature, setActiveAuthoringMode, setActiveFaceCanvasFocusMode, setActiveFaceCanvasOverlay, setActiveFaceCanvasTool, setActiveSpriteDocument, setAnimBottomTab, setCanvasMode, setEditorSelection, setEntityFaceAuthoringState, setSelectedSlot, upsertSpriteEditorDocument]);

  useEffect(() => {
    if (!activeEntity || !template) return;
    const selection = editor.selection;

    const bodyPatch: Partial<{ focusRegion: BodyMorphRegionId; activeBoneId: string | null; activeSlotId: string | null }> = {};
    const facePatch: Partial<{
      activeFeatureKey: FaceFeatureKey | "generic" | null;
      overlayFilter: FaceFeatureKey | "generic" | "all";
      selectedOverlayId: string | null;
      activeBoneId: string | null;
      activeSlotId: string | null;
      workflowMode: "feature" | "overlay";
      focusMode: "document" | "head";
    }> = {};

    if (selection.kind === "bone" && selection.entityId === activeEntity.id) {
      bodyPatch.focusRegion = getBodyRegionFromBoneId(selection.boneId);
      bodyPatch.activeBoneId = selection.boneId;
      bodyPatch.activeSlotId = null;
      if (selection.boneId === "head") {
        facePatch.activeBoneId = "head";
        facePatch.focusMode = "head";
        facePatch.workflowMode = "feature";
      }
    }

    if (selection.kind === "entity-visual" && selection.entityId === activeEntity.id) {
      const selectedVisual = (activeEntity.visuals ?? []).find(visual => visual.id === selection.visualId);
      if (selectedVisual) {
        bodyPatch.focusRegion = getBodyRegionFromBoneId(selectedVisual.boneId);
        bodyPatch.activeBoneId = selectedVisual.boneId;
        bodyPatch.activeSlotId = null;
        if (selectedVisual.boneId === "head") {
          facePatch.activeBoneId = "head";
          facePatch.focusMode = "head";
          facePatch.workflowMode = "feature";
        }
      }
    }

    const selectedSlotId = (
      selection.kind === "item-part"
      || selection.kind === "equipped-item"
      || selection.kind === "template-slot"
      || selection.kind === "face-overlay"
    )
      ? selection.slotId
      : null;
    const selectedSlotDef = selectedSlotId
      ? template.slots.find(slot => slot.id === selectedSlotId)
      : null;
    if (selectedSlotDef) {
      bodyPatch.focusRegion = getBodyRegionFromBoneId(selectedSlotDef.boneId);
      bodyPatch.activeBoneId = selectedSlotDef.boneId;
      bodyPatch.activeSlotId = selectedSlotDef.id;
      const featureFromSlot = getFaceFeatureFromSlotId(selectedSlotDef.id);
      if (featureFromSlot) {
        facePatch.activeFeatureKey = featureFromSlot;
        facePatch.overlayFilter = featureFromSlot;
        facePatch.activeSlotId = selectedSlotDef.id;
        facePatch.activeBoneId = "head";
        facePatch.workflowMode = "feature";
      }
    }

    if (selection.kind === "face-overlay" && selection.entityId === activeEntity.id) {
      facePatch.activeFeatureKey = selection.featureKey;
      facePatch.overlayFilter = selection.featureKey;
      facePatch.selectedOverlayId = selection.overlayId;
      facePatch.activeSlotId = selection.slotId;
      facePatch.activeBoneId = "head";
      facePatch.focusMode = "head";
      facePatch.workflowMode = "overlay";
      bodyPatch.focusRegion = "head";
      bodyPatch.activeBoneId = "head";
      bodyPatch.activeSlotId = selection.slotId;
    }

    if (
      bodyPatch.focusRegion !== undefined &&
      (
        bodyPatch.focusRegion !== bodyAuthoring.focusRegion
        || (bodyPatch.activeBoneId ?? null) !== (bodyAuthoring.activeBoneId ?? null)
        || (bodyPatch.activeSlotId ?? null) !== (bodyAuthoring.activeSlotId ?? null)
      )
    ) {
      setEntityBodyAuthoringState(activeEntity.id, {
        focusRegion: bodyPatch.focusRegion,
        activeBoneId: bodyPatch.activeBoneId ?? null,
        activeSlotId: bodyPatch.activeSlotId ?? null,
      });
    }

    const shouldUpdateFace = Object.entries(facePatch).some(([key, value]) => {
      const currentValue = (faceAuthoring as unknown as Record<string, unknown>)[key];
      return (currentValue ?? null) !== (value ?? null);
    });
    if (shouldUpdateFace) {
      setEntityFaceAuthoringState(activeEntity.id, facePatch);
    }
  }, [
    activeEntity,
    bodyAuthoring.activeBoneId,
    bodyAuthoring.focusRegion,
    editor.selection,
    faceAuthoring,
    setEntityBodyAuthoringState,
    setEntityFaceAuthoringState,
    template,
  ]);

  // Ref to latest reconcile fn for ResizeObserver
  const rerenderRef = useRef<(() => void) | null>(null);

  // ── Heavy effect: entity / palette / slots / visuals / selectedSlot change ─
  useEffect(() => {
    if (!initialized || !engineRef.current) return;

    const doReconcile = async () => {
      if (!engineRef.current) return;

      if (!engineRef.current.isTransforming) {
        engineRef.current.commitPendingEdits();
      }
      const store = useStore.getState();
      const liveEntity = store.project.entities.find(e => e.id === store.project.activeEntityId);
      const liveTemplate = liveEntity
        ? resolveTemplate(store.project, liveEntity.templateId)
        : undefined;

      if (!liveEntity || !liveTemplate) {
        engineRef.current.renderEmpty("Select an entity to view it here");
        cameraDirtyRef.current = false;
        return;
      }

      const effectiveItems = refreshCanonicalBuiltInTypedItems(store.project.items);
      const pose  = buildMultiClipPose(
        store.project.animationClips,
        store.animPlayback.activeClipId,
        store.animPlayback.upperClipId,
        store.animPlayback.lowerClipId,
        store.animPlayback.upperBlendWeight,
        store.animPlayback.timeMs,
        liveEntity,
        effectiveItems,
      );
      const skeleton = evaluateSkeleton(liveTemplate.bones, pose, liveEntity.bodyMorphs);
      const scene    = evaluateScene(liveEntity, liveTemplate, skeleton, effectiveItems, store.project.itemFitProfiles);

      const itemsArr = effectiveItems;
      await engineRef.current.reconcileSceneStructure(
        scene,
        liveTemplate,
        editor.selectedSlotId,
        itemsArr,
        store.project.itemFitProfiles,
        liveEntity,
        store.project.editorMeta.slotEditorByTemplateId[liveTemplate.id] ?? { hiddenSlotIds: [], lockedSlotIds: [] },
      );

      // Re-apply viewport after reconcile (new visuals reset internal state)
      engineRef.current.setViewport(vpRef.current.zoom, vpRef.current.panX, vpRef.current.panY);

      // Auto-fit on first render for this entity
      if (cameraDirtyRef.current) {
        cameraDirtyRef.current = false;
        const cam = engineRef.current.fitScene(scene, liveTemplate);
        applyViewport(cam);
      }
    };

    rerenderRef.current = () => { doReconcile(); };
    doReconcile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initialized,
    project.activeEntityId,
    JSON.stringify(activeEntity?.slots),
    JSON.stringify(activeEntity?.palette),
    JSON.stringify(activeEntity?.visuals),
    JSON.stringify(template?.slots),
    JSON.stringify(slotEditorState),
    activeEntity?.styleSetId,
    editor.selectedSlotId,
  ]);

  // ── Animation tick (≈12fps) — fast transforms only, no SVG loading ────────
  useEffect(() => {
    if (!initialized) return;
    const remove = animController.addSyncListener(() => {
      if (!engineRef.current) return;
      const store = useStore.getState();
      const eid   = store.project.activeEntityId;
      const ent   = store.project.entities.find(e => e.id === eid);
      const tmpl  = ent ? resolveTemplate(store.project, ent.templateId) : null;
      if (!ent || !tmpl) return;

      const effectiveItems = refreshCanonicalBuiltInTypedItems(store.project.items);
      const pose = buildMultiClipPose(
        store.project.animationClips,
        store.animPlayback.activeClipId,
        store.animPlayback.upperClipId,
        store.animPlayback.lowerClipId,
        store.animPlayback.upperBlendWeight,
        store.animPlayback.timeMs,
        ent,
        effectiveItems,
      );
      const skeleton = evaluateSkeleton(tmpl.bones, pose, ent.bodyMorphs);
      const scene    = evaluateScene(ent, tmpl, skeleton, effectiveItems, store.project.itemFitProfiles);
      engineRef.current.updateSceneTransforms(scene);
    });
    return remove;
  }, [initialized]);

  // ── Resize observer ───────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0 && engineRef.current) {
          engineRef.current.resize(width, height);
          rerenderRef.current?.();
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [initialized]);

  // ── Pan handlers ──────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const isMid     = e.button === 1;
    const isAltLeft = e.button === 0 && e.altKey;
    if (!isMid && !isAltLeft) return;
    e.preventDefault();
    isPanning.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    applyViewport(p => ({ ...p, panX: p.panX + dx, panY: p.panY + dy }));
  }, [applyViewport]);

  const stopPan = useCallback(() => { isPanning.current = false; }, []);

  const onAuxClick = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) e.preventDefault();
  }, []);

  // Alt cursor hint
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === "Alt") setAltHeld(true); };
    const up   = (e: KeyboardEvent) => { if (e.key === "Alt") setAltHeld(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup",   up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  // ── Fit / Reset view ─────────────────────────────────────────────────────
  const fitView = useCallback(() => {
    if (!engineRef.current || !activeEntity || !template) {
      applyViewport({ zoom: 1, panX: 0, panY: 0 });
      return;
    }
    const store    = useStore.getState();
    const effectiveItems = refreshCanonicalBuiltInTypedItems(store.project.items);
    const skeleton = evaluateSkeleton(template.bones, new Map(), activeEntity.bodyMorphs);
    const scene    = evaluateScene(activeEntity, template, skeleton, effectiveItems, store.project.itemFitProfiles);
    const cam      = engineRef.current.fitScene(scene, template);
    applyViewport(cam);
  }, [activeEntity, template, applyViewport]);

  const focusAuthoringView = useCallback(() => {
    if (!engineRef.current || !activeEntity || !template || !containerRef.current) return;

    const store = useStore.getState();
    const effectiveItems = refreshCanonicalBuiltInTypedItems(store.project.items);
    const pose = buildMultiClipPose(
      store.project.animationClips,
      store.animPlayback.activeClipId,
      store.animPlayback.upperClipId,
      store.animPlayback.lowerClipId,
      store.animPlayback.upperBlendWeight,
      store.animPlayback.timeMs,
      activeEntity,
      effectiveItems,
    );
    const skeleton = evaluateSkeleton(template.bones, pose, activeEntity.bodyMorphs);
    const scene = evaluateScene(activeEntity, template, skeleton, effectiveItems, store.project.itemFitProfiles);
    const viewportW = containerRef.current.clientWidth || 600;
    const viewportH = containerRef.current.clientHeight || 500;

    let focusVisuals = scene.visuals;
    let padding = 0.12;

    if (activeAuthoringMode === "body-morph") {
      if (bodyAuthoring.viewportMode === "focus_region") {
        const regionalVisuals = scene.visuals.filter(visual => visualMatchesBodyRegion(visual, bodyAuthoring.focusRegion));
        if (regionalVisuals.length > 0) {
          focusVisuals = regionalVisuals;
          padding = bodyAuthoring.focusRegion === "global" ? 0.12 : 0.2;
        }
      }
    } else if (activeAuthoringMode === "face-editor" && faceAuthoring.focusMode === "head") {
      padding = 0.22;
      if (faceAuthoring.workflowMode === "overlay" && faceAuthoring.selectedOverlayId) {
        const overlayVisuals = scene.visuals.filter(visual => visual.entityVisualId === faceAuthoring.selectedOverlayId);
        if (overlayVisuals.length > 0) {
          focusVisuals = overlayVisuals;
          padding = 0.32;
        }
      } else {
        const featureVisualIds = new Set<string>();
        if (activeFaceFeature) {
          featureVisualIds.add(`face__${activeFaceFeature}`);
          for (const overlay of faceOverlays) {
            if ((overlay.featureTag ?? "generic") === activeFaceFeature) {
              featureVisualIds.add(overlay.id);
            }
          }
        }
        const faceVisuals = scene.visuals.filter(visual => {
          if (featureVisualIds.size > 0) {
            return featureVisualIds.has(visual.entityVisualId ?? "");
          }
          return visual.boneId === "head" || visual.boneId === "neck";
        });
        if (faceVisuals.length > 0) {
          focusVisuals = faceVisuals;
          padding = 0.26;
        }
      }
    }

    const bounds = computeSceneBounds(focusVisuals, template.previewWidth, template.previewHeight);
    const cam = fitSceneToViewport(bounds, viewportW, viewportH, padding);
    applyViewport(cam);
  }, [
    activeAuthoringMode,
    activeEntity,
    activeFaceFeature,
    applyViewport,
    bodyAuthoring.focusRegion,
    bodyAuthoring.viewportMode,
    faceAuthoring.focusMode,
    faceAuthoring.selectedOverlayId,
    faceAuthoring.workflowMode,
    faceOverlays,
    template,
  ]);

  useEffect(() => {
    if (!activeAuthoringMode) return;
    if (activeAuthoringMode === "face-editor" && faceAuthoring.focusMode !== "head") return;
    focusAuthoringView();
  }, [
    activeAuthoringMode,
    bodyAuthoring.focusRegion,
    bodyAuthoring.viewportMode,
    faceAuthoring.focusMode,
    faceAuthoring.selectedOverlayId,
    faceAuthoring.workflowMode,
    activeFaceFeature,
    focusAuthoringView,
  ]);

  // ── Wheel zoom towards cursor ─────────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    // pivotX/Y relative to viewport centre (matches new setViewport formula)
    const pivotX = e.clientX - rect.left  - rect.width  / 2;
    const pivotY = e.clientY - rect.top   - rect.height / 2;
    const delta  = e.ctrlKey ? e.deltaY * 0.005 : e.deltaY * 0.001;
    const factor = Math.exp(-delta);
    applyViewport(prev => {
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.zoom * factor));
      // Keep template point under cursor fixed: newPanX = pivotX - (pivotX - panX)*next/prev
      return {
        zoom: next,
        panX: pivotX - (pivotX - prev.panX) * (next / prev.zoom),
        panY: pivotY - (pivotY - prev.panY) * (next / prev.zoom),
      };
    });
  }, [applyViewport]);

  const cursor = isPanning.current ? "grabbing" : altHeld ? "grab" : "default";

  const nudgeActiveFaceFeature = useCallback((
    patch: Partial<{ x: number; y: number; rotation: number; scaleX: number; scaleY: number }>,
  ) => {
    if (!activeEntity || !activeFaceFeature) return;
    const slotId = FACE_FEATURE_SLOT[activeFaceFeature];
    setEntityFaceAuthoringState(activeEntity.id, {
      activeFeatureKey: activeFaceFeature,
      overlayFilter: activeFaceFeature,
      selectedOverlayId: faceAuthoring.selectedOverlayId ?? null,
      activeSlotId: slotId,
      activeBoneId: "head",
      focusMode: "head",
    });
    setEntityFaceFeatureTransform(activeEntity.id, activeFaceFeature, patch);
  }, [activeEntity, activeFaceFeature, faceAuthoring.selectedOverlayId, setEntityFaceAuthoringState, setEntityFaceFeatureTransform]);

  return (
    <div
      data-testid="canvas-panel"
      ref={containerRef}
      className="relative flex-1 min-w-0 bg-[#1e1e2e] overflow-hidden"
      style={{ cursor }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={stopPan}
      onMouseLeave={stopPan}
      onAuxClick={onAuxClick}
      onWheel={onWheel}
    >
      {/* Canvas — no CSS transform; Fabric viewport handles zoom/pan */}
      <canvas ref={canvasRef} className="absolute inset-0" />

      <TooltipProvider delayDuration={150}>
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1 rounded-lg border border-border bg-card/85 p-1 backdrop-blur">
          {MODE_BUTTONS.map(({ mode, label, title, icon: Icon }) => {
            const active = editor.canvasMode === mode;
            return (
              <Tooltip key={mode}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant={active ? "default" : "secondary"}
                    className={[
                      "h-8 gap-1.5 px-2.5 text-xs",
                      active ? "shadow-sm" : "bg-card/70",
                    ].join(" ")}
                    onClick={() => setCanvasMode(mode)}
                    aria-pressed={active}
                    data-testid={`canvas-mode-${mode}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{label}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {title}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1 z-10">
        <Button
          data-testid="canvas-zoom-in"
          size="icon" variant="secondary"
          className="h-7 w-7 bg-card/80 backdrop-blur border-border hover:bg-card"
          onClick={() => applyViewport(p => ({ ...p, zoom: Math.min(p.zoom * 1.25, MAX_ZOOM) }))}
        ><ZoomIn className="w-3.5 h-3.5" /></Button>
        <Button
          data-testid="canvas-zoom-out"
          size="icon" variant="secondary"
          className="h-7 w-7 bg-card/80 backdrop-blur border-border hover:bg-card"
          onClick={() => applyViewport(p => ({ ...p, zoom: Math.max(p.zoom * 0.8, MIN_ZOOM) }))}
        ><ZoomOut className="w-3.5 h-3.5" /></Button>
        <Button
          data-testid="canvas-zoom-reset"
          size="icon" variant="secondary"
          className="h-7 w-7 bg-card/80 backdrop-blur border-border hover:bg-card"
          onClick={fitView}
          title="Fit entity in view"
        ><Maximize2 className="w-3.5 h-3.5" /></Button>
      </div>

      {/* Zoom / pan info badge */}
      <div className="absolute bottom-3 left-3 z-10">
        <span className="text-[10px] text-muted-foreground bg-card/60 backdrop-blur px-1.5 py-0.5 rounded tabular-nums">
          {Math.round(vp.zoom * 100)}%
          {(vp.panX !== 0 || vp.panY !== 0) && (
            <span className="ml-1 opacity-60">
              {vp.panX > 0 ? "+" : ""}{Math.round(vp.panX)},{vp.panY > 0 ? "+" : ""}{Math.round(vp.panY)}
            </span>
          )}
        </span>
      </div>

      {/* Pan hint */}
      <div className="absolute top-3 right-3 z-10 pointer-events-none">
        <span className="text-[10px] text-muted-foreground/40">
          Wheel-click or Alt+drag to pan
        </span>
      </div>

      {/* No entity placeholder */}
      {!activeEntity && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-sm text-muted-foreground/50">Select or create an entity</p>
          <p className="text-xs text-muted-foreground/30 mt-1">to preview it here</p>
        </div>
      )}

      {/* Active slot indicator */}
      {editor.selectedSlotId && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-primary/90 text-primary-foreground text-xs rounded-full px-3 py-1 shadow-lg animate-bounce">
            Slot selected — pick an item from the library
          </div>
        </div>
      )}

      {activeEntity && activeAuthoringMode && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-10">
          <div className="rounded-lg border border-border bg-card/85 px-3 py-2 text-[11px] text-muted-foreground backdrop-blur">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">
                {activeAuthoringMode === "body-morph" ? "Body Workflow" : activeAuthoringMode === "face-editor" ? "Face Workflow" : "Authoring"}
              </span>
              {activeAuthoringMode === "body-morph" && (
                <span>
                  focus: {BODY_REGION_LABELS[bodyAuthoring.focusRegion]}
                  {bodyAuthoring.activeBoneId ? ` · bone ${bodyAuthoring.activeBoneId}` : ""}
                  {bodyAuthoring.intent ? ` · ${bodyAuthoring.intent}` : ""}
                  {bodyAuthoring.viewportMode ? ` · ${bodyAuthoring.viewportMode}` : ""}
                </span>
              )}
              {activeAuthoringMode === "face-editor" && (
                <span>
                  feature: {activeFaceFeature ? FACE_FEATURE_LABELS[activeFaceFeature] : "Generic"}
                  {faceAuthoring.activeSlotId ? ` · slot ${faceAuthoring.activeSlotId}` : ""}
                  {faceAuthoring.workflowMode ? ` · ${faceAuthoring.workflowMode}` : ""}
                </span>
              )}
              {faceAuthoring.overlayFilter !== "all" && activeAuthoringMode === "face-editor" && (
                <span>overlay filter: {faceAuthoring.overlayFilter}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {activeEntity && (
        <div className="absolute top-14 left-3 z-10 flex flex-col gap-2">
          <div className="rounded-lg border border-border bg-card/85 p-2 backdrop-blur">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Body Focus</div>
            <div className="grid grid-cols-3 gap-1">
              {(Object.keys(BODY_REGION_LABELS) as BodyMorphRegionId[]).map(region => (
                <Button
                  key={region}
                  type="button"
                  size="sm"
                  variant={bodyAuthoring.focusRegion === region ? "default" : "secondary"}
                  className="h-7 px-2 text-[10px]"
                  onClick={() => {
                    setEntityBodyAuthoringState(activeEntity.id, {
                      focusRegion: region,
                      activeBoneId: BODY_REGION_BONE[region],
                    });
                    setActiveAuthoringMode("body-morph");
                    setEditorSelection({
                      kind: "bone",
                      entityId: activeEntity.id,
                      boneId: BODY_REGION_BONE[region],
                    });
                    setSelectedSlot(null);
                    setCanvasMode("select");
                    fitView();
                  }}
                >
                  {BODY_REGION_LABELS[region]}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card/85 p-2 backdrop-blur">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Face Focus</div>
            <div className="grid grid-cols-3 gap-1">
              {(Object.keys(FACE_FEATURE_LABELS) as FaceFeatureKey[]).map(featureKey => (
                <Button
                  key={featureKey}
                  type="button"
                  size="sm"
                  variant={activeFaceFeature === featureKey ? "default" : "secondary"}
                  className="h-7 px-2 text-[10px]"
                  onClick={() => {
                    const slotId = FACE_FEATURE_SLOT[featureKey];
                    setEntityFaceAuthoringState(activeEntity.id, {
                      activeFeatureKey: featureKey,
                      overlayFilter: featureKey,
                      selectedOverlayId: null,
                      activeBoneId: "head",
                      activeSlotId: slotId,
                      focusMode: "head",
                    });
                    setActiveAuthoringMode("face-editor");
                    setSelectedSlot(slotId);
                    setEditorSelection({
                      kind: "bone",
                      entityId: activeEntity.id,
                      boneId: "head",
                    });
                    setCanvasMode("select");
                    fitView();
                  }}
                >
                  {FACE_FEATURE_LABELS[featureKey]}
                </Button>
              ))}
            </div>
          </div>

          {activeFaceFeature && (
            <div className="rounded-lg border border-border bg-card/85 p-2 backdrop-blur">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Face Local
                </div>
                <div className="text-[10px] text-foreground">
                  {FACE_FEATURE_LABELS[activeFaceFeature]}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-[10px]" onClick={() => nudgeActiveFaceFeature({ x: -1 })}>Left</Button>
                <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-[10px]" onClick={() => nudgeActiveFaceFeature({ y: -1 })}>Up</Button>
                <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-[10px]" onClick={() => nudgeActiveFaceFeature({ x: 1 })}>Right</Button>
                <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-[10px]" onClick={() => nudgeActiveFaceFeature({ rotation: -5 })}>Rot -</Button>
                <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-[10px]" onClick={() => nudgeActiveFaceFeature({ y: 1 })}>Down</Button>
                <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-[10px]" onClick={() => nudgeActiveFaceFeature({ rotation: 5 })}>Rot +</Button>
                <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-[10px]" onClick={() => nudgeActiveFaceFeature({ scaleX: 0.95, scaleY: 0.95 })}>Scale -</Button>
                <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-[10px]" onClick={() => nudgeActiveFaceFeature({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 })}>Reset</Button>
                <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-[10px]" onClick={() => nudgeActiveFaceFeature({ scaleX: 1.05, scaleY: 1.05 })}>Scale +</Button>
              </div>
              <div className="mt-2 space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Overlay Focus</div>
                {visibleFaceOverlays.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground">No overlays for this feature.</div>
                ) : (
                  <div className="space-y-1">
                    {visibleFaceOverlays.map(overlay => (
                      <Button
                        key={overlay.id}
                        type="button"
                        size="sm"
                        variant={faceAuthoring.selectedOverlayId === overlay.id ? "default" : "secondary"}
                        className="h-7 w-full justify-start px-2 text-[10px]"
                        onClick={() => {
                          const featureKey = overlay.featureTag ?? "generic";
                          const slotId = featureKey === "generic" ? null : FACE_FEATURE_SLOT[featureKey];
                          setEntityFaceAuthoringState(activeEntity.id, {
                            activeFeatureKey: featureKey,
                            overlayFilter: featureKey,
                            selectedOverlayId: overlay.id,
                            activeBoneId: "head",
                            activeSlotId: slotId,
                            focusMode: "head",
                          });
                          setSelectedSlot(slotId);
                          setEditorSelection({
                            kind: "face-overlay",
                            entityId: activeEntity.id,
                            overlayId: overlay.id,
                            featureKey,
                            slotId,
                          });
                          setActiveAuthoringMode("face-editor");
                          setCanvasMode("select");
                        }}
                      >
                        {overlay.name}
                      </Button>
                    ))}
                  </div>
                )}
                {activeFaceOverlay && (
                  <div className="rounded border border-border bg-background/60 px-2 py-1 text-[10px] text-muted-foreground">
                    selected overlay: <span className="text-foreground">{activeFaceOverlay.name}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7 px-2 text-[10px]"
                    onClick={() => openFaceOverlayEditor(undefined, "select", "document")}
                    disabled={!activeFaceOverlay}
                  >
                    Open Overlay Editor
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7 px-2 text-[10px]"
                    onClick={() => createFaceOverlayDraftFromCanvas("pencil", "head")}
                    disabled={!activeFaceFeature}
                  >
                    New Overlay Draft
                  </Button>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7 w-full px-2 text-[10px]"
                  onClick={() => activeFaceOverlay ? openFaceOverlayEditor(activeFaceOverlay.id, "pencil", "head") : createFaceOverlayDraftFromCanvas("pencil", "head")}
                >
                  Draw On Head
                </Button>
                <div className="grid grid-cols-4 gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={activeFaceCanvasTool === "pencil" ? "default" : "secondary"}
                    className="h-7 px-2 text-[10px]"
                      onClick={() => activeFaceOverlay ? openFaceOverlayEditor(activeFaceOverlay.id, "pencil", "head") : createFaceOverlayDraftFromCanvas("pencil", "head")}
                  >
                    Draw
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={activeFaceCanvasTool === "closed-pencil" ? "default" : "secondary"}
                    className="h-7 px-2 text-[10px]"
                      onClick={() => activeFaceOverlay ? openFaceOverlayEditor(activeFaceOverlay.id, "closed-pencil", "head") : createFaceOverlayDraftFromCanvas("closed-pencil", "head")}
                  >
                    Shape
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={activeFaceCanvasTool === "fill" ? "default" : "secondary"}
                    className="h-7 px-2 text-[10px]"
                      onClick={() => activeFaceOverlay ? openFaceOverlayEditor(activeFaceOverlay.id, "fill", "head") : createFaceOverlayDraftFromCanvas("fill", "head")}
                  >
                    Fill
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={activeFaceCanvasTool === "eraser" ? "default" : "secondary"}
                    className="h-7 px-2 text-[10px]"
                      onClick={() => activeFaceOverlay ? openFaceOverlayEditor(activeFaceOverlay.id, "eraser", "head") : createFaceOverlayDraftFromCanvas("eraser", "head")}
                  >
                    Erase
                  </Button>
                </div>
                {activeFaceOverlay && (
                  <div className="mt-2 space-y-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Overlay Local</div>
                    <div className="grid grid-cols-3 gap-1">
                      <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-[10px]" onClick={() => nudgeActiveFaceOverlay({ x: -1 })}>Left</Button>
                      <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-[10px]" onClick={() => nudgeActiveFaceOverlay({ y: -1 })}>Up</Button>
                      <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-[10px]" onClick={() => nudgeActiveFaceOverlay({ x: 1 })}>Right</Button>
                      <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-[10px]" onClick={() => nudgeActiveFaceOverlay({ rotation: -5 })}>Rot -</Button>
                      <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-[10px]" onClick={() => nudgeActiveFaceOverlay({ y: 1 })}>Down</Button>
                      <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-[10px]" onClick={() => nudgeActiveFaceOverlay({ rotation: 5 })}>Rot +</Button>
                      <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-[10px]" onClick={() => nudgeActiveFaceOverlay({ scaleX: activeFaceOverlay.localTransform.scaleX * 0.95, scaleY: activeFaceOverlay.localTransform.scaleY * 0.95 })}>Scale -</Button>
                      <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-[10px]" onClick={() => nudgeActiveFaceOverlay({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 })}>Reset</Button>
                      <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-[10px]" onClick={() => nudgeActiveFaceOverlay({ scaleX: activeFaceOverlay.localTransform.scaleX * 1.05, scaleY: activeFaceOverlay.localTransform.scaleY * 1.05 })}>Scale +</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
