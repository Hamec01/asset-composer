/**
 * evaluationPipeline.ts
 *
 * Single canonical rendering pipeline consumed by all renderers:
 *
 *   const localPose = buildMultiClipPose(...);
 *   const skeleton  = evaluateSkeleton(template.bones, localPose);
 *   const scene     = evaluateScene(entity, template, skeleton, items);
 *
 * EvaluatedScene.visuals  — new v2.0 path: each visual has a pre-computed
 *   worldMatrix, localBounds, and worldBounds.  All renderers consume these
 *   directly without re-computing bone transforms.
 *
 * EvaluatedScene.layers   — legacy path kept for PixiPreviewPanel / frameRenderer
 *   backward compatibility.
 */

import type {
  Bone, Entity, Item, Template, PaletteTokens, SkeletonFamilyId,
  AnimationClip, EvaluatedVisual, Matrix2D, AABB, ItemPart, SlotDef, SlotAssignment, ItemFitProfile, ItemCategory, BodyMorphValues, FaceCustomization,
} from "@/domain/types";
import { resolveClipPose, blendPoses } from "./animationRuntime";
import { getCharacterBodyParts } from "@/data/chibiBody";
import { chibiFeatureSvg, DEFAULT_APPEARANCE } from "@/data/characterAppearance";
import type { CharacterAppearance } from "@/domain/types";
import { getSideGaitClip } from "@/data/chibiAnimations";
import type { BoneTransformMap } from "./animationRuntime";
import { applyPaletteToSvg } from "./svgUtils";
import { parseMetrics } from "./svgMetrics";
import { refreshCanonicalBuiltInTypedItems } from "./canonicalItems";
import { resolveItemFitAnchorOverride, resolveItemFitPartTransform } from "./itemFitProfiles";
import { isLegacyBodyCloneVisual } from "./projectNormalization";
import { ITEM_SOURCE_PALETTE } from "@/data/items";
import {
  identity, multiply, translation, worldBoneToMatrix,
  localTransformToMatrix, transformAABB,
} from "./matrixUtils";

// ── Legacy layer types (unchanged — kept for Pixi / frameRenderer compat) ─────

export interface WorldBone {
  x:        number;
  y:        number;
  rotation: number;
  scaleX:   number;
  scaleY:   number;
}

export interface EvaluatedSkeleton {
  bones: Map<string, WorldBone>;
}

export interface SceneLayer {
  id:            string;
  svgData:       string;
  zIndex:        number;
  opacity:       number;
  boneId:        string | null;
  localX:        number;
  localY:        number;
  rotation:      number;
  scaleX:        number;
  scaleY:        number;
  naturalWidth:  number;
  naturalHeight: number;
}

// ── EvaluatedScene ────────────────────────────────────────────────────────────

export interface EvaluatedScene {
  entityId:       string;
  templateId:     string;
  skeletonFamily: SkeletonFamilyId;
  /** v2.0: pre-computed visuals with worldMatrix.  Consumed by canvasEngine. */
  visuals:        EvaluatedVisual[];
  /** Legacy: consumed by PixiPreviewPanel and frameRenderer. */
  layers:         SceneLayer[];
  skeleton:       EvaluatedSkeleton;
  frameWidth:     number;
  frameHeight:    number;
}

// ── buildMultiClipPose ────────────────────────────────────────────────────────

export function buildMultiClipPose(
  allClips:       AnimationClip[],
  activeClipId:   string | null,
  upperClipId:    string | null,
  lowerClipId:    string | null,
  upperBlendW:    number,
  renderTime:     number,
  entity:         Entity,
  items:          Item[],
  itemAnimClips:  AnimationClip[] = [],
): BoneTransformMap {
  const findClip = (id: string | null) =>
    id ? (allClips.find(c => c.id === id) ?? null) : null;

  const baseClip  = findClip(activeClipId);
  const upperClip = findClip(upperClipId);
  const lowerClip = findClip(lowerClipId);
  const heldHands = entity.slots.flatMap(slot => {
    const item = slot.itemId ? items.find(candidate => candidate.id === slot.itemId) : undefined;
    if (!item || !["weapon_main", "weapon_off", "shield"].includes(item.category)) return [];
    return (item.parts ?? []).filter(part => part.coordinateMode === "bone_local" && /^hand_[lr]$/.test(part.boneId)).map(part => part.boneId);
  });

  let pose: BoneTransformMap = baseClip
    ? resolveClipPose(entity.appearance?.view && entity.appearance.view !== "front" && baseClip.id.startsWith("chibi_front__") ? getSideGaitClip(baseClip, heldHands) : baseClip, renderTime)
    : new Map();

  if ((upperClip || lowerClip) && !entity.templateId.startsWith("biped_profile_")) {
    const upperPose = upperClip ? resolveClipPose(upperClip, renderTime) : pose;
    const lowerPose = lowerClip ? resolveClipPose(lowerClip, renderTime) : pose;
    pose = blendPoses(lowerPose, upperPose, upperBlendW);
  }

  for (const slot of entity.slots) {
    if (!slot.itemId) continue;
    const item = items.find(i => i.id === slot.itemId);
    if (!item?.hasOwnAnimation || !item.animationClipId) continue;
    const itemClip =
      allClips.find(c => c.id === item.animationClipId) ??
      itemAnimClips.find(c => c.id === item.animationClipId) ?? null;
    if (!itemClip) continue;
    const itemPose = resolveClipPose(itemClip, renderTime);
    for (const [boneId, t] of itemPose) {
      const base = pose.get(boneId);
      pose.set(boneId, {
        tx:       (base?.tx       ?? 0) + t.tx,
        ty:       (base?.ty       ?? 0) + t.ty,
        rotation: (base?.rotation ?? 0) + t.rotation,
        scaleX:   (base?.scaleX   ?? 1) * t.scaleX,
        scaleY:   (base?.scaleY   ?? 1) * t.scaleY,
      });
    }
  }

  for (const [boneId, override] of Object.entries(entity.poseOverrides ?? {})) {
    const base = pose.get(boneId);
    pose.set(boneId, {
      tx: (base?.tx ?? 0) + (override.tx ?? 0),
      ty: (base?.ty ?? 0) + (override.ty ?? 0),
      rotation: (base?.rotation ?? 0) + (override.rotation ?? 0),
      scaleX: (base?.scaleX ?? 1) * (override.scaleX ?? 1),
      scaleY: (base?.scaleY ?? 1) * (override.scaleY ?? 1),
    });
  }

  return pose;
}

