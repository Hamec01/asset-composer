import type {
  ImportedAssetSource,
  Item,
  ItemCategory,
  ItemPart,
  PaletteTokens,
  Pivot,
  SlotDef,
  Template,
} from "@/domain/types";
import { computePivotXY, parseMetrics } from "@/lib/svgMetrics";

const EMPTY_CHANNELS: (keyof PaletteTokens)[] = [];

export type ImportPartRole =
  | "auto"
  | "center"
  | "front"
  | "back"
  | "head"
  | "neck"
  | "chest"
  | "spine"
  | "pelvis"
  | "shoulder_l"
  | "shoulder_r"
  | "hand_l"
  | "hand_r"
  | "hip_l"
  | "hip_r"
  | "knee_l"
  | "knee_r"
  | "foot_l"
  | "foot_r";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "asset";
}

function normalizeImportLabel(value: string): string {
  return slugify(value).replace(/_/g, " ");
}

function inferSide(label: string): "left" | "right" | "center" {
  if (/\b(left|l|lh|main_gauche)\b/.test(label)) return "left";
  if (/\b(right|r|rh|main_droite)\b/.test(label)) return "right";
  return "center";
}

function hasAnyToken(label: string, tokens: string[]): boolean {
  return tokens.some(token => label.includes(token));
}

function pickExistingBone(template: Template, candidates: string[], fallback: string): string {
  for (const boneId of candidates) {
    if (template.bones.some(bone => bone.id === boneId)) {
      return boneId;
    }
  }
  return fallback;
}

function inferPartBoneId(
  label: string,
  category: ItemCategory,
  template: Template,
  slotDef?: SlotDef,
): string {
  const side = inferSide(label);
  const fallback = slotDef?.boneId ?? "root";

  if (category === "hair" || category === "eyes" || category === "face" || category === "beard" || category === "head_cover") {
    if (hasAnyToken(label, ["ear", "earring"]) && side !== "center") {
      return pickExistingBone(template, [side === "left" ? "ear_l" : "ear_r", "head"], "head");
    }
    return "head";
  }

  if (category === "neck" || category === "amulet") {
    return pickExistingBone(template, ["neck", "head"], fallback);
  }

  if (category === "torso" || category === "cloak" || category === "arms") {
    if (hasAnyToken(label, ["pauldron", "shoulder", "spaulder"])) {
      return pickExistingBone(template, [side === "right" ? "shoulder_r" : "shoulder_l", "chest"], fallback);
    }
    if (hasAnyToken(label, ["bracer", "vambrace", "forearm", "wrist"])) {
      return pickExistingBone(template, [side === "right" ? "elbow_r" : "elbow_l", side === "right" ? "hand_r" : "hand_l", "chest"], fallback);
    }
    if (hasAnyToken(label, ["sleeve", "arm"])) {
      return pickExistingBone(template, [side === "right" ? "shoulder_r" : "shoulder_l", "chest"], fallback);
    }
    if (hasAnyToken(label, ["cape", "cloak", "back"])) {
      return pickExistingBone(template, ["spine", "chest"], fallback);
    }
    return pickExistingBone(template, ["chest", "spine"], fallback);
  }

  if (category === "hands" || category === "weapon_main" || category === "weapon_off" || category === "shield" || category === "ring") {
    if (side === "left") return pickExistingBone(template, ["hand_l"], fallback);
    if (side === "right") return pickExistingBone(template, ["hand_r"], fallback);
    return pickExistingBone(template, [fallback, "hand_r", "hand_l"], fallback);
  }

  if (category === "legs" || category === "waist" || category === "feet") {
    if (hasAnyToken(label, ["belt", "waist", "pelvis", "hips", "skirt", "loin"])) {
      return pickExistingBone(template, ["pelvis"], fallback);
    }
    if (hasAnyToken(label, ["thigh", "upper_leg", "upperleg"])) {
      return pickExistingBone(template, [side === "right" ? "hip_r" : "hip_l", "pelvis"], fallback);
    }
    if (hasAnyToken(label, ["knee", "shin", "greave", "calf", "lower_leg", "lowerleg"])) {
      return pickExistingBone(template, [side === "right" ? "knee_r" : "knee_l", side === "right" ? "hip_r" : "hip_l", "pelvis"], fallback);
    }
    if (hasAnyToken(label, ["boot", "shoe", "foot", "sabaton"])) {
      return pickExistingBone(template, [side === "right" ? "foot_r" : "foot_l", side === "right" ? "knee_r" : "knee_l", "pelvis"], fallback);
    }
    if (side === "left") return pickExistingBone(template, ["hip_l", "knee_l", "foot_l", "pelvis"], fallback);
    if (side === "right") return pickExistingBone(template, ["hip_r", "knee_r", "foot_r", "pelvis"], fallback);
    return pickExistingBone(template, ["pelvis", "hip_l", "hip_r"], fallback);
  }

  return fallback;
}

