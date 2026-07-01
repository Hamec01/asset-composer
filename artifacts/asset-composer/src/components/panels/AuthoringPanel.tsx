import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { resolveTemplate } from "@/data/templates";
import { renderFrameToCanvas } from "@/lib/frameRenderer";
import { sanitizeSvg } from "@/lib/sanitize";
import { parseMetrics } from "@/lib/svgMetrics";
import {
  buildPathDataFromPoints,
  computeShapeBounds,
  computeDocumentContentBounds,
  createFreehandPathShape,
  createDefaultShape,
  createDocumentFromEntityVisual,
  createDocumentFromFaceOverlay,
  createDocumentFromItemPart,
  createEmptySpriteLayer,
  flipSpriteShape,
  hitTestSpriteDocument,
  resizeSpriteShape,
  spriteEditorDocumentToSvg,
  translateSpriteShape,
} from "@/lib/spriteEditor";
import type {
  BodyAuthoringIntent,
  BodyAuthoringViewportMode,
  BodyMorphRegionId,
  BodyMorphValues,
  FaceCanvasFocusMode,
  FaceCustomization,
  FaceFeatureKey,
  FaceOverlayRole,
  FaceAuthoringTool,
  FaceAuthoringWorkflowMode,
  FaceOverlay,
  SpriteEditorSymmetryMode,
  SpriteEditorDocument,
  SpriteEditorPaintTarget,
  SpriteEditorShape,
} from "@/domain/types";

const SHAPE_LABELS: Record<SpriteEditorShape["type"], string> = {
  rect: "Rect",
  ellipse: "Ellipse",
  path: "Path",
};

const BODY_MORPH_LABELS: Record<keyof BodyMorphValues, string> = {
  headSize: "Head Size",
  neckLength: "Neck Length",
  torsoHeight: "Torso Height",
  torsoWidth: "Torso Width",
  armLength: "Arm Length",
  forearmLength: "Forearm Length",
  handSize: "Hand Size",
  legLength: "Leg Length",
  shinLength: "Shin Length",
  footSize: "Foot Size",
  pelvisWidth: "Pelvis Width",
  overallHeightScale: "Overall Height",
};

const BODY_REGION_LABELS: Record<BodyMorphRegionId, string> = {
  head: "Head",
  torso: "Torso",
  arms: "Arms",
  legs: "Legs",
  global: "Global",
};

const BODY_AUTHORING_INTENT_LABELS: Record<BodyAuthoringIntent, string> = {
  morph: "Morph",
  inspect: "Inspect",
  preview: "Preview",
};

const BODY_VIEWPORT_MODE_LABELS: Record<BodyAuthoringViewportMode, string> = {
  full_body: "Full Body",
  focus_region: "Focus Region",
};

const FACE_WORKFLOW_MODE_LABELS: Record<FaceAuthoringWorkflowMode, string> = {
  feature: "Feature",
  overlay: "Overlay",
};

const FACE_OVERLAY_ROLE_LABELS: Record<FaceOverlayRole, string> = {
  base: "Base",
  line: "Line",
  detail: "Detail",
  shadow: "Shadow",
  highlight: "Highlight",
};

const FACE_PAINT_TARGET_LABELS: Record<SpriteEditorPaintTarget, string> = {
  fill: "Fill",
  stroke: "Line",
  both: "Both",
};

const FACE_SYMMETRY_LABELS: Record<SpriteEditorSymmetryMode, string> = {
  none: "None",
  mirror_x: "Mirror X",
};

function getSuggestedToolForPaintTarget(target: SpriteEditorPaintTarget): FaceAuthoringTool {
  switch (target) {
    case "fill":
      return "fill";
    case "stroke":
      return "pencil";
    case "both":
    default:
      return "closed-pencil";
  }
}

const BODY_REGION_KEYS: Record<BodyMorphRegionId, Array<keyof BodyMorphValues>> = {
  head: ["headSize", "neckLength"],
  torso: ["torsoHeight", "torsoWidth", "pelvisWidth"],
  arms: ["armLength", "forearmLength", "handSize"],
  legs: ["legLength", "shinLength", "footSize"],
  global: ["overallHeightScale"],
};

const DEFAULT_BODY_MORPHS: BodyMorphValues = {
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

const BODY_MORPH_PRESETS: Array<{ id: string; label: string; values: Partial<BodyMorphValues> }> = [
  {
    id: "heroic",
    label: "Heroic",
    values: { headSize: 0.94, torsoWidth: 1.15, armLength: 1.08, handSize: 1.08, legLength: 1.08, overallHeightScale: 1.05 },
  },
  {
    id: "rogue",
    label: "Rogue",
    values: { headSize: 1.02, torsoWidth: 0.92, armLength: 1.1, forearmLength: 1.08, legLength: 1.12, footSize: 0.95 },
  },
  {
    id: "dwarf",
    label: "Dwarf",
    values: { headSize: 1.12, neckLength: 0.9, torsoHeight: 0.88, torsoWidth: 1.12, legLength: 0.84, shinLength: 0.86, overallHeightScale: 0.88 },
  },
];

const BODY_QUICK_ACTIONS: Record<BodyMorphRegionId, Array<{ id: string; label: string; values: Partial<BodyMorphValues> }>> = {
  head: [
    { id: "head_big_head", label: "Big Head", values: { headSize: 1.16, neckLength: 0.94 } },
    { id: "head_small_head", label: "Small Head", values: { headSize: 0.9, neckLength: 1.05 } },
  ],
  torso: [
    { id: "torso_broad_torso", label: "Broad Torso", values: { torsoWidth: 1.18, torsoHeight: 1.08, pelvisWidth: 1.08 } },
    { id: "torso_lean_torso", label: "Lean Torso", values: { torsoWidth: 0.9, torsoHeight: 1.04, pelvisWidth: 0.94 } },
  ],
  arms: [
    { id: "arms_long_reach", label: "Long Reach", values: { armLength: 1.14, forearmLength: 1.12, handSize: 1.02 } },
    { id: "arms_compact_arms", label: "Compact Arms", values: { armLength: 0.92, forearmLength: 0.92, handSize: 0.94 } },
  ],
  legs: [
    { id: "legs_long_legs", label: "Long Legs", values: { legLength: 1.16, shinLength: 1.12, footSize: 1.02 } },
    { id: "legs_heavy_steps", label: "Heavy Steps", values: { legLength: 0.96, shinLength: 0.96, footSize: 1.14 } },
  ],
  global: [
    { id: "global_compact", label: "Compact", values: { overallHeightScale: 0.92, armLength: 0.94, legLength: 0.9, shinLength: 0.92 } },
    { id: "global_tall", label: "Tall", values: { overallHeightScale: 1.1, legLength: 1.08, torsoHeight: 1.04 } },
  ],
};

const FACE_WORKSPACE_LABELS: Record<keyof Omit<FaceCustomization, "overlays">, string> = {
  eyes: "Eyes",
  mouth: "Mouth",
  brows: "Brows",
  beard: "Beard",
  hair: "Hair",
};

const FACE_FEATURE_TO_SLOT: Partial<Record<FaceFeatureKey, string>> = {
  hair: "slot_hair",
  eyes: "slot_eyes",
  beard: "slot_beard",
  mouth: "slot_face",
  brows: "slot_face",
};

const FACE_PRESETS: Record<keyof Omit<FaceCustomization, "overlays">, Array<{ id: string; label: string }>> = {
  eyes: [
    { id: "round_kawaii", label: "Round Kawaii" },
    { id: "sleepy", label: "Sleepy" },
    { id: "none", label: "None" },
  ],
  mouth: [
    { id: "soft_smile", label: "Soft Smile" },
    { id: "frown", label: "Frown" },
    { id: "none", label: "None" },
  ],
  brows: [
    { id: "soft_arc", label: "Soft Arc" },
    { id: "stern", label: "Stern" },
    { id: "none", label: "None" },
  ],
  beard: [
    { id: "short_goatee", label: "Short Goatee" },
    { id: "full_short", label: "Full Short" },
    { id: "none", label: "None" },
  ],
  hair: [
    { id: "fringe_short", label: "Fringe Short" },
    { id: "fringe_long", label: "Fringe Long" },
    { id: "none", label: "None" },
  ],
};

const FACE_OVERLAY_DEFAULTS: Record<"generic" | keyof Omit<FaceCustomization, "overlays">, { name: string; width: number; height: number }> = {
  generic: { name: "Face Overlay", width: 64, height: 64 },
  eyes: { name: "Eyes Overlay", width: 52, height: 22 },
  mouth: { name: "Mouth Overlay", width: 28, height: 18 },
  brows: { name: "Brows Overlay", width: 50, height: 18 },
  beard: { name: "Beard Overlay", width: 42, height: 30 },
  hair: { name: "Hair Overlay", width: 60, height: 42 },
};

const FACE_DRAWING_PRESETS: Record<
  "generic" | keyof Omit<FaceCustomization, "overlays">,
  {
    stroke: string;
    fill: string;
    width: number;
    tool: "select" | "pencil" | "closed-pencil" | "fill" | "eraser";
    description: string;
  }
> = {
  generic: {
    stroke: "#1A1208",
    fill: "#B87333",
    width: 1.5,
    tool: "pencil",
    description: "General face overlay sketching.",
  },
  eyes: {
    stroke: "#2B1D18",
    fill: "#F8F6F2",
    width: 1.2,
    tool: "closed-pencil",
    description: "Clean eye shapes with bright fill and dark linework.",
  },
  mouth: {
    stroke: "#2B1D18",
    fill: "#C97C6B",
    width: 1,
    tool: "pencil",
    description: "Thin lip and smile line details.",
  },
  brows: {
    stroke: "#2B1D18",
    fill: "#2B1D18",
    width: 1.2,
    tool: "pencil",
    description: "Dark eyebrow strokes and tapered arcs.",
  },
  beard: {
    stroke: "#2B1D18",
    fill: "#4A2F22",
    width: 1.5,
    tool: "closed-pencil",
    description: "Chunkier beard masses with darker fill.",
  },
  hair: {
    stroke: "#2B1D18",
    fill: "#4A2F22",
    width: 1.6,
    tool: "closed-pencil",
    description: "Hair silhouette blocking with a strong outline.",
  },
};

const FACE_QUICK_ACTION_LABELS: Record<string, string> = {
  eye_pair: "Eye Pair",
  pupils: "Pupils",
  brows_soft: "Soft Brows",
  mouth_smile: "Smile",
  mouth_open: "Open Mouth",
  hair_fringe: "Fringe",
  beard_goatee: "Goatee",
  generic_mark: "Accent Mark",
};

const FACE_PAINT_SWATCHES = ["#1A1208", "#2B1D18", "#3B2314", "#4A2F22", "#C97C6B", "#F8F6F2"];

function getRichDocumentGroupLabel(groupKey: string) {
  if (!groupKey.startsWith("face:")) {
    return getDocumentGroupLabel(groupKey);
  }
  const [, feature = "generic", role = "", paint = ""] = groupKey.split(":");
  const parts = ["Face", getFaceFeatureLabel(feature as FaceFeatureKey | "generic")];
  if (role) parts.push(role);
  if (paint) parts.push(getPaintTargetLabel(paint as SpriteEditorPaintTarget));
  return parts.join(" · ");
}

function getOverlayRoleLabel(role?: "base" | "line" | "detail" | "shadow" | "highlight") {
  return role ?? "detail";
}

function getFaceFeatureLabel(featureKey?: FaceFeatureKey | "generic") {
  if (!featureKey) return "generic";
  if (featureKey === "generic") return "generic";
  return FACE_WORKSPACE_LABELS[featureKey].toLowerCase();
}

function getBodyMorphPresetLabel(presetId?: string | null) {
  if (!presetId) return "custom";
  const preset = [...BODY_MORPH_PRESETS, ...Object.values(BODY_QUICK_ACTIONS).flat()].find(candidate => candidate.id === presetId);
  return preset?.label ?? presetId;
}

function getDocumentGroupLabel(groupKey: string) {
  if (groupKey.startsWith("face:")) {
    return `Face · ${getFaceFeatureLabel(groupKey.slice(5) as FaceFeatureKey | "generic")}`;
  }
  if (groupKey === "item:item-part") return "Item Parts";
  if (groupKey === "entity:entity-visual") return "Entity Visuals";
  return groupKey;
}

function toColorInputValue(hex: string): string {
  const normalized = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) return normalized;
  if (/^#[0-9a-fA-F]{8}$/.test(normalized)) return normalized.slice(0, 7);
  return "#000000";
}

function getFaceDrawingPreset(featureKey: FaceFeatureKey | "generic" | null | undefined) {
  return FACE_DRAWING_PRESETS[featureKey ?? "generic"] ?? FACE_DRAWING_PRESETS.generic;
}

function getFaceQuickActionIds(featureKey: FaceFeatureKey | "generic" | null | undefined) {
  switch (featureKey ?? "generic") {
    case "eyes":
      return ["eye_pair", "pupils"];
    case "mouth":
      return ["mouth_smile", "mouth_open"];
    case "brows":
      return ["brows_soft"];
    case "hair":
      return ["hair_fringe"];
    case "beard":
      return ["beard_goatee"];
    default:
      return ["generic_mark"];
  }
}

function getDefaultFaceOverlayRole(featureKey: FaceFeatureKey | "generic") {
  switch (featureKey) {
    case "hair":
    case "beard":
      return "base" as const;
    case "brows":
    case "mouth":
      return "line" as const;
    default:
      return "detail" as const;
  }
}

function getDefaultFaceOverlaySymmetry(featureKey: FaceFeatureKey | "generic") {
  return featureKey === "eyes" || featureKey === "brows" ? "mirror_x" as const : "none" as const;
}

function getDefaultFacePaintTarget(role: "base" | "line" | "detail" | "shadow" | "highlight") {
  switch (role) {
    case "base":
    case "shadow":
    case "highlight":
      return "fill" as const;
    case "line":
      return "stroke" as const;
    case "detail":
    default:
      return "both" as const;
  }
}

function getPaintTargetLabel(target: SpriteEditorPaintTarget) {
  switch (target) {
    case "fill":
      return "Fill";
    case "stroke":
      return "Line";
    case "both":
    default:
      return "Both";
  }
}

function mirrorPointAcrossWidth(point: PreviewPoint, width: number): PreviewPoint {
  return {
    x: Number((width - point.x).toFixed(2)),
    y: point.y,
  };
}

function NumericInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      onChange={event => onChange(Number(event.target.value) || 0)}
      className="h-7 text-[11px] bg-background border-border"
    />
  );
}

function cloneSpriteEditorDocument(document: SpriteEditorDocument): SpriteEditorDocument {
  return structuredClone(document);
}

function spriteDocumentsEqual(a: SpriteEditorDocument, b: SpriteEditorDocument): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tagName = el.tagName;
  return (
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    el.isContentEditable
  );
}