// ── evaluateSkeleton ──────────────────────────────────────────────────────────

export function evaluateSkeleton(
  bones:     Bone[],
  localPose: BoneTransformMap,
  bodyMorphs?: BodyMorphValues,
  appearance?: CharacterAppearance,
): EvaluatedSkeleton {
  const world = new Map<string, WorldBone>();

  for (const bone of bones) {
    const restPose = { ...applyBodyMorphToRestPose(bone, bodyMorphs) };
    if (appearance?.view && appearance.view !== "front" && appearance.projection !== "authored") {
      const near = appearance.view === "left" ? "r" : "l";
      const far = near === "l" ? "r" : "l";
      if (bone.id === `shoulder_${near}`) restPose.tx = -6;
      if (bone.id === `shoulder_${far}`) restPose.tx = 4;
      if (bone.id === `hip_${near}`) restPose.tx = -2.5;
      if (bone.id === `hip_${far}`) restPose.tx = 2.5;
      if (/^(elbow|hand|knee|foot)_[lr]$/.test(bone.id)) restPose.rotation = 0;
      if (bone.id === "head") restPose.tx += 1;
    }
    const anim = localPose.get(bone.id);
    let lx     = restPose.tx       + (anim?.tx       ?? 0);
    let ly     = restPose.ty       + (anim?.ty       ?? 0);
    const lRot = restPose.rotation + (anim?.rotation ?? 0);
    const lSx  = restPose.scaleX   * (anim?.scaleX   ?? 1);
    const lSy  = restPose.scaleY   * (anim?.scaleY   ?? 1);

    // Chibi torso artwork is authored above the waist. Bend around its pelvic
    // attachment without changing saved part coordinates or the standing pose.
    if (appearance && bone.id === "spine" && bone.parentId === "pelvis") {
      const waistY = -restPose.ty;
      const radians = lRot * Math.PI / 180;
      lx += waistY * lSy * Math.sin(radians);
      ly += waistY * (1 - lSy * Math.cos(radians));
    }

    if (bone.parentId === null) {
      world.set(bone.id, { x: lx, y: ly, rotation: lRot, scaleX: lSx, scaleY: lSy });
    } else {
      const parent = world.get(bone.parentId);
      if (!parent) {
        world.set(bone.id, { x: lx, y: ly, rotation: lRot, scaleX: lSx, scaleY: lSy });
        continue;
      }
      const pRad = (parent.rotation * Math.PI) / 180;
      world.set(bone.id, {
        x:        parent.x + (lx * Math.cos(pRad) - ly * Math.sin(pRad)) * parent.scaleX,
        y:        parent.y + (lx * Math.sin(pRad) + ly * Math.cos(pRad)) * parent.scaleY,
        rotation: parent.rotation + lRot,
        scaleX:   parent.scaleX * lSx,
        scaleY:   parent.scaleY * lSy,
      });
    }
  }

  if (appearance?.view === "left") {
    for (const bone of world.values()) {
      bone.x = -bone.x;
      bone.rotation = -bone.rotation;
      bone.scaleX = -bone.scaleX;
    }
  }
  return { bones: world };
}

export function evaluateRestSkeleton(
  bones: Bone[],
  bodyMorphs?: BodyMorphValues,
  poseOverrides?: Record<string, Bone["restPose"]>,
  appearance?: CharacterAppearance,
): EvaluatedSkeleton {
  const restPose = new Map<string, Bone["restPose"]>();
  for (const [boneId, override] of Object.entries(poseOverrides ?? {})) {
    restPose.set(boneId, {
      tx: override.tx ?? 0,
      ty: override.ty ?? 0,
      rotation: override.rotation ?? 0,
      scaleX: override.scaleX ?? 1,
      scaleY: override.scaleY ?? 1,
    });
  }
  return evaluateSkeleton(bones, restPose, bodyMorphs, appearance);
}