function inferImportedPartRoleFromLabel(label: string, category: ItemCategory): ImportPartRole {
  const side = inferSide(label);

  if (category === "hair") {
    if (hasAnyToken(label, ["back", "rear"])) return "back";
    if (hasAnyToken(label, ["front", "fringe", "bang"])) return "front";
    return "head";
  }

  if (category === "eyes" || category === "face" || category === "beard" || category === "head_cover") {
    return "head";
  }

  if (category === "neck" || category === "amulet") {
    return "neck";
  }

  if (category === "torso" || category === "cloak" || category === "arms") {
    if (hasAnyToken(label, ["cape", "cloak", "back"])) return "back";
    if (hasAnyToken(label, ["pauldron", "shoulder", "spaulder"])) return side === "right" ? "shoulder_r" : "shoulder_l";
    if (hasAnyToken(label, ["bracer", "vambrace", "forearm", "wrist"])) return side === "right" ? "hand_r" : "hand_l";
    if (hasAnyToken(label, ["sleeve", "arm"])) return side === "right" ? "shoulder_r" : "shoulder_l";
    return "chest";
  }

  if (category === "hands" || category === "weapon_main" || category === "weapon_off" || category === "shield" || category === "ring") {
    if (side === "left") return "hand_l";
    if (side === "right") return "hand_r";
    return "center";
  }

  if (category === "legs" || category === "waist" || category === "feet") {
    if (hasAnyToken(label, ["belt", "waist", "pelvis", "hips", "skirt", "loin"])) return "pelvis";
    if (hasAnyToken(label, ["thigh", "upper_leg", "upperleg"])) return side === "right" ? "hip_r" : "hip_l";
    if (hasAnyToken(label, ["knee", "shin", "greave", "calf", "lower_leg", "lowerleg"])) return side === "right" ? "knee_r" : "knee_l";
    if (hasAnyToken(label, ["boot", "shoe", "foot", "sabaton"])) return side === "right" ? "foot_r" : "foot_l";
    if (side === "left") return "hip_l";
    if (side === "right") return "hip_r";
    return "pelvis";
  }

  return "center";
}

function inferPartZOffset(
  label: string,
  category: ItemCategory,
  slotDef?: SlotDef,
): number {
  const side = inferSide(label);
  const base = slotDef?.zIndex ?? 0;
  const sideBias = side === "right" ? 0.08 : side === "left" ? 0.02 : 0.05;

  if (category === "hair") {
    if (hasAnyToken(label, ["back", "rear"])) return base - 0.2;
    if (hasAnyToken(label, ["front", "fringe", "bang"])) return base + 0.25;
    return base + 0.1 + sideBias;
  }

  if (category === "beard" || category === "eyes" || category === "face") {
    return base + 0.1 + sideBias;
  }

  if (category === "torso" || category === "arms") {
    if (hasAnyToken(label, ["cape", "cloak", "back"])) return base - 0.3;
    if (hasAnyToken(label, ["pauldron", "shoulder"])) return base + 0.2 + sideBias;
    if (hasAnyToken(label, ["bracer", "vambrace", "wrist"])) return base + 0.16 + sideBias;
    return base + 0.1;
  }

  if (category === "legs" || category === "feet") {
    if (hasAnyToken(label, ["belt", "waist", "pelvis"])) return base + 0.18;
    if (hasAnyToken(label, ["thigh", "upper_leg", "upperleg"])) return base + 0.12 + sideBias;
    if (hasAnyToken(label, ["knee", "shin", "greave", "calf"])) return base + 0.08 + sideBias;
    if (hasAnyToken(label, ["boot", "shoe", "foot", "sabaton"])) return base + sideBias;
    return base + sideBias;
  }

  if (category === "hands" || category === "weapon_main" || category === "weapon_off" || category === "shield" || category === "ring") {
    return base + sideBias;
  }

  return base + sideBias;
}

export function inferImportedPartDefaults(options: {
  fileName: string;
  displayName?: string;
  category: ItemCategory;
  template: Template;
  slotDef?: SlotDef;
}): { role: ImportPartRole; boneId: string; zOffset: number } {
  const label = normalizeImportLabel(`${options.displayName ?? ""} ${options.fileName}`);
  const role = inferImportedPartRoleFromLabel(label, options.category);
  return {
    role,
    boneId: inferPartBoneId(label, options.category, options.template, options.slotDef),
    zOffset: inferPartZOffset(label, options.category, options.slotDef),
  };
}

