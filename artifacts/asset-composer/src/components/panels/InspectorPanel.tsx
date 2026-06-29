import { useEffect, useRef, useState } from "react";
import { useStore } from "@/store";
import { sanitizeSvg } from "@/lib/sanitize";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { resolveTemplate } from "@/data/templates";
import { getStyleSetById, STYLE_SETS } from "@/data/styleSets";
import { resolveItemFitPartTransform } from "@/lib/itemFitProfiles";
import { createDocumentFromFaceOverlay } from "@/lib/spriteEditor";
import {
  getFamilyLabelById,
  getTemplateFamilyLabel,
  getTemplatePresentationSummary,
} from "@/lib/templatePresentation";
import { itemSupportsTemplate, templateMatchesCompatibilityFamily } from "@/lib/templateCompatibility";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type {
  PaletteTokens,
  Item,
  LocalTransform,
  BodyMorphValues,
  BodyMorphRegionId,
  FaceCustomization,
  FaceFeatureKey,
  FaceOverlayRole,
  SpriteEditorPaintTarget,
} from "@/domain/types";

const COMMON_SPECIES = [
  "human","elf","orc","dwarf","halfling","gnome",
  "horse","pony","ox","bear","wolf","cat","dog",
  "dragon","demon","undead","unicorn","griffon",
];