function applyBodyMorphToRestPose(bone: Bone, bodyMorphs?: BodyMorphValues): Bone["restPose"] {
  if (!bodyMorphs) return bone.restPose;

  const next = { ...bone.restPose };
  const {
    headSize,
    neckLength,
    torsoHeight,
    torsoWidth,
    armLength,
    forearmLength,
    handSize,
    legLength,
    shinLength,
    footSize,
    pelvisWidth,
    overallHeightScale,
  } = bodyMorphs;

  if (bone.parentId !== null) {
    next.ty *= overallHeightScale;
  }

  if (bone.id === "head") {
    next.scaleX *= headSize;
    next.scaleY *= headSize;
    next.ty *= neckLength;
  } else if (bone.id === "neck") {
    next.ty *= torsoHeight;
    next.scaleX *= torsoWidth;
  } else if (bone.id === "spine" || bone.id === "chest") {
    next.ty *= torsoHeight;
    next.scaleX *= torsoWidth;
  } else if (bone.id === "pelvis") {
    next.scaleX *= pelvisWidth;
  } else if (bone.id === "shoulder_l" || bone.id === "shoulder_r") {
    next.tx *= torsoWidth;
    next.scaleX *= armLength;
  } else if (bone.id === "elbow_l" || bone.id === "elbow_r") {
    next.tx *= armLength;
    next.scaleX *= forearmLength;
  } else if (bone.id === "hand_l" || bone.id === "hand_r") {
    next.tx *= forearmLength;
    next.scaleX *= handSize;
    next.scaleY *= handSize;
  } else if (bone.id === "hip_l" || bone.id === "hip_r") {
    next.tx *= pelvisWidth;
    next.scaleY *= legLength;
  } else if (bone.id === "knee_l" || bone.id === "knee_r") {
    next.ty *= legLength;
    next.scaleY *= shinLength;
  } else if (bone.id === "foot_l" || bone.id === "foot_r") {
    next.ty *= shinLength;
    next.scaleX *= footSize;
    next.scaleY *= footSize;
  }

  return next;
}

function makeFaceFeatureSvg(feature: keyof Omit<FaceCustomization, "overlays">, presetId: string, color: string): string | null {
  switch (feature) {
    case "eyes":
      if (presetId === "dot_cute") {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -6 24 12"><ellipse cx="-4" cy="0" rx="1.45" ry="2.1" fill="${color}"/><ellipse cx="4" cy="0" rx="1.45" ry="2.1" fill="${color}"/></svg>`;
      }
      if (presetId === "round_kawaii") {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -6 24 12"><ellipse cx="-4" cy="0" rx="2.5" ry="3" fill="${color}"/><ellipse cx="4" cy="0" rx="2.5" ry="3" fill="${color}"/><circle cx="-3.2" cy="-0.8" r="0.7" fill="#ffffff"/><circle cx="4.8" cy="-0.8" r="0.7" fill="#ffffff"/></svg>`;
      }
      if (presetId === "wide_shine") {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-13 -7 26 14"><ellipse cx="-5" cy="0" rx="3" ry="3.6" fill="${color}"/><ellipse cx="5" cy="0" rx="3" ry="3.6" fill="${color}"/><circle cx="-4.1" cy="-1.1" r="0.8" fill="#ffffff"/><circle cx="5.9" cy="-1.1" r="0.8" fill="#ffffff"/></svg>`;
      }
      if (presetId === "sleepy") {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -6 24 12"><path d="M-7 -1 Q-4 -3 -1 -1" stroke="${color}" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M1 -1 Q4 -3 7 -1" stroke="${color}" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`;
      }
      return null;
    case "mouth":
      if (presetId === "tiny_smile") {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -4 16 8"><path d="M-2 0 Q0 1.5 2 0" stroke="${color}" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>`;
      }
      if (presetId === "soft_smile") {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -4 16 8"><path d="M-3 -1 Q0 2 3 -1" stroke="${color}" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>`;
      }
      if (presetId === "neutral") {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -4 16 8"><path d="M-3 0 H3" stroke="${color}" stroke-width="1.25" fill="none" stroke-linecap="round"/></svg>`;
      }
      if (presetId === "open_smile") {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -5 16 10"><path d="M-3 -1 Q0 3 3 -1 Q1 2 -1 2 Q-2 1 -3 -1 Z" fill="${color}"/></svg>`;
      }
      if (presetId === "frown") {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -4 16 8"><path d="M-3 1 Q0 -2 3 1" stroke="${color}" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>`;
      }
      return null;
    case "brows":
      if (presetId === "soft_arc") {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -5 24 10"><path d="M-7 1 Q-4 -1 -1 0" stroke="${color}" stroke-width="1.4" fill="none" stroke-linecap="round"/><path d="M1 0 Q4 -1 7 1" stroke="${color}" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>`;
      }
      if (presetId === "stern") {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -5 24 10"><path d="M-7 2 L-1 -1" stroke="${color}" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M1 -1 L7 2" stroke="${color}" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`;
      }
      if (presetId === "worried") {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -5 24 10"><path d="M-7 -1 Q-4 1 -1 1" stroke="${color}" stroke-width="1.45" fill="none" stroke-linecap="round"/><path d="M1 1 Q4 1 7 -1" stroke="${color}" stroke-width="1.45" fill="none" stroke-linecap="round"/></svg>`;
      }
      return null;
    case "beard":
      if (presetId === "short_goatee") {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -2 16 12"><path d="M-3 1 Q0 8 3 1 Q2 9 0 10 Q-2 9 -3 1 Z" fill="${color}" opacity="0.95"/></svg>`;
      }
      if (presetId === "full_short") {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -2 24 16"><path d="M-8 1 Q-9 10 0 14 Q9 10 8 1 Q4 4 0 4 Q-4 4 -8 1 Z" fill="${color}" opacity="0.95"/></svg>`;
      }
      return null;
    case "hair":
      if (presetId === "messy_short") {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-18 -15 36 22"><path d="M-14 3 Q-13 -9 -4 -12 L-6 -15 Q-2 -13 0 -12 Q4 -15 5 -12 Q13 -10 15 2 Q10 -1 6 0 Q4 3 1 1 Q-2 4 -4 1 Q-8 1 -14 3 Z" fill="${color}"/><path d="M-11 1 L-8 -8 L-5 1 M-3 0 L0 -10 L3 0 M6 0 L9 -7 L12 2" stroke="#00000044" stroke-width="0.8" fill="none" stroke-linecap="round"/></svg>`;
      }
      if (presetId === "fringe_short") {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-16 -12 32 16"><path d="M-12 2 Q-10 -8 0 -10 Q10 -8 12 2 Q7 -1 2 1 Q0 3 -2 1 Q-7 -1 -12 2 Z" fill="${color}"/></svg>`;
      }
      if (presetId === "fringe_long") {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-18 -14 36 22"><path d="M-14 2 Q-12 -10 0 -12 Q12 -10 14 2 Q10 -1 4 0 Q2 8 -1 8 Q-3 7 -5 1 Q-10 0 -14 2 Z" fill="${color}"/></svg>`;
      }
      if (presetId === "tuft") {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-16 -14 32 18"><path d="M-10 1 Q-7 -8 -1 -8 Q0 -13 5 -11 Q4 -7 10 1 Q5 -2 1 0 Q-3 2 -10 1 Z" fill="${color}"/></svg>`;
      }
      return null;
    default:
      return null;
  }
}