export function resolveImportedPartRole(options: {
  role: ImportPartRole;
  category: ItemCategory;
  template: Template;
  slotDef?: SlotDef;
}): { boneId: string; zOffset: number } {
  if (options.role === "auto") {
    return {
      boneId: options.slotDef?.boneId ?? "root",
      zOffset: options.slotDef?.zIndex ?? 0,
    };
  }

  const base = options.slotDef?.zIndex ?? 0;
  const sideBias = options.role.endsWith("_r") ? 0.08 : options.role.endsWith("_l") ? 0.02 : 0.05;
  const roleBoneMap: Record<Exclude<ImportPartRole, "auto">, string> = {
    center: options.slotDef?.boneId ?? "root",
    front: options.category === "hair" ? "head" : (options.slotDef?.boneId ?? "root"),
    back: options.category === "torso" || options.category === "cloak" ? "spine" : "head",
    head: "head",
    neck: "neck",
    chest: "chest",
    spine: "spine",
    pelvis: "pelvis",
    shoulder_l: "shoulder_l",
    shoulder_r: "shoulder_r",
    hand_l: "hand_l",
    hand_r: "hand_r",
    hip_l: "hip_l",
    hip_r: "hip_r",
    knee_l: "knee_l",
    knee_r: "knee_r",
    foot_l: "foot_l",
    foot_r: "foot_r",
  };
  const desiredBone = roleBoneMap[options.role];
  const boneId = pickExistingBone(options.template, [desiredBone, options.slotDef?.boneId ?? "root"], options.slotDef?.boneId ?? "root");

  let zOffset = base + sideBias;
  if (options.role === "back") zOffset = base - 0.25;
  if (options.role === "front") zOffset = base + 0.25;
  if (options.role === "chest") zOffset = base + 0.1;
  if (options.role === "pelvis") zOffset = base + 0.18;
  if (options.role === "shoulder_l" || options.role === "shoulder_r") zOffset = base + 0.2 + sideBias;
  if (options.role === "hand_l" || options.role === "hand_r") zOffset = base + 0.12 + sideBias;
  if (options.role === "hip_l" || options.role === "hip_r") zOffset = base + 0.12 + sideBias;
  if (options.role === "knee_l" || options.role === "knee_r") zOffset = base + 0.08 + sideBias;

  return { boneId, zOffset };
}

export function wrapRasterDataUriAsSvg(
  dataUri: string,
  width: number,
  height: number,
): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">`,
    `<image href="${dataUri}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none"/>`,
    `</svg>`,
  ].join("");
}

export function makeImportedAssetSource(options: {
  format: "svg" | "png";
  name: string;
  originalFileName: string;
  mimeType: string;
  dataUri?: string;
}): ImportedAssetSource {
  return {
    format: options.format,
    name: options.name,
    originalFileName: options.originalFileName,
    mimeType: options.mimeType,
    dataUri: options.dataUri,
  };
}

export function buildImportedItemPart(options: {
  fileName: string;
  displayName: string;
  boneId: string;
  svgData: string;
  source: ImportedAssetSource;
  pivotX?: number;
  pivotY?: number;
  zOffset?: number;
}): ItemPart {
  const metrics = parseMetrics(options.svgData);
  const defaultPivot = computePivotXY(metrics, "center");
  const pivot: Pivot = {
    x: options.pivotX ?? defaultPivot.x,
    y: options.pivotY ?? defaultPivot.y,
    preset: "custom",
  };

  return {
    id: slugify(options.displayName || options.fileName),
    boneId: options.boneId,
    svgData: options.svgData,
    metrics,
    pivot,
    localTransform: {
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    },
    coordinateMode: "bone_local",
    zOffset: options.zOffset ?? 0,
    source: options.source,
    editorDocumentId: null,
  };
}

export function buildImportedProjectItem(options: {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  slotId: string;
  template: Template;
  slotDef?: SlotDef;
  parts: ItemPart[];
}): Item {
  const firstPart = options.parts[0];
  const slotAnchorId = options.slotDef?.defaultAnchorId;

  return {
    id: options.id,
    name: options.name,
    description: options.description,
    category: options.category,
    compatibility: {
      skeletonFamilies: [options.template.skeletonFamily],
      species: [],
      viewProfiles: [options.template.viewProfile],
    },
    allowedSlots: [options.slotId],
    fitProfile: "standard",
    paletteChannels: EMPTY_CHANNELS,
    hasOwnAnimation: false,
    animationClipId: null,
    anchorRules: slotAnchorId
      ? {
          [options.slotId]: {
            anchorId: slotAnchorId,
            bindMode: "anchor_lock",
          },
        }
      : {},
    svgLayers: firstPart
      ? [{
          id: "thumb",
          styleSetId: null,
          svgData: firstPart.svgData,
          paletteChannels: EMPTY_CHANNELS,
          zOffset: 0,
        }]
      : [],
    parts: options.parts,
    coordinateMode: "bone_local",
    licenseMeta: {
      source: "User Import",
      author: "Project User",
      licenseType: "proprietary",
      aiGenerated: false,
      commercialUseAllowed: true,
      purchaseRef: null,
      derivativePolicy: "project_local",
    },
    tags: ["custom", "imported", options.category, slugify(options.name)],
  };
}

export function makeImportedItemId(name: string): string {
  return `custom_${slugify(name)}_${Date.now().toString(36)}`;
}