const PALETTE_LABELS: Record<keyof PaletteTokens, string> = {
  skin: "Skin",
  hair: "Hair",
  primaryCloth: "Primary Cloth",
  secondaryCloth: "Secondary Cloth",
  metal: "Metal",
  accent: "Accent",
  outline: "Outline",
  shadow: "Shadow",
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

const BODY_REGION_KEYS: Record<BodyMorphRegionId, Array<keyof BodyMorphValues>> = {
  head: ["headSize", "neckLength"],
  torso: ["torsoHeight", "torsoWidth", "pelvisWidth"],
  arms: ["armLength", "forearmLength", "handSize"],
  legs: ["legLength", "shinLength", "footSize"],
  global: ["overallHeightScale"],
};

const FACE_FEATURE_LABELS: Record<FaceFeatureKey, string> = {
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

function getFaceOverlayRoleLabel(role?: FaceOverlayRole) {
  return role ?? "detail";
}

function getPaintTargetLabel(target?: SpriteEditorPaintTarget) {
  switch (target ?? "both") {
    case "fill":
      return "Fill";
    case "stroke":
      return "Line";
    case "both":
    default:
      return "Both";
  }
}

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

function MorphSlider({
  label,
  value,
  min = 0.6,
  max = 1.6,
  step = 0.01,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{label}</span>
        <span className="text-foreground">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-[var(--primary)]"
      />
    </div>
  );
}

interface CompatWarning {
  itemName: string;
  slotName: string;
  message: string;
  severity: "error" | "warning";
}

function TransactionalNumberInput({
  value,
  step = 0.1,
  testId,
  onBeginEdit,
  onPreview,
  onCommit,
  onCancel,
}: {
  value: number;
  step?: number;
  testId: string;
  onBeginEdit?: () => void;
  onPreview: (value: number) => void;
  onCommit: (value: number) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(String(Number.isFinite(value) ? value : 0));
  const editingRef = useRef(false);
  const initialValueRef = useRef(value);
  const draftRef = useRef(draft);

  useEffect(() => {
    if (editingRef.current) return;
    setDraft(String(Number.isFinite(value) ? value : 0));
    draftRef.current = String(Number.isFinite(value) ? value : 0);
    initialValueRef.current = value;
  }, [value]);

  function commitDraft() {
    const nextText = draftRef.current;
    const next = Number(nextText);
    if (!Number.isFinite(next)) return;
    onCommit(next);
    editingRef.current = false;
    setDraft(String(next));
    draftRef.current = String(next);
    initialValueRef.current = next;
  }

  function cancelDraft() {
    editingRef.current = false;
    const initial = initialValueRef.current;
    setDraft(String(initial));
    draftRef.current = String(initial);
    onPreview(initial);
    onCancel();
  }

  useEffect(() => {
    return () => {
      if (editingRef.current) {
        commitDraft();
      }
    };
  }, []);

  return (
    <Input
      data-testid={testId}
      type="text"
      inputMode="decimal"
      value={draft}
      onFocus={() => {
        editingRef.current = true;
        initialValueRef.current = value;
        setDraft(String(Number.isFinite(value) ? value : 0));
        draftRef.current = String(Number.isFinite(value) ? value : 0);
        onBeginEdit?.();
      }}
      onChange={e => {
        editingRef.current = true;
        const nextText = e.target.value;
        setDraft(nextText);
        draftRef.current = nextText;
        const next = Number(nextText);
        if (Number.isFinite(next)) {
          onPreview(next);
        }
      }}
      onBlur={() => commitDraft()}
      onKeyDown={e => {
        if (e.key === "Enter") {
          e.preventDefault();
          commitDraft();
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          cancelDraft();
          return;
        }
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          const current = Number(draft);
          const base = Number.isFinite(current) ? current : initialValueRef.current;
          const delta = (e.shiftKey ? step * 10 : e.altKey ? step * 0.1 : step) * (e.key === "ArrowUp" ? 1 : -1);
          const next = Number((base + delta).toFixed(4));
          setDraft(String(next));
          draftRef.current = String(next);
          onPreview(next);
        }
      }}
      className="h-6 text-[11px] bg-background border-border"
    />
  );
}

function toColorInputValue(hex: string): string {
  const normalized = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) return normalized;
  if (/^#[0-9a-fA-F]{8}$/.test(normalized)) return normalized.slice(0, 7);
  return "#000000";
}

function mergeColorWithExistingAlpha(nextHex: string, previousHex: string): string {
  if (/^#[0-9a-fA-F]{8}$/.test(previousHex)) {
    return `${nextHex}${previousHex.slice(7, 9)}`;
  }
  return nextHex;
}

function openAuthoringWorkflow(
  mode: "body-morph" | "face-editor",
  setActiveAuthoringMode: (mode: "asset-import" | "sprite-editor" | "body-morph" | "face-editor" | null) => void,
  setAnimBottomTab: (tab: "timeline" | "preview" | "statemachine" | "authoring") => void,
  setCanvasMode: (mode: "select" | "edit-attachment" | "edit-template-slots") => void,
) {
  setActiveAuthoringMode(mode);
  setAnimBottomTab("authoring");
  setCanvasMode("select");
}

export function InspectorPanel() {
  const project              = useStore(s => s.project);
  const editor               = useStore(s => s.editor);
  const renameEntity         = useStore(s => s.renameEntity);
  const setEntityPaletteToken = useStore(s => s.setEntityPaletteToken);
  const setEntityStyleSet    = useStore(s => s.setEntityStyleSet);
  const setEntitySlot        = useStore(s => s.setEntitySlot);
  const previewAttachmentOverride = useStore(s => s.previewAttachmentOverride);
  const removeEntityVisual   = useStore(s => s.removeEntityVisual);
  const previewTemplateSlotTransform = useStore(s => s.previewTemplateSlotTransform);
  const getActiveEntity      = useStore(s => s.getActiveEntity);
  const animPlayback         = useStore(s => s.animPlayback);
  const beginItemPartFitAuthoring = useStore(s => s.beginItemPartFitAuthoring);
  const clearItemPartFitAuthoring = useStore(s => s.clearItemPartFitAuthoring);
  const saveItemPartFitProfile = useStore(s => s.saveItemPartFitProfile);
  const resetItemPartFitProfile = useStore(s => s.resetItemPartFitProfile);
  const previewItemPartFitTransform = useStore(s => s.previewItemPartFitTransform);
  const commitItemPartFitTransform = useStore(s => s.commitItemPartFitTransform);

  const setEntitySpecies = useStore(s => s.setEntitySpecies);
  const setEntityBodyMorphValue = useStore(s => s.setEntityBodyMorphValue);
  const setEntityBodyAuthoringFocus = useStore(s => s.setEntityBodyAuthoringFocus);
  const setEntityBodyAuthoringState = useStore(s => s.setEntityBodyAuthoringState);
  const setEntityFaceFeature = useStore(s => s.setEntityFaceFeature);
  const setEntityFaceFeatureTransform = useStore(s => s.setEntityFaceFeatureTransform);
  const setEntityFaceOverlayTransform = useStore(s => s.setEntityFaceOverlayTransform);
  const setEntityFaceAuthoringState = useStore(s => s.setEntityFaceAuthoringState);
  const removeEntityFaceOverlay = useStore(s => s.removeEntityFaceOverlay);
  const upsertSpriteEditorDocument = useStore(s => s.upsertSpriteEditorDocument);
  const setActiveSpriteDocument = useStore(s => s.setActiveSpriteDocument);
  const setActiveAuthoringMode = useStore(s => s.setActiveAuthoringMode);
  const setAnimBottomTab = useStore(s => s.setAnimBottomTab);
  const setSelectedSlot = useStore(s => s.setSelectedSlot);
  const setEditorSelection = useStore(s => s.setEditorSelection);
  const setCanvasMode = useStore(s => s.setCanvasMode);

  const activeEntity = getActiveEntity();
  const template     = activeEntity ? resolveTemplate(project, activeEntity.templateId) : undefined;
  const styleSet     = activeEntity ? getStyleSetById(activeEntity.styleSetId) : undefined;
  const entityFamily = template?.skeletonFamily ?? null;
  const activeClip = activeEntity?.activeAnimationClipId
    ? project.animationClips.find(clip => clip.id === activeEntity.activeAnimationClipId)
    : null;
  const activeStateMachineId = activeEntity?.activeStateMachineId ?? animPlayback.activeStateMachineId;
  const activeStateMachine = activeStateMachineId
    ? project.stateMachines.find(machine => machine.id === activeStateMachineId)
    : null;
  const templateFamilyLabel = template ? getTemplateFamilyLabel(template) : entityFamily;

  const [editingName,    setEditingName]    = useState(false);
  const [nameValue,      setNameValue]      = useState("");
  const [speciesValue,   setSpeciesValue]   = useState("");
  const [editingSpecies, setEditingSpecies] = useState(false);
  const [attachmentLockAspect, setAttachmentLockAspect] = useState(false);

  const selectedSlotId =
    editor.selection.kind === "item-part" || editor.selection.kind === "template-slot" || editor.selection.kind === "equipped-item" || editor.selection.kind === "face-overlay"
      ? editor.selection.slotId
      : editor.selectedSlotId;
  const selectedAssign   = activeEntity?.slots.find(s => s.slotId === selectedSlotId);
  const selectedItem     = selectedAssign?.itemId
    ? (project.items.find(i => i.id === selectedAssign.itemId) as Item | undefined)
    : undefined;
  const selectedSlotDef  = template?.slots.find(s => s.id === selectedSlotId);
  const selection = editor.selection;
  const selectedPart = selection.kind === "item-part" && selectedItem?.parts
    ? selectedItem.parts.find(part => part.id === selection.partId)
    : undefined;
  const selectedEntityVisual = selection.kind === "entity-visual"
    ? activeEntity?.visuals?.find(v => v.id === selection.visualId)
    : undefined;
  const selectedBone = selection.kind === "bone"
    ? template?.bones.find(bone => bone.id === selection.boneId)
    : undefined;
  const selectedFaceOverlay = selection.kind === "face-overlay"
    ? activeEntity?.faceCustomization?.overlays.find(overlay => overlay.id === selection.overlayId)
    : undefined;
  const selectedAnchor = selection.kind === "anchor"
    ? template?.anchors?.[selection.anchorId]
    : undefined;
  const selectedItemAnchorId =
    selectedAssign?.attachmentOverride.anchorId ||
    (selectedSlotDef && selectedItem ? selectedItem.anchorRules?.[selectedSlotDef.id]?.anchorId : undefined) ||
    selectedSlotDef?.defaultAnchorId ||
    "";
  const selectedItemAnchor = selectedItemAnchorId
    ? template?.anchors?.[selectedItemAnchorId]
    : undefined;
  const fitAuthoring = editor.fitAuthoring;
  const isEditingDefaultFit = Boolean(
    fitAuthoring &&
    selection.kind === "item-part" &&
    selection.entityId === fitAuthoring.entityId &&
    selection.slotId === fitAuthoring.slotId &&
    selection.itemId === fitAuthoring.itemId &&
    selection.partId === fitAuthoring.partId
  );
  const fitTransformValues = selectedItem && selectedSlotDef && selectedPart && template
    ? (resolveItemFitPartTransform(selectedItem, template, selectedSlotDef, selectedPart.id, project.itemFitProfiles) ?? selectedPart.localTransform)
    : {
        x: 0,
        y: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      };
  const attachmentValues = {
    offsetX: selectedAssign?.attachmentOverride?.offsetX ?? 0,
    offsetY: selectedAssign?.attachmentOverride?.offsetY ?? 0,
    rotation: selectedAssign?.attachmentOverride?.rotation ?? 0,
    scaleX: selectedAssign?.attachmentOverride?.scaleX ?? 1,
    scaleY: selectedAssign?.attachmentOverride?.scaleY ?? 1,
  };
  const itemPartTransformValues = isEditingDefaultFit
    ? fitTransformValues
    : {
        x: attachmentValues.offsetX,
        y: attachmentValues.offsetY,
        rotation: attachmentValues.rotation,
        scaleX: attachmentValues.scaleX,
        scaleY: attachmentValues.scaleY,
      };
  const slotTransformValues = {
    x: selectedSlotDef?.defaultTransform?.x ?? 0,
    y: selectedSlotDef?.defaultTransform?.y ?? 0,
    rotation: selectedSlotDef?.defaultTransform?.rotation ?? 0,
    scaleX: selectedSlotDef?.defaultTransform?.scaleX ?? 1,
    scaleY: selectedSlotDef?.defaultTransform?.scaleY ?? 1,
  };
  const visualValues = selectedEntityVisual?.localTransform ?? {
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
  };
  const attachmentBeforeRef = useRef(itemPartTransformValues);
  const slotBeforeRef = useRef(slotTransformValues);
  const visualBeforeRef = useRef(visualValues);
  const bodyMorphs = activeEntity?.bodyMorphs ?? {
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
  const faceCustomization = activeEntity?.faceCustomization;
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
    overlayRoleFilter: "all" as const,
    paintTargetFilter: "all" as const,
    overlayGrouping: "feature" as const,
    drawMode: null as "select" | "pencil" | "closed-pencil" | "fill" | "eraser" | null,
    focusMode: "document" as const,
  };
  const visibleBodyMorphKeys = BODY_REGION_KEYS[bodyAuthoring.focusRegion] ?? BODY_REGION_KEYS.global;
  const activeFaceFeature = (faceAuthoring.activeFeatureKey && faceAuthoring.activeFeatureKey !== "generic"
    ? faceAuthoring.activeFeatureKey
    : "eyes") as FaceFeatureKey;
  const visibleFaceFeatures = [activeFaceFeature];
  const visibleFaceOverlays = faceCustomization?.overlays.filter(overlay => {
    const featureMatch = faceAuthoring.overlayFilter === "all"
      || (overlay.featureTag ?? "generic") === faceAuthoring.overlayFilter;
    const roleMatch = faceAuthoring.overlayRoleFilter === "all"
      || (overlay.overlayRole ?? "detail") === faceAuthoring.overlayRoleFilter;
    const paintMatch = faceAuthoring.paintTargetFilter === "all"
      || (overlay.paintTarget ?? "both") === faceAuthoring.paintTargetFilter;
    return featureMatch && roleMatch && paintMatch;
  }) ?? [];

  if (!activeEntity) {
    return (
      <aside
        data-testid="inspector-panel"
        className="flex flex-col h-full bg-sidebar border-l border-sidebar-border"
      >
        <div className="px-3 py-2 border-b border-border flex-shrink-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Inspector</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-muted-foreground text-center px-4">
            Select an entity to inspect its properties.
          </p>
        </div>
      </aside>
    );
  }

  // Build equipped item list
  const equippedSlots = activeEntity.slots.filter(s => s.itemId !== null);
  const equippedItems = equippedSlots.map(s => ({
    slot: template?.slots.find(sl => sl.id === s.slotId),
    item: project.items.find(i => i.id === s.itemId) as Item | undefined,
    assignment: s,
  })).filter(x => x.slot && x.item);

  // Compatibility analysis
  const entitySpecies = activeEntity.species ?? "";
  const compatWarnings: CompatWarning[] = [];
  if (entityFamily) {
    // Required slots with no item
    template?.slots.filter(s => s.required).forEach(slot => {
      const assignment = activeEntity.slots.find(a => a.slotId === slot.id);
      if (!assignment?.itemId) {
        compatWarnings.push({
          itemName: "",
          slotName: slot.name,
          message: `Required slot "${slot.name}" is empty.`,
          severity: "error",
        });
      }
    });
    // Items incompatible with entity skeleton family
    equippedItems.forEach(({ slot, item }) => {
      if (!item || !slot) return;
      const families = item.compatibility.skeletonFamilies;
      if (families.length > 0 && template && !itemSupportsTemplate(item, template)) {
        compatWarnings.push({
          itemName: item.name,
          slotName: slot.name,
          message: `"${item.name}" is not designed for ${templateFamilyLabel ?? entityFamily}.`,
          severity: "warning",
        });
      }
    });
  }
  // Items incompatible with entity species (if species is set)
  if (entitySpecies) {
    equippedItems.forEach(({ slot, item }) => {
      if (!item || !slot) return;
      const sp = item.compatibility.species;
      if (sp.length > 0 && !sp.includes(entitySpecies)) {
        compatWarnings.push({
          itemName: item.name,
          slotName: slot.name,
          message: `"${item.name}" has no variant for species "${entitySpecies}" (supports: ${sp.slice(0, 3).join(", ")}${sp.length > 3 ? "…" : ""}).`,
          severity: "warning",
        });
      }
    });
  }

  // Keep slot-derived UI aligned with the actual active selection.

  function buildAttachmentOverride(values: typeof itemPartTransformValues) {
    return {
      anchorId: selectedAssign?.attachmentOverride.anchorId ?? "",
      bindMode: selectedAssign?.attachmentOverride.bindMode ?? "",
      offsetX: values.x,
      offsetY: values.y,
      rotation: values.rotation,
      scaleX: values.scaleX,
      scaleY: values.scaleY,
    };
  }

  function buildItemPartTransform(values: typeof itemPartTransformValues): LocalTransform {
    return {
      x: values.x,
      y: values.y,
      rotation: values.rotation,
      scaleX: values.scaleX,
      scaleY: values.scaleY,
    };
  }

  function patchAttachment<K extends keyof typeof itemPartTransformValues>(key: K, value: number) {
    if (!activeEntity || !selectedSlotDef || !selectedAssign) return;
    if (isEditingDefaultFit && selectedItem && selectedPart && template && fitAuthoring) {
      previewItemPartFitTransform(
        selectedItem,
        template,
        selectedSlotDef.id,
        selectedPart.id,
        buildItemPartTransform({
          ...itemPartTransformValues,
          [key]: value,
        }),
        fitAuthoring.scope,
        selectedItemAnchor?.id ?? null,
      );
      return;
    }
    const overrideKey = key === "x" ? "offsetX" : key === "y" ? "offsetY" : key;
    previewAttachmentOverride(activeEntity.id, selectedSlotDef.id, { [overrideKey]: value });
  }

  function patchAttachmentValues(nextValues: Partial<typeof itemPartTransformValues>) {
    if (!activeEntity || !selectedSlotDef || !selectedAssign) return;
    if (isEditingDefaultFit && selectedItem && selectedPart && template && fitAuthoring) {
      previewItemPartFitTransform(
        selectedItem,
        template,
        selectedSlotDef.id,
        selectedPart.id,
        buildItemPartTransform({
          ...itemPartTransformValues,
          ...nextValues,
        }),
        fitAuthoring.scope,
        selectedItemAnchor?.id ?? null,
      );
      return;
    }
    const overridePatch: Record<string, number> = {};
    if (nextValues.x !== undefined) overridePatch.offsetX = nextValues.x;
    if (nextValues.y !== undefined) overridePatch.offsetY = nextValues.y;
    if (nextValues.rotation !== undefined) overridePatch.rotation = nextValues.rotation;
    if (nextValues.scaleX !== undefined) overridePatch.scaleX = nextValues.scaleX;
    if (nextValues.scaleY !== undefined) overridePatch.scaleY = nextValues.scaleY;
    previewAttachmentOverride(activeEntity.id, selectedSlotDef.id, overridePatch);
  }

  function buildAttachmentScalePatch<K extends "scaleX" | "scaleY">(
    key: K,
    value: number,
    source: typeof itemPartTransformValues,
  ): Pick<typeof itemPartTransformValues, "scaleX" | "scaleY"> {
    if (!attachmentLockAspect) {
      return key === "scaleX"
        ? { scaleX: value, scaleY: source.scaleY }
        : { scaleX: source.scaleX, scaleY: value };
    }

    const primary = source[key];
    const secondaryKey = key === "scaleX" ? "scaleY" : "scaleX";
    const secondary = source[secondaryKey];
    const nextSecondary = primary === 0
      ? (secondary === 0 ? value : Number((Math.sign(secondary || 1) * Math.abs(value)).toFixed(4)))
      : Number((secondary * (value / primary)).toFixed(4));

    return key === "scaleX"
      ? { scaleX: value, scaleY: nextSecondary }
      : { scaleX: nextSecondary, scaleY: value };
  }

  function previewAttachmentScale<K extends "scaleX" | "scaleY">(key: K, value: number) {
    patchAttachmentValues(buildAttachmentScalePatch(key, value, itemPartTransformValues));
  }

  function cancelAttachmentScale<K extends "scaleX" | "scaleY">(key: K) {
    patchAttachmentValues(buildAttachmentScalePatch(key, attachmentBeforeRef.current[key], attachmentBeforeRef.current));
  }

  function commitAttachmentField<K extends keyof typeof itemPartTransformValues>(key: K, value: number) {
    if (!activeEntity || !selectedSlotDef || !selectedAssign) return;
    if (isEditingDefaultFit && selectedItem && selectedPart && template && fitAuthoring) {
      commitItemPartFitTransform(
        selectedItem,
        template,
        selectedSlotDef.id,
        selectedPart.id,
        buildItemPartTransform(attachmentBeforeRef.current),
        buildItemPartTransform({
          ...itemPartTransformValues,
          [key]: value,
        }),
        fitAuthoring.scope,
        selectedItemAnchor?.id ?? null,
      );
      return;
    }
    const beforeFull = buildAttachmentOverride(attachmentBeforeRef.current);
    const afterFull = buildAttachmentOverride({
      ...itemPartTransformValues,
      [key]: value,
    });
    useStore.getState().commitAttachmentOverride(activeEntity.id, selectedSlotDef.id, beforeFull, afterFull);
  }

  function commitAttachmentScale<K extends "scaleX" | "scaleY">(key: K, value: number) {
    if (!activeEntity || !selectedSlotDef || !selectedAssign) return;
    if (isEditingDefaultFit && selectedItem && selectedPart && template && fitAuthoring) {
      const afterPatch = buildAttachmentScalePatch(key, value, itemPartTransformValues);
      commitItemPartFitTransform(
        selectedItem,
        template,
        selectedSlotDef.id,
        selectedPart.id,
        buildItemPartTransform(attachmentBeforeRef.current),
        buildItemPartTransform({
          ...itemPartTransformValues,
          ...afterPatch,
        }),
        fitAuthoring.scope,
        selectedItemAnchor?.id ?? null,
        "Scale fit transform",
      );
      return;
    }
    const beforeFull = buildAttachmentOverride(attachmentBeforeRef.current);
    const afterPatch = buildAttachmentScalePatch(key, value, itemPartTransformValues);
    const afterFull = buildAttachmentOverride({
      ...itemPartTransformValues,
      ...afterPatch,
    });
    useStore.getState().commitAttachmentOverride(activeEntity.id, selectedSlotDef.id, beforeFull, afterFull, "Scale attachment");
  }

  function commitAttachmentValues(
    nextValues: Partial<typeof itemPartTransformValues>,
    label: string,
  ) {
    if (!activeEntity || !selectedSlotDef || !selectedAssign) return;
    if (isEditingDefaultFit && selectedItem && selectedPart && template && fitAuthoring) {
      commitItemPartFitTransform(
        selectedItem,
        template,
        selectedSlotDef.id,
        selectedPart.id,
        buildItemPartTransform(itemPartTransformValues),
        buildItemPartTransform({
          ...itemPartTransformValues,
          ...nextValues,
        }),
        fitAuthoring.scope,
        selectedItemAnchor?.id ?? null,
        label,
      );
      return;
    }
    const beforeFull = buildAttachmentOverride(itemPartTransformValues);
    const afterFull = buildAttachmentOverride({
      ...itemPartTransformValues,
      x: nextValues.x ?? itemPartTransformValues.x,
      y: nextValues.y ?? itemPartTransformValues.y,
      rotation: nextValues.rotation ?? itemPartTransformValues.rotation,
      scaleX: nextValues.scaleX ?? itemPartTransformValues.scaleX,
      scaleY: nextValues.scaleY ?? itemPartTransformValues.scaleY,
    });
    useStore.getState().commitAttachmentOverride(activeEntity.id, selectedSlotDef.id, beforeFull, afterFull, label);
  }

  function patchSlotTransform<K extends keyof typeof slotTransformValues>(key: K, value: number) {
    if (!template || !selectedSlotDef) return;
    previewTemplateSlotTransform(template.id, selectedSlotDef.id, {
      ...slotTransformValues,
      [key]: value,
    });
  }

  function commitSlotField<K extends keyof typeof slotTransformValues>(key: K, value: number) {
    if (!template || !selectedSlotDef) return;
    useStore.getState().commitTemplateSlotTransform(template.id, selectedSlotDef.id, slotBeforeRef.current, {
      ...slotTransformValues,
      [key]: value,
    });
  }

  function commitSlotTransformValues(
    nextValues: Partial<typeof slotTransformValues>,
    label: string,
  ) {
    if (!template || !selectedSlotDef) return;
    useStore.getState().commitTemplateSlotTransform(
      template.id,
      selectedSlotDef.id,
      slotTransformValues,
      {
        ...slotTransformValues,
        ...nextValues,
      },
      label,
    );
  }

  function patchVisualTransform<K extends keyof typeof visualValues>(key: K, value: number) {
    if (!activeEntity || !selectedEntityVisual) return;
    useStore.getState().previewEntityVisualTransform(activeEntity.id, selectedEntityVisual.id, {
      ...visualBeforeRef.current,
      [key]: value,
    });
  }

  function commitVisualField<K extends keyof typeof visualValues>(key: K, value: number) {
    if (!activeEntity || !selectedEntityVisual) return;
    useStore.getState().commitEntityVisualTransform(activeEntity.id, selectedEntityVisual.id, visualBeforeRef.current, {
      ...visualValues,
      [key]: value,
    });
  }

  function saveSelectedPartFit(scope: "template" | "family") {
    if (!selectedItem || !selectedPart || !selectedSlotDef || !template) return;
    saveItemPartFitProfile(
      selectedItem,
      template,
      selectedSlotDef.id,
      selectedPart.id,
      {
        x: itemPartTransformValues.x,
        y: itemPartTransformValues.y,
        rotation: itemPartTransformValues.rotation,
        scaleX: itemPartTransformValues.scaleX,
        scaleY: itemPartTransformValues.scaleY,
      },
      scope,
      selectedItemAnchor?.id ?? null,
    );
  }

  function resetSelectedPartFitToDefault() {
    if (!selectedItem || !selectedPart || !selectedSlotDef || !template) return;
    resetItemPartFitProfile(selectedItem, template, selectedSlotDef.id, selectedPart.id, "template");
    resetItemPartFitProfile(selectedItem, template, selectedSlotDef.id, selectedPart.id, "family");
  }

  return (
    <aside
      data-testid="inspector-panel"
      className="flex flex-col h-full bg-sidebar border-l border-sidebar-border"
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex-shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Inspector</span>
      </div>

      <ScrollArea className="flex-1 ide-scroll">
        <div className="p-3 space-y-4">
          {/* Entity name */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Name</Label>
            {editingName ? (
              <Input
                data-testid="inspector-name-input"
                value={nameValue}
                onChange={e => setNameValue(e.target.value)}
                onBlur={() => { renameEntity(activeEntity.id, nameValue || activeEntity.name); setEditingName(false); }}
                onKeyDown={e => {
                  if (e.key === "Enter") { renameEntity(activeEntity.id, nameValue || activeEntity.name); setEditingName(false); }
                  if (e.key === "Escape") setEditingName(false);
                }}
                className="h-7 text-xs bg-background border-border"
                autoFocus
              />
            ) : (
              <p
                className="text-sm font-medium text-foreground cursor-pointer hover:text-primary transition-colors"
                onClick={() => { setNameValue(activeEntity.name); setEditingName(true); }}
                data-testid="inspector-name"
              >
                {activeEntity.name}
              </p>
            )}
          </div>

          <div className="space-y-1 text-[10px] text-muted-foreground">
            <div className="flex justify-between"><span>Entity Type</span><span className="text-foreground">{activeEntity.entityType}</span></div>
            <div className="flex justify-between"><span>Active Animation</span><span className="text-foreground">{activeClip?.label ?? activeClip?.name ?? "none"}</span></div>
            <div className="flex justify-between"><span>State Machine</span><span className="text-foreground">{activeStateMachine?.name ?? "none"}</span></div>
            <div className="flex justify-between"><span>Root Transform</span><span className="text-foreground">{activeEntity.rootTransform ? "custom" : "identity"}</span></div>
          </div>

          <Separator className="bg-border" />

          {/* Template info */}
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Template</Label>
            <div className="flex items-center gap-2">
              {template && (
                <div
                  className="w-8 h-8 rounded border border-border flex-shrink-0 overflow-hidden bg-background"
                  dangerouslySetInnerHTML={{ __html: sanitizeSvg(template.thumbnailSvg) }}
                />
              )}
              <div>
                <p className="text-xs text-foreground">{template?.name ?? activeEntity.templateId}</p>
                <p className="text-[10px] text-muted-foreground">
                  {template ? getTemplatePresentationSummary(template) : activeEntity.templateId}
                </p>
              </div>
            </div>
          </div>

          {/* Species */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Species
              <span className="ml-1 text-muted-foreground/50 normal-case font-normal">(affects item filtering)</span>
            </Label>
            {editingSpecies ? (
              <div className="space-y-1">
                <Input
                  data-testid="inspector-species-input"
                  value={speciesValue}
                  onChange={e => setSpeciesValue(e.target.value)}
                  onBlur={() => {
                    setEntitySpecies(activeEntity.id, speciesValue.trim().toLowerCase());
                    setEditingSpecies(false);
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter") { setEntitySpecies(activeEntity.id, speciesValue.trim().toLowerCase()); setEditingSpecies(false); }
                    if (e.key === "Escape") setEditingSpecies(false);
                  }}
                  placeholder="e.g. horse, human, dragon…"
                  className="h-6 text-xs bg-background border-border"
                  autoFocus
                  list="species-suggestions"
                />
                <datalist id="species-suggestions">
                  {COMMON_SPECIES.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
            ) : (
              <p
                className="text-xs text-foreground cursor-pointer hover:text-primary transition-colors"
                onClick={() => { setSpeciesValue(activeEntity.species ?? ""); setEditingSpecies(true); }}
                data-testid="inspector-species"
              >
                {activeEntity.species ? activeEntity.species : <span className="text-muted-foreground italic">Not set — click to add</span>}
              </p>
            )}
          </div>

          <Separator className="bg-border" />

          {/* ── Compatibility panel ── */}
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Compatibility
              {compatWarnings.length > 0 && (
                <span className="ml-1.5 text-yellow-500">({compatWarnings.length})</span>
              )}
            </Label>

            {compatWarnings.length === 0 ? (
              <div className="flex items-center gap-1.5 text-[10px] text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-3 h-3" />
                All slots compatible
              </div>
            ) : (
              <div className="space-y-1">
                {compatWarnings.map((w, i) => (
                  <div
                    key={i}
                    className={[
                      "flex items-start gap-1.5 rounded px-2 py-1.5 text-[10px]",
                      w.severity === "error"
                        ? "bg-destructive/10 border border-destructive/30 text-destructive"
                        : "bg-yellow-500/10 border border-yellow-500/30 text-yellow-700 dark:text-yellow-400",
                    ].join(" ")}
                  >
                    <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    <span>{w.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Selected slot item detail ── */}
          {selectedSlotDef && (
            <>
              <Separator className="bg-border" />
              <div className="space-y-1.5">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Selected Slot: {selectedSlotDef.name}
                </Label>
                {selectedItem ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded border border-border overflow-hidden bg-background flex-shrink-0">
                        {selectedItem.svgLayers[0] && (
                          <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: sanitizeSvg(selectedItem.svgLayers[0].svgData) }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground">{selectedItem.name}</p>
                        <p className="text-[10px] text-muted-foreground">{selectedItem.description}</p>
                      </div>
                    </div>
                    {/* Item compatibility info */}
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground">Supports families:</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedItem.compatibility.skeletonFamilies.length === 0 ? (
                          <Badge variant="outline" className="text-[9px]">All</Badge>
                        ) : selectedItem.compatibility.skeletonFamilies.map(f => {
                          const isMatch = template ? templateMatchesCompatibilityFamily(template, f) : f === entityFamily;
                          return (
                            <Badge
                              key={f}
                              variant="outline"
                              className={`text-[9px] ${isMatch ? "border-green-500/50 text-green-600 dark:text-green-400" : "border-border text-muted-foreground"}`}
                            >
                              {getFamilyLabelById(f)}
                            </Badge>
                          );
                        })}
                      </div>
                      {selectedItem.tags.length > 0 && (
                        <div className="flex flex-wrap gap-0.5 mt-1">
                          {selectedItem.tags.map(tag => (
                            <span key={tag} className="text-[8px] bg-accent/40 rounded px-1 py-0.5 text-muted-foreground">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Unequip */}
                    <button
                      onClick={() => setEntitySlot(activeEntity.id, selectedSlotDef.id, null)}
                      className="text-[10px] text-destructive/70 hover:text-destructive transition-colors flex items-center gap-1"
                    >
                      <span>× Unequip</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Info className="w-3 h-3" />
                    Empty slot — pick an item from the Items tab.
                  </div>
                )}
              </div>
            </>
          )}

          {selectedSlotDef && selection.kind === "item-part" && selection.slotId === selectedSlotDef.id && selectedAssign && selectedItem && (
            <>
              <Separator className="bg-border" />
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Item Part
                </Label>
                <div className="space-y-1 text-[10px] text-muted-foreground">
                  <div className="flex justify-between"><span>Item</span><span className="text-foreground">{selectedItem.name}</span></div>
                  <div className="flex justify-between"><span>Part</span><span className="text-foreground">{selectedPart?.id ?? selection.partId}</span></div>
                  <div className="flex justify-between"><span>Slot</span><span className="text-foreground">{selectedSlotDef.name}</span></div>
                  <div className="flex justify-between"><span>Bone</span><span className="text-foreground">{selectedPart?.boneId ?? selectedSlotDef.boneId}</span></div>
                  <div className="flex justify-between"><span>Anchor</span><span className="text-foreground">{selectedItemAnchor?.id ?? "none"}</span></div>
                  <div className="flex justify-between"><span>Pivot</span><span className="text-foreground">{selectedPart ? `${selectedPart.pivot.x}, ${selectedPart.pivot.y}` : "n/a"}</span></div>
                  <div className="flex justify-between"><span>Z Offset</span><span className="text-foreground">{selectedPart?.zOffset ?? 0}</span></div>
                </div>
                <Separator className="bg-border" />
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {isEditingDefaultFit ? "Default Fit Transform" : "Attachment Transform"}
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">X</label>
                    <TransactionalNumberInput
                      testId="inspector-attach-x"
                      value={itemPartTransformValues.x}
                      onBeginEdit={() => { attachmentBeforeRef.current = itemPartTransformValues; }}
                      onPreview={v => patchAttachment("x", v)}
                      onCommit={v => commitAttachmentField("x", v)}
                      onCancel={() => patchAttachment("x", attachmentBeforeRef.current.x)}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">Y</label>
                    <TransactionalNumberInput
                      testId="inspector-attach-y"
                      value={itemPartTransformValues.y}
                      onBeginEdit={() => { attachmentBeforeRef.current = itemPartTransformValues; }}
                      onPreview={v => patchAttachment("y", v)}
                      onCommit={v => commitAttachmentField("y", v)}
                      onCancel={() => patchAttachment("y", attachmentBeforeRef.current.y)}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">Rotation</label>
                    <TransactionalNumberInput
                      testId="inspector-attach-rotation"
                      value={itemPartTransformValues.rotation}
                      onBeginEdit={() => { attachmentBeforeRef.current = itemPartTransformValues; }}
                      onPreview={v => patchAttachment("rotation", v)}
                      onCommit={v => commitAttachmentField("rotation", v)}
                      onCancel={() => patchAttachment("rotation", attachmentBeforeRef.current.rotation)}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">Scale X</label>
                    <TransactionalNumberInput
                      testId="inspector-attach-scale-x"
                      value={itemPartTransformValues.scaleX}
                      onBeginEdit={() => { attachmentBeforeRef.current = itemPartTransformValues; }}
                      onPreview={v => previewAttachmentScale("scaleX", v)}
                      onCommit={v => commitAttachmentScale("scaleX", v)}
                      onCancel={() => cancelAttachmentScale("scaleX")}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">Scale Y</label>
                    <TransactionalNumberInput
                      testId="inspector-attach-scale-y"
                      value={itemPartTransformValues.scaleY}
                      onBeginEdit={() => { attachmentBeforeRef.current = itemPartTransformValues; }}
                      onPreview={v => previewAttachmentScale("scaleY", v)}
                      onCommit={v => commitAttachmentScale("scaleY", v)}
                      onCancel={() => cancelAttachmentScale("scaleY")}
                    />
                  </div>
                </div>
                <button
                  data-testid="inspector-lock-aspect"
                  onClick={() => setAttachmentLockAspect(value => !value)}
                  className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                >
                  {attachmentLockAspect ? "Lock Aspect: On" : "Lock Aspect: Off"}
                </button>
                <button
                  onClick={() => commitAttachmentValues({
                    x: 0,
                    y: 0,
                  }, isEditingDefaultFit ? "Reset fit position" : "Reset attachment position")}
                  className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                >
                  Reset Position
                </button>
                <button
                  onClick={() => {
                    if (isEditingDefaultFit && selectedItem && selectedPart && template && fitAuthoring) {
                      commitItemPartFitTransform(
                        selectedItem,
                        template,
                        selectedSlotDef.id,
                        selectedPart.id,
                        buildItemPartTransform(itemPartTransformValues),
                        buildItemPartTransform({
                          ...itemPartTransformValues,
                          rotation: 0,
                        }),
                        fitAuthoring.scope,
                        selectedItemAnchor?.id ?? null,
                        "Reset fit rotation",
                      );
                      return;
                    }
                    const beforeFull = buildAttachmentOverride(itemPartTransformValues);
                    const afterFull = buildAttachmentOverride({
                      ...itemPartTransformValues,
                      rotation: 0,
                    });
                    useStore.getState().commitAttachmentOverride(activeEntity.id, selectedSlotDef.id, beforeFull, afterFull, "Reset rotation");
                  }}
                  className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                >
                  Reset Rotation
                </button>
                <button
                  onClick={() => commitAttachmentValues({
                    x: 0,
                    y: 0,
                    rotation: 0,
                    scaleX: 1,
                    scaleY: 1,
                  }, isEditingDefaultFit ? "Reset fit transform" : "Reset attachment transform")}
                  className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                >
                  Reset All
                </button>
                <button
                  onClick={() => commitAttachmentValues({
                    scaleX: -Math.abs(itemPartTransformValues.scaleX || 1),
                  }, isEditingDefaultFit ? "Flip fit horizontally" : "Flip attachment horizontally")}
                  className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                >
                  Flip X
                </button>
                <button
                  onClick={() => commitAttachmentValues({
                    scaleY: -Math.abs(itemPartTransformValues.scaleY || 1),
                  }, isEditingDefaultFit ? "Flip fit vertically" : "Flip attachment vertically")}
                  className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                >
                  Flip Y
                </button>
                <button
                  onClick={() => commitAttachmentValues({
                    scaleX: 1,
                    scaleY: 1,
                  }, isEditingDefaultFit ? "Reset fit scale" : "Reset attachment scale")}
                  className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                >
                  Reset Scale
                </button>
                <button
                  onClick={() => setEntitySlot(activeEntity.id, selectedSlotDef.id, null)}
                  className="text-[10px] text-destructive/70 hover:text-destructive transition-colors flex items-center gap-1"
                >
                  <span>Remove from character</span>
                </button>
                <button
                  className="text-[10px] text-primary/60 cursor-not-allowed"
                  disabled
                >
                  Edit Source Asset
                </button>
                {isEditingDefaultFit && (
                  <button
                    onClick={() => clearItemPartFitAuthoring()}
                    className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                  >
                    Back To Attachment Override
                  </button>
                )}
                <button
                  data-testid="save-fit-template"
                  onClick={() => {
                    if (activeEntity && selectedSlotDef && selectedItem && selectedPart) {
                      beginItemPartFitAuthoring("template", activeEntity.id, selectedSlotDef.id, selectedItem.id, selectedPart.id);
                    }
                    saveSelectedPartFit("template");
                  }}
                  className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                >
                  Save Fit For This Template
                </button>
                <button
                  data-testid="save-fit-family"
                  onClick={() => {
                    if (activeEntity && selectedSlotDef && selectedItem && selectedPart) {
                      beginItemPartFitAuthoring("family", activeEntity.id, selectedSlotDef.id, selectedItem.id, selectedPart.id);
                    }
                    saveSelectedPartFit("family");
                  }}
                  className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                >
                  Save Fit For Skeleton Family
                </button>
                <button
                  data-testid="reset-fit-default"
                  onClick={() => resetSelectedPartFitToDefault()}
                  className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                >
                  Reset To Item Default
                </button>
              </div>
            </>
          )}

          {selectedSlotDef && selection.kind === "equipped-item" && selection.slotId === selectedSlotDef.id && selectedAssign && selectedItem && (
            <>
              <Separator className="bg-border" />
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Equipped Item
                </Label>
                <div className="space-y-1 text-[10px] text-muted-foreground">
                  <div className="flex justify-between"><span>Item</span><span className="text-foreground">{selectedItem.name}</span></div>
                  <div className="flex justify-between"><span>Slot</span><span className="text-foreground">{selectedSlotDef.name}</span></div>
                  <div className="flex justify-between"><span>Anchor</span><span className="text-foreground">{selectedItemAnchor?.id ?? "none"}</span></div>
                  <div className="flex justify-between"><span>Shared Attachment Override</span><span className="text-foreground">active</span></div>
                  <div className="flex justify-between"><span>Default Fit Editing</span><span className="text-foreground">{fitAuthoring && fitAuthoring.slotId === selectedSlotDef.id && fitAuthoring.itemId === selectedItem.id ? fitAuthoring.scope : "off"}</span></div>
                  <div className="flex justify-between"><span>Palette Override</span><span className="text-foreground">{Object.keys(selectedAssign.paletteOverride ?? {}).length ? "custom" : "default"}</span></div>
                  {import.meta.env.DEV && (
                    <div className="flex flex-col gap-1">
                      <span>Attachment Override</span>
                      <span className="text-[9px] text-foreground break-words">
                        {JSON.stringify({
                          x: selectedAssign.attachmentOverride?.offsetX ?? 0,
                          y: selectedAssign.attachmentOverride?.offsetY ?? 0,
                          rotation: selectedAssign.attachmentOverride?.rotation ?? 0,
                          scaleX: selectedAssign.attachmentOverride?.scaleX ?? 1,
                          scaleY: selectedAssign.attachmentOverride?.scaleY ?? 1,
                          anchorId: selectedAssign.attachmentOverride?.anchorId ?? "",
                        })}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setEntitySlot(activeEntity.id, selectedSlotDef.id, null)}
                  className="text-[10px] text-destructive/70 hover:text-destructive transition-colors flex items-center gap-1"
                >
                  <span>Remove from character</span>
                </button>
                <button
                  className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                  onClick={() => {
                    const firstPart = selectedItem.parts?.[0];
                    if (!firstPart) return;
                    beginItemPartFitAuthoring("template", activeEntity.id, selectedSlotDef.id, selectedItem.id, firstPart.id);
                  }}
                >
                  Edit Default Fit
                </button>
                <button
                  className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                  onClick={() => {
                    setActiveAuthoringMode("sprite-editor");
                    setAnimBottomTab("authoring");
                  }}
                >
                  Open In Sprite Editor
                </button>
              </div>
            </>
          )}

          {selectedSlotDef && selection.kind === "template-slot" && template && (
            <>
              <Separator className="bg-border" />
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Template Slot
                </Label>
                <div className="space-y-1 text-[10px] text-muted-foreground">
                  <div className="flex justify-between"><span>Template</span><span className="text-foreground">{template.name}</span></div>
                  <div className="flex justify-between"><span>Slot</span><span className="text-foreground">{selectedSlotDef.name}</span></div>
                  <div className="flex justify-between"><span>Bone</span><span className="text-foreground">{selectedSlotDef.boneId}</span></div>
                  <div className="flex justify-between"><span>Anchor</span><span className="text-foreground">{selectedSlotDef.defaultAnchorId ?? "none"}</span></div>
                  <div className="flex justify-between"><span>Z Index</span><span className="text-foreground">{selectedSlotDef.zIndex}</span></div>
                  <div className="flex justify-between"><span>Allowed</span><span className="text-foreground">{selectedSlotDef.allowedCategories.join(", ") || "none"}</span></div>
                </div>
                <Separator className="bg-border" />
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Slot Transform
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">X</label>
                    <TransactionalNumberInput
                      testId="inspector-slot-x"
                      value={slotTransformValues.x}
                      onBeginEdit={() => { slotBeforeRef.current = slotTransformValues; }}
                      onPreview={v => patchSlotTransform("x", v)}
                      onCommit={v => commitSlotField("x", v)}
                      onCancel={() => patchSlotTransform("x", slotBeforeRef.current.x)}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">Y</label>
                    <TransactionalNumberInput
                      testId="inspector-slot-y"
                      value={slotTransformValues.y}
                      onBeginEdit={() => { slotBeforeRef.current = slotTransformValues; }}
                      onPreview={v => patchSlotTransform("y", v)}
                      onCommit={v => commitSlotField("y", v)}
                      onCancel={() => patchSlotTransform("y", slotBeforeRef.current.y)}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">Rotation</label>
                    <TransactionalNumberInput
                      testId="inspector-slot-rotation"
                      value={slotTransformValues.rotation}
                      onBeginEdit={() => { slotBeforeRef.current = slotTransformValues; }}
                      onPreview={v => patchSlotTransform("rotation", v)}
                      onCommit={v => commitSlotField("rotation", v)}
                      onCancel={() => patchSlotTransform("rotation", slotBeforeRef.current.rotation)}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">Scale X</label>
                    <TransactionalNumberInput
                      testId="inspector-slot-scale-x"
                      value={slotTransformValues.scaleX}
                      onBeginEdit={() => { slotBeforeRef.current = slotTransformValues; }}
                      onPreview={v => patchSlotTransform("scaleX", v)}
                      onCommit={v => commitSlotField("scaleX", v)}
                      onCancel={() => patchSlotTransform("scaleX", slotBeforeRef.current.scaleX)}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">Scale Y</label>
                    <TransactionalNumberInput
                      testId="inspector-slot-scale-y"
                      value={slotTransformValues.scaleY}
                      onBeginEdit={() => { slotBeforeRef.current = slotTransformValues; }}
                      onPreview={v => patchSlotTransform("scaleY", v)}
                      onCommit={v => commitSlotField("scaleY", v)}
                      onCancel={() => patchSlotTransform("scaleY", slotBeforeRef.current.scaleY)}
                    />
                  </div>
                </div>
                <button
                  onClick={() => commitSlotTransformValues({
                    x: 0,
                    y: 0,
                    rotation: 0,
                    scaleX: 1,
                    scaleY: 1,
                  }, "Reset slot transform")}
                  className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                >
                  Reset slot transform
                </button>
              </div>
            </>
          )}

          {selection.kind === "entity-visual" && selectedEntityVisual && template && (
            <>
              <Separator className="bg-border" />
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Entity Visual
                </Label>
                <div className="space-y-1 text-[10px] text-muted-foreground">
                  <div className="flex justify-between"><span>Bone</span><span className="text-foreground">{selectedEntityVisual.boneId}</span></div>
                  <div className="flex justify-between"><span>Pivot</span><span className="text-foreground">{`${selectedEntityVisual.pivot.x}, ${selectedEntityVisual.pivot.y}`}</span></div>
                </div>
                <Separator className="bg-border" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">X</label>
                    <TransactionalNumberInput
                      testId="inspector-visual-x"
                      value={visualValues.x}
                      onBeginEdit={() => { visualBeforeRef.current = visualValues; }}
                      onPreview={v => patchVisualTransform("x", v)}
                      onCommit={v => commitVisualField("x", v)}
                      onCancel={() => patchVisualTransform("x", visualBeforeRef.current.x)}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">Y</label>
                    <TransactionalNumberInput
                      testId="inspector-visual-y"
                      value={visualValues.y}
                      onBeginEdit={() => { visualBeforeRef.current = visualValues; }}
                      onPreview={v => patchVisualTransform("y", v)}
                      onCommit={v => commitVisualField("y", v)}
                      onCancel={() => patchVisualTransform("y", visualBeforeRef.current.y)}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">Rotation</label>
                    <TransactionalNumberInput
                      testId="inspector-visual-rotation"
                      value={visualValues.rotation}
                      onBeginEdit={() => { visualBeforeRef.current = visualValues; }}
                      onPreview={v => patchVisualTransform("rotation", v)}
                      onCommit={v => commitVisualField("rotation", v)}
                      onCancel={() => patchVisualTransform("rotation", visualBeforeRef.current.rotation)}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">Scale X</label>
                    <TransactionalNumberInput
                      testId="inspector-visual-scale-x"
                      value={visualValues.scaleX}
                      onBeginEdit={() => { visualBeforeRef.current = visualValues; }}
                      onPreview={v => patchVisualTransform("scaleX", v)}
                      onCommit={v => commitVisualField("scaleX", v)}
                      onCancel={() => patchVisualTransform("scaleX", visualBeforeRef.current.scaleX)}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">Scale Y</label>
                    <TransactionalNumberInput
                      testId="inspector-visual-scale-y"
                      value={visualValues.scaleY}
                      onBeginEdit={() => { visualBeforeRef.current = visualValues; }}
                      onPreview={v => patchVisualTransform("scaleY", v)}
                      onCommit={v => commitVisualField("scaleY", v)}
                      onCancel={() => patchVisualTransform("scaleY", visualBeforeRef.current.scaleY)}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">Z Index</label>
                    <Input
                      data-testid="inspector-visual-zindex"
                      type="number"
                      value={selectedEntityVisual.zIndex}
                      readOnly
                      className="h-6 text-[11px] bg-background border-border"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                    onClick={() => {
                      setActiveAuthoringMode("sprite-editor");
                      setAnimBottomTab("authoring");
                    }}
                  >
                    Edit Source Asset
                  </button>
                  <button
                    onClick={() => removeEntityVisual(activeEntity.id, selectedEntityVisual.id)}
                    className="text-[10px] text-destructive/70 hover:text-destructive transition-colors"
                  >
                    Detach Source
                  </button>
                </div>
              </div>
            </>
          )}

          {selection.kind === "face-overlay" && selectedFaceOverlay && (
            <>
              <Separator className="bg-border" />
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Face Overlay
                </Label>
                  <div className="space-y-1 text-[10px] text-muted-foreground">
                    <div className="flex justify-between"><span>Name</span><span className="text-foreground">{selectedFaceOverlay.name}</span></div>
                    <div className="flex justify-between"><span>Feature</span><span className="text-foreground">{selectedFaceOverlay.featureTag ?? "generic"}</span></div>
                    <div className="flex justify-between"><span>Target Slot</span><span className="text-foreground">{selection.slotId ?? "head-local"}</span></div>
                    <div className="flex justify-between"><span>Target Bone</span><span className="text-foreground">head</span></div>
                    <div className="flex justify-between"><span>Role</span><span className="text-foreground">{getFaceOverlayRoleLabel(selectedFaceOverlay.overlayRole)}</span></div>
                    <div className="flex justify-between"><span>Paint Pass</span><span className="text-foreground">{getPaintTargetLabel(selectedFaceOverlay.paintTarget)}</span></div>
                    <div className="flex justify-between"><span>Symmetry</span><span className="text-foreground">{selectedFaceOverlay.symmetryMode ?? "none"}</span></div>
                    <div className="flex justify-between"><span>Pivot</span><span className="text-foreground">{`${selectedFaceOverlay.pivot.x}, ${selectedFaceOverlay.pivot.y}`}</span></div>
                  </div>
                <Separator className="bg-border" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">X</label>
                    <TransactionalNumberInput
                      testId="inspector-face-overlay-x"
                      value={selectedFaceOverlay.localTransform.x}
                      onPreview={v => setEntityFaceOverlayTransform(activeEntity.id, selectedFaceOverlay.id, { x: v })}
                      onCommit={v => setEntityFaceOverlayTransform(activeEntity.id, selectedFaceOverlay.id, { x: v })}
                      onCancel={() => undefined}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">Y</label>
                    <TransactionalNumberInput
                      testId="inspector-face-overlay-y"
                      value={selectedFaceOverlay.localTransform.y}
                      onPreview={v => setEntityFaceOverlayTransform(activeEntity.id, selectedFaceOverlay.id, { y: v })}
                      onCommit={v => setEntityFaceOverlayTransform(activeEntity.id, selectedFaceOverlay.id, { y: v })}
                      onCancel={() => undefined}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">Rotation</label>
                    <TransactionalNumberInput
                      testId="inspector-face-overlay-rotation"
                      value={selectedFaceOverlay.localTransform.rotation}
                      onPreview={v => setEntityFaceOverlayTransform(activeEntity.id, selectedFaceOverlay.id, { rotation: v })}
                      onCommit={v => setEntityFaceOverlayTransform(activeEntity.id, selectedFaceOverlay.id, { rotation: v })}
                      onCancel={() => undefined}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-muted-foreground">Scale</label>
                    <TransactionalNumberInput
                      testId="inspector-face-overlay-scale"
                      value={selectedFaceOverlay.localTransform.scaleX}
                      onPreview={v => setEntityFaceOverlayTransform(activeEntity.id, selectedFaceOverlay.id, { scaleX: v, scaleY: v })}
                      onCommit={v => setEntityFaceOverlayTransform(activeEntity.id, selectedFaceOverlay.id, { scaleX: v, scaleY: v })}
                      onCancel={() => undefined}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                      onClick={() => {
                        setEntityFaceAuthoringState(activeEntity.id, {
                          activeFeatureKey: selectedFaceOverlay.featureTag ?? "generic",
                          overlayFilter: selectedFaceOverlay.featureTag ?? "generic",
                          overlayRoleFilter: selectedFaceOverlay.overlayRole ?? "detail",
                          paintTargetFilter: selectedFaceOverlay.paintTarget ?? "both",
                          selectedOverlayId: selectedFaceOverlay.id,
                          activeBoneId: "head",
                          activeSlotId: selection.slotId,
                          workflowMode: "overlay",
                          focusMode: "head",
                        });
                        openAuthoringWorkflow("face-editor", setActiveAuthoringMode, setAnimBottomTab, setCanvasMode);
                      }}
                  >
                    Open In Face Mode
                  </button>
                  <button
                    className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                    onClick={() => setEntityFaceOverlayTransform(activeEntity.id, selectedFaceOverlay.id, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 })}
                  >
                    Reset Overlay Transform
                  </button>
                </div>
              </div>
            </>
          )}

          {selection.kind === "bone" && selectedBone && template && (
            <>
              <Separator className="bg-border" />
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Bone
                </Label>
                <div className="space-y-1 text-[10px] text-muted-foreground">
                  <div className="flex justify-between"><span>Bone ID</span><span className="text-foreground">{selectedBone.id}</span></div>
                  <div className="flex justify-between"><span>Name</span><span className="text-foreground">{selectedBone.name}</span></div>
                  <div className="flex justify-between"><span>Parent</span><span className="text-foreground">{selectedBone.parentId ?? "none"}</span></div>
                  <div className="flex justify-between"><span>Rest TX</span><span className="text-foreground">{selectedBone.restPose.tx}</span></div>
                  <div className="flex justify-between"><span>Rest TY</span><span className="text-foreground">{selectedBone.restPose.ty}</span></div>
                  <div className="flex justify-between"><span>Rest Rotation</span><span className="text-foreground">{selectedBone.restPose.rotation}</span></div>
                  <div className="flex justify-between"><span>Rest Scale X</span><span className="text-foreground">{selectedBone.restPose.scaleX}</span></div>
                  <div className="flex justify-between"><span>Rest Scale Y</span><span className="text-foreground">{selectedBone.restPose.scaleY}</span></div>
                  <div className="flex justify-between"><span>Length</span><span className="text-foreground">{selectedBone.length}</span></div>
                  <div className="flex justify-between"><span>Assigned Parts</span><span className="text-foreground">{template.boneParts?.filter(part => part.boneId === selectedBone.id).length ?? 0}</span></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                    onClick={() => {
                      const region = selectedBone.id === "head"
                        ? "head"
                        : selectedBone.id === "root"
                          ? "global"
                          : selectedBone.id.includes("shoulder") || selectedBone.id.includes("arm") || selectedBone.id.includes("hand")
                            ? "arms"
                            : selectedBone.id.includes("hip") || selectedBone.id.includes("leg") || selectedBone.id.includes("knee") || selectedBone.id.includes("shin") || selectedBone.id.includes("foot")
                              ? "legs"
                              : "torso";
                      setEntityBodyAuthoringState(activeEntity.id, {
                        focusRegion: region,
                        activeBoneId: selectedBone.id,
                      });
                      openAuthoringWorkflow("body-morph", setActiveAuthoringMode, setAnimBottomTab, setCanvasMode);
                    }}
                  >
                    Focus Body Region
                  </button>
                  {selectedBone.id === "head" && (
                    <button
                      className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                      onClick={() => {
                        setEntityFaceAuthoringState(activeEntity.id, {
                          activeBoneId: "head",
                          focusMode: "head",
                        });
                        openAuthoringWorkflow("face-editor", setActiveAuthoringMode, setAnimBottomTab, setCanvasMode);
                      }}
                    >
                      Draw On Head
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {selection.kind === "anchor" && selectedAnchor && template && (
            <>
              <Separator className="bg-border" />
              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Anchor
                </Label>
                <div className="space-y-1 text-[10px] text-muted-foreground">
                  <div className="flex justify-between"><span>Anchor ID</span><span className="text-foreground">{selectedAnchor.id}</span></div>
                  <div className="flex justify-between"><span>Bone</span><span className="text-foreground">{selectedAnchor.boneId}</span></div>
                  <div className="flex justify-between"><span>Offset X</span><span className="text-foreground">{selectedAnchor.offsetX}</span></div>
                  <div className="flex justify-between"><span>Offset Y</span><span className="text-foreground">{selectedAnchor.offsetY}</span></div>
                  <div className="flex justify-between"><span>Rotation</span><span className="text-foreground">{selectedAnchor.rotation}</span></div>
                  <div className="flex justify-between"><span>Usage</span><span className="text-foreground">{template.slots.filter(slot => slot.defaultAnchorId === selectedAnchor.id).length}</span></div>
                </div>
              </div>
            </>
          )}

          <Separator className="bg-border" />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Body Morph</Label>
                <button
                className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                onClick={() => {
                  openAuthoringWorkflow("body-morph", setActiveAuthoringMode, setAnimBottomTab, setCanvasMode);
                }}
              >
                  Morph Mode
                </button>
              </div>
              <div className="rounded border border-border bg-accent/20 p-2 space-y-1 text-[10px] text-muted-foreground">
                <div className="flex justify-between"><span>Focus Region</span><span className="text-foreground">{BODY_REGION_LABELS[bodyAuthoring.focusRegion]}</span></div>
                <div className="flex justify-between"><span>Target Bone</span><span className="text-foreground">{bodyAuthoring.activeBoneId ?? "auto"}</span></div>
                <div className="flex justify-between"><span>Target Slot</span><span className="text-foreground">{bodyAuthoring.activeSlotId ?? "none"}</span></div>
                <div className="flex justify-between"><span>Intent</span><span className="text-foreground">{bodyAuthoring.intent ?? "morph"}</span></div>
                <div className="flex justify-between"><span>Viewport</span><span className="text-foreground">{bodyAuthoring.viewportMode ?? "focus_region"}</span></div>
                <div className="flex justify-between"><span>Visible Sliders</span><span className="text-foreground">{visibleBodyMorphKeys.map(key => BODY_MORPH_LABELS[key]).join(", ")}</span></div>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(Object.keys(BODY_REGION_LABELS) as BodyMorphRegionId[]).map(region => (
                <button
                  key={region}
                  className={[
                    "rounded border px-2 py-1 text-[10px] transition-colors",
                    bodyAuthoring.focusRegion === region
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-border bg-background/60 text-muted-foreground hover:text-foreground hover:bg-accent/30",
                  ].join(" ")}
                  onClick={() => {
                    const boneId = region === "head" ? "head" : region === "torso" ? "chest" : region === "arms" ? "shoulder_l" : region === "legs" ? "hip_l" : "root";
                      setEntityBodyAuthoringState(activeEntity.id, {
                        focusRegion: region,
                        activeBoneId: boneId,
                        activeSlotId: null,
                        intent: "morph",
                        viewportMode: "focus_region",
                      });
                    setEditorSelection({
                      kind: "bone",
                      entityId: activeEntity.id,
                      boneId,
                    });
                    openAuthoringWorkflow("body-morph", setActiveAuthoringMode, setAnimBottomTab, setCanvasMode);
                  }}
                >
                  {BODY_REGION_LABELS[region]}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {visibleBodyMorphKeys.map(key => (
                <MorphSlider
                  key={key}
                  label={BODY_MORPH_LABELS[key]}
                  value={bodyMorphs[key]}
                  onChange={value => {
                    setEntityBodyAuthoringFocus(activeEntity.id, bodyAuthoring.focusRegion);
                    setEntityBodyMorphValue(activeEntity.id, key, value);
                  }}
                />
              ))}
            </div>
          </div>

          <Separator className="bg-border" />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Face Editor</Label>
              <button
                className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                onClick={() => {
                  openAuthoringWorkflow("face-editor", setActiveAuthoringMode, setAnimBottomTab, setCanvasMode);
                }}
              >
                Face Mode
              </button>
            </div>
            {faceCustomization && (
                <div className="space-y-3">
                  <div className="rounded border border-border bg-accent/20 p-2 space-y-1 text-[10px] text-muted-foreground">
                    <div className="flex justify-between"><span>Focus</span><span className="text-foreground">{activeFaceFeature}</span></div>
                    <div className="flex justify-between"><span>Target Slot</span><span className="text-foreground">{faceAuthoring.activeSlotId ?? "head-local"}</span></div>
                    <div className="flex justify-between"><span>Target Bone</span><span className="text-foreground">{faceAuthoring.activeBoneId ?? "head"}</span></div>
                    <div className="flex justify-between"><span>Workflow</span><span className="text-foreground">{faceAuthoring.workflowMode ?? "feature"}</span></div>
                    <div className="flex justify-between"><span>Draft Role</span><span className="text-foreground">{faceAuthoring.draftOverlayRole ?? "detail"}</span></div>
                    <div className="flex justify-between"><span>Draft Paint</span><span className="text-foreground">{faceAuthoring.draftPaintTarget ?? "both"}</span></div>
                    <div className="flex justify-between"><span>Draft Symmetry</span><span className="text-foreground">{faceAuthoring.draftSymmetryMode ?? "none"}</span></div>
                    <div className="flex justify-between"><span>Draw Mode</span><span className="text-foreground">{faceAuthoring.drawMode ?? "none"}</span></div>
                    <div className="flex justify-between"><span>Canvas Focus</span><span className="text-foreground">{faceAuthoring.focusMode ?? "document"}</span></div>
                    <div className="flex justify-between"><span>Role Filter</span><span className="text-foreground">{faceAuthoring.overlayRoleFilter ?? "all"}</span></div>
                    <div className="flex justify-between"><span>Paint Filter</span><span className="text-foreground">{faceAuthoring.paintTargetFilter ?? "all"}</span></div>
                    <div className="flex justify-between"><span>Grouping</span><span className="text-foreground">{faceAuthoring.overlayGrouping ?? "feature"}</span></div>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                  {(Object.keys(FACE_FEATURE_LABELS) as FaceFeatureKey[]).map(featureKey => (
                    <button
                      key={featureKey}
                      className={[
                        "rounded border px-2 py-1 text-[10px] transition-colors",
                        activeFaceFeature === featureKey
                          ? "border-primary/40 bg-primary/10 text-foreground"
                          : "border-border bg-background/60 text-muted-foreground hover:text-foreground hover:bg-accent/30",
                      ].join(" ")}
                      onClick={() => {
                        const slotId = FACE_FEATURE_TO_SLOT[featureKey] ?? null;
                        setEntityFaceAuthoringState(activeEntity.id, {
                          activeFeatureKey: featureKey,
                          overlayFilter: featureKey,
                          activeSlotId: slotId,
                          activeBoneId: "head",
                          focusMode: "head",
                        });
                        if (slotId) {
                          setSelectedSlot(slotId);
                        }
                        openAuthoringWorkflow("face-editor", setActiveAuthoringMode, setAnimBottomTab, setCanvasMode);
                      }}
                    >
                      {FACE_FEATURE_LABELS[featureKey]}
                    </button>
                  ))}
                </div>
                {visibleFaceFeatures.map(featureKey => {
                  const feature = faceCustomization[featureKey];
                  const testPrefix = `face-${featureKey}`;
                  return (
                    <div key={featureKey} className="rounded border border-border bg-accent/20 p-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-foreground capitalize">{featureKey}</span>
                        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={feature.visible}
                            onChange={e => {
                              setEntityFaceAuthoringState(activeEntity.id, { activeFeatureKey: featureKey });
                              setEntityFaceFeature(activeEntity.id, featureKey, { visible: e.target.checked });
                            }}
                          />
                          Visible
                        </label>
                      </div>
                      <Select
                        value={feature.presetId}
                        onValueChange={value => {
                          setEntityFaceAuthoringState(activeEntity.id, { activeFeatureKey: featureKey });
                          setEntityFaceFeature(activeEntity.id, featureKey, { presetId: value, visible: value !== "none" });
                        }}
                      >
                        <SelectTrigger className="h-7 text-[11px] bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground text-xs">
                          {FACE_PRESETS[featureKey].map(preset => (
                            <SelectItem key={preset.id} value={preset.id} className="text-xs">{preset.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={toColorInputValue(feature.color)}
                          onChange={e => {
                            setEntityFaceAuthoringState(activeEntity.id, { activeFeatureKey: featureKey });
                            setEntityFaceFeature(activeEntity.id, featureKey, { color: e.target.value });
                          }}
                          className="w-8 h-7 rounded border border-border bg-transparent"
                        />
                        <span className="text-[10px] text-muted-foreground font-mono">{feature.color}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <TransactionalNumberInput
                          testId={`${testPrefix}-x`}
                          value={feature.transform.x}
                          onPreview={v => {
                            setEntityFaceAuthoringState(activeEntity.id, { activeFeatureKey: featureKey });
                            setEntityFaceFeatureTransform(activeEntity.id, featureKey, { x: v });
                          }}
                          onCommit={v => setEntityFaceFeatureTransform(activeEntity.id, featureKey, { x: v })}
                          onCancel={() => undefined}
                        />
                        <TransactionalNumberInput
                          testId={`${testPrefix}-y`}
                          value={feature.transform.y}
                          onPreview={v => {
                            setEntityFaceAuthoringState(activeEntity.id, { activeFeatureKey: featureKey });
                            setEntityFaceFeatureTransform(activeEntity.id, featureKey, { y: v });
                          }}
                          onCommit={v => setEntityFaceFeatureTransform(activeEntity.id, featureKey, { y: v })}
                          onCancel={() => undefined}
                        />
                        <TransactionalNumberInput
                          testId={`${testPrefix}-rotation`}
                          value={feature.transform.rotation}
                          onPreview={v => {
                            setEntityFaceAuthoringState(activeEntity.id, { activeFeatureKey: featureKey });
                            setEntityFaceFeatureTransform(activeEntity.id, featureKey, { rotation: v });
                          }}
                          onCommit={v => setEntityFaceFeatureTransform(activeEntity.id, featureKey, { rotation: v })}
                          onCancel={() => undefined}
                        />
                        <TransactionalNumberInput
                          testId={`${testPrefix}-scale`}
                          value={feature.transform.scaleX}
                          onPreview={v => {
                            setEntityFaceAuthoringState(activeEntity.id, { activeFeatureKey: featureKey });
                            setEntityFaceFeatureTransform(activeEntity.id, featureKey, { scaleX: v, scaleY: v });
                          }}
                          onCommit={v => setEntityFaceFeatureTransform(activeEntity.id, featureKey, { scaleX: v, scaleY: v })}
                          onCancel={() => undefined}
                        />
                      </div>
                    </div>
                  );
                })}

                <div className="rounded border border-border bg-accent/20 p-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-foreground">Face Overlays</span>
                    <button
                      className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                      onClick={() => {
                        setEntityFaceAuthoringState(activeEntity.id, {
                          activeFeatureKey: activeFaceFeature,
                          overlayFilter: activeFaceFeature,
                          selectedOverlayId: null,
                        });
                        const doc = createDocumentFromFaceOverlay(activeEntity.id);
                        upsertSpriteEditorDocument(doc);
                        setActiveSpriteDocument(doc.id);
                        setActiveAuthoringMode("sprite-editor");
                        setAnimBottomTab("authoring");
                      }}
                    >
                      New Overlay
                    </button>
                  </div>
                  {visibleFaceOverlays.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground">
                      No custom face overlays for the current feature.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {visibleFaceOverlays.map(overlay => (
                        <div
                          key={overlay.id}
                          className={[
                            "rounded border p-2 space-y-1",
                            faceAuthoring.selectedOverlayId === overlay.id
                              ? "border-primary/40 bg-primary/10"
                              : "border-border bg-background/60",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-[11px] text-foreground">{overlay.name}</div>
                              <div className="truncate text-[10px] text-muted-foreground">
                                z {overlay.zOffset} · pivot {overlay.pivot.x}, {overlay.pivot.y}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                                onClick={() => {
                                  const featureKey = overlay.featureTag ?? "generic";
                                  const slotId = featureKey === "generic" ? null : (FACE_FEATURE_TO_SLOT[featureKey] ?? null);
                                setEntityFaceAuthoringState(activeEntity.id, {
                                  activeFeatureKey: featureKey,
                                  overlayFilter: featureKey,
                                  selectedOverlayId: overlay.id,
                                  activeSlotId: slotId,
                                  activeBoneId: "head",
                                  focusMode: "head",
                                });
                                  setEditorSelection({
                                    kind: "face-overlay",
                                    entityId: activeEntity.id,
                                    overlayId: overlay.id,
                                    featureKey,
                                    slotId,
                                  });
                                  setSelectedSlot(slotId);
                                  const doc = createDocumentFromFaceOverlay(activeEntity.id, overlay);
                                  upsertSpriteEditorDocument(doc);
                                  setActiveSpriteDocument(doc.id);
                                  setActiveAuthoringMode("sprite-editor");
                                  setAnimBottomTab("authoring");
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="text-[10px] text-destructive/70 hover:text-destructive transition-colors"
                                onClick={() => removeEntityFaceOverlay(activeEntity.id, overlay.id)}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <Separator className="bg-border" />

          {/* Palette tokens */}
          <div className="space-y-2">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Palette</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(activeEntity.palette) as (keyof PaletteTokens)[]).map(token => (
                <div key={token} className="space-y-0.5">
                  <label className="text-[10px] text-muted-foreground">{PALETTE_LABELS[token]}</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      data-testid={`palette-${token}`}
                      value={toColorInputValue(activeEntity.palette[token])}
                      onChange={e =>
                        setEntityPaletteToken(
                          activeEntity.id,
                          token,
                          mergeColorWithExistingAlpha(e.target.value, activeEntity.palette[token]),
                        )
                      }
                      className="w-6 h-6 rounded border border-border cursor-pointer bg-transparent"
                      title={PALETTE_LABELS[token]}
                    />
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {activeEntity.palette[token]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator className="bg-border" />

          {/* Equipped items summary */}
          <div className="space-y-2">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Equipped ({equippedItems.length})
            </Label>
            {equippedItems.length === 0 && (
              <p className="text-xs text-muted-foreground">No items equipped. Use the Slots tab to equip items.</p>
            )}
            <div className="space-y-1">
              {equippedItems.map(({ slot, item }) => {
                const isIncompat = item && template &&
                  item.compatibility.skeletonFamilies.length > 0 &&
                  !itemSupportsTemplate(item, template);
                return (
                  <div
                    key={slot!.id}
                    className={[
                      "flex items-center gap-2 rounded border px-2 py-1.5",
                      isIncompat
                        ? "border-yellow-500/30 bg-yellow-500/5"
                        : "border-border bg-accent/30",
                    ].join(" ")}
                  >
                    <div className="w-6 h-6 rounded border border-border overflow-hidden bg-background flex-shrink-0">
                      {item!.svgLayers[0] && (
                        <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: sanitizeSvg(item!.svgLayers[0].svgData) }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground truncate">{item!.name}</p>
                      <p className="text-[10px] text-muted-foreground">{slot!.name}</p>
                    </div>
                    {isIncompat && <AlertTriangle className="w-3 h-3 text-yellow-500 flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>

          <Separator className="bg-border" />

          {/* Per-entity StyleSet override */}
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Style Set
              <span className="ml-1 text-muted-foreground/50 normal-case font-normal">(this entity only)</span>
            </Label>
            <Select
              value={activeEntity.styleSetId}
              onValueChange={id => setEntityStyleSet(activeEntity.id, id)}
            >
              <SelectTrigger
                data-testid="inspector-styleset-select"
                className="h-7 text-xs bg-background border-border"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STYLE_SETS.map(ss => (
                  <SelectItem key={ss.id} value={ss.id} className="text-xs">
                    {ss.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Overrides the scene style for this entity. Use the toolbar to reset all entities at once.
            </p>
          </div>

          <Separator className="bg-border" />

          {/* Metadata */}
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Metadata</Label>
            <div className="space-y-1 text-[10px] text-muted-foreground">
              <div className="flex justify-between">
                <span>ID</span>
                <span className="font-mono text-foreground text-[9px]">{activeEntity.id.slice(0, 8)}…</span>
              </div>
              <div className="flex justify-between">
                <span>Created</span>
                <span className="text-foreground">{new Date(activeEntity.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span>License</span>
                <span className="text-foreground">{activeEntity.licenseMeta.licenseType}</span>
              </div>
              {import.meta.env.DEV && (
                <>
                  <div className="flex justify-between">
                    <span>Entity Visuals</span>
                    <span className="text-foreground">{activeEntity.visuals?.length ?? 0}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span>Visual Bones</span>
                    <span className="text-[9px] text-foreground break-words">
                      {(activeEntity.visuals ?? []).map(visual => visual.boneId).join(", ") || "none"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span>Slot Overrides</span>
                    <span className="text-[9px] text-foreground break-words">
                      {activeEntity.slots
                        .filter(slot => slot.itemId)
                        .map(slot => `${slot.slotId}:${JSON.stringify({
                          x: slot.attachmentOverride?.offsetX ?? 0,
                          y: slot.attachmentOverride?.offsetY ?? 0,
                          rotation: slot.attachmentOverride?.rotation ?? 0,
                          scaleX: slot.attachmentOverride?.scaleX ?? 1,
                          scaleY: slot.attachmentOverride?.scaleY ?? 1,
                          anchorId: slot.attachmentOverride?.anchorId ?? "",
                        })}`)
                        .join(" | ") || "none"}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}