function LiveAuthoringPreview({
  entityId,
  isolateSlotId,
  isolateVisualId,
  frameSize = 256,
  canvasClassName = "h-52 w-52 object-contain",
}: {
  entityId: string;
  isolateSlotId?: string | null;
  isolateVisualId?: string | null;
  frameSize?: number;
  canvasClassName?: string;
}) {
  const project = useStore(s => s.project);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const previewEntity = useMemo(() => {
    const entity = project.entities.find(candidate => candidate.id === entityId);
    if (!entity) return null;
    if (isolateVisualId) {
      return {
        ...entity,
        visuals: entity.visuals?.filter(visual => visual.id === isolateVisualId) ?? [],
      };
    }
    if (isolateSlotId) {
      return {
        ...entity,
        slots: entity.slots.map(slot =>
          slot.slotId === isolateSlotId
            ? { ...slot }
            : { ...slot, itemId: null },
        ),
      };
    }
    return entity;
  }, [entityId, isolateSlotId, isolateVisualId, project.entities]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !previewEntity) return;
    const template = resolveTemplate(project, previewEntity.templateId);
    if (!template) return;
    let cancelled = false;
    void renderFrameToCanvas({
      canvas,
      entity: previewEntity,
      template,
      items: project.items,
      itemFitProfiles: project.itemFitProfiles,
      frameSz: frameSize,
      bgColor: null,
      outlinePadding: 0,
      antiAlias: true,
    }).catch(() => {
      if (!cancelled) {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [frameSize, previewEntity, project]);

  return (
    <div className="rounded border border-border bg-[#141622] p-3">
      <div className="flex items-center justify-center rounded border border-border bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05),rgba(255,255,255,0.02)_55%,transparent_100%)]">
        <canvas
          ref={canvasRef}
          width={frameSize}
          height={frameSize}
          className={canvasClassName}
        />
      </div>
    </div>
  );
}

function getAngleDegrees(from: PreviewPoint, to: PreviewPoint): number {
  return Math.atan2(to.y - from.y, to.x - from.x) * (180 / Math.PI);
}

function getSpriteDocumentTargetLabel(doc: SpriteEditorDocument): string {
  if (doc.target.kind === "item-part") {
    return doc.target.partId ?? "item part";
  }
  if (doc.target.kind === "entity-visual") {
    return doc.target.visualId ?? "entity visual";
  }
  return doc.target.overlayId ?? "face overlay";
}

function getSpriteDocumentBoneLabel(doc: SpriteEditorDocument, project: { items: { id: string; parts?: Array<{ id: string; boneId: string }> }[]; entities: Array<{ id: string; visuals?: Array<{ id: string; boneId: string }> }> }): string | null {
  if (doc.target.kind === "item-part" && doc.target.itemId && doc.target.partId) {
    const item = project.items.find(candidate => candidate.id === doc.target.itemId);
    return item?.parts?.find(part => part.id === doc.target.partId)?.boneId ?? null;
  }
  if (doc.target.kind === "entity-visual" && doc.target.entityId && doc.target.visualId) {
    const entity = project.entities.find(candidate => candidate.id === doc.target.entityId);
    return entity?.visuals?.find(visual => visual.id === doc.target.visualId)?.boneId ?? null;
  }
  return "head";
}

interface PreviewPoint {
  x: number;
  y: number;
}

type PreviewInteraction =
  | {
      kind: "shape-drag";
      layerId: string;
      shapeId: string;
      startPoint: PreviewPoint;
      beforeDoc: SpriteEditorDocument;
      moved: boolean;
    }
  | {
      kind: "shape-resize";
      layerId: string;
      shapeId: string;
      startBounds: { minX: number; minY: number; width: number; height: number };
      beforeDoc: SpriteEditorDocument;
      moved: boolean;
    }
  | {
      kind: "shape-rotate";
      layerId: string;
      shapeId: string;
      center: PreviewPoint;
      startAngle: number;
      startRotation: number;
      beforeDoc: SpriteEditorDocument;
      moved: boolean;
    }
  | {
      kind: "pivot-place";
      startPoint: PreviewPoint;
      moved: boolean;
    }
  | {
      kind: "erase-sweep";
      erasedShapeIds: string[];
      beforeDoc: SpriteEditorDocument;
      moved: boolean;
    }
  | {
      kind: "fill-sweep";
      filledShapeIds: string[];
      beforeDoc: SpriteEditorDocument;
      moved: boolean;
    }
  | {
      kind: "pencil-draw";
      layerId: string;
      shapeId: string;
      mirroredShapeId?: string | null;
      points: PreviewPoint[];
      mirroredPoints?: PreviewPoint[];
      closed: boolean;
      beforeDoc: SpriteEditorDocument;
      moved: boolean;
    };

export function AuthoringPanel() {
  const project = useStore(s => s.project);
  const editor = useStore(s => s.editor);
  const setAnimBottomTab = useStore(s => s.setAnimBottomTab);
  const upsertSpriteEditorDocument = useStore(s => s.upsertSpriteEditorDocument);
  const setActiveSpriteDocument = useStore(s => s.setActiveSpriteDocument);
  const setActiveAuthoringMode = useStore(s => s.setActiveAuthoringMode);
  const setActiveFaceCanvasOverlay = useStore(s => s.setActiveFaceCanvasOverlay);
  const setActiveFaceCanvasTool = useStore(s => s.setActiveFaceCanvasTool);
  const setActiveFaceCanvasFocusMode = useStore(s => s.setActiveFaceCanvasFocusMode);
  const setEditorSelection = useStore(s => s.setEditorSelection);
  const setSelectedSlot = useStore(s => s.setSelectedSlot);
  const setEntityBodyMorphValue = useStore(s => s.setEntityBodyMorphValue);
  const setEntityBodyMorphPreset = useStore(s => s.setEntityBodyMorphPreset);
  const setEntityBodyAuthoringState = useStore(s => s.setEntityBodyAuthoringState);
  const setEntityBodyAuthoringRegionPreset = useStore(s => s.setEntityBodyAuthoringRegionPreset);
  const setEntityFaceFeature = useStore(s => s.setEntityFaceFeature);
  const setEntityFaceFeatureTransform = useStore(s => s.setEntityFaceFeatureTransform);
  const updateProjectItemPart = useStore(s => s.updateProjectItemPart);
  const updateEntityVisual = useStore(s => s.updateEntityVisual);
  const upsertEntityFaceOverlay = useStore(s => s.upsertEntityFaceOverlay);
  const removeEntityFaceOverlay = useStore(s => s.removeEntityFaceOverlay);
  const setEntityFaceAuthoringState = useStore(s => s.setEntityFaceAuthoringState);
  const getActiveEntity = useStore(s => s.getActiveEntity);

  const activeEntity = getActiveEntity();
  const faceOverlays = activeEntity?.faceCustomization?.overlays ?? [];
  const bodyMorphs = activeEntity?.bodyMorphs ?? DEFAULT_BODY_MORPHS;
  const faceCustomization = activeEntity?.faceCustomization ?? null;
  const bodyAuthoring = activeEntity?.bodyAuthoring ?? {
    focusRegion: "global" as BodyMorphRegionId,
    activeBoneId: null as string | null,
    activeSlotId: null as string | null,
    intent: "morph" as BodyAuthoringIntent,
    viewportMode: "focus_region" as BodyAuthoringViewportMode,
    regionPresetIds: {},
  };
  const faceAuthoring = activeEntity?.faceAuthoring ?? {
    activeFeatureKey: null as FaceFeatureKey | "generic" | null,
    overlayFilter: "all" as FaceFeatureKey | "generic" | "all",
    selectedOverlayId: null as string | null,
    activeBoneId: "head" as string | null,
    activeSlotId: null as string | null,
    workflowMode: "feature" as FaceAuthoringWorkflowMode,
    draftOverlayRole: "detail" as FaceOverlayRole,
    draftPaintTarget: "both" as SpriteEditorPaintTarget,
    draftSymmetryMode: "none" as SpriteEditorSymmetryMode,
    overlayRoleFilter: "all" as const,
    paintTargetFilter: "all" as const,
    overlayGrouping: "feature" as const,
    drawMode: null as FaceAuthoringTool | null,
    focusMode: "document" as FaceCanvasFocusMode,
  };
  const activeMode = project.editorMeta.activeAuthoringMode ?? "sprite-editor";
  const activeFaceCanvasTool = project.editorMeta.activeFaceCanvasTool ?? null;
  const activeFaceCanvasFocusMode = project.editorMeta.activeFaceCanvasFocusMode ?? faceAuthoring.focusMode ?? "document";
  const activeDocId = project.editorMeta.activeSpriteDocumentId ?? null;
  const activeDoc = project.editorMeta.spriteEditorDocuments.find(doc => doc.id === activeDocId) ?? null;
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const previewInteractionRef = useRef<PreviewInteraction | null>(null);
  const documentHistoryRef = useRef<Record<string, { past: SpriteEditorDocument[]; future: SpriteEditorDocument[] }>>({});
  const [autoPreviewEnabled, setAutoPreviewEnabled] = useState(true);
  const [isSpriteStudioOpen, setIsSpriteStudioOpen] = useState(false);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [hoverPreviewPoint, setHoverPreviewPoint] = useState<PreviewPoint | null>(null);
  const [hoverPreviewShapeId, setHoverPreviewShapeId] = useState<string | null>(null);
  const [, setHistoryRevision] = useState(0);
  const [spriteTool, setSpriteTool] = useState<FaceAuthoringTool>("select");
  const [toolStrokeColor, setToolStrokeColor] = useState("#1A1208");
  const [toolFillColor, setToolFillColor] = useState("#B87333");
  const [toolStrokeWidth, setToolStrokeWidth] = useState(1.5);

  const itemPartSelection = editor.selection.kind === "item-part" ? editor.selection : null;
  const entityVisualSelection = editor.selection.kind === "entity-visual" ? editor.selection : null;
  const selectedAssignment = activeEntity?.slots.find(slot =>
    itemPartSelection ? slot.slotId === itemPartSelection.slotId : false,
  );
  const selectedItem = itemPartSelection && selectedAssignment?.itemId
    ? project.items.find(item => item.id === selectedAssignment.itemId)
    : undefined;
  const selectedPart = itemPartSelection && selectedItem?.parts
    ? selectedItem.parts.find(part => part.id === itemPartSelection.partId)
    : undefined;
  const selectedVisual = entityVisualSelection && activeEntity?.visuals
    ? activeEntity.visuals.find(visual => visual.id === entityVisualSelection.visualId)
    : undefined;

  const currentLayer = activeDoc
    ? activeDoc.layers.find(layer => layer.id === selectedLayerId) ?? activeDoc.layers[0] ?? null
    : null;
  const selectedShape = currentLayer?.shapes.find(shape => shape.id === selectedShapeId) ?? currentLayer?.shapes[0] ?? null;

  const previewSvg = useMemo(
    () => (activeDoc ? sanitizeSvg(spriteEditorDocumentToSvg(activeDoc)) : ""),
    [activeDoc],
  );
  const contentBounds = useMemo(
    () => (activeDoc ? computeDocumentContentBounds(activeDoc) : null),
    [activeDoc],
  );
  const selectedShapeBounds = useMemo(
    () => (selectedShape ? computeShapeBounds(selectedShape) : null),
    [selectedShape],
  );
  const activeBodyRegionKeys = BODY_REGION_KEYS[bodyAuthoring.focusRegion] ?? BODY_REGION_KEYS.global;
  const activeFaceFeature = faceAuthoring.activeFeatureKey ?? "generic";
  const visibleFaceFeatures = useMemo(() => {
    if (activeFaceFeature === "generic") {
      return Object.keys(FACE_WORKSPACE_LABELS) as Array<keyof Omit<FaceCustomization, "overlays">>;
    }
    return [activeFaceFeature] as Array<keyof Omit<FaceCustomization, "overlays">>;
  }, [activeFaceFeature]);
  const selectedFaceOverlay = useMemo(
    () => faceOverlays.find(overlay => overlay.id === faceAuthoring.selectedOverlayId) ?? null,
    [faceAuthoring.selectedOverlayId, faceOverlays],
  );
  const filteredFaceOverlays = useMemo(() => {
    return faceOverlays.filter(overlay => {
      const featureMatch = faceAuthoring.overlayFilter === "all"
        || (overlay.featureTag ?? "generic") === faceAuthoring.overlayFilter;
      const roleMatch = faceAuthoring.overlayRoleFilter === "all"
        || (overlay.overlayRole ?? "detail") === faceAuthoring.overlayRoleFilter;
      const paintMatch = faceAuthoring.paintTargetFilter === "all"
        || (overlay.paintTarget ?? "both") === faceAuthoring.paintTargetFilter;
      return featureMatch && roleMatch && paintMatch;
    });
  }, [faceAuthoring.overlayFilter, faceAuthoring.overlayRoleFilter, faceAuthoring.paintTargetFilter, faceOverlays]);
  const groupedFaceOverlays = useMemo(() => {
    const groups = new Map<string, FaceOverlay[]>();
    for (const overlay of filteredFaceOverlays) {
      const feature = overlay.featureTag ?? "generic";
      const role = overlay.overlayRole ?? "detail";
      const paint = overlay.paintTarget ?? "both";
      const key = faceAuthoring.overlayGrouping === "feature_role_paint"
        ? `${feature}:${role}:${paint}`
        : faceAuthoring.overlayGrouping === "feature_role"
          ? `${feature}:${role}`
          : feature;
      groups.set(key, [...(groups.get(key) ?? []), overlay]);
    }
    return Array.from(groups.entries());
  }, [faceAuthoring.overlayGrouping, filteredFaceOverlays]);
  const filteredDocuments = useMemo(() => {
    return project.editorMeta.spriteEditorDocuments.filter(doc => {
      if (doc.target.kind !== "face-overlay") return true;
      const featureMatch = faceAuthoring.overlayFilter === "all"
        || (doc.authoringHint?.faceFeatureKey ?? "generic") === faceAuthoring.overlayFilter;
      const roleMatch = faceAuthoring.overlayRoleFilter === "all"
        || (doc.authoringHint?.faceOverlayRole ?? "detail") === faceAuthoring.overlayRoleFilter;
      const paintMatch = faceAuthoring.paintTargetFilter === "all"
        || (doc.authoringHint?.paintTarget ?? "both") === faceAuthoring.paintTargetFilter;
      return featureMatch && roleMatch && paintMatch;
    });
  }, [faceAuthoring.overlayFilter, faceAuthoring.overlayRoleFilter, faceAuthoring.paintTargetFilter, project.editorMeta.spriteEditorDocuments]);
  const groupedDocuments = useMemo(() => {
    const groups = new Map<string, SpriteEditorDocument[]>();
    for (const doc of filteredDocuments) {
      const key = doc.target.kind === "face-overlay"
        ? (() => {
            const feature = doc.authoringHint?.faceFeatureKey ?? "generic";
            const role = doc.authoringHint?.faceOverlayRole ?? "detail";
            const paint = doc.authoringHint?.paintTarget ?? "both";
            if (faceAuthoring.overlayGrouping === "feature_role_paint") {
              return `face:${feature}:${role}:${paint}`;
            }
            if (faceAuthoring.overlayGrouping === "feature_role") {
              return `face:${feature}:${role}`;
            }
            return `face:${feature}`;
          })()
        : doc.target.kind === "item-part"
          ? "item:item-part"
          : "entity:entity-visual";
      groups.set(key, [...(groups.get(key) ?? []), doc]);
    }
    return Array.from(groups.entries());
  }, [faceAuthoring.overlayGrouping, filteredDocuments]);
  const selectedFaceOverlayDocument = useMemo(() => {
    if (!selectedFaceOverlay || !activeEntity) return null;
    return project.editorMeta.spriteEditorDocuments.find(doc =>
      doc.target.kind === "face-overlay" &&
      doc.target.entityId === activeEntity.id &&
      doc.target.overlayId === selectedFaceOverlay.id,
    ) ?? null;
  }, [activeEntity, project.editorMeta.spriteEditorDocuments, selectedFaceOverlay]);
  const previewScale = activeDoc
    ? Math.min(560 / Math.max(activeDoc.width, 1), 560 / Math.max(activeDoc.height, 1), 4)
    : 1;
  const relatedDocuments = useMemo(() => {
    if (!activeDoc) return [] as SpriteEditorDocument[];
    const docs = project.editorMeta.spriteEditorDocuments;
    if (activeDoc.target.kind === "item-part" && activeDoc.target.entityId && activeDoc.target.itemId) {
      return docs.filter(doc =>
        doc.target.kind === "item-part" &&
        doc.target.entityId === activeDoc.target.entityId &&
        doc.target.itemId === activeDoc.target.itemId,
      );
    }
    if (activeDoc.target.kind === "entity-visual" && activeDoc.target.entityId) {
      return docs.filter(doc =>
        doc.target.kind === "entity-visual" &&
        doc.target.entityId === activeDoc.target.entityId,
      );
    }
    if (activeDoc.target.kind === "face-overlay" && activeDoc.target.entityId) {
      return docs.filter(doc =>
        doc.target.kind === "face-overlay" &&
        doc.target.entityId === activeDoc.target.entityId,
      );
    }
    return [activeDoc];
  }, [activeDoc, project.editorMeta.spriteEditorDocuments]);
  const activeRelatedDocIndex = activeDoc
    ? relatedDocuments.findIndex(doc => doc.id === activeDoc.id)
    : -1;
  const activeDocFaceFeature = activeDoc?.target.kind === "face-overlay"
    ? (activeDoc.authoringHint?.faceFeatureKey ?? "generic")
    : null;
  const activeDocSymmetryMode = activeDoc?.authoringHint?.symmetryMode ?? "none";
  const activeDocFaceOverlayRole = activeDoc?.authoringHint?.faceOverlayRole ?? "detail";
  const activeDocPaintTarget = activeDoc?.authoringHint?.paintTarget ?? getDefaultFacePaintTarget(activeDocFaceOverlayRole);
  const studioPreviewEntity = useMemo(() => {
    if (!activeEntity || !activeDoc) return null;
    if (activeDoc.target.kind === "item-part") {
      const activeSlotId =
        activeEntity.slots.find(slot => slot.itemId === activeDoc.target.itemId)?.slotId
        ?? itemPartSelection?.slotId
        ?? null;
      const entity = {
        ...activeEntity,
        slots: activeEntity.slots.map(slot =>
          slot.slotId === activeSlotId
            ? { ...slot }
            : { ...slot, itemId: null },
        ),
      };
      return entity;
    }
    if (activeDoc.target.kind === "entity-visual" && activeDoc.target.visualId) {
      return {
        ...activeEntity,
        visuals: activeEntity.visuals?.filter(visual => visual.id === activeDoc.target.visualId) ?? [],
      };
    }
    return activeEntity;
  }, [activeDoc, activeEntity, itemPartSelection?.slotId]);
  const activeDocumentContext = useMemo(() => {
    if (!activeDoc) return null;
    if (activeDoc.target.kind === "entity-visual") {
      return {
        kindLabel: "Entity Visual",
        targetLabel: activeDoc.target.visualId ?? "visual",
        slotLabel: null as string | null,
        boneLabel: getSpriteDocumentBoneLabel(activeDoc, project),
      };
    }
    if (activeDoc.target.kind === "face-overlay") {
      return {
        kindLabel: "Face Overlay",
        targetLabel: activeDoc.target.overlayId ?? "overlay",
        slotLabel: null as string | null,
        boneLabel: "head",
      };
    }
    const entity = activeDoc.target.entityId
      ? project.entities.find(candidate => candidate.id === activeDoc.target.entityId)
      : null;
    const slotId = entity?.slots.find(slot => slot.itemId === activeDoc.target.itemId)?.slotId ?? null;
    return {
      kindLabel: "Item Part",
      targetLabel: activeDoc.target.partId ?? "part",
      slotLabel: slotId,
      boneLabel: getSpriteDocumentBoneLabel(activeDoc, project),
    };
  }, [activeDoc, project]);
  const activeDocumentHistory = activeDoc ? documentHistoryRef.current[activeDoc.id] : undefined;
  const canUndoDocument = Boolean(activeDoc && activeDocumentHistory && activeDocumentHistory.past.length > 0);
  const canRedoDocument = Boolean(activeDoc && activeDocumentHistory && activeDocumentHistory.future.length > 0);

  useEffect(() => {
    if (!activeDoc) {
      if (selectedLayerId !== null) setSelectedLayerId(null);
      if (selectedShapeId !== null) setSelectedShapeId(null);
      setIsSpriteStudioOpen(false);
      return;
    }

    const fallbackLayer = activeDoc.layers[0] ?? null;
    const nextLayer =
      activeDoc.layers.find(layer => layer.id === selectedLayerId)
      ?? (selectedShapeId
        ? activeDoc.layers.find(layer => layer.shapes.some(shape => shape.id === selectedShapeId))
        : null)
      ?? fallbackLayer;

    if (nextLayer && nextLayer.id !== selectedLayerId) {
      setSelectedLayerId(nextLayer.id);
    }

    const nextShape =
      nextLayer?.shapes.find(shape => shape.id === selectedShapeId)
      ?? nextLayer?.shapes[0]
      ?? null;
    const nextShapeId = nextShape?.id ?? null;
    if (nextShapeId !== selectedShapeId) {
      setSelectedShapeId(nextShapeId);
    }
  }, [activeDoc, selectedLayerId, selectedShapeId]);

  useEffect(() => {
    if (activeMode === "sprite-editor" && activeDoc) {
      setIsSpriteStudioOpen(true);
    }
  }, [activeDoc, activeMode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!activeDoc || activeMode !== "sprite-editor" || event.repeat) return;
      if (isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      const redoPressed =
        ((event.ctrlKey || event.metaKey) && !event.altKey && key === "y") ||
        ((event.ctrlKey || event.metaKey) && !event.altKey && event.shiftKey && key === "z");
      const undoPressed =
        (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && key === "z";

      if (undoPressed) {
        if (!undoDocumentEdit()) return;
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (redoPressed) {
        if (!redoDocumentEdit()) return;
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [activeDoc, activeMode]);

  useEffect(() => {
    if (!selectedShape) return;
    if (/^#[0-9a-fA-F]{6}$/.test(selectedShape.stroke)) {
      setToolStrokeColor(selectedShape.stroke);
    }
    if (/^#[0-9a-fA-F]{6}$/.test(selectedShape.fill)) {
      setToolFillColor(selectedShape.fill);
    }
    if (Number.isFinite(selectedShape.strokeWidth) && selectedShape.strokeWidth > 0) {
      setToolStrokeWidth(selectedShape.strokeWidth);
    }
  }, [selectedShape]);

  useEffect(() => {
    if (!activeDoc) return;
    if (activeDoc.target.kind === "entity-visual" && activeDoc.target.entityId && activeDoc.target.visualId) {
      if (editor.selectedSlotId !== null) {
        setSelectedSlot(null);
      }
      const nextSelection = {
        kind: "entity-visual",
        entityId: activeDoc.target.entityId,
        visualId: activeDoc.target.visualId,
      } as const;
      if (
        editor.selection.kind !== "entity-visual" ||
        editor.selection.entityId !== nextSelection.entityId ||
        editor.selection.visualId !== nextSelection.visualId
      ) {
        setEditorSelection(nextSelection);
      }
      return;
    }
    if (activeDoc.target.kind === "item-part" && activeDoc.target.entityId && activeDoc.target.itemId && activeDoc.target.partId) {
      const entity = project.entities.find(candidate => candidate.id === activeDoc.target.entityId);
      const slotId = entity?.slots.find(slot => slot.itemId === activeDoc.target.itemId)?.slotId ?? null;
      if (!slotId) return;
      if (editor.selectedSlotId !== slotId) {
        setSelectedSlot(slotId);
      }
      const nextSelection = {
        kind: "item-part",
        entityId: activeDoc.target.entityId,
        slotId,
        itemId: activeDoc.target.itemId,
        partId: activeDoc.target.partId,
      } as const;
      if (
        editor.selection.kind !== "item-part" ||
        editor.selection.entityId !== nextSelection.entityId ||
        editor.selection.slotId !== nextSelection.slotId ||
        editor.selection.itemId !== nextSelection.itemId ||
        editor.selection.partId !== nextSelection.partId
      ) {
        setEditorSelection(nextSelection);
      }
      return;
    }
    if (activeDoc.target.kind === "face-overlay") {
      if (editor.selectedSlotId !== null) {
        setSelectedSlot(null);
      }
      if (editor.selection.kind !== "none") {
        setEditorSelection({ kind: "none" });
      }
    }
  }, [activeDoc, editor.selectedSlotId, editor.selection, project.entities, setEditorSelection, setSelectedSlot]);

  useEffect(() => {
    if (!activeDoc || activeDoc.target.kind !== "face-overlay" || !activeDoc.target.entityId) return;
    const featureKey = activeDoc.authoringHint?.faceFeatureKey ?? "generic";
    const slotId = featureKey === "generic" ? null : FACE_FEATURE_TO_SLOT[featureKey] ?? null;
    const nextDrawMode = activeFaceCanvasTool ?? faceAuthoring.drawMode ?? null;
    if (
      faceAuthoring.activeFeatureKey !== featureKey ||
      faceAuthoring.overlayFilter !== featureKey ||
      (faceAuthoring.selectedOverlayId ?? null) !== (activeDoc.target.overlayId ?? null) ||
      (faceAuthoring.drawMode ?? null) !== nextDrawMode ||
      faceAuthoring.focusMode !== activeFaceCanvasFocusMode
    ) {
      setEntityFaceAuthoringState(activeDoc.target.entityId, {
        activeFeatureKey: featureKey,
        overlayFilter: featureKey,
        selectedOverlayId: activeDoc.target.overlayId ?? null,
        drawMode: nextDrawMode,
        focusMode: activeFaceCanvasFocusMode,
      });
    }
    if (editor.selectedSlotId !== slotId) {
      setSelectedSlot(slotId);
    }
    if (activeDoc.target.overlayId) {
      if (project.editorMeta.activeFaceCanvasOverlayId !== activeDoc.target.overlayId) {
        setActiveFaceCanvasOverlay(activeDoc.target.overlayId);
      }
      const nextSelection = {
        kind: "face-overlay",
        entityId: activeDoc.target.entityId,
        overlayId: activeDoc.target.overlayId,
        featureKey,
        slotId,
      } as const;
      if (
        editor.selection.kind !== "face-overlay" ||
        editor.selection.entityId !== nextSelection.entityId ||
        editor.selection.overlayId !== nextSelection.overlayId ||
        editor.selection.featureKey !== nextSelection.featureKey ||
        editor.selection.slotId !== nextSelection.slotId
      ) {
        setEditorSelection(nextSelection);
      }
    }
  }, [
    activeDoc,
    activeFaceCanvasFocusMode,
    activeFaceCanvasTool,
    editor.selectedSlotId,
    editor.selection,
    faceAuthoring.activeFeatureKey,
    faceAuthoring.drawMode,
    faceAuthoring.focusMode,
    faceAuthoring.overlayFilter,
    faceAuthoring.selectedOverlayId,
    project.editorMeta.activeFaceCanvasOverlayId,
    setActiveFaceCanvasOverlay,
    setEditorSelection,
    setEntityFaceAuthoringState,
    setSelectedSlot,
  ]);

  useEffect(() => {
    if (!activeDoc || activeDoc.target.kind !== "face-overlay" || !activeFaceCanvasTool) return;
    setSpriteTool(activeFaceCanvasTool);
  }, [activeDoc, activeFaceCanvasTool]);

  function applyDocumentToTarget(doc: SpriteEditorDocument) {
    const svgData = spriteEditorDocumentToSvg(doc);
    const metrics = parseMetrics(svgData);

    if (doc.target.kind === "item-part" && doc.target.itemId && doc.target.partId) {
      updateProjectItemPart(doc.target.itemId, doc.target.partId, {
        svgData,
        metrics,
        pivot: doc.pivot,
        editorDocumentId: doc.id,
        source: {
          format: "svg",
          name: doc.name,
          originalFileName: `${doc.name}.svg`,
          mimeType: "image/svg+xml",
          dataUri: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`,
        },
      });
      return;
    }

    if (doc.target.kind === "entity-visual" && doc.target.entityId && doc.target.visualId) {
      updateEntityVisual(doc.target.entityId, doc.target.visualId, {
        svgData,
        metrics,
        pivot: doc.pivot,
        editorDocumentId: doc.id,
        source: {
          format: "svg",
          name: doc.name,
          originalFileName: `${doc.name}.svg`,
          mimeType: "image/svg+xml",
          dataUri: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`,
        },
      });
      return;
    }

    if (doc.target.kind === "face-overlay" && doc.target.entityId && doc.target.overlayId) {
      const overlay: FaceOverlay = {
        id: doc.target.overlayId,
        name: doc.name,
        featureTag: doc.authoringHint?.faceFeatureKey ?? "generic",
        overlayRole: doc.authoringHint?.faceOverlayRole ?? "detail",
        symmetryMode: doc.authoringHint?.symmetryMode ?? "none",
        paintTarget: doc.authoringHint?.paintTarget ?? getDefaultFacePaintTarget(doc.authoringHint?.faceOverlayRole ?? "detail"),
        svgData,
        zOffset: 80,
        pivot: doc.pivot,
        metrics,
        localTransform: {
          x: 0,
          y: 0,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
        },
        source: {
          format: "svg",
          name: doc.name,
          originalFileName: `${doc.name}.svg`,
          mimeType: "image/svg+xml",
          dataUri: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`,
        },
        editorDocumentId: doc.id,
      };
      upsertEntityFaceOverlay(doc.target.entityId, overlay);
    }
  }

  function openFaceOverlayDocument(overlay: FaceOverlay) {
    if (!activeEntity) return;
    const featureKey = overlay.featureTag ?? "generic";
    const slotId = featureKey === "generic" ? null : FACE_FEATURE_TO_SLOT[featureKey] ?? null;
    applyFaceBrushPreset(featureKey);
    setActiveFaceCanvasFocusMode(activeFaceCanvasFocusMode);
    setEntityFaceAuthoringState(activeEntity.id, {
      activeFeatureKey: featureKey,
      overlayFilter: featureKey,
      selectedOverlayId: overlay.id,
      activeBoneId: "head",
      activeSlotId: slotId,
      workflowMode: "overlay",
      draftOverlayRole: overlay.overlayRole ?? "detail",
      draftPaintTarget: overlay.paintTarget ?? "both",
      draftSymmetryMode: overlay.symmetryMode ?? "none",
      drawMode: activeFaceCanvasTool ?? null,
      focusMode: activeFaceCanvasFocusMode,
    });
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
    setSelectedLayerId(doc.layers[0]?.id ?? null);
    ensureSelection(doc.layers[0]?.shapes[0]?.id ?? null);
  }

  function getDocumentHistory(documentId: string) {
    const existing = documentHistoryRef.current[documentId];
    if (existing) return existing;
    const created = { past: [] as SpriteEditorDocument[], future: [] as SpriteEditorDocument[] };
    documentHistoryRef.current[documentId] = created;
    return created;
  }

  function getLatestDocumentSnapshot(documentId: string) {
    return useStore
      .getState()
      .project.editorMeta.spriteEditorDocuments.find(doc => doc.id === documentId) ?? null;
  }

  function recordDocumentHistory(beforeDoc: SpriteEditorDocument, afterDoc: SpriteEditorDocument) {
    if (spriteDocumentsEqual(beforeDoc, afterDoc)) return;
    const history = getDocumentHistory(afterDoc.id);
    history.past.push(cloneSpriteEditorDocument(beforeDoc));
    if (history.past.length > 100) history.past.shift();
    history.future = [];
    setHistoryRevision(value => value + 1);
  }

  function undoDocumentEdit() {
    if (!activeDoc) return false;
    const history = getDocumentHistory(activeDoc.id);
    if (history.past.length === 0) return false;
    const current = getLatestDocumentSnapshot(activeDoc.id) ?? activeDoc;
    const previous = history.past.pop();
    if (!previous) return false;
    history.future.unshift(cloneSpriteEditorDocument(current));
    upsertSpriteEditorDocument({ ...cloneSpriteEditorDocument(previous), updatedAt: Date.now() });
    setActiveSpriteDocument(previous.id);
    setSelectedLayerId(previous.layers[0]?.id ?? null);
    ensureSelection(previous.layers[0]?.shapes[0]?.id ?? null);
    setHistoryRevision(value => value + 1);
    return true;
  }

  function redoDocumentEdit() {
    if (!activeDoc) return false;
    const history = getDocumentHistory(activeDoc.id);
    if (history.future.length === 0) return false;
    const current = getLatestDocumentSnapshot(activeDoc.id) ?? activeDoc;
    const next = history.future.shift();
    if (!next) return false;
    history.past.push(cloneSpriteEditorDocument(current));
    upsertSpriteEditorDocument({ ...cloneSpriteEditorDocument(next), updatedAt: Date.now() });
    setActiveSpriteDocument(next.id);
    setSelectedLayerId(next.layers[0]?.id ?? null);
    ensureSelection(next.layers[0]?.shapes[0]?.id ?? null);
    setHistoryRevision(value => value + 1);
    return true;
  }

  function patchDocument(
    mutator: (doc: SpriteEditorDocument) => SpriteEditorDocument,
    options?: { recordHistory?: boolean },
  ) {
    if (!activeDoc) return;
    const next = mutator(activeDoc);
    if (options?.recordHistory !== false) {
      recordDocumentHistory(activeDoc, next);
    }
    upsertSpriteEditorDocument({ ...next, updatedAt: Date.now() });
    if (autoPreviewEnabled) {
      applyDocumentToTarget(next);
    }
  }

  function ensureSelection(shapeId: string | null) {
    setSelectedShapeId(shapeId);
    if (shapeId && activeDoc) {
      const shapeLayer = activeDoc.layers.find(layer => layer.shapes.some(shape => shape.id === shapeId));
      if (shapeLayer) {
        setSelectedLayerId(shapeLayer.id);
      }
    } else if (activeDoc?.layers[0]) {
      setSelectedLayerId(activeDoc.layers[0].id);
    }
    setActiveAuthoringMode("sprite-editor");
    setAnimBottomTab("authoring");
  }

  function getPreviewPoint(event: Pick<React.MouseEvent<Element>, "clientX" | "clientY">): PreviewPoint | null {
    if (!activeDoc || !previewFrameRef.current) return null;
    const rect = previewFrameRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const rawX = ((event.clientX - rect.left) / rect.width) * activeDoc.width;
    const rawY = ((event.clientY - rect.top) / rect.height) * activeDoc.height;
    return {
      x: Math.max(0, Math.min(activeDoc.width, Number(rawX.toFixed(2)))),
      y: Math.max(0, Math.min(activeDoc.height, Number(rawY.toFixed(2)))),
    };
  }

  function switchMode(mode: "sprite-editor" | "body-morph" | "face-editor") {
    setActiveAuthoringMode(mode);
    setAnimBottomTab("authoring");
  }

  function applyMorphPreset(
    presetId: string | null,
    values: Partial<BodyMorphValues>,
    region: BodyMorphRegionId = bodyAuthoring.focusRegion,
  ) {
    if (!activeEntity) return;
    for (const key of Object.keys(DEFAULT_BODY_MORPHS) as Array<keyof BodyMorphValues>) {
      setEntityBodyMorphValue(activeEntity.id, key, values[key] ?? DEFAULT_BODY_MORPHS[key]);
    }
    setEntityBodyMorphPreset(activeEntity.id, presetId);
    setEntityBodyAuthoringRegionPreset(activeEntity.id, region, presetId);
  }

  function patchBodyWorkflow(
    patch: Partial<{
      focusRegion: BodyMorphRegionId;
      activeBoneId: string | null;
      activeSlotId: string | null;
      intent: BodyAuthoringIntent;
      viewportMode: BodyAuthoringViewportMode;
    }>,
  ) {
    if (!activeEntity) return;
    setEntityBodyAuthoringState(activeEntity.id, patch);
  }

  function patchFaceWorkflow(
    patch: Partial<{
      workflowMode: FaceAuthoringWorkflowMode;
      draftOverlayRole: FaceOverlayRole;
      draftPaintTarget: SpriteEditorPaintTarget;
      draftSymmetryMode: SpriteEditorSymmetryMode;
      activeSlotId: string | null;
      activeBoneId: string | null;
    }>,
  ) {
    if (!activeEntity) return;
    setEntityFaceAuthoringState(activeEntity.id, patch);
  }

  function applyDraftPaintBehavior(target: SpriteEditorPaintTarget) {
    const suggestedTool = getSuggestedToolForPaintTarget(target);
    setSpriteTool(suggestedTool);
    setActiveFaceCanvasTool(suggestedTool);
    if (activeEntity) {
      setEntityFaceAuthoringState(activeEntity.id, {
        drawMode: suggestedTool,
      });
    }
  }

  function applyFaceBrushPreset(featureKey: FaceFeatureKey | "generic" = activeFaceFeature) {
    const preset = getFaceDrawingPreset(featureKey);
    setToolStrokeColor(preset.stroke);
    setToolFillColor(preset.fill);
    setToolStrokeWidth(preset.width);
    setSpriteTool(preset.tool);
    setActiveFaceCanvasTool(preset.tool);
  }

  function selectSpriteTool(tool: FaceAuthoringTool) {
    setSpriteTool(tool);
    if (activeDoc?.target.kind === "face-overlay") {
      setActiveFaceCanvasTool(tool);
      if (activeDoc.target.entityId) {
        setEntityFaceAuthoringState(activeDoc.target.entityId, {
          drawMode: tool,
          focusMode: activeFaceCanvasFocusMode,
        });
      }
      if (activeDoc.target.overlayId) {
        setActiveFaceCanvasOverlay(activeDoc.target.overlayId);
      }
    }
  }

  function setFaceCanvasFocusMode(mode: FaceCanvasFocusMode) {
    setActiveFaceCanvasFocusMode(mode);
    if (activeEntity) {
      setEntityFaceAuthoringState(activeEntity.id, { focusMode: mode });
    }
  }

  function enterDrawOnHeadMode(tool: FaceAuthoringTool = "pencil") {
    selectSpriteTool(tool);
    setFaceCanvasFocusMode("head");
    setIsSpriteStudioOpen(true);
  }

  function handleOverlayFeatureTagChange(
    overlay: FaceOverlay,
    featureKey: "eyes" | "mouth" | "brows" | "beard" | "hair" | "generic",
  ) {
    if (!activeEntity) return;
    const nextOverlay: FaceOverlay = {
      ...overlay,
      featureTag: featureKey,
    };
    upsertEntityFaceOverlay(activeEntity.id, nextOverlay);

    const docs = project.editorMeta.spriteEditorDocuments.filter(doc =>
      doc.target.kind === "face-overlay" &&
      doc.target.entityId === activeEntity.id &&
      doc.target.overlayId === overlay.id,
    );
    for (const doc of docs) {
      upsertSpriteEditorDocument({
        ...doc,
        authoringHint: {
          ...doc.authoringHint,
          faceFeatureKey: featureKey,
        },
        updatedAt: Date.now(),
      });
    }
    if (faceAuthoring.selectedOverlayId === overlay.id) {
      const slotId = featureKey === "generic" ? null : FACE_FEATURE_TO_SLOT[featureKey] ?? null;
      setEntityFaceAuthoringState(activeEntity.id, {
        activeFeatureKey: featureKey,
        overlayFilter: featureKey,
        selectedOverlayId: overlay.id,
        activeBoneId: "head",
        activeSlotId: slotId,
        workflowMode: "overlay",
      });
      applyFaceBrushPreset(featureKey);
    }
  }

  function handleOverlayNameChange(overlay: FaceOverlay, name: string) {
    if (!activeEntity) return;
    const nextOverlay: FaceOverlay = {
      ...overlay,
      name,
    };
    upsertEntityFaceOverlay(activeEntity.id, nextOverlay);

    const docs = project.editorMeta.spriteEditorDocuments.filter(doc =>
      doc.target.kind === "face-overlay" &&
      doc.target.entityId === activeEntity.id &&
      doc.target.overlayId === overlay.id,
    );
    for (const doc of docs) {
      upsertSpriteEditorDocument({
        ...doc,
        name,
        updatedAt: Date.now(),
      });
    }
  }

  function handleOpenSelection() {
    if (!activeEntity) return;
    switchMode("sprite-editor");
    if (selectedPart && selectedItem) {
      const itemParts = selectedItem.parts ?? [];
      const docs = itemParts.map(part => createDocumentFromItemPart(activeEntity.id, selectedItem, part));
      for (const doc of docs) {
        upsertSpriteEditorDocument(doc);
      }
      const activeSelectionDoc = docs.find(doc => doc.target.partId === selectedPart.id) ?? docs[0];
      if (activeSelectionDoc) {
        setActiveSpriteDocument(activeSelectionDoc.id);
        setSelectedLayerId(activeSelectionDoc.layers[0]?.id ?? null);
        ensureSelection(activeSelectionDoc.layers[0]?.shapes[0]?.id ?? null);
      }
      return;
    }
    if (selectedVisual) {
      const doc = createDocumentFromEntityVisual(activeEntity.id, selectedVisual);
      upsertSpriteEditorDocument(doc);
      setActiveSpriteDocument(doc.id);
      setSelectedLayerId(doc.layers[0]?.id ?? null);
      ensureSelection(doc.layers[0]?.shapes[0]?.id ?? null);
    }
  }

  function handleNewFaceOverlay(featureKey: "generic" | keyof Omit<FaceCustomization, "overlays"> = "generic") {
    if (!activeEntity) return;
    switchMode("face-editor");
    applyFaceBrushPreset(featureKey);
    const doc = createDocumentFromFaceOverlay(activeEntity.id);
    const overlayId = doc.target.overlayId ?? `face_overlay_${doc.id}`;
    const slotId = featureKey === "generic" ? null : FACE_FEATURE_TO_SLOT[featureKey] ?? null;
    const overlayRole = faceAuthoring.draftOverlayRole ?? getDefaultFaceOverlayRole(featureKey);
    const symmetryMode = faceAuthoring.draftSymmetryMode ?? getDefaultFaceOverlaySymmetry(featureKey);
    const paintTarget = faceAuthoring.draftPaintTarget ?? getDefaultFacePaintTarget(overlayRole);
    const suggestedTool = getSuggestedToolForPaintTarget(paintTarget);
    setActiveFaceCanvasFocusMode("head");
    setActiveFaceCanvasTool(suggestedTool);
    setSpriteTool(suggestedTool);
    setEntityFaceAuthoringState(activeEntity.id, {
      activeFeatureKey: featureKey,
      overlayFilter: featureKey,
      selectedOverlayId: overlayId,
      activeBoneId: "head",
      activeSlotId: slotId,
      workflowMode: "overlay",
      draftOverlayRole: overlayRole,
      draftPaintTarget: paintTarget,
      draftSymmetryMode: symmetryMode,
      drawMode: suggestedTool,
      focusMode: "head",
    });
    setSelectedSlot(slotId);
    setEditorSelection({
      kind: "face-overlay",
      entityId: activeEntity.id,
      overlayId,
      featureKey,
      slotId,
    });
    const defaults = FACE_OVERLAY_DEFAULTS[featureKey];
    const seededDoc: SpriteEditorDocument = {
      ...doc,
      name: defaults.name,
      width: defaults.width,
      height: defaults.height,
      pivot: {
        x: defaults.width / 2,
        y: defaults.height / 2,
        preset: "custom",
      },
      authoringHint: {
        ...(doc.authoringHint ?? {}),
        faceFeatureKey: featureKey,
        faceOverlayRole: overlayRole,
        symmetryMode,
        paintTarget,
        paintToolPreset: "vector_brush",
      },
    };
    upsertSpriteEditorDocument(seededDoc);
    setActiveSpriteDocument(seededDoc.id);
    setSelectedLayerId(seededDoc.layers[0]?.id ?? null);
    ensureSelection(seededDoc.layers[0]?.shapes[0]?.id ?? null);
  }

  function handleOpenOrCreateFaceOverlay(
    featureKey: "generic" | keyof Omit<FaceCustomization, "overlays"> = activeFaceFeature,
  ) {
    if (!activeEntity) return;
    const existingOverlay = faceOverlays.find(overlay => (overlay.featureTag ?? "generic") === featureKey);
    if (existingOverlay) {
      switchMode("sprite-editor");
      openFaceOverlayDocument(existingOverlay);
      return;
    }
    handleNewFaceOverlay(featureKey);
  }

  function handleCreateLayer() {
    if (!activeDoc) return;
    const nextLayer = createEmptySpriteLayer(`Layer ${activeDoc.layers.length + 1}`);
    nextLayer.zIndex = activeDoc.layers.length;
    patchDocument(doc => ({
      ...doc,
      layers: [...doc.layers, nextLayer],
    }));
    setSelectedLayerId(nextLayer.id);
    setSelectedShapeId(null);
  }

  function handleLayerPatch(layerId: string, patch: Partial<SpriteEditorDocument["layers"][number]>) {
    if (!activeDoc) return;
    patchDocument(doc => ({
      ...doc,
      layers: doc.layers.map(layer => layer.id === layerId ? { ...layer, ...patch } : layer),
    }));
  }

  function handleDeleteLayer() {
    if (!activeDoc || !currentLayer || activeDoc.layers.length <= 1) return;
    const nextLayers = activeDoc.layers.filter(layer => layer.id !== currentLayer.id);
    patchDocument(doc => ({
      ...doc,
      layers: nextLayers,
    }));
    setSelectedLayerId(nextLayers[0]?.id ?? null);
    setSelectedShapeId(nextLayers[0]?.shapes[0]?.id ?? null);
  }

  function handleMoveLayer(direction: -1 | 1) {
    if (!activeDoc || !currentLayer) return;
    const index = activeDoc.layers.findIndex(layer => layer.id === currentLayer.id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= activeDoc.layers.length) return;
    const nextLayers = [...activeDoc.layers];
    const [layer] = nextLayers.splice(index, 1);
    nextLayers.splice(nextIndex, 0, layer);
    patchDocument(doc => ({
      ...doc,
      layers: nextLayers.map((candidate, orderIndex) => ({ ...candidate, zIndex: orderIndex })),
    }));
  }

  function handleAddShape(type: SpriteEditorShape["type"]) {
    if (!activeDoc || !currentLayer) return;
    const shape = createDefaultShape(type);
    patchDocument(doc => ({
      ...doc,
      layers: doc.layers.map(layer =>
        layer.id === currentLayer.id
          ? { ...layer, shapes: [...layer.shapes, shape] }
          : layer,
      ),
    }));
    ensureSelection(shape.id);
  }

  function appendShapesToCurrentLayer(shapes: SpriteEditorShape[]) {
    if (!activeDoc || !currentLayer || shapes.length === 0) return;
    patchDocument(doc => ({
      ...doc,
      layers: doc.layers.map(layer =>
        layer.id === currentLayer.id
          ? { ...layer, shapes: [...layer.shapes, ...shapes] }
          : layer,
      ),
    }));
    ensureSelection(shapes[shapes.length - 1]?.id ?? null);
  }

  function handleAddFaceQuickShapes(actionId: string) {
    if (!activeDoc || !currentLayer) return;
    const stroke = toolStrokeColor;
    const fill = toolFillColor;
    const shapes: SpriteEditorShape[] = [];

    switch (actionId) {
      case "eye_pair":
        shapes.push(
          {
            id: crypto.randomUUID(),
            type: "ellipse",
            x: 12,
            y: 8,
            width: 12,
            height: 8,
            rotation: 0,
            fill,
            stroke,
            strokeWidth: toolStrokeWidth,
          },
          {
            id: crypto.randomUUID(),
            type: "ellipse",
            x: 36,
            y: 8,
            width: 12,
            height: 8,
            rotation: 0,
            fill,
            stroke,
            strokeWidth: toolStrokeWidth,
          },
        );
        break;
      case "pupils":
        shapes.push(
          {
            id: crypto.randomUUID(),
            type: "ellipse",
            x: 16,
            y: 10,
            width: 4,
            height: 4,
            rotation: 0,
            fill: stroke,
            stroke,
            strokeWidth: Math.max(0.8, toolStrokeWidth * 0.7),
          },
          {
            id: crypto.randomUUID(),
            type: "ellipse",
            x: 40,
            y: 10,
            width: 4,
            height: 4,
            rotation: 0,
            fill: stroke,
            stroke,
            strokeWidth: Math.max(0.8, toolStrokeWidth * 0.7),
          },
        );
        break;
      case "brows_soft":
        shapes.push(
          {
            id: crypto.randomUUID(),
            type: "path",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            rotation: 0,
            fill: "none",
            stroke,
            strokeWidth: Math.max(1, toolStrokeWidth),
            pathData: "M 10 11 C 14 7, 21 7, 26 10",
          },
          {
            id: crypto.randomUUID(),
            type: "path",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            rotation: 0,
            fill: "none",
            stroke,
            strokeWidth: Math.max(1, toolStrokeWidth),
            pathData: "M 38 10 C 43 7, 50 7, 54 11",
          },
        );
        break;
      case "mouth_smile":
        shapes.push({
          id: crypto.randomUUID(),
          type: "path",
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          rotation: 0,
          fill: "none",
          stroke,
          strokeWidth: Math.max(1, toolStrokeWidth),
          pathData: "M 22 38 C 28 44, 36 44, 42 38",
        });
        break;
      case "mouth_open":
        shapes.push({
          id: crypto.randomUUID(),
          type: "ellipse",
          x: 24,
          y: 34,
          width: 16,
          height: 10,
          rotation: 0,
          fill,
          stroke,
          strokeWidth: Math.max(1, toolStrokeWidth),
        });
        break;
      case "hair_fringe":
        shapes.push({
          id: crypto.randomUUID(),
          type: "path",
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          rotation: 0,
          fill,
          stroke,
          strokeWidth: Math.max(1.1, toolStrokeWidth),
          pathData: "M 6 16 C 8 4, 24 1, 33 4 C 40 1, 56 4, 58 17 C 50 12, 43 13, 35 19 C 29 11, 21 12, 14 18 C 11 15, 9 15, 6 16 Z",
        });
        break;
      case "beard_goatee":
        shapes.push({
          id: crypto.randomUUID(),
          type: "path",
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          rotation: 0,
          fill,
          stroke,
          strokeWidth: Math.max(1.1, toolStrokeWidth),
          pathData: "M 24 30 C 23 38, 25 46, 32 52 C 39 46, 41 38, 40 30 C 37 33, 35 34, 32 34 C 29 34, 27 33, 24 30 Z",
        });
        break;
      default:
        shapes.push({
          id: crypto.randomUUID(),
          type: "path",
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          rotation: -8,
          fill: "none",
          stroke,
          strokeWidth: Math.max(1, toolStrokeWidth),
          pathData: "M 18 18 C 22 15, 28 15, 32 20",
        });
        break;
    }

    appendShapesToCurrentLayer(shapes);
  }

  function handleShapePatch(patch: Partial<SpriteEditorShape>) {
    if (!activeDoc || !currentLayer || !selectedShape) return;
    patchDocument(doc => ({
      ...doc,
      layers: doc.layers.map(layer =>
        layer.id === currentLayer.id
          ? {
              ...layer,
              shapes: layer.shapes.map(shape =>
                shape.id === selectedShape.id ? { ...shape, ...patch } : shape,
              ),
            }
          : layer,
      ),
    }));
  }

  function handleDuplicateShape() {
    if (!activeDoc || !currentLayer || !selectedShape) return;
    const duplicate = { ...selectedShape, id: crypto.randomUUID(), x: selectedShape.x + 6, y: selectedShape.y + 6 };
    patchDocument(doc => ({
      ...doc,
      layers: doc.layers.map(layer =>
        layer.id === currentLayer.id
          ? { ...layer, shapes: [...layer.shapes, duplicate] }
          : layer,
      ),
    }));
    ensureSelection(duplicate.id);
  }

  function handleFlipSelectedShape(axis: "horizontal" | "vertical") {
    if (!activeDoc || !currentLayer || !selectedShape) return;
    patchDocument(doc => ({
      ...doc,
      layers: doc.layers.map(layer =>
        layer.id === currentLayer.id
          ? {
              ...layer,
              shapes: layer.shapes.map(shape =>
                shape.id === selectedShape.id ? flipSpriteShape(shape, axis) : shape,
              ),
            }
          : layer,
      ),
    }));
  }

  function handleRotateSelectedShape(delta: number) {
    if (!selectedShape) return;
    const nextRotation = Number((selectedShape.rotation + delta).toFixed(2));
    handleShapePatch({ rotation: nextRotation });
  }

  function handleDeleteShape() {
    if (!activeDoc || !currentLayer || !selectedShape) return;
    const remaining = currentLayer.shapes.filter(shape => shape.id !== selectedShape.id);
    patchDocument(doc => ({
      ...doc,
      layers: doc.layers.map(layer =>
        layer.id === currentLayer.id
          ? { ...layer, shapes: remaining }
          : layer,
      ),
    }));
    ensureSelection(remaining[0]?.id ?? null);
  }

  function handleSaveToTarget() {
    if (!activeDoc) return;
    applyDocumentToTarget(activeDoc);
  }

  function placePivot(point: PreviewPoint) {
    patchDocument(doc => ({
      ...doc,
      pivot: { ...doc.pivot, x: point.x, y: point.y, preset: "custom" },
    }));
  }

  function beginResizeSelectedShape(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (!activeDoc || !currentLayer || !selectedShape || !selectedShapeBounds) return;
    previewInteractionRef.current = {
      kind: "shape-resize",
      layerId: currentLayer.id,
      shapeId: selectedShape.id,
      startBounds: selectedShapeBounds,
      beforeDoc: cloneSpriteEditorDocument(activeDoc),
      moved: false,
    };
  }

  function beginRotateSelectedShape(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (!activeDoc || !currentLayer || !selectedShape || !selectedShapeBounds) return;
    const point = getPreviewPoint(event);
    if (!point) return;
    const center = {
      x: selectedShapeBounds.minX + selectedShapeBounds.width / 2,
      y: selectedShapeBounds.minY + selectedShapeBounds.height / 2,
    };
    previewInteractionRef.current = {
      kind: "shape-rotate",
      layerId: currentLayer.id,
      shapeId: selectedShape.id,
      center,
      startAngle: getAngleDegrees(center, point),
      startRotation: selectedShape.rotation,
      beforeDoc: cloneSpriteEditorDocument(activeDoc),
      moved: false,
    };
  }

  function appendFreehandPoint(points: PreviewPoint[], point: PreviewPoint) {
    const last = points[points.length - 1];
    if (!last) return [...points, point];
    const distance = Math.hypot(point.x - last.x, point.y - last.y);
    if (distance < 1.2) return points;
    return [...points, point];
  }

  function applyPaintToShape(layerId: string, shapeId: string, target: SpriteEditorPaintTarget) {
    patchDocument(doc => ({
      ...doc,
      layers: doc.layers.map(layer =>
        layer.id === layerId
          ? {
              ...layer,
              shapes: layer.shapes.map(shape =>
                  shape.id === shapeId
                    ? {
                        ...shape,
                        fill: target === "stroke" ? shape.fill : toolFillColor,
                        stroke: target === "fill" ? shape.stroke : toolStrokeColor,
                        strokeWidth: target === "fill" ? shape.strokeWidth : toolStrokeWidth,
                      }
                    : shape,
                ),
              }
            : layer,
        ),
    }));
  }

  function eraseShape(layerId: string, shapeId: string, options?: { recordHistory?: boolean }) {
    patchDocument(doc => ({
      ...doc,
      layers: doc.layers.map(layer =>
        layer.id === layerId
          ? {
              ...layer,
              shapes: layer.shapes.filter(shape => shape.id !== shapeId),
            }
          : layer,
      ),
    }), options);
    if (selectedShapeId === shapeId) {
      setSelectedShapeId(null);
    }
  }

  function handlePreviewMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    if (!activeDoc) return;
    const point = getPreviewPoint(event);
    if (!point) return;
    setHoverPreviewPoint(point);

    if (event.button === 2 || event.altKey) {
      const hit = hitTestSpriteDocument(activeDoc, point.x, point.y);
      if (!hit) return;
      setHoverPreviewShapeId(hit.shapeId);
      const layer = activeDoc.layers.find(candidate => candidate.id === hit.layerId);
      const shape = layer?.shapes.find(candidate => candidate.id === hit.shapeId);
      if (!shape) return;
      setSelectedLayerId(hit.layerId);
      setSelectedShapeId(hit.shapeId);
      setToolStrokeColor(shape.stroke);
      setToolFillColor(shape.fill);
      setToolStrokeWidth(shape.strokeWidth);
      return;
    }

    if (spriteTool === "fill") {
      const hit = hitTestSpriteDocument(activeDoc, point.x, point.y);
      if (!hit) return;
      setSelectedLayerId(hit.layerId);
      setSelectedShapeId(hit.shapeId);
        applyPaintToShape(hit.layerId, hit.shapeId, activeDocPaintTarget);
      previewInteractionRef.current = {
        kind: "fill-sweep",
        filledShapeIds: [hit.shapeId],
        beforeDoc: cloneSpriteEditorDocument(activeDoc),
        moved: false,
      };
      return;
    }

    if (spriteTool === "eraser") {
      const hit = hitTestSpriteDocument(activeDoc, point.x, point.y);
      if (!hit) return;
      setSelectedLayerId(hit.layerId);
      eraseShape(hit.layerId, hit.shapeId, { recordHistory: false });
      previewInteractionRef.current = {
        kind: "erase-sweep",
        erasedShapeIds: [hit.shapeId],
        beforeDoc: cloneSpriteEditorDocument(activeDoc),
        moved: false,
      };
      return;
    }

    if ((spriteTool === "pencil" || spriteTool === "closed-pencil") && currentLayer) {
      const closed = spriteTool === "closed-pencil";
      const shape = createFreehandPathShape([point], {
        stroke: toolStrokeColor,
        strokeWidth: toolStrokeWidth,
        fill: closed ? toolFillColor : "none",
        closed,
        smooth: true,
      });
      const shouldMirrorStroke = activeDoc.target.kind === "face-overlay" && activeDocSymmetryMode === "mirror_x";
      const mirroredPoint = shouldMirrorStroke ? mirrorPointAcrossWidth(point, activeDoc.width) : null;
      const mirroredShape = shouldMirrorStroke && mirroredPoint
        ? createFreehandPathShape([mirroredPoint], {
          stroke: toolStrokeColor,
          strokeWidth: toolStrokeWidth,
          fill: closed ? toolFillColor : "none",
          closed,
          smooth: true,
        })
        : null;
      const beforeDoc = cloneSpriteEditorDocument(activeDoc);
      patchDocument(doc => ({
        ...doc,
        layers: doc.layers.map(layer =>
          layer.id === currentLayer.id
            ? { ...layer, shapes: [...layer.shapes, shape, ...(mirroredShape ? [mirroredShape] : [])] }
            : layer,
        ),
      }), { recordHistory: false });
      setSelectedLayerId(currentLayer.id);
      setSelectedShapeId(shape.id);
      previewInteractionRef.current = {
        kind: "pencil-draw",
        layerId: currentLayer.id,
        shapeId: shape.id,
        mirroredShapeId: mirroredShape?.id ?? null,
        points: [point],
        mirroredPoints: mirroredPoint ? [mirroredPoint] : undefined,
        closed,
        beforeDoc,
        moved: false,
      };
      return;
    }

    const hit = hitTestSpriteDocument(activeDoc, point.x, point.y);
    if (hit) {
      setSelectedLayerId(hit.layerId);
      setSelectedShapeId(hit.shapeId);
      previewInteractionRef.current = {
        kind: "shape-drag",
        layerId: hit.layerId,
        shapeId: hit.shapeId,
        startPoint: point,
        beforeDoc: cloneSpriteEditorDocument(activeDoc),
        moved: false,
      };
      return;
    }

    previewInteractionRef.current = {
      kind: "pivot-place",
      startPoint: point,
      moved: false,
    };
  }

  function handlePreviewMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (!activeDoc) return;
    const point = getPreviewPoint(event);
    if (point) {
      setHoverPreviewPoint(point);
      const hoverHit = hitTestSpriteDocument(activeDoc, point.x, point.y);
      setHoverPreviewShapeId(hoverHit?.shapeId ?? null);
    }
    const interaction = previewInteractionRef.current;
    if (!interaction) return;
    if (!point) return;

    if (interaction.kind === "shape-drag") {
      const deltaX = Number((point.x - interaction.startPoint.x).toFixed(2));
      const deltaY = Number((point.y - interaction.startPoint.y).toFixed(2));
      if (Math.abs(deltaX) <= 0.01 && Math.abs(deltaY) <= 0.01) {
        return;
      }
      patchDocument(doc => ({
        ...doc,
        layers: doc.layers.map(layer =>
          layer.id === interaction.layerId
            ? {
                ...layer,
                shapes: layer.shapes.map(shape =>
                  shape.id === interaction.shapeId
                    ? translateSpriteShape(shape, deltaX, deltaY)
                    : shape,
                ),
              }
            : layer,
        ),
      }), { recordHistory: false });
      previewInteractionRef.current = {
        ...interaction,
        startPoint: point,
        moved: true,
      };
      return;
    }

    if (interaction.kind === "pencil-draw") {
      const nextPoints = appendFreehandPoint(interaction.points, point);
      if (nextPoints === interaction.points) return;
      const nextMirroredPoints = interaction.mirroredShapeId
        ? appendFreehandPoint(interaction.mirroredPoints ?? [], mirrorPointAcrossWidth(point, activeDoc.width))
        : interaction.mirroredPoints;
      patchDocument(doc => ({
        ...doc,
        layers: doc.layers.map(layer =>
          layer.id === interaction.layerId
            ? {
                ...layer,
                shapes: layer.shapes.map(shape =>
                  shape.id === interaction.shapeId
                    ? {
                        ...shape,
                        fill: interaction.closed ? toolFillColor : "none",
                        stroke: toolStrokeColor,
                        strokeWidth: toolStrokeWidth,
                        pathData: buildPathDataFromPoints(nextPoints, {
                          closed: interaction.closed,
                          smooth: true,
                        }),
                      }
                    : interaction.mirroredShapeId && shape.id === interaction.mirroredShapeId && nextMirroredPoints
                      ? {
                        ...shape,
                        fill: interaction.closed ? toolFillColor : "none",
                        stroke: toolStrokeColor,
                        strokeWidth: toolStrokeWidth,
                        pathData: buildPathDataFromPoints(nextMirroredPoints, {
                          closed: interaction.closed,
                          smooth: true,
                        }),
                      }
                    : shape,
                ),
              }
            : layer,
        ),
      }), { recordHistory: false });
      previewInteractionRef.current = {
        ...interaction,
        points: nextPoints,
        mirroredPoints: nextMirroredPoints,
        moved: nextPoints.length > 1,
      };
      return;
    }

    if (interaction.kind === "erase-sweep") {
      const hit = hitTestSpriteDocument(activeDoc, point.x, point.y);
      if (!hit || interaction.erasedShapeIds.includes(hit.shapeId)) {
        return;
      }
      eraseShape(hit.layerId, hit.shapeId, { recordHistory: false });
      previewInteractionRef.current = {
        ...interaction,
        erasedShapeIds: [...interaction.erasedShapeIds, hit.shapeId],
        moved: true,
      };
      return;
    }

    if (interaction.kind === "fill-sweep") {
      const hit = hitTestSpriteDocument(activeDoc, point.x, point.y);
      if (!hit || interaction.filledShapeIds.includes(hit.shapeId)) {
        return;
      }
      applyPaintToShape(hit.layerId, hit.shapeId, activeDocPaintTarget);
      previewInteractionRef.current = {
        ...interaction,
        filledShapeIds: [...interaction.filledShapeIds, hit.shapeId],
        moved: true,
      };
      return;
    }

    if (interaction.kind === "shape-resize") {
      const nextWidth = Math.max(1, Number((point.x - interaction.startBounds.minX).toFixed(2)));
      const nextHeight = Math.max(1, Number((point.y - interaction.startBounds.minY).toFixed(2)));
      patchDocument(doc => ({
        ...doc,
        layers: doc.layers.map(layer =>
          layer.id === interaction.layerId
            ? {
                ...layer,
                shapes: layer.shapes.map(shape =>
                  shape.id === interaction.shapeId
                    ? resizeSpriteShape(shape, {
                        minX: interaction.startBounds.minX,
                        minY: interaction.startBounds.minY,
                        width: nextWidth,
                        height: nextHeight,
                      })
                    : shape,
                ),
              }
            : layer,
        ),
      }), { recordHistory: false });
      previewInteractionRef.current = { ...interaction, moved: true };
      return;
    }

    if (interaction.kind === "shape-rotate") {
      const currentAngle = getAngleDegrees(interaction.center, point);
      const nextRotation = Number((interaction.startRotation + currentAngle - interaction.startAngle).toFixed(2));
      patchDocument(doc => ({
        ...doc,
        layers: doc.layers.map(layer =>
          layer.id === interaction.layerId
            ? {
                ...layer,
                shapes: layer.shapes.map(shape =>
                  shape.id === interaction.shapeId
                    ? { ...shape, rotation: nextRotation }
                    : shape,
                ),
              }
            : layer,
        ),
      }), { recordHistory: false });
      previewInteractionRef.current = { ...interaction, moved: true };
      return;
    }

    previewInteractionRef.current = {
      ...interaction,
      moved:
        Math.abs(point.x - interaction.startPoint.x) > 0.01 ||
        Math.abs(point.y - interaction.startPoint.y) > 0.01,
    };
  }

  function handlePreviewMouseUp(event: React.MouseEvent<HTMLDivElement>) {
    const interaction = previewInteractionRef.current;
    previewInteractionRef.current = null;
    if (interaction?.kind === "pencil-draw") {
      if (interaction.closed && interaction.points.length >= 3) {
        patchDocument(doc => ({
          ...doc,
          layers: doc.layers.map(layer =>
            layer.id === interaction.layerId
              ? {
                  ...layer,
                  shapes: layer.shapes.map(shape =>
                    shape.id === interaction.shapeId
                      ? {
                          ...shape,
                          fill: toolFillColor,
                          stroke: toolStrokeColor,
                          strokeWidth: toolStrokeWidth,
                          pathData: buildPathDataFromPoints(interaction.points, {
                            closed: true,
                            smooth: true,
                          }),
                        }
                      : interaction.mirroredShapeId && shape.id === interaction.mirroredShapeId && interaction.mirroredPoints
                        ? {
                          ...shape,
                          fill: toolFillColor,
                          stroke: toolStrokeColor,
                          strokeWidth: toolStrokeWidth,
                          pathData: buildPathDataFromPoints(interaction.mirroredPoints, {
                            closed: true,
                            smooth: true,
                          }),
                        }
                      : shape,
                  ),
                }
              : layer,
          ),
        }), { recordHistory: false });
      }
      const latestDoc = getLatestDocumentSnapshot(interaction.beforeDoc.id);
      if (latestDoc) {
        recordDocumentHistory(interaction.beforeDoc, latestDoc);
      }
      ensureSelection(interaction.shapeId);
      return;
    }
    if (interaction?.kind === "erase-sweep") {
      const latestDoc = getLatestDocumentSnapshot(interaction.beforeDoc.id);
      if (latestDoc) {
        recordDocumentHistory(interaction.beforeDoc, latestDoc);
      }
      return;
    }
    if (interaction?.kind === "fill-sweep") {
      const latestDoc = getLatestDocumentSnapshot(interaction.beforeDoc.id);
      if (latestDoc) {
        recordDocumentHistory(interaction.beforeDoc, latestDoc);
      }
      return;
    }
    if (interaction?.kind === "shape-drag" || interaction?.kind === "shape-resize" || interaction?.kind === "shape-rotate") {
      const latestDoc = getLatestDocumentSnapshot(interaction.beforeDoc.id);
      if (latestDoc) {
        recordDocumentHistory(interaction.beforeDoc, latestDoc);
      }
      return;
    }
    if (!interaction || interaction.kind !== "pivot-place") return;
    const point = getPreviewPoint(event);
    if (point) {
      placePivot(point);
    }
  }

  function handlePreviewMouseLeave() {
    setHoverPreviewPoint(null);
    setHoverPreviewShapeId(null);
    const interaction = previewInteractionRef.current;
    if (!interaction) return;
    previewInteractionRef.current = null;
    if (
      interaction.kind === "pencil-draw" ||
      interaction.kind === "erase-sweep" ||
      interaction.kind === "fill-sweep" ||
      interaction.kind === "shape-drag" ||
      interaction.kind === "shape-resize" ||
      interaction.kind === "shape-rotate"
    ) {
      const latestDoc = getLatestDocumentSnapshot(interaction.beforeDoc.id);
      if (latestDoc) {
        recordDocumentHistory(interaction.beforeDoc, latestDoc);
      }
    }
  }

  return (
    <>
    <div className="flex h-full bg-background">
      <div className="w-64 border-r border-border bg-sidebar/40">
        <ScrollArea className="h-full">
          <div className="p-3 space-y-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Authoring</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Open the selected item part or entity visual, draw vector shapes, then save back into the project.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-1">
              <Button
                size="sm"
                variant={activeMode === "sprite-editor" ? "default" : "outline"}
                className="h-8 text-[11px]"
                onClick={() => switchMode("sprite-editor")}
              >
                Sprite
              </Button>
              <Button
                size="sm"
                variant={activeMode === "body-morph" ? "default" : "outline"}
                className="h-8 text-[11px]"
                onClick={() => switchMode("body-morph")}
                disabled={!activeEntity}
              >
                Morph
              </Button>
              <Button
                size="sm"
                variant={activeMode === "face-editor" ? "default" : "outline"}
                className="h-8 text-[11px]"
                onClick={() => switchMode("face-editor")}
                disabled={!activeEntity}
              >
                Face
              </Button>
            </div>

            <div className="space-y-2">
              <Button
                size="sm"
                className="w-full h-8 text-xs"
                onClick={handleOpenSelection}
                disabled={!selectedPart && !selectedVisual}
              >
                Open Current Selection
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full h-8 text-xs"
                onClick={() => handleOpenOrCreateFaceOverlay()}
                disabled={!activeEntity}
              >
                {activeFaceFeature === "generic"
                  ? "Open Or Create Generic Overlay"
                  : `Open Or Create ${FACE_WORKSPACE_LABELS[activeFaceFeature]} Overlay`}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full h-8 text-xs"
                onClick={() => setIsSpriteStudioOpen(true)}
                disabled={!activeDoc}
              >
                Open Sprite Studio
              </Button>
            </div>

            {faceOverlays.length > 0 && (
              <div className="space-y-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Face Overlays</p>
                    <Select
                      value={faceAuthoring.overlayGrouping}
                      onValueChange={value => {
                        if (!activeEntity) return;
                        setEntityFaceAuthoringState(activeEntity.id, {
                          overlayGrouping: value as "feature" | "feature_role" | "feature_role_paint",
                        });
                      }}
                    >
                      <SelectTrigger className="h-7 w-[128px] text-[11px] bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-foreground text-xs">
                        <SelectItem value="feature" className="text-xs">By Feature</SelectItem>
                        <SelectItem value="feature_role" className="text-xs">Feature + Role</SelectItem>
                        <SelectItem value="feature_role_paint" className="text-xs">Feature + Role + Paint</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Select
                      value={faceAuthoring.overlayFilter}
                      onValueChange={value => {
                        if (!activeEntity) return;
                        const nextValue = value as FaceFeatureKey | "generic" | "all";
                        const nextSelectedOverlay = nextValue === "all"
                          ? selectedFaceOverlay
                          : faceOverlays.find(overlay =>
                            overlay.id === faceAuthoring.selectedOverlayId &&
                            (overlay.featureTag ?? "generic") === nextValue,
                          ) ?? null;
                        setEntityFaceAuthoringState(activeEntity.id, {
                          overlayFilter: nextValue,
                          activeFeatureKey: nextValue === "all" ? activeFaceFeature : nextValue,
                          selectedOverlayId: nextSelectedOverlay?.id ?? null,
                        });
                      }}
                    >
                      <SelectTrigger className="h-7 text-[11px] bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-foreground text-xs">
                        <SelectItem value="all" className="text-xs">All features</SelectItem>
                        <SelectItem value="generic" className="text-xs">Generic</SelectItem>
                        <SelectItem value="eyes" className="text-xs">Eyes</SelectItem>
                        <SelectItem value="mouth" className="text-xs">Mouth</SelectItem>
                        <SelectItem value="brows" className="text-xs">Brows</SelectItem>
                        <SelectItem value="beard" className="text-xs">Beard</SelectItem>
                        <SelectItem value="hair" className="text-xs">Hair</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={faceAuthoring.overlayRoleFilter}
                      onValueChange={value => {
                        if (!activeEntity) return;
                        setEntityFaceAuthoringState(activeEntity.id, {
                          overlayRoleFilter: value as "all" | "base" | "line" | "detail" | "shadow" | "highlight",
                        });
                      }}
                    >
                      <SelectTrigger className="h-7 text-[11px] bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-foreground text-xs">
                        <SelectItem value="all" className="text-xs">All roles</SelectItem>
                        <SelectItem value="base" className="text-xs">Base</SelectItem>
                        <SelectItem value="line" className="text-xs">Line</SelectItem>
                        <SelectItem value="detail" className="text-xs">Detail</SelectItem>
                        <SelectItem value="shadow" className="text-xs">Shadow</SelectItem>
                        <SelectItem value="highlight" className="text-xs">Highlight</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={faceAuthoring.paintTargetFilter}
                      onValueChange={value => {
                        if (!activeEntity) return;
                        setEntityFaceAuthoringState(activeEntity.id, {
                          paintTargetFilter: value as "all" | "fill" | "stroke" | "both",
                        });
                      }}
                    >
                      <SelectTrigger className="h-7 text-[11px] bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-foreground text-xs">
                        <SelectItem value="all" className="text-xs">All paint</SelectItem>
                        <SelectItem value="fill" className="text-xs">Fill</SelectItem>
                        <SelectItem value="stroke" className="text-xs">Line</SelectItem>
                        <SelectItem value="both" className="text-xs">Both</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  {groupedFaceOverlays.map(([groupKey, overlays]) => (
                    <div key={groupKey} className="space-y-1">
                      <p className="text-[10px] font-medium text-muted-foreground">{groupKey.replaceAll(":", " · ")}</p>
                      {overlays.map(overlay => (
                        <button
                          key={overlay.id}
                          onClick={() => {
                            if (!activeEntity) return;
                            openFaceOverlayDocument(overlay);
                          }}
                          className={[
                            "w-full rounded border px-2 py-1.5 text-left text-xs transition-colors",
                            faceAuthoring.selectedOverlayId === overlay.id
                              ? "border-primary/50 bg-primary/10 text-foreground"
                              : "border-border bg-background/50 text-muted-foreground hover:text-foreground hover:bg-accent/30",
                          ].join(" ")}
                        >
                          <div className="truncate font-medium">{overlay.name}</div>
                          <div className="truncate text-[10px] opacity-80">
                            overlay · {getFaceFeatureLabel(overlay.featureTag)}
                            {overlay.editorDocumentId && " · linked doc"}
                          </div>
                          <div className="truncate text-[10px] opacity-70">
                            {`${getOverlayRoleLabel(overlay.overlayRole)} · ${getPaintTargetLabel(overlay.paintTarget ?? "both")}`}
                          </div>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator className="bg-border" />

            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Documents</p>
              <div className="space-y-2">
                {project.editorMeta.spriteEditorDocuments.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">No editor documents yet.</p>
                )}
                {groupedDocuments.map(([groupKey, docs]) => (
                  <div key={groupKey} className="space-y-1">
                    <p className="text-[10px] font-medium text-muted-foreground">{getRichDocumentGroupLabel(groupKey)}</p>
                    {docs.map(doc => (
                      <button
                        key={doc.id}
                        onClick={() => {
                          if (doc.target.kind === "face-overlay" && doc.target.entityId) {
                            const featureKey = doc.authoringHint?.faceFeatureKey ?? "generic";
                            setEntityFaceAuthoringState(doc.target.entityId, {
                              activeFeatureKey: featureKey,
                              overlayFilter: featureKey,
                              selectedOverlayId: doc.target.overlayId ?? null,
                            });
                          }
                          setActiveSpriteDocument(doc.id);
                          setSelectedLayerId(doc.layers[0]?.id ?? null);
                          ensureSelection(doc.layers[0]?.shapes[0]?.id ?? null);
                        }}
                        className={[
                          "w-full rounded border px-2 py-1.5 text-left text-xs transition-colors",
                          activeDoc?.id === doc.id
                            ? "border-primary/50 bg-primary/10 text-foreground"
                            : "border-border bg-background/50 text-muted-foreground hover:text-foreground hover:bg-accent/30",
                        ].join(" ")}
                      >
                        <div className="font-medium truncate">{doc.name}</div>
                        <div className="text-[10px] opacity-80 truncate">
                          {doc.target.kind}
                          {doc.target.kind === "face-overlay" && ` · ${getFaceFeatureLabel(doc.authoringHint?.faceFeatureKey)}`}
                          {doc.target.kind === "face-overlay" && doc.target.overlayId && " · overlay doc"}
                          {doc.target.kind !== "face-overlay" && doc.authoringHint?.bodyMorphPresetId && ` · ${getBodyMorphPresetLabel(doc.authoringHint.bodyMorphPresetId)}`}
                        </div>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>

      {activeMode === "body-morph" ? (
        <div className="flex-1 grid grid-cols-[0.9fr,1.1fr]">
          <div className="border-r border-border p-3">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-foreground">Body Morph Workspace</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  These sliders update the active entity immediately in canvas, animation preview and save data.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Presets</p>
                <div className="grid grid-cols-2 gap-2">
                  {BODY_MORPH_PRESETS.map(preset => (
                    <Button
                      key={preset.id}
                      size="sm"
                      variant="outline"
                      className="h-8 text-[11px]"
                      onClick={() => applyMorphPreset(preset.id, preset.values)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-[11px]"
                    onClick={() => applyMorphPreset("balanced", DEFAULT_BODY_MORPHS)}
                  >
                    Reset
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Body Regions</p>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(BODY_REGION_LABELS) as BodyMorphRegionId[]).map(region => (
                    <Button
                      key={region}
                      size="sm"
                      variant={bodyAuthoring.focusRegion === region ? "default" : "outline"}
                      className="h-8 text-[11px]"
                      onClick={() => {
                        if (!activeEntity) return;
                        patchBodyWorkflow({
                          focusRegion: region,
                          intent: "morph",
                          viewportMode: "focus_region",
                        });
                      }}
                    >
                      {BODY_REGION_LABELS[region]}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Body Intent</Label>
                  <Select
                    value={bodyAuthoring.intent ?? "morph"}
                    onValueChange={value => patchBodyWorkflow({ intent: value as BodyAuthoringIntent })}
                  >
                    <SelectTrigger className="h-8 text-[11px] bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground text-xs">
                      {(Object.keys(BODY_AUTHORING_INTENT_LABELS) as BodyAuthoringIntent[]).map(intent => (
                        <SelectItem key={intent} value={intent} className="text-xs">{BODY_AUTHORING_INTENT_LABELS[intent]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Viewport</Label>
                  <Select
                    value={bodyAuthoring.viewportMode ?? "focus_region"}
                    onValueChange={value => patchBodyWorkflow({ viewportMode: value as BodyAuthoringViewportMode })}
                  >
                    <SelectTrigger className="h-8 text-[11px] bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground text-xs">
                      {(Object.keys(BODY_VIEWPORT_MODE_LABELS) as BodyAuthoringViewportMode[]).map(mode => (
                        <SelectItem key={mode} value={mode} className="text-xs">{BODY_VIEWPORT_MODE_LABELS[mode]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Quick Body Actions · {BODY_REGION_LABELS[bodyAuthoring.focusRegion]}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {BODY_QUICK_ACTIONS[bodyAuthoring.focusRegion].map(action => (
                    <Button
                      key={action.id}
                      size="sm"
                      variant="outline"
                      className="h-8 text-[11px]"
                      onClick={() => applyMorphPreset(action.id, { ...bodyMorphs, ...action.values }, bodyAuthoring.focusRegion)}
                    >
                      {action.label}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-[11px]"
                    onClick={() => applyMorphPreset("balanced", DEFAULT_BODY_MORPHS, bodyAuthoring.focusRegion)}
                  >
                    Reset Balanced
                  </Button>
                </div>
              </div>

              {activeEntity && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Live Character Preview</p>
                  <LiveAuthoringPreview entityId={activeEntity.id} />
                  <p className="text-[10px] text-muted-foreground">
                    Morph changes apply directly to the active entity and re-render here in the same authoring flow.
                  </p>
                </div>
              )}

              <Separator className="bg-border" />

              <div className="space-y-2 text-[11px] text-muted-foreground">
                <div className="flex justify-between"><span>Profile</span><span>{getBodyMorphPresetLabel(activeEntity?.bodyMorphPresetId)}</span></div>
                <div className="flex justify-between"><span>Focus</span><span>{BODY_REGION_LABELS[bodyAuthoring.focusRegion]}</span></div>
                <div className="flex justify-between"><span>Intent</span><span>{BODY_AUTHORING_INTENT_LABELS[bodyAuthoring.intent ?? "morph"]}</span></div>
                <div className="flex justify-between"><span>Viewport</span><span>{BODY_VIEWPORT_MODE_LABELS[bodyAuthoring.viewportMode ?? "focus_region"]}</span></div>
                <div className="flex justify-between"><span>Target Bone</span><span>{bodyAuthoring.activeBoneId ?? "auto"}</span></div>
                <div className="flex justify-between"><span>Target Slot</span><span>{bodyAuthoring.activeSlotId ?? "none"}</span></div>
                <div className="flex justify-between"><span>Head</span><span>{bodyMorphs.headSize.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Torso</span><span>{bodyMorphs.torsoHeight.toFixed(2)} / {bodyMorphs.torsoWidth.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Arms</span><span>{bodyMorphs.armLength.toFixed(2)} / {bodyMorphs.forearmLength.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Legs</span><span>{bodyMorphs.legLength.toFixed(2)} / {bodyMorphs.shinLength.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Overall</span><span>{bodyMorphs.overallHeightScale.toFixed(2)}</span></div>
              </div>
            </div>
          </div>

          <ScrollArea className="h-full">
            <div className="p-3 space-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Morph Sliders · {BODY_REGION_LABELS[bodyAuthoring.focusRegion]}
                </p>
              </div>
              {activeBodyRegionKeys.map(key => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] text-foreground">{BODY_MORPH_LABELS[key]}</Label>
                    <span className="text-[10px] text-muted-foreground">{bodyMorphs[key].toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.65"
                    max="1.35"
                    step="0.01"
                    value={bodyMorphs[key]}
                    onChange={event => {
                      if (!activeEntity) return;
                      patchBodyWorkflow({
                        focusRegion: bodyAuthoring.focusRegion,
                        intent: "morph",
                      });
                      setEntityBodyAuthoringRegionPreset(activeEntity.id, bodyAuthoring.focusRegion, null);
                      setEntityBodyMorphValue(activeEntity.id, key, Number(event.target.value));
                    }}
                    className="w-full accent-primary"
                  />
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      ) : activeMode === "face-editor" ? (
        <div className="flex-1 grid grid-cols-[0.9fr,1.1fr]">
          <div className="border-r border-border p-3">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-foreground">Face Workspace</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Parametric face settings stay in the inspector, while custom overlays and draw-over parts live here.
                </p>
              </div>

              {faceCustomization && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Active Face Feature</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.keys(FACE_WORKSPACE_LABELS) as Array<keyof Omit<FaceCustomization, "overlays">>).map(key => (
                        <Button
                          key={key}
                          size="sm"
                          variant={activeFaceFeature === key ? "default" : "outline"}
                          className="h-8 text-[11px]"
                          onClick={() => {
                            if (!activeEntity) return;
                            applyFaceBrushPreset(key);
                            setEntityFaceAuthoringState(activeEntity.id, {
                              activeFeatureKey: key,
                              overlayFilter: key,
                              selectedOverlayId: null,
                              activeBoneId: "head",
                              activeSlotId: FACE_FEATURE_TO_SLOT[key] ?? null,
                              workflowMode: "feature",
                            });
                            setSelectedSlot(FACE_FEATURE_TO_SLOT[key] ?? null);
                          }}
                        >
                          {FACE_WORKSPACE_LABELS[key]}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded border border-border bg-background/50 p-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Workflow</Label>
                        <Select
                          value={faceAuthoring.workflowMode ?? "feature"}
                          onValueChange={value => patchFaceWorkflow({ workflowMode: value as FaceAuthoringWorkflowMode })}
                        >
                          <SelectTrigger className="h-8 text-[11px] bg-background border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground text-xs">
                            {(Object.keys(FACE_WORKFLOW_MODE_LABELS) as FaceAuthoringWorkflowMode[]).map(mode => (
                              <SelectItem key={mode} value={mode} className="text-xs">{FACE_WORKFLOW_MODE_LABELS[mode]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Draft Role</Label>
                        <Select
                          value={faceAuthoring.draftOverlayRole ?? "detail"}
                          onValueChange={value => patchFaceWorkflow({ draftOverlayRole: value as FaceOverlayRole })}
                        >
                          <SelectTrigger className="h-8 text-[11px] bg-background border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground text-xs">
                            {(Object.keys(FACE_OVERLAY_ROLE_LABELS) as FaceOverlayRole[]).map(role => (
                              <SelectItem key={role} value={role} className="text-xs">{FACE_OVERLAY_ROLE_LABELS[role]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Draft Paint</Label>
                        <Select
                          value={faceAuthoring.draftPaintTarget ?? "both"}
                          onValueChange={value => {
                            const paintTarget = value as SpriteEditorPaintTarget;
                            patchFaceWorkflow({ draftPaintTarget: paintTarget });
                            applyDraftPaintBehavior(paintTarget);
                          }}
                        >
                          <SelectTrigger className="h-8 text-[11px] bg-background border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground text-xs">
                            {(Object.keys(FACE_PAINT_TARGET_LABELS) as SpriteEditorPaintTarget[]).map(target => (
                              <SelectItem key={target} value={target} className="text-xs">{FACE_PAINT_TARGET_LABELS[target]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Draft Symmetry</Label>
                        <Select
                          value={faceAuthoring.draftSymmetryMode ?? "none"}
                          onValueChange={value => patchFaceWorkflow({ draftSymmetryMode: value as SpriteEditorSymmetryMode })}
                        >
                          <SelectTrigger className="h-8 text-[11px] bg-background border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground text-xs">
                            {(Object.keys(FACE_SYMMETRY_LABELS) as SpriteEditorSymmetryMode[]).map(mode => (
                              <SelectItem key={mode} value={mode} className="text-xs">{FACE_SYMMETRY_LABELS[mode]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
                      <div className="flex justify-between"><span>Target Bone</span><span className="text-foreground">{faceAuthoring.activeBoneId ?? "head"}</span></div>
                      <div className="flex justify-between"><span>Target Slot</span><span className="text-foreground">{faceAuthoring.activeSlotId ?? "head-local"}</span></div>
                    </div>
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Feature Controls</p>
                  {visibleFaceFeatures.map(key => {
                    const feature = faceCustomization[key];
                    return (
                      <div key={key} className="rounded border border-border bg-background/50 p-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-foreground">{FACE_WORKSPACE_LABELS[key]}</span>
                          <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={feature.visible}
                              onChange={event => {
                                if (!activeEntity) return;
                                setEntityFaceAuthoringState(activeEntity.id, { activeFeatureKey: key });
                                setEntityFaceFeature(activeEntity.id, key, { visible: event.target.checked });
                              }}
                            />
                            Visible
                          </label>
                        </div>

                        <Select
                          value={feature.presetId}
                          onValueChange={value => {
                            if (!activeEntity) return;
                            setEntityFaceAuthoringState(activeEntity.id, { activeFeatureKey: key });
                            setEntityFaceFeature(activeEntity.id, key, { presetId: value, visible: value !== "none" });
                          }}
                        >
                          <SelectTrigger className="h-7 text-[11px] bg-background border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground text-xs">
                            {FACE_PRESETS[key].map(preset => (
                              <SelectItem key={preset.id} value={preset.id} className="text-xs">
                                {preset.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={toColorInputValue(feature.color)}
                            onChange={event => {
                              if (!activeEntity) return;
                              setEntityFaceAuthoringState(activeEntity.id, { activeFeatureKey: key });
                              setEntityFaceFeature(activeEntity.id, key, { color: event.target.value });
                            }}
                            className="w-8 h-7 rounded border border-border bg-transparent"
                          />
                          <span className="text-[10px] text-muted-foreground font-mono">{feature.color}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px]">X</Label>
                            <NumericInput value={feature.transform.x} onChange={value => {
                              if (!activeEntity) return;
                              setEntityFaceAuthoringState(activeEntity.id, { activeFeatureKey: key });
                              setEntityFaceFeatureTransform(activeEntity.id, key, { x: value });
                            }} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px]">Y</Label>
                            <NumericInput value={feature.transform.y} onChange={value => {
                              if (!activeEntity) return;
                              setEntityFaceAuthoringState(activeEntity.id, { activeFeatureKey: key });
                              setEntityFaceFeatureTransform(activeEntity.id, key, { y: value });
                            }} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px]">Rotation</Label>
                            <NumericInput value={feature.transform.rotation} onChange={value => {
                              if (!activeEntity) return;
                              setEntityFaceAuthoringState(activeEntity.id, { activeFeatureKey: key });
                              setEntityFaceFeatureTransform(activeEntity.id, key, { rotation: value });
                            }} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px]">Scale</Label>
                            <NumericInput value={feature.transform.scaleX} onChange={value => {
                              if (!activeEntity) return;
                              setEntityFaceAuthoringState(activeEntity.id, { activeFeatureKey: key });
                              setEntityFaceFeatureTransform(activeEntity.id, key, { scaleX: value, scaleY: value });
                            }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

                {activeEntity && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Live Character Preview</p>
                      <Button
                        size="sm"
                        variant={activeFaceCanvasFocusMode === "head" ? "default" : "outline"}
                        className="h-7 text-[11px]"
                        onClick={() => enterDrawOnHeadMode(activeFaceCanvasTool ?? "pencil")}
                      >
                        Draw On Head
                      </Button>
                    </div>
                    <LiveAuthoringPreview
                      entityId={activeEntity.id}
                      frameSize={activeFaceCanvasFocusMode === "head" ? 320 : 256}
                      canvasClassName={activeFaceCanvasFocusMode === "head" ? "h-64 w-64 object-contain" : "h-52 w-52 object-contain"}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      {activeFaceCanvasFocusMode === "head"
                        ? "Draw On Head keeps the face workflow locked to the head overlay context while you paint."
                        : "Face presets, transforms and overlays update this preview through the same evaluated character pipeline."}
                    </p>
                  </div>
                )}

              <Separator className="bg-border" />

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Quick Overlay Actions</p>
                  <span className="text-[10px] text-muted-foreground">
                    Focus: {activeFaceFeature === "generic" ? "Generic" : FACE_WORKSPACE_LABELS[activeFaceFeature]}
                  </span>
                </div>
                <div className="rounded border border-border bg-background/50 p-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] text-foreground">
                        {selectedFaceOverlay ? selectedFaceOverlay.name : "No overlay selected"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {selectedFaceOverlay
                          ? `${getFaceFeatureLabel(selectedFaceOverlay.featureTag)} · ${selectedFaceOverlayDocument ? "linked document" : "overlay only"}`
                          : getFaceDrawingPreset(activeFaceFeature).description}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => applyFaceBrushPreset(selectedFaceOverlay?.featureTag ?? activeFaceFeature)}
                      disabled={!activeEntity}
                    >
                      Apply Brush Preset
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => selectedFaceOverlay && openFaceOverlayDocument(selectedFaceOverlay)}
                      disabled={!selectedFaceOverlay}
                    >
                      Open Selected
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => {
                        if (!activeEntity) return;
                        setEntityFaceAuthoringState(activeEntity.id, {
                          activeFeatureKey: activeFaceFeature,
                          overlayFilter: activeFaceFeature,
                          selectedOverlayId: null,
                        });
                      }}
                      disabled={!selectedFaceOverlay}
                    >
                      Clear Selection
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => handleOpenOrCreateFaceOverlay("eyes")} disabled={!activeEntity}>
                    Eyes Overlay
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => handleOpenOrCreateFaceOverlay("mouth")} disabled={!activeEntity}>
                    Mouth Overlay
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => handleOpenOrCreateFaceOverlay("brows")} disabled={!activeEntity}>
                    Brows Overlay
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => handleOpenOrCreateFaceOverlay("beard")} disabled={!activeEntity}>
                    Beard Overlay
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => handleOpenOrCreateFaceOverlay("hair")} disabled={!activeEntity}>
                    Hair Overlay
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => handleOpenOrCreateFaceOverlay("generic")} disabled={!activeEntity}>
                    Generic Overlay
                  </Button>
                </div>
              </div>

              <Button
                size="sm"
                className="w-full h-8 text-xs"
                onClick={() => handleOpenOrCreateFaceOverlay()}
                disabled={!activeEntity}
              >
                {activeFaceFeature === "generic"
                  ? "Open Or Create Generic Overlay"
                  : `Open Or Create ${FACE_WORKSPACE_LABELS[activeFaceFeature]} Overlay`}
              </Button>
            </div>
          </div>

          <ScrollArea className="h-full">
            <div className="p-3 space-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Overlay Documents · {faceAuthoring.overlayFilter === "all" ? "all features" : getFaceFeatureLabel(faceAuthoring.overlayFilter)}
                </p>
              </div>
              {filteredFaceOverlays.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">No face overlays yet. Create one to start drawing.</p>
              ) : (
                filteredFaceOverlays.map(overlay => (
                  <div
                    key={overlay.id}
                    className={[
                      "rounded border bg-background/50 p-3 space-y-2",
                      faceAuthoring.selectedOverlayId === overlay.id ? "border-primary/50 bg-primary/10" : "border-border",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-foreground">{overlay.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {getFaceFeatureLabel(overlay.featureTag)} · pivot {overlay.pivot.x}, {overlay.pivot.y}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px]"
                          onClick={() => {
                            if (!activeEntity) return;
                            switchMode("sprite-editor");
                            openFaceOverlayDocument(overlay);
                          }}
                        >
                          Open In Editor
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px]"
                          onClick={() => {
                            if (!activeEntity) return;
                            removeEntityFaceOverlay(activeEntity.id, overlay.id);
                            if (faceAuthoring.selectedOverlayId === overlay.id) {
                              setEntityFaceAuthoringState(activeEntity.id, {
                                selectedOverlayId: null,
                              });
                            }
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-[1fr,140px] gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Overlay Name</Label>
                        <Input
                          value={overlay.name}
                          onChange={event => handleOverlayNameChange(overlay, event.target.value)}
                          className="h-8 text-[11px] bg-background border-border"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Feature Tag</Label>
                        <Select
                          value={overlay.featureTag ?? "generic"}
                          onValueChange={value => handleOverlayFeatureTagChange(overlay, value as "eyes" | "mouth" | "brows" | "beard" | "hair" | "generic")}
                        >
                          <SelectTrigger className="h-8 text-[11px] bg-background border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground text-xs">
                            <SelectItem value="generic" className="text-xs">Generic</SelectItem>
                            <SelectItem value="eyes" className="text-xs">Eyes</SelectItem>
                            <SelectItem value="mouth" className="text-xs">Mouth</SelectItem>
                            <SelectItem value="brows" className="text-xs">Brows</SelectItem>
                            <SelectItem value="beard" className="text-xs">Beard</SelectItem>
                            <SelectItem value="hair" className="text-xs">Hair</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={faceAuthoring.selectedOverlayId === overlay.id ? "default" : "outline"}
                        className="h-7 text-[11px]"
                        onClick={() => {
                          if (!activeEntity) return;
                          const featureKey = overlay.featureTag ?? "generic";
                          const slotId = featureKey === "generic" ? null : FACE_FEATURE_TO_SLOT[featureKey] ?? null;
                          applyFaceBrushPreset(featureKey);
                          setEntityFaceAuthoringState(activeEntity.id, {
                            activeFeatureKey: featureKey,
                            overlayFilter: featureKey,
                            selectedOverlayId: overlay.id,
                            activeBoneId: "head",
                            activeSlotId: slotId,
                            workflowMode: "overlay",
                          });
                        }}
                      >
                        {faceAuthoring.selectedOverlayId === overlay.id ? "Selected" : "Select Overlay"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px]"
                        onClick={() => {
                          if (!activeEntity) return;
                          openFaceOverlayDocument(overlay);
                          enterDrawOnHeadMode("pencil");
                        }}
                      >
                        Draw On Head
                      </Button>
                      <span className="text-[10px] text-muted-foreground">
                        {overlay.editorDocumentId ? "doc-linked overlay" : "overlay without saved doc link"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      ) : (
      <div className="flex-1 grid grid-cols-[1.1fr,0.9fr]">
        <div className="border-r border-border p-3 overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-foreground">{activeDoc?.name ?? "No document selected"}</p>
              <p className="text-[11px] text-muted-foreground">
                {activeDoc ? `${activeDoc.width}×${activeDoc.height}` : "Open a selection to start editing."}
              </p>
            </div>
            {activeDoc && (
              <div className="flex items-center gap-2">
                {activeDoc.target.kind === "face-overlay" && (
                  <>
                    <Button
                      size="sm"
                      variant={activeFaceCanvasFocusMode === "head" ? "default" : "outline"}
                      className="h-8 text-xs"
                      onClick={() => enterDrawOnHeadMode(activeFaceCanvasTool ?? "pencil")}
                    >
                      Draw On Head
                    </Button>
                    <Button
                      size="sm"
                      variant={activeFaceCanvasFocusMode === "document" ? "default" : "outline"}
                      className="h-8 text-xs"
                      onClick={() => setFaceCanvasFocusMode("document")}
                    >
                      Document View
                    </Button>
                  </>
                )}
                <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={autoPreviewEnabled}
                    onChange={event => setAutoPreviewEnabled(event.target.checked)}
                  />
                  Live Preview
                </label>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => patchDocument(doc => ({ ...doc, referenceAsset: null }))}>
                  Clear Underlay
                </Button>
                <Button size="sm" className="h-8 text-xs" onClick={handleSaveToTarget}>
                  Save To Target
                </Button>
              </div>
            )}
          </div>

          <div className="h-[calc(100%-3rem)] rounded border border-border bg-[#141622] p-3 overflow-auto">
            {activeDoc ? (
              <div
                ref={previewFrameRef}
                className="mx-auto relative bg-white/5 rounded border border-border overflow-hidden cursor-crosshair"
                style={{ width: activeDoc.width * previewScale, height: activeDoc.height * previewScale }}
                onContextMenu={event => event.preventDefault()}
                onMouseDown={handlePreviewMouseDown}
                onMouseMove={handlePreviewMouseMove}
                onMouseUp={handlePreviewMouseUp}
                onMouseLeave={handlePreviewMouseLeave}
              >
                <div
                  className="absolute inset-0"
                  dangerouslySetInnerHTML={{ __html: previewSvg }}
                />
                {activeDoc.layers
                  .filter(layer => layer.visible)
                  .flatMap(layer => layer.shapes.map(shape => ({ layerId: layer.id, shape })))
                  .map(({ layerId, shape }) => {
                    const bounds = computeShapeBounds(shape);
                    return (
                      <div
                          key={`${layerId}-${shape.id}`}
                          className={[
                            "absolute pointer-events-none border transition-colors",
                            selectedShape?.id === shape.id
                              ? "border-amber-300/90"
                              : hoverPreviewShapeId === shape.id && spriteTool === "fill"
                                ? "border-emerald-300/95 bg-emerald-300/10"
                                : hoverPreviewShapeId === shape.id && spriteTool === "eraser"
                                  ? "border-red-300/95 bg-red-300/10"
                                  : "border-white/25",
                          ].join(" ")}
                        style={{
                          left: bounds.minX * previewScale,
                          top: bounds.minY * previewScale,
                          width: Math.max(bounds.width * previewScale, 1),
                          height: Math.max(bounds.height * previewScale, 1),
                          transform: shape.rotation ? `rotate(${shape.rotation}deg)` : undefined,
                          transformOrigin: "center center",
                        }}
                      />
                    );
                  })}
                {selectedShape && selectedShapeBounds && (
                  <>
                    <button
                      type="button"
                      aria-label="Rotate shape"
                      onMouseDown={beginRotateSelectedShape}
                      className="absolute h-3 w-3 rounded-full border border-amber-300 bg-[#141622] shadow-sm"
                      style={{
                        left: (selectedShapeBounds.minX + selectedShapeBounds.width / 2) * previewScale,
                        top: (selectedShapeBounds.minY - 12) * previewScale,
                        transform: "translate(-50%, -50%)",
                      }}
                    />
                    <button
                      type="button"
                      aria-label="Resize shape"
                      onMouseDown={beginResizeSelectedShape}
                      className="absolute h-3 w-3 rounded-sm border border-cyan-300 bg-[#141622] shadow-sm"
                      style={{
                        left: (selectedShapeBounds.minX + selectedShapeBounds.width) * previewScale,
                        top: (selectedShapeBounds.minY + selectedShapeBounds.height) * previewScale,
                        transform: "translate(-50%, -50%)",
                      }}
                    />
                  </>
                )}
                {contentBounds && (
                  <div
                    className="absolute border border-dashed border-cyan-400/80 pointer-events-none"
                    style={{
                      left: contentBounds.minX * previewScale,
                      top: contentBounds.minY * previewScale,
                      width: Math.max(contentBounds.width * previewScale, 1),
                      height: Math.max(contentBounds.height * previewScale, 1),
                    }}
                  />
                )}
                {activeDoc.target.kind === "face-overlay" && activeDocSymmetryMode === "mirror_x" && (
                  <div
                    className="absolute top-0 bottom-0 border-l border-dashed border-pink-400/80 pointer-events-none"
                    style={{
                      left: activeDoc.width * previewScale * 0.5,
                    }}
                  />
                )}
                {hoverPreviewShapeId && (spriteTool === "fill" || spriteTool === "eraser") && (
                  <div className="absolute left-2 top-2 rounded bg-black/45 px-2 py-1 text-[10px] text-foreground pointer-events-none">
                    {spriteTool === "fill" ? `Paint Pass: ${getPaintTargetLabel(activeDocPaintTarget)}` : "Erase Pass"}
                  </div>
                )}
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: activeDoc.pivot.x * previewScale,
                    top: activeDoc.pivot.y * previewScale,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <div className="relative w-4 h-4">
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-amber-400 -translate-x-1/2" />
                    <div className="absolute top-1/2 left-0 right-0 h-px bg-amber-400 -translate-y-1/2" />
                    <div className="absolute inset-[5px] rounded-full border border-amber-400 bg-[#141622]" />
                  </div>
                </div>
                <div className="absolute left-2 bottom-2 rounded bg-black/40 px-2 py-1 text-[10px] text-muted-foreground pointer-events-none">
                  {spriteTool === "pencil"
                    ? "Pencil: drag to draw a smooth freehand stroke."
                    : spriteTool === "closed-pencil"
                      ? "Closed pencil: drag to draw a filled closed shape."
                      : spriteTool === "fill"
                        ? `Paint pass: click or sweep shapes to apply ${getPaintTargetLabel(activeDocPaintTarget).toLowerCase()} styling.`
                        : spriteTool === "eraser"
                          ? "Eraser: click or drag across shapes to remove them."
                          : "Drag shape to move. Click empty space to place pivot."}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Select an item-part or entity visual, then click “Open Current Selection”.
              </div>
            )}
          </div>
        </div>

        <ScrollArea className="h-full">
          <div className="p-3 space-y-3">
            {activeDoc && (
              <>
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Document</p>
                  {activeDocumentContext && (
                    <div className="rounded border border-border bg-background/50 px-2 py-2 text-[11px] text-muted-foreground">
                      <div className="flex items-center justify-between gap-2">
                        <span>{activeDocumentContext.kindLabel}</span>
                        <span className="font-mono text-[10px]">{activeDocumentContext.targetLabel}</span>
                      </div>
                      {activeDocumentContext.slotLabel && (
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span>Slot</span>
                          <span className="font-mono text-[10px]">{activeDocumentContext.slotLabel}</span>
                        </div>
                      )}
                      {activeDocumentContext.boneLabel && (
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span>Bone</span>
                          <span className="font-mono text-[10px]">{activeDocumentContext.boneLabel}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-[10px]">Name</Label>
                    <Input
                      value={activeDoc.name}
                      onChange={event => patchDocument(doc => ({ ...doc, name: event.target.value }))}
                      className="h-7 text-[11px] bg-background border-border"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Width</Label>
                      <NumericInput value={activeDoc.width} onChange={value => patchDocument(doc => ({ ...doc, width: Math.max(1, value) }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Height</Label>
                      <NumericInput value={activeDoc.height} onChange={value => patchDocument(doc => ({ ...doc, height: Math.max(1, value) }))} />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pivot</p>
                    <span className="text-[10px] text-muted-foreground">{activeDoc.pivot.preset}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Pivot X</Label>
                      <NumericInput value={activeDoc.pivot.x} onChange={value => patchDocument(doc => ({ ...doc, pivot: { ...doc.pivot, x: value, preset: "custom" } }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Pivot Y</Label>
                      <NumericInput value={activeDoc.pivot.y} onChange={value => patchDocument(doc => ({ ...doc, pivot: { ...doc.pivot, y: value, preset: "custom" } }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-[11px]"
                      onClick={() => patchDocument(doc => ({ ...doc, pivot: { ...doc.pivot, x: doc.width / 2, y: doc.height / 2, preset: "center" } }))}
                    >
                      Center Pivot
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-[11px]"
                      onClick={() => patchDocument(doc => ({ ...doc, pivot: { ...doc.pivot, x: doc.width / 2, y: doc.height, preset: "feet" } }))}
                    >
                      Feet Pivot
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Tip: click anywhere on the preview to place the pivot.</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Content Bounds</p>
                    <span className="text-[10px] text-muted-foreground">{contentBounds ? "visible" : "empty"}</span>
                  </div>
                  {contentBounds ? (
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                      <div className="flex justify-between rounded border border-border bg-background/50 px-2 py-1"><span>X</span><span>{contentBounds.minX.toFixed(1)}</span></div>
                      <div className="flex justify-between rounded border border-border bg-background/50 px-2 py-1"><span>Y</span><span>{contentBounds.minY.toFixed(1)}</span></div>
                      <div className="flex justify-between rounded border border-border bg-background/50 px-2 py-1"><span>W</span><span>{contentBounds.width.toFixed(1)}</span></div>
                      <div className="flex justify-between rounded border border-border bg-background/50 px-2 py-1"><span>H</span><span>{contentBounds.height.toFixed(1)}</span></div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">Draw at least one visible shape to compute bounds.</p>
                  )}
                </div>

                <Separator className="bg-border" />
              </>
            )}

            {activeDoc && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Layers</p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={handleCreateLayer}>New</Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={handleDeleteLayer} disabled={!currentLayer || activeDoc.layers.length <= 1}>Delete</Button>
                  </div>
                </div>
                <div className="space-y-1">
                  {activeDoc.layers.map(layer => (
                    <div
                      key={layer.id}
                      className={[
                        "rounded border p-2 space-y-2",
                        currentLayer?.id === layer.id ? "border-primary/50 bg-primary/10" : "border-border bg-background/50",
                      ].join(" ")}
                    >
                      <button
                        onClick={() => {
                          setSelectedLayerId(layer.id);
                          ensureSelection(layer.shapes[0]?.id ?? null);
                        }}
                        className="w-full text-left"
                      >
                        <div className="text-xs font-medium text-foreground truncate">{layer.name}</div>
                        <div className="text-[10px] text-muted-foreground">{layer.shapes.length} shapes</div>
                      </button>
                      <Input
                        value={layer.name}
                        onChange={event => handleLayerPatch(layer.id, { name: event.target.value })}
                        className="h-7 text-[11px] bg-background border-border"
                      />
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={layer.visible}
                            onChange={event => handleLayerPatch(layer.id, { visible: event.target.checked })}
                          />
                          Visible
                        </label>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => { setSelectedLayerId(layer.id); handleMoveLayer(-1); }}>Up</Button>
                          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => { setSelectedLayerId(layer.id); handleMoveLayer(1); }}>Down</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Separator className="bg-border" />
              </div>
            )}

            <div className="space-y-2">
              {activeDocFaceFeature && (
                <div className="rounded border border-border bg-background/50 p-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Face Brush Preset</p>
                      <p className="text-[11px] text-foreground">{getFaceFeatureLabel(activeDocFaceFeature)}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => applyFaceBrushPreset(activeDocFaceFeature)}
                    >
                      Apply
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{getFaceDrawingPreset(activeDocFaceFeature).description}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Select
                      value={activeDocFaceOverlayRole}
                      onValueChange={value => patchDocument(doc => ({
                        ...doc,
                        authoringHint: {
                          ...doc.authoringHint,
                          faceOverlayRole: value as "base" | "line" | "detail" | "shadow" | "highlight",
                          paintTarget: doc.authoringHint?.paintTarget ?? getDefaultFacePaintTarget(value as "base" | "line" | "detail" | "shadow" | "highlight"),
                        },
                      }))}
                    >
                      <SelectTrigger className="h-8 text-[11px] bg-background border-border">
                        <SelectValue placeholder="Overlay role" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-foreground text-xs">
                        <SelectItem value="base" className="text-xs">Base</SelectItem>
                        <SelectItem value="line" className="text-xs">Line</SelectItem>
                        <SelectItem value="detail" className="text-xs">Detail</SelectItem>
                        <SelectItem value="shadow" className="text-xs">Shadow</SelectItem>
                        <SelectItem value="highlight" className="text-xs">Highlight</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={activeDocPaintTarget}
                      onValueChange={value => patchDocument(doc => ({
                        ...doc,
                        authoringHint: {
                          ...doc.authoringHint,
                          paintTarget: value as SpriteEditorPaintTarget,
                        },
                      }))}
                    >
                      <SelectTrigger className="h-8 text-[11px] bg-background border-border">
                        <SelectValue placeholder="Paint pass" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-foreground text-xs">
                        <SelectItem value="fill" className="text-xs">Fill Pass</SelectItem>
                        <SelectItem value="stroke" className="text-xs">Line Pass</SelectItem>
                        <SelectItem value="both" className="text-xs">Both</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={activeDocSymmetryMode}
                      onValueChange={value => patchDocument(doc => ({
                        ...doc,
                        authoringHint: {
                          ...doc.authoringHint,
                          symmetryMode: value as "none" | "mirror_x",
                        },
                      }))}
                    >
                      <SelectTrigger className="h-8 text-[11px] bg-background border-border">
                        <SelectValue placeholder="Symmetry" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-foreground text-xs">
                        <SelectItem value="none" className="text-xs">No Symmetry</SelectItem>
                        <SelectItem value="mirror_x" className="text-xs">Mirror X</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {FACE_PAINT_SWATCHES.map(color => (
                      <button
                        key={color}
                        type="button"
                        className="h-6 w-6 rounded border border-border"
                        style={{ backgroundColor: color }}
                        onClick={() => {
                          setToolStrokeColor(color);
                          setToolFillColor(color);
                        }}
                        title={color}
                      />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {getFaceQuickActionIds(activeDocFaceFeature).map(actionId => (
                      <Button
                        key={actionId}
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px]"
                        onClick={() => handleAddFaceQuickShapes(actionId)}
                        disabled={!activeDoc || !currentLayer}
                      >
                        {FACE_QUICK_ACTION_LABELS[actionId] ?? actionId}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant={spriteTool === "select" ? "default" : "outline"}
                  className="h-8 text-xs"
                  onClick={() => selectSpriteTool("select")}
                  disabled={!activeDoc}
                >
                  Select
                </Button>
                <Button
                  size="sm"
                  variant={spriteTool === "pencil" ? "default" : "outline"}
                  className="h-8 text-xs"
                  onClick={() => selectSpriteTool("pencil")}
                  disabled={!activeDoc || !currentLayer}
                >
                  Pencil
                </Button>
                <Button
                  size="sm"
                  variant={spriteTool === "closed-pencil" ? "default" : "outline"}
                  className="h-8 text-xs"
                  onClick={() => selectSpriteTool("closed-pencil")}
                  disabled={!activeDoc || !currentLayer}
                >
                  Closed Pencil
                </Button>
                  <Button
                    size="sm"
                    variant={spriteTool === "fill" ? "default" : "outline"}
                    className="h-8 text-xs"
                    onClick={() => selectSpriteTool("fill")}
                    disabled={!activeDoc}
                  >
                    Fill Bucket
                  </Button>
                  <Button
                    size="sm"
                    variant={spriteTool === "eraser" ? "default" : "outline"}
                    className="h-8 text-xs"
                    onClick={() => selectSpriteTool("eraser")}
                    disabled={!activeDoc}
                  >
                    Eraser
                  </Button>
                </div>
              <div className="grid grid-cols-[1fr,1fr,92px] gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">Stroke</Label>
                  <input
                    type="color"
                    value={toolStrokeColor}
                    onChange={event => setToolStrokeColor(event.target.value)}
                    className="w-full h-8 rounded border border-border bg-transparent"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Fill</Label>
                  <input
                    type="color"
                    value={toolFillColor}
                    onChange={event => setToolFillColor(event.target.value)}
                    className="w-full h-8 rounded border border-border bg-transparent"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Width</Label>
                  <Input
                    type="number"
                    min="0.5"
                    step="0.1"
                    value={toolStrokeWidth}
                    onChange={event => setToolStrokeWidth(Math.max(0.1, Number(event.target.value) || 1))}
                    className="h-8 text-[11px] bg-background border-border"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => undoDocumentEdit()}
                  disabled={!canUndoDocument}
                >
                  Undo
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => redoDocumentEdit()}
                  disabled={!canRedoDocument}
                >
                  Redo
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleAddShape("rect")} disabled={!activeDoc}>
                  Add Rect
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleAddShape("ellipse")} disabled={!activeDoc}>
                  Add Ellipse
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleAddShape("path")} disabled={!activeDoc}>
                  Add Path
                </Button>
              </div>
            </div>

            {currentLayer && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Shapes</p>
                <div className="space-y-1">
                  {currentLayer.shapes.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">This layer is empty.</p>
                  )}
                  {currentLayer.shapes.map(shape => (
                    <button
                      key={shape.id}
                      onClick={() => {
                        setSelectedLayerId(currentLayer.id);
                        ensureSelection(shape.id);
                      }}
                      className={[
                        "w-full rounded border px-2 py-1.5 text-left text-xs transition-colors",
                        selectedShape?.id === shape.id
                          ? "border-primary/50 bg-primary/10 text-foreground"
                          : "border-border bg-background/50 text-muted-foreground hover:text-foreground hover:bg-accent/30",
                      ].join(" ")}
                    >
                      <div className="font-medium">{SHAPE_LABELS[shape.type]}</div>
                      <div className="text-[10px] opacity-80">
                        {shape.type === "path" ? "Custom path" : `${shape.width} × ${shape.height}`}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedShape && (
              <>
                <Separator className="bg-border" />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Shape Properties</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={handleDuplicateShape}>Duplicate</Button>
                      <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={handleDeleteShape}>Delete</Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => handleFlipSelectedShape("horizontal")}>
                      Mirror H
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => handleFlipSelectedShape("vertical")}>
                      Mirror V
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => handleRotateSelectedShape(-90)}>
                      Rotate -90
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => handleRotateSelectedShape(90)}>
                      Rotate +90
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><Label className="text-[10px]">X</Label><NumericInput value={selectedShape.x} onChange={value => handleShapePatch({ x: value })} /></div>
                    <div className="space-y-1"><Label className="text-[10px]">Y</Label><NumericInput value={selectedShape.y} onChange={value => handleShapePatch({ y: value })} /></div>
                    {selectedShape.type !== "path" && (
                      <>
                        <div className="space-y-1"><Label className="text-[10px]">Width</Label><NumericInput value={selectedShape.width} onChange={value => handleShapePatch({ width: value })} /></div>
                        <div className="space-y-1"><Label className="text-[10px]">Height</Label><NumericInput value={selectedShape.height} onChange={value => handleShapePatch({ height: value })} /></div>
                      </>
                    )}
                    <div className="space-y-1"><Label className="text-[10px]">Rotation</Label><NumericInput value={selectedShape.rotation} onChange={value => handleShapePatch({ rotation: value })} /></div>
                    <div className="space-y-1"><Label className="text-[10px]">Stroke Width</Label><NumericInput value={selectedShape.strokeWidth} onChange={value => handleShapePatch({ strokeWidth: value })} /></div>
                  </div>

                  {selectedShape.type === "path" && (
                    <div className="space-y-1">
                      <Label className="text-[10px]">Path Data</Label>
                      <textarea
                        value={selectedShape.pathData ?? ""}
                        onChange={event => handleShapePatch({ pathData: event.target.value })}
                        className="w-full min-h-24 rounded border border-border bg-background px-2 py-1 text-[11px] text-foreground outline-none"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Fill</Label>
                      <input
                        type="color"
                        value={selectedShape.fill}
                        onChange={event => handleShapePatch({ fill: event.target.value })}
                        className="w-full h-8 rounded border border-border bg-transparent"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Stroke</Label>
                      <input
                        type="color"
                        value={selectedShape.stroke}
                        onChange={event => handleShapePatch({ stroke: event.target.value })}
                        className="w-full h-8 rounded border border-border bg-transparent"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </div>
      )}
    </div>
    <Dialog open={isSpriteStudioOpen && !!activeDoc} onOpenChange={setIsSpriteStudioOpen}>
      <DialogContent className="h-[92vh] w-[96vw] max-w-[96vw] border-border bg-background p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>{activeDoc?.name ?? "Sprite Studio"}</DialogTitle>
          <DialogDescription>
            Large authoring workspace for editing item parts, entity visuals and face overlays without squeezing tools into the timeline panel.
          </DialogDescription>
        </DialogHeader>

        {activeDoc && (
          <div className="grid h-[calc(92vh-88px)] grid-cols-[1.35fr,0.65fr] overflow-hidden">
            <div className="border-r border-border p-4 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">{activeDoc.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {activeDoc.width}x{activeDoc.height} document
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => {
                      if (activeRelatedDocIndex <= 0) return;
                      setActiveSpriteDocument(relatedDocuments[activeRelatedDocIndex - 1]?.id ?? null);
                    }}
                    disabled={activeRelatedDocIndex <= 0}
                  >
                    Prev Part
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => {
                      if (activeRelatedDocIndex < 0 || activeRelatedDocIndex >= relatedDocuments.length - 1) return;
                      setActiveSpriteDocument(relatedDocuments[activeRelatedDocIndex + 1]?.id ?? null);
                    }}
                    disabled={activeRelatedDocIndex < 0 || activeRelatedDocIndex >= relatedDocuments.length - 1}
                  >
                    Next Part
                  </Button>
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={autoPreviewEnabled}
                      onChange={event => setAutoPreviewEnabled(event.target.checked)}
                    />
                    Live Preview
                  </label>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => patchDocument(doc => ({ ...doc, referenceAsset: null }))}>
                    Clear Underlay
                  </Button>
                  <Button size="sm" className="h-8 text-xs" onClick={handleSaveToTarget}>
                    Save To Target
                  </Button>
                </div>
              </div>

              <div className="h-[calc(100%-3.5rem)] rounded border border-border bg-[#141622] p-4 overflow-auto">
                <div
                  ref={previewFrameRef}
                    className="mx-auto relative bg-white/5 rounded border border-border overflow-hidden cursor-crosshair"
                    style={{ width: activeDoc.width * previewScale, height: activeDoc.height * previewScale }}
                    onContextMenu={event => event.preventDefault()}
                    onMouseDown={handlePreviewMouseDown}
                    onMouseMove={handlePreviewMouseMove}
                    onMouseUp={handlePreviewMouseUp}
                    onMouseLeave={handlePreviewMouseLeave}
                  >
                  <div
                    className="absolute inset-0"
                    dangerouslySetInnerHTML={{ __html: previewSvg }}
                  />
                  {activeDoc.layers
                    .filter(layer => layer.visible)
                    .flatMap(layer => layer.shapes.map(shape => ({ layerId: layer.id, shape })))
                    .map(({ layerId, shape }) => {
                      const bounds = computeShapeBounds(shape);
                      return (
                        <div
                          key={`studio-${layerId}-${shape.id}`}
                          className={[
                            "absolute pointer-events-none border transition-colors",
                            selectedShape?.id === shape.id
                              ? "border-amber-300/90"
                              : hoverPreviewShapeId === shape.id && spriteTool === "fill"
                                ? "border-emerald-300/95 bg-emerald-300/10"
                                : hoverPreviewShapeId === shape.id && spriteTool === "eraser"
                                  ? "border-red-300/95 bg-red-300/10"
                                  : "border-white/25",
                          ].join(" ")}
                          style={{
                            left: bounds.minX * previewScale,
                            top: bounds.minY * previewScale,
                            width: Math.max(bounds.width * previewScale, 1),
                            height: Math.max(bounds.height * previewScale, 1),
                            transform: shape.rotation ? `rotate(${shape.rotation}deg)` : undefined,
                            transformOrigin: "center center",
                          }}
                        />
                      );
                    })}
                  {selectedShape && selectedShapeBounds && (
                    <>
                      <button
                        type="button"
                        aria-label="Rotate shape"
                        onMouseDown={beginRotateSelectedShape}
                        className="absolute h-3 w-3 rounded-full border border-amber-300 bg-[#141622] shadow-sm"
                        style={{
                          left: (selectedShapeBounds.minX + selectedShapeBounds.width / 2) * previewScale,
                          top: (selectedShapeBounds.minY - 12) * previewScale,
                          transform: "translate(-50%, -50%)",
                        }}
                      />
                      <button
                        type="button"
                        aria-label="Resize shape"
                        onMouseDown={beginResizeSelectedShape}
                        className="absolute h-3 w-3 rounded-sm border border-cyan-300 bg-[#141622] shadow-sm"
                        style={{
                          left: (selectedShapeBounds.minX + selectedShapeBounds.width) * previewScale,
                          top: (selectedShapeBounds.minY + selectedShapeBounds.height) * previewScale,
                          transform: "translate(-50%, -50%)",
                        }}
                      />
                    </>
                  )}
                  {contentBounds && (
                    <div
                      className="absolute border border-dashed border-cyan-400/80 pointer-events-none"
                      style={{
                        left: contentBounds.minX * previewScale,
                        top: contentBounds.minY * previewScale,
                        width: Math.max(contentBounds.width * previewScale, 1),
                        height: Math.max(contentBounds.height * previewScale, 1),
                      }}
                    />
                  )}
                  {activeDoc.target.kind === "face-overlay" && activeDocSymmetryMode === "mirror_x" && (
                    <div
                      className="absolute top-0 bottom-0 border-l border-dashed border-pink-400/80 pointer-events-none"
                      style={{
                        left: activeDoc.width * previewScale * 0.5,
                      }}
                    />
                  )}
                  {hoverPreviewPoint && (
                    <>
                      <div
                        className="absolute h-3 w-3 rounded-full border border-cyan-300/90 bg-cyan-300/30 pointer-events-none"
                        style={{
                          left: hoverPreviewPoint.x * previewScale,
                          top: hoverPreviewPoint.y * previewScale,
                          transform: "translate(-50%, -50%)",
                        }}
                      />
                      {activeDoc.target.kind === "face-overlay" && activeDocSymmetryMode === "mirror_x" && (
                        <div
                          className="absolute h-3 w-3 rounded-full border border-pink-400/90 bg-pink-400/25 pointer-events-none"
                          style={{
                            left: mirrorPointAcrossWidth(hoverPreviewPoint, activeDoc.width).x * previewScale,
                            top: hoverPreviewPoint.y * previewScale,
                            transform: "translate(-50%, -50%)",
                          }}
                        />
                      )}
                    </>
                  )}
                  {hoverPreviewShapeId && (spriteTool === "fill" || spriteTool === "eraser") && (
                    <div className="absolute left-2 top-2 rounded bg-black/45 px-2 py-1 text-[10px] text-foreground pointer-events-none">
                      {spriteTool === "fill" ? `Paint Pass: ${getPaintTargetLabel(activeDocPaintTarget)}` : "Erase Pass"}
                    </div>
                  )}
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left: activeDoc.pivot.x * previewScale,
                      top: activeDoc.pivot.y * previewScale,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <div className="relative w-4 h-4">
                      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-amber-400 -translate-x-1/2" />
                      <div className="absolute top-1/2 left-0 right-0 h-px bg-amber-400 -translate-y-1/2" />
                      <div className="absolute inset-[5px] rounded-full border border-amber-400 bg-[#141622]" />
                    </div>
                  </div>
                  <div className="absolute left-2 bottom-2 rounded bg-black/40 px-2 py-1 text-[10px] text-muted-foreground pointer-events-none">
                    {spriteTool === "pencil"
                      ? "Pencil: drag to draw a smooth freehand stroke."
                      : spriteTool === "closed-pencil"
                        ? "Closed pencil: drag to draw a filled closed shape."
                      : spriteTool === "fill"
                          ? `Paint pass: click or sweep shapes to apply ${getPaintTargetLabel(activeDocPaintTarget).toLowerCase()} styling.`
                        : spriteTool === "eraser"
                          ? "Eraser: click or drag across shapes to remove them."
                          : "Drag shape to move. Use the handles to rotate and resize. Click empty space to place pivot."}
                  </div>
                </div>
              </div>
            </div>

            <ScrollArea className="h-full">
              <div className="p-4 space-y-3">
                {relatedDocuments.length > 1 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Related Parts</p>
                      <span className="text-[10px] text-muted-foreground">
                        {Math.max(activeRelatedDocIndex + 1, 1)} / {relatedDocuments.length}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {relatedDocuments.map(doc => (
                        <button
                          key={`related-${doc.id}`}
                          onClick={() => setActiveSpriteDocument(doc.id)}
                          className={[
                            "w-full rounded border px-2 py-1.5 text-left text-xs transition-colors",
                            activeDoc.id === doc.id
                              ? "border-primary/50 bg-primary/10 text-foreground"
                              : "border-border bg-background/50 text-muted-foreground hover:text-foreground hover:bg-accent/30",
                          ].join(" ")}
                        >
                          <div className="font-medium truncate">{doc.name}</div>
                          <div className="text-[10px] opacity-80 truncate">
                            {getSpriteDocumentTargetLabel(doc)}
                            {getSpriteDocumentBoneLabel(doc, project) ? ` · ${getSpriteDocumentBoneLabel(doc, project)}` : ""}
                          </div>
                        </button>
                      ))}
                    </div>
                    <Separator className="bg-border" />
                  </div>
                )}

                {studioPreviewEntity && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Live Character Preview</p>
                      <span className="text-[10px] text-muted-foreground">runtime</span>
                    </div>
                    <LiveAuthoringPreview
                      entityId={studioPreviewEntity.id}
                      isolateSlotId={activeDocumentContext?.slotLabel ?? null}
                      isolateVisualId={activeDoc?.target.kind === "entity-visual" ? activeDoc.target.visualId ?? null : null}
                      frameSize={activeDoc?.target.kind === "face-overlay" && activeFaceCanvasFocusMode === "head" ? 320 : 256}
                      canvasClassName={activeDoc?.target.kind === "face-overlay" && activeFaceCanvasFocusMode === "head" ? "h-64 w-64 object-contain" : "h-52 w-52 object-contain"}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      {activeDoc?.target.kind === "face-overlay" && activeFaceCanvasFocusMode === "head"
                        ? "Head focus is active: keep painting while watching the face overlay in the same runtime stack."
                        : "Uses the same evaluated scene path as canvas and export. When editing an item part, this preview isolates the current equipped slot."}
                    </p>
                    <Separator className="bg-border" />
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Document</p>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Name</Label>
                    <Input
                      value={activeDoc.name}
                      onChange={event => patchDocument(doc => ({ ...doc, name: event.target.value }))}
                      className="h-8 text-[11px] bg-background border-border"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Width</Label>
                      <NumericInput value={activeDoc.width} onChange={value => patchDocument(doc => ({ ...doc, width: Math.max(1, value) }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Height</Label>
                      <NumericInput value={activeDoc.height} onChange={value => patchDocument(doc => ({ ...doc, height: Math.max(1, value) }))} />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pivot</p>
                    <span className="text-[10px] text-muted-foreground">{activeDoc.pivot.preset}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Pivot X</Label>
                      <NumericInput value={activeDoc.pivot.x} onChange={value => patchDocument(doc => ({ ...doc, pivot: { ...doc.pivot, x: value, preset: "custom" } }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Pivot Y</Label>
                      <NumericInput value={activeDoc.pivot.y} onChange={value => patchDocument(doc => ({ ...doc, pivot: { ...doc.pivot, y: value, preset: "custom" } }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-[11px]"
                      onClick={() => patchDocument(doc => ({ ...doc, pivot: { ...doc.pivot, x: doc.width / 2, y: doc.height / 2, preset: "center" } }))}
                    >
                      Center Pivot
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-[11px]"
                      onClick={() => patchDocument(doc => ({ ...doc, pivot: { ...doc.pivot, x: doc.width / 2, y: doc.height, preset: "feet" } }))}
                    >
                      Feet Pivot
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {activeDocFaceFeature && (
                    <div className="rounded border border-border bg-background/50 p-2 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Face Brush Preset</p>
                          <p className="text-[11px] text-foreground">{getFaceFeatureLabel(activeDocFaceFeature)}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px]"
                          onClick={() => applyFaceBrushPreset(activeDocFaceFeature)}
                        >
                          Apply
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{getFaceDrawingPreset(activeDocFaceFeature).description}</p>
                      <div className="grid grid-cols-3 gap-2">
                        <Select
                          value={activeDocFaceOverlayRole}
                          onValueChange={value => patchDocument(doc => ({
                            ...doc,
                            authoringHint: {
                              ...doc.authoringHint,
                              faceOverlayRole: value as "base" | "line" | "detail" | "shadow" | "highlight",
                              paintTarget: doc.authoringHint?.paintTarget ?? getDefaultFacePaintTarget(value as "base" | "line" | "detail" | "shadow" | "highlight"),
                            },
                          }))}
                        >
                          <SelectTrigger className="h-8 text-[11px] bg-background border-border">
                            <SelectValue placeholder="Overlay role" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground text-xs">
                            <SelectItem value="base" className="text-xs">Base</SelectItem>
                            <SelectItem value="line" className="text-xs">Line</SelectItem>
                            <SelectItem value="detail" className="text-xs">Detail</SelectItem>
                            <SelectItem value="shadow" className="text-xs">Shadow</SelectItem>
                            <SelectItem value="highlight" className="text-xs">Highlight</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={activeDocPaintTarget}
                          onValueChange={value => patchDocument(doc => ({
                            ...doc,
                            authoringHint: {
                              ...doc.authoringHint,
                              paintTarget: value as SpriteEditorPaintTarget,
                            },
                          }))}
                        >
                          <SelectTrigger className="h-8 text-[11px] bg-background border-border">
                            <SelectValue placeholder="Paint pass" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground text-xs">
                            <SelectItem value="fill" className="text-xs">Fill Pass</SelectItem>
                            <SelectItem value="stroke" className="text-xs">Line Pass</SelectItem>
                            <SelectItem value="both" className="text-xs">Both</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={activeDocSymmetryMode}
                          onValueChange={value => patchDocument(doc => ({
                            ...doc,
                            authoringHint: {
                              ...doc.authoringHint,
                              symmetryMode: value as "none" | "mirror_x",
                            },
                          }))}
                        >
                          <SelectTrigger className="h-8 text-[11px] bg-background border-border">
                            <SelectValue placeholder="Symmetry" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground text-xs">
                            <SelectItem value="none" className="text-xs">No Symmetry</SelectItem>
                            <SelectItem value="mirror_x" className="text-xs">Mirror X</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {FACE_PAINT_SWATCHES.map(color => (
                          <button
                            key={color}
                            type="button"
                            className="h-6 w-6 rounded border border-border"
                            style={{ backgroundColor: color }}
                            onClick={() => {
                              setToolStrokeColor(color);
                              setToolFillColor(color);
                            }}
                            title={color}
                          />
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {getFaceQuickActionIds(activeDocFaceFeature).map(actionId => (
                          <Button
                            key={actionId}
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px]"
                            onClick={() => handleAddFaceQuickShapes(actionId)}
                            disabled={!activeDoc || !currentLayer}
                          >
                            {FACE_QUICK_ACTION_LABELS[actionId] ?? actionId}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant={spriteTool === "select" ? "default" : "outline"}
                      className="h-8 text-xs"
                      onClick={() => selectSpriteTool("select")}
                      disabled={!activeDoc}
                    >
                      Select
                    </Button>
                    <Button
                      size="sm"
                      variant={spriteTool === "pencil" ? "default" : "outline"}
                      className="h-8 text-xs"
                      onClick={() => selectSpriteTool("pencil")}
                      disabled={!activeDoc || !currentLayer}
                    >
                      Pencil
                    </Button>
                    <Button
                      size="sm"
                      variant={spriteTool === "closed-pencil" ? "default" : "outline"}
                      className="h-8 text-xs"
                      onClick={() => selectSpriteTool("closed-pencil")}
                      disabled={!activeDoc || !currentLayer}
                    >
                      Closed Pencil
                    </Button>
                    <Button
                      size="sm"
                      variant={spriteTool === "fill" ? "default" : "outline"}
                      className="h-8 text-xs"
                      onClick={() => selectSpriteTool("fill")}
                      disabled={!activeDoc}
                    >
                      Fill Bucket
                    </Button>
                    <Button
                      size="sm"
                      variant={spriteTool === "eraser" ? "default" : "outline"}
                      className="h-8 text-xs"
                      onClick={() => selectSpriteTool("eraser")}
                      disabled={!activeDoc}
                    >
                      Eraser
                    </Button>
                  </div>
                  <div className="grid grid-cols-[1fr,1fr,92px] gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Stroke</Label>
                      <input
                        type="color"
                        value={toolStrokeColor}
                        onChange={event => setToolStrokeColor(event.target.value)}
                        className="w-full h-8 rounded border border-border bg-transparent"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Fill</Label>
                      <input
                        type="color"
                        value={toolFillColor}
                        onChange={event => setToolFillColor(event.target.value)}
                        className="w-full h-8 rounded border border-border bg-transparent"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Width</Label>
                      <Input
                        type="number"
                        min="0.5"
                        step="0.1"
                        value={toolStrokeWidth}
                        onChange={event => setToolStrokeWidth(Math.max(0.1, Number(event.target.value) || 1))}
                        className="h-8 text-[11px] bg-background border-border"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => undoDocumentEdit()}
                      disabled={!canUndoDocument}
                    >
                      Undo
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => redoDocumentEdit()}
                      disabled={!canRedoDocument}
                    >
                      Redo
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleAddShape("rect")} disabled={!activeDoc}>
                      Add Rect
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleAddShape("ellipse")} disabled={!activeDoc}>
                      Add Ellipse
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleAddShape("path")} disabled={!activeDoc}>
                      Add Path
                    </Button>
                  </div>
                </div>

                <Separator className="bg-border" />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Layers</p>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={handleCreateLayer}>New</Button>
                      <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={handleDeleteLayer} disabled={!currentLayer || activeDoc.layers.length <= 1}>Delete</Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {activeDoc.layers.map(layer => (
                      <div
                        key={`studio-layer-${layer.id}`}
                        className={[
                          "rounded border p-2 space-y-2",
                          currentLayer?.id === layer.id ? "border-primary/50 bg-primary/10" : "border-border bg-background/50",
                        ].join(" ")}
                      >
                        <button
                          onClick={() => {
                            setSelectedLayerId(layer.id);
                            ensureSelection(layer.shapes[0]?.id ?? null);
                          }}
                          className="w-full text-left"
                        >
                          <div className="text-xs font-medium text-foreground truncate">{layer.name}</div>
                          <div className="text-[10px] text-muted-foreground">{layer.shapes.length} shapes</div>
                        </button>
                        <Input
                          value={layer.name}
                          onChange={event => handleLayerPatch(layer.id, { name: event.target.value })}
                          className="h-7 text-[11px] bg-background border-border"
                        />
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={layer.visible}
                              onChange={event => handleLayerPatch(layer.id, { visible: event.target.checked })}
                            />
                            Visible
                          </label>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => { setSelectedLayerId(layer.id); handleMoveLayer(-1); }}>Up</Button>
                            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => { setSelectedLayerId(layer.id); handleMoveLayer(1); }}>Down</Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {currentLayer && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Shapes</p>
                    <div className="space-y-1">
                      {currentLayer.shapes.length === 0 && (
                        <p className="text-[11px] text-muted-foreground">This layer is empty.</p>
                      )}
                      {currentLayer.shapes.map(shape => (
                        <button
                          key={`studio-shape-${shape.id}`}
                          onClick={() => {
                            setSelectedLayerId(currentLayer.id);
                            ensureSelection(shape.id);
                          }}
                          className={[
                            "w-full rounded border px-2 py-1.5 text-left text-xs transition-colors",
                            selectedShape?.id === shape.id
                              ? "border-primary/50 bg-primary/10 text-foreground"
                              : "border-border bg-background/50 text-muted-foreground hover:text-foreground hover:bg-accent/30",
                          ].join(" ")}
                        >
                          <div className="font-medium">{SHAPE_LABELS[shape.type]}</div>
                          <div className="text-[10px] opacity-80">
                            {shape.type === "path" ? "Custom path" : `${shape.width} x ${shape.height}`}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedShape && (
                  <>
                    <Separator className="bg-border" />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Shape Properties</p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={handleDuplicateShape}>Duplicate</Button>
                          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={handleDeleteShape}>Delete</Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => handleFlipSelectedShape("horizontal")}>
                          Mirror H
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => handleFlipSelectedShape("vertical")}>
                          Mirror V
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => handleRotateSelectedShape(-90)}>
                          Rotate -90
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => handleRotateSelectedShape(90)}>
                          Rotate +90
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1"><Label className="text-[10px]">X</Label><NumericInput value={selectedShape.x} onChange={value => handleShapePatch({ x: value })} /></div>
                        <div className="space-y-1"><Label className="text-[10px]">Y</Label><NumericInput value={selectedShape.y} onChange={value => handleShapePatch({ y: value })} /></div>
                        {selectedShape.type !== "path" && (
                          <>
                            <div className="space-y-1"><Label className="text-[10px]">Width</Label><NumericInput value={selectedShape.width} onChange={value => handleShapePatch({ width: value })} /></div>
                            <div className="space-y-1"><Label className="text-[10px]">Height</Label><NumericInput value={selectedShape.height} onChange={value => handleShapePatch({ height: value })} /></div>
                          </>
                        )}
                        <div className="space-y-1"><Label className="text-[10px]">Rotation</Label><NumericInput value={selectedShape.rotation} onChange={value => handleShapePatch({ rotation: value })} /></div>
                        <div className="space-y-1"><Label className="text-[10px]">Stroke Width</Label><NumericInput value={selectedShape.strokeWidth} onChange={value => handleShapePatch({ strokeWidth: value })} /></div>
                      </div>

                      {selectedShape.type === "path" && (
                        <div className="space-y-1">
                          <Label className="text-[10px]">Path Data</Label>
                          <textarea
                            value={selectedShape.pathData ?? ""}
                            onChange={event => handleShapePatch({ pathData: event.target.value })}
                            className="w-full min-h-24 rounded border border-border bg-background px-2 py-1 text-[11px] text-foreground outline-none"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px]">Fill</Label>
                          <input
                            type="color"
                            value={selectedShape.fill}
                            onChange={event => handleShapePatch({ fill: event.target.value })}
                            className="w-full h-8 rounded border border-border bg-transparent"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Stroke</Label>
                          <input
                            type="color"
                            value={selectedShape.stroke}
                            onChange={event => handleShapePatch({ stroke: event.target.value })}
                            className="w-full h-8 rounded border border-border bg-transparent"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