function makeFaceCustomizationVisuals(entity: Entity, skeleton: EvaluatedSkeleton): EvaluatedVisual[] {
  const face = entity.faceCustomization;
  const headBone = skeleton.bones.get("head");
  if (!face || !headBone) return [];

  const boneM = worldBoneToMatrix(headBone);
  const visuals: EvaluatedVisual[] = [];
  const chibi = entity.templateId.startsWith("biped_profile_");
  const laughing = chibi && entity.activeAnimationClipId === "chibi_front__laugh";
  const defs: Array<{ key: keyof Omit<FaceCustomization, "overlays">; zIndex: number; x: number; y: number }> = [
    { key: "hair", zIndex: -698, x: 0, y: -11 },
    { key: "brows", zIndex: -697, x: 0, y: -5 },
    { key: "eyes", zIndex: -696, x: 0, y: -2 },
    { key: "mouth", zIndex: -695, x: 0, y: 6 },
    { key: "beard", zIndex: -694, x: 0, y: 9 },
  ];

  for (const def of defs) {
    const config = face[def.key];
    if (!config?.visible || !config.presetId || config.presetId === "none") continue;
    const presetId = laughing && def.key === "eyes" ? "closed_happy"
      : laughing && def.key === "mouth" ? "open_smile" : config.presetId;
    const svgData = chibi ? chibiFeatureSvg(def.key, presetId, config.color, { ...DEFAULT_APPEARANCE, ...entity.appearance }) : makeFaceFeatureSvg(def.key, presetId, config.color);
    if (!svgData) continue;
    const metrics = parseMetrics(svgData);
    // Face feature SVGs use centered viewBoxes like -12..12, so their pivot
    // must be computed in the SVG's own coordinate space, not from 0..width.
    const pivotX = chibi ? 0 : metrics.viewBoxX + metrics.viewBoxWidth / 2;
    const pivotY = chibi ? 0 : metrics.viewBoxY + metrics.viewBoxHeight / 2;
    const worldM = multiply(
      boneM,
      localTransformToMatrix(
        def.x + config.transform.x,
        (chibi ? -8 : def.y) + config.transform.y,
        config.transform.rotation,
        config.transform.scaleX,
        config.transform.scaleY,
        pivotX,
        pivotY,
      ),
    );
    const localBounds = chibi
      ? { minX: metrics.viewBoxX, minY: metrics.viewBoxY, maxX: metrics.viewBoxX + metrics.viewBoxWidth, maxY: metrics.viewBoxY + metrics.viewBoxHeight }
      : makeMetricBounds(metrics, pivotX, pivotY);
    const worldBounds = transformAABB(worldM, localBounds);
    visuals.push({
      id: `face__${entity.id}__${def.key}`,
      svgData,
      zIndex: def.zIndex,
      worldMatrix: worldM,
      localBounds,
      worldBounds,
      sourceKind: "entity-visual",
      entityVisualId: `face__${def.key}`,
      boneId: "head",
      svgFitMode: "v2_vector",
    });
  }

  if (chibi && entity.appearance) {
    const appearance = { ...DEFAULT_APPEARANCE, ...entity.appearance };
    for (const feature of ["nose", "marks"] as const) {
      const svgData = chibiFeatureSvg(feature, feature === "nose" ? appearance.nose : "marks", "#b67d5c", appearance);
      if (!svgData) continue;
      const metrics = parseMetrics(svgData);
      const localBounds = { minX: metrics.viewBoxX, minY: metrics.viewBoxY, maxX: metrics.viewBoxX + metrics.viewBoxWidth, maxY: metrics.viewBoxY + metrics.viewBoxHeight };
      const worldMatrix = multiply(boneM, localTransformToMatrix(0, -8, 0, 1, 1, 0, 0));
      visuals.push({
        id: `face__${entity.id}__${feature}`, svgData, zIndex: feature === "marks" ? -699 : -695.5,
        worldMatrix, localBounds, worldBounds: transformAABB(worldMatrix, localBounds),
        sourceKind: "entity-visual", entityVisualId: `face__${feature}`, boneId: "head", svgFitMode: "v2_vector",
      });
    }
  }

  for (const overlay of face.overlays ?? []) {
    const worldM = multiply(
      boneM,
      localTransformToMatrix(
        overlay.localTransform.x,
        overlay.localTransform.y,
        overlay.localTransform.rotation,
        overlay.localTransform.scaleX,
        overlay.localTransform.scaleY,
        overlay.pivot.x,
        overlay.pivot.y,
      ),
    );
    const localBounds = makeMetricBounds(overlay.metrics, overlay.pivot.x, overlay.pivot.y);
    const worldBounds = transformAABB(worldM, localBounds);
    visuals.push({
      id: `face_overlay__${overlay.id}`,
      svgData: overlay.svgData,
      zIndex: overlay.zOffset,
      worldMatrix: worldM,
      localBounds,
      worldBounds,
      sourceKind: "entity-visual",
      entityVisualId: overlay.id,
      boneId: "head",
      svgFitMode: "v2_vector",
    });
  }

  return visuals;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function makeLocalBounds(w: number, h: number): AABB {
  return { minX: -w / 2, minY: -h / 2, maxX: w / 2, maxY: h / 2 };
}

function makeMetricBounds(
  metrics: { visualMinX: number; visualMinY: number; visualWidth: number; visualHeight: number },
  pivotX: number,
  pivotY: number,
): AABB {
  return {
    minX: metrics.visualMinX - pivotX,
    minY: metrics.visualMinY - pivotY,
    maxX: metrics.visualMinX - pivotX + metrics.visualWidth,
    maxY: metrics.visualMinY - pivotY + metrics.visualHeight,
  };
}

function makeFullFrameMatrix(): Matrix2D {
  return identity();
}

function makeAttachmentOverrideMatrix(ovr: {
  offsetX?: number; offsetY?: number;
  rotation?: number; scaleX?: number; scaleY?: number;
}): Matrix2D {
  return localTransformToMatrix(
    ovr.offsetX  ?? 0,
    ovr.offsetY  ?? 0,
    ovr.rotation ?? 0,
    ovr.scaleX   ?? 1,
    ovr.scaleY   ?? 1,
  );
}

function makeSlotDefaultTransformMatrix(slotDef: SlotDef): Matrix2D {
  const dt = slotDef.defaultTransform;
  return dt
    ? localTransformToMatrix(dt.x, dt.y, dt.rotation, dt.scaleX, dt.scaleY)
    : identity();
}

const LEGACY_BODY_COVERAGE_BY_CATEGORY: Partial<Record<ItemCategory, string[]>> = {
  torso: ["spine", "chest"],
  arms: ["shoulder_l", "shoulder_r", "elbow_l", "elbow_r"],
  head_cover: ["head"],
};

const V2_BODY_COVERAGE_CATEGORIES = new Set<ItemCategory>([
  "torso",
  "arms",
  "legs",
  "feet",
]);

const BODY_CLONE_REGIONS: Partial<Record<string, "core" | "arms" | "legs" | "feet" | "hands" | "head">> = {
  pelvis: "core",
  spine: "core",
  chest: "core",
  neck: "head",
  head: "head",
  shoulder_l: "arms",
  shoulder_r: "arms",
  elbow_l: "arms",
  elbow_r: "arms",
  hand_l: "hands",
  hand_r: "hands",
  hip_l: "legs",
  hip_r: "legs",
  knee_l: "legs",
  knee_r: "legs",
  foot_l: "feet",
  foot_r: "feet",
};

function getLegacyOverlayFrameSize(
  _item: Item,
  _template: Template,
  svgData: string,
): { width: number; height: number } {
  const metrics = parseMetrics(svgData);
  return {
    width: metrics.viewBoxWidth,
    height: metrics.viewBoxHeight,
  };
}

function getSlotBoneMatrix(
  skeleton: EvaluatedSkeleton,
  slotDef: SlotDef,
): Matrix2D {
  const slotBone = skeleton.bones.get(slotDef.boneId);
  return slotBone ? worldBoneToMatrix(slotBone) : identity();
}

function getCoveredBodyBoneIds(entity: Entity, template: Template, items: Item[]): Set<string> {
  const covered = new Set<string>();
  const existingBoneIds = new Set(template.bones.map(bone => bone.id));

  for (const slotAssign of entity.slots) {
    if (!slotAssign.itemId) continue;
    const item = items.find(i => i.id === slotAssign.itemId);
    if (!item) continue;

    const hasV2Parts = item.parts?.some(part => part.coordinateMode === "bone_local") ?? false;
    if (hasV2Parts) {
      if (!V2_BODY_COVERAGE_CATEGORIES.has(item.category)) continue;
      for (const part of item.parts ?? []) {
        if (item.tags.includes("rig-depth") && item.category === "feet" && part.boneId.startsWith("knee")) continue;
        if (item.tags.includes("rig-depth") && item.category === "torso" && part.boneId === "pelvis") continue;
        if (part.coordinateMode === "bone_local" && existingBoneIds.has(part.boneId)) {
          covered.add(part.boneId);
        }
      }
      continue;
    }

    if (item.coordinateMode === "bone_local") continue;

    const legacyCoverage = LEGACY_BODY_COVERAGE_BY_CATEGORY[item.category];
    if (!legacyCoverage?.length) continue;

    for (const boneId of legacyCoverage) {
      if (existingBoneIds.has(boneId)) {
        covered.add(boneId);
      }
    }
  }
  return covered;
}

function resolveAnchorId(
  slotAssign: SlotAssignment,
  slotDef: SlotDef,
  item: Item,
  template: Template,
  fitProfiles: ItemFitProfile[],
): string | null {
  const assignmentAnchorId = slotAssign.attachmentOverride.anchorId?.trim();
  if (assignmentAnchorId) {
    return assignmentAnchorId;
  }

  const fitProfileAnchorId = resolveItemFitAnchorOverride(item, template, slotDef, fitProfiles)?.trim();
  if (fitProfileAnchorId) {
    return fitProfileAnchorId;
  }

  return (
    item.anchorRules?.[slotDef.id]?.anchorId ??
    slotDef.defaultAnchorId ??
    null
  );
}

export function resolveItemPartBinding(
  entity: Entity,
  template: Template,
  skeleton: EvaluatedSkeleton,
  item: Item,
  slotAssign: SlotAssignment,
  slotDef: SlotDef,
  part: ItemPart,
  fitProfiles: ItemFitProfile[] = [],
): {
  parentMatrix: Matrix2D;
  anchorMatrix: Matrix2D;
  defaultTransformMatrix: Matrix2D;
  attachmentOverrideMatrix: Matrix2D;
  anchorId: string | null;
  boneId: string;
} {
  const anchorId = resolveAnchorId(slotAssign, slotDef, item, template, fitProfiles);
  const anchor = anchorId ? template.anchors?.[anchorId] : undefined;

  const distinctPartBones = new Set((item.parts ?? []).map(itemPart => itemPart.boneId));
  const isMultiBoneItem = distinctPartBones.size > 1;

  const parentBoneId =
    isMultiBoneItem
      ? part.boneId || slotDef.boneId
      : anchor?.boneId ?? part.boneId ?? slotDef.boneId;

  const parentBone = skeleton.bones.get(parentBoneId);
  const parentMatrix: Matrix2D = parentBone ? worldBoneToMatrix(parentBone) : identity();

  const anchorMatrix = anchor && !isMultiBoneItem
    ? localTransformToMatrix(anchor.offsetX, anchor.offsetY, anchor.rotation, 1, 1)
    : identity();

  const defaultTransformMatrix = makeSlotDefaultTransformMatrix(slotDef);

  const attachmentOverrideMatrix = makeAttachmentOverrideMatrix(slotAssign.attachmentOverride);

  return {
    parentMatrix,
    anchorMatrix,
    defaultTransformMatrix,
    attachmentOverrideMatrix,
    anchorId: isMultiBoneItem ? null : anchorId,
    boneId: parentBoneId,
  };
}

function visualFitModeForItemPart(part: ItemPart): "legacy_full_frame" | "v2_vector" {
  return part.coordinateMode === "legacy_full_frame" ? "legacy_full_frame" : "v2_vector";
}

function getRenderableEntityVisuals(entity: Entity, template: Template) {
  if (!template.boneParts || template.boneParts.length === 0) {
    return entity.visuals ?? [];
  }

  const visuals = entity.visuals ?? [];
  if (visuals.length === 0) {
    return visuals;
  }
  return visuals.filter(visual => !isLegacyBodyCloneVisual(visual, template));
}

// ── evaluateScene ─────────────────────────────────────────────────────────────

export function evaluateScene(
  entity:   Entity,
  template: Template,
  skeleton: EvaluatedSkeleton,
  items:    Item[],
  fitProfiles: ItemFitProfile[] = [],
): EvaluatedScene {
  const effectiveItems = refreshCanonicalBuiltInTypedItems(items);
  const coveredBodyBoneIds = getCoveredBodyBoneIds(entity, template, effectiveItems);
  const visuals: EvaluatedVisual[] = [];
  const layers:  SceneLayer[]      = [];

  const fw = template.previewWidth;
  const fh = template.previewHeight;
  const bodyParts = getCharacterBodyParts(template, entity);

  // ── 1. Entity visuals (full-vector body, v2.0) ─────────────────────────────
  for (const visual of getRenderableEntityVisuals(entity, template)) {
    if (visual.bodyPartId && (visual.bodyView ?? "front") !== (entity.appearance?.view && entity.appearance.view !== "front" ? "side" : "front")) continue;
    if (visual.bodyPartId && coveredBodyBoneIds.has(visual.boneId)) continue;
    const svgData = applyPaletteToSvg(visual.svgData, template.paletteTokens, entity.palette);

    const wb = skeleton.bones.get(visual.boneId);
    const boneM: Matrix2D = wb ? worldBoneToMatrix(wb) : identity();

    const piv = visual.pivot;
    const lt  = visual.localTransform;
    // Local bounds are already pivot-relative; subtracting the pivot again shifts the art.
    const localM = localTransformToMatrix(lt.x, lt.y, lt.rotation, lt.scaleX, lt.scaleY, 0, 0);
    const worldM = multiply(boneM, localM);

    const localBounds = makeMetricBounds(visual.metrics, piv.x, piv.y);
    const worldBounds = transformAABB(worldM, localBounds);

    // Edited body parts keep the same depth as their replaceable rig attachment.
    const zIndex = visual.bodyPartId
      ? bodyParts.find(part => part.id === visual.bodyPartId)?.zOffset ?? visual.zIndex
      : visual.zIndex;

    visuals.push({
      id: `vis__${visual.id}`,
      svgData,
      zIndex,
      worldMatrix: worldM,
      localBounds,
      worldBounds,
      sourceKind: "entity-visual",
      entityVisualId: visual.id,
      svgFitMode: "v2_vector",
    });

    // Legacy layer (full-frame, boneId=null for Pixi/frameRenderer)
    layers.push({
      id: `vis__${visual.id}`, svgData, zIndex, opacity: 1,
      boneId: null, localX: 0, localY: 0, rotation: 0, scaleX: 1, scaleY: 1,
      naturalWidth: fw, naturalHeight: fh,
    });
  }

  // ── 2. Template body layers ────────────────────────────────────────────────
  if (template.boneParts && template.boneParts.length > 0) {
    // Stage 3: per-bone SVG parts
    for (const part of bodyParts) {
      if (entity.visuals?.some(visual => visual.bodyPartId === part.id && (visual.bodyView ?? "front") === (entity.appearance?.view && entity.appearance.view !== "front" ? "side" : "front"))) continue;
      if (coveredBodyBoneIds.has(part.boneId)) continue;
      const svgData = applyPaletteToSvg(part.svgData, template.paletteTokens, entity.palette);

      const wb = skeleton.bones.get(part.boneId);
      const boneM: Matrix2D = wb ? worldBoneToMatrix(wb) : identity();
      const localM = translation(part.localX, part.localY);
      const worldM = multiply(boneM, localM);

      const localBounds = makeLocalBounds(part.naturalWidth, part.naturalHeight);
      const worldBounds = transformAABB(worldM, localBounds);

      visuals.push({
        id: `part__${part.id}`,
        svgData,
        zIndex: part.zOffset,
        worldMatrix: worldM,
        localBounds,
        worldBounds,
        sourceKind: "bone-part",
        boneId: part.boneId,
        svgFitMode: "v2_vector",
      });

      // Legacy layer (bone-local)
      layers.push({
        id: `part__${part.id}`, svgData, zIndex: part.zOffset, opacity: 1,
        boneId: part.boneId, localX: part.localX, localY: part.localY,
        rotation: 0, scaleX: 1, scaleY: 1,
        naturalWidth: part.naturalWidth, naturalHeight: part.naturalHeight,
      });
    }
  } else if (getRenderableEntityVisuals(entity, template).length === 0) {
    // Fallback: full-frame base body layers (no boneParts, no entity.visuals)
    for (const bodyLayer of template.baseBodyLayers) {
      const svgData = applyPaletteToSvg(bodyLayer.svgData, template.paletteTokens, entity.palette);
      const zIndex  = -1000 + bodyLayer.zOffset;
      const worldM  = makeFullFrameMatrix();
      const localBounds = makeLocalBounds(fw, fh);
      const worldBounds = localBounds;

      visuals.push({
        id: `base__${bodyLayer.id}`,
        svgData,
        zIndex,
        worldMatrix: worldM,
        localBounds,
        worldBounds,
        sourceKind: "base-layer",
        svgFitMode: "legacy_full_frame",
      });

      layers.push({
        id: `base__${bodyLayer.id}`, svgData, zIndex, opacity: 1,
        boneId: null, localX: 0, localY: 0, rotation: 0, scaleX: 1, scaleY: 1,
        naturalWidth: fw, naturalHeight: fh,
      });
    }
  }

  // ── 3. Slot item layers ────────────────────────────────────────────────────
  for (const faceVisual of makeFaceCustomizationVisuals(entity, skeleton)) {
    visuals.push(faceVisual);
  }

  for (const slotAssign of entity.slots) {
    if (!slotAssign.itemId) continue;
    const item    = effectiveItems.find(i => i.id === slotAssign.itemId);
    const slotDef = template.slots.find(s => s.id === slotAssign.slotId);
    if (!item || !slotDef) continue;

    const effectivePalette: PaletteTokens = { ...entity.palette, ...slotAssign.paletteOverride };

    if (item.parts && item.parts.length > 0) {
      // v2.0: multi-bone item parts
      for (const part of item.parts) {
        const svgData = applyPaletteToSvg(part.svgData, ITEM_SOURCE_PALETTE, effectivePalette);
        const binding = part.coordinateMode === "bone_local"
          ? resolveItemPartBinding(entity, template, skeleton, item, slotAssign, slotDef, part, fitProfiles) : null;
        const heldItem = ["weapon_main", "weapon_off", "shield"].includes(item.category);
        const attachmentDepth = item.tags.includes("rig-depth") || (heldItem && binding)
          ? bodyParts.find(bodyPart => bodyPart.boneId === (binding?.boneId ?? part.boneId))?.zOffset : undefined;
        const zIndex = attachmentDepth !== undefined ? attachmentDepth + part.zOffset : slotDef.zIndex + part.zOffset;
        const vid     = `slot__${slotAssign.slotId}__${item.id}__${part.id}`;

        if (part.coordinateMode === "legacy_full_frame") {
          const { width: frameWidth, height: frameHeight } = getLegacyOverlayFrameSize(item, template, svgData);
          const slotBoneMatrix = getSlotBoneMatrix(skeleton, slotDef);
          const worldM = multiply(
            slotBoneMatrix,
            multiply(
              makeSlotDefaultTransformMatrix(slotDef),
              makeAttachmentOverrideMatrix(slotAssign.attachmentOverride),
            ),
          );
          const localBounds = makeLocalBounds(frameWidth, frameHeight);
          const worldBounds = transformAABB(worldM, localBounds);
          visuals.push({
            id: vid,
            svgData,
            zIndex,
            worldMatrix: worldM,
            localBounds,
            worldBounds,
            sourceKind: "item-part",
            slotId: slotAssign.slotId,
            itemId: item.id,
            partId: part.id,
            svgFitMode: "legacy_full_frame",
          });
          layers.push({ id: vid, svgData, zIndex, opacity: 1, boneId: null, localX: 0, localY: 0, rotation: 0, scaleX: 1, scaleY: 1, naturalWidth: frameWidth, naturalHeight: frameHeight });
        } else {
          const piv    = part.pivot;
          const lt     = part.localTransform;
          const fitTransform = resolveItemFitPartTransform(item, template, slotDef, part.id, fitProfiles);
          const resolvedPartTransform = fitTransform ?? lt;
          const resolvedPartLocalM = localTransformToMatrix(
            resolvedPartTransform.x,
            resolvedPartTransform.y,
            resolvedPartTransform.rotation,
            resolvedPartTransform.scaleX,
            resolvedPartTransform.scaleY,
            piv.x,
            piv.y,
          );
          const partBinding = binding ?? resolveItemPartBinding(entity, template, skeleton, item, slotAssign, slotDef, part, fitProfiles);
          const worldM = multiply(
            partBinding.parentMatrix,
            multiply(
              partBinding.anchorMatrix,
              multiply(
                partBinding.defaultTransformMatrix,
                multiply(partBinding.attachmentOverrideMatrix, resolvedPartLocalM),
              ),
            ),
          );
          const localBounds = makeMetricBounds(part.metrics, piv.x, piv.y);
          const worldBounds = transformAABB(worldM, localBounds);
          const partWidth = part.metrics.visualWidth;
          const partHeight = part.metrics.visualHeight;
          visuals.push({
            id: vid,
            svgData,
            zIndex,
            worldMatrix: worldM,
            localBounds,
            worldBounds,
            sourceKind: "item-part",
            slotId: slotAssign.slotId,
            itemId: item.id,
            partId: part.id,
            svgFitMode: visualFitModeForItemPart(part),
          });
          layers.push({ id: vid, svgData, zIndex, opacity: 1, boneId: part.boneId, localX: lt.x, localY: lt.y, rotation: lt.rotation, scaleX: lt.scaleX, scaleY: lt.scaleY, naturalWidth: partWidth, naturalHeight: partHeight });
        }
      }
    } else {
      // Legacy: item has only svgLayers → full-frame overlays
      for (const svgLayer of item.svgLayers) {
        const svgData = applyPaletteToSvg(svgLayer.svgData, ITEM_SOURCE_PALETTE, effectivePalette);
        const zIndex  = slotDef.zIndex + svgLayer.zOffset;
        const { width: frameWidth, height: frameHeight } = getLegacyOverlayFrameSize(item, template, svgData);
        const slotBoneMatrix = getSlotBoneMatrix(skeleton, slotDef);
        const worldM = multiply(
          slotBoneMatrix,
          multiply(
            makeSlotDefaultTransformMatrix(slotDef),
            makeAttachmentOverrideMatrix(slotAssign.attachmentOverride),
          ),
        );
        const localBounds = makeLocalBounds(frameWidth, frameHeight);
        const worldBounds = transformAABB(worldM, localBounds);
        const id = `slot__${slotAssign.slotId}__${item.id}__${svgLayer.id}`;
        visuals.push({
          id,
          svgData,
          zIndex,
          worldMatrix: worldM,
          localBounds,
          worldBounds,
          sourceKind: "item-part",
          slotId: slotAssign.slotId,
          itemId: item.id,
          partId: svgLayer.id,
          svgFitMode: "legacy_full_frame",
        });
        layers.push({ id, svgData, zIndex, opacity: 1, boneId: null, localX: 0, localY: 0, rotation: 0, scaleX: 1, scaleY: 1, naturalWidth: frameWidth, naturalHeight: frameHeight });
      }
    }
  }

  visuals.sort((a, b) => a.zIndex - b.zIndex);
  layers.sort((a, b)  => a.zIndex - b.zIndex);

  return {
    entityId:       entity.id,
    templateId:     template.id,
    skeletonFamily: template.skeletonFamily,
    visuals,
    layers,
    skeleton,
    frameWidth:     fw,
    frameHeight:    fh,
  };
}

// ── Renderer helpers ──────────────────────────────────────────────────────────

export function projectBone(
  wb:        WorldBone,
  cx:        number,
  cy:        number,
  skelScale: number,
): { x: number; y: number; rotation: number } {
  return {
    x:        cx + wb.x * skelScale,
    y:        cy + wb.y * skelScale,
    rotation: wb.rotation,
  };
}
