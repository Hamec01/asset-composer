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
  AnimationClip, EvaluatedVisual, Matrix2D, AABB,
} from "@/domain/types";
import { resolveClipPose, blendPoses } from "./animationRuntime";
import type { BoneTransformMap } from "./animationRuntime";
import { applyPaletteToSvg } from "./svgUtils";
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

  let pose: BoneTransformMap = baseClip
    ? resolveClipPose(baseClip, renderTime)
    : new Map();

  if (upperClip || lowerClip) {
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

  return pose;
}

// ── evaluateSkeleton ──────────────────────────────────────────────────────────

export function evaluateSkeleton(
  bones:     Bone[],
  localPose: BoneTransformMap,
): EvaluatedSkeleton {
  const world = new Map<string, WorldBone>();

  for (const bone of bones) {
    const anim = localPose.get(bone.id);
    const lx   = bone.restPose.tx       + (anim?.tx       ?? 0);
    const ly   = bone.restPose.ty       + (anim?.ty       ?? 0);
    const lRot = bone.restPose.rotation + (anim?.rotation ?? 0);
    const lSx  = bone.restPose.scaleX   * (anim?.scaleX   ?? 1);
    const lSy  = bone.restPose.scaleY   * (anim?.scaleY   ?? 1);

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

  return { bones: world };
}

export function evaluateRestSkeleton(bones: Bone[]): EvaluatedSkeleton {
  return evaluateSkeleton(bones, new Map());
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function makeLocalBounds(w: number, h: number): AABB {
  return { minX: -w / 2, minY: -h / 2, maxX: w / 2, maxY: h / 2 };
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

// ── evaluateScene ─────────────────────────────────────────────────────────────

export function evaluateScene(
  entity:   Entity,
  template: Template,
  skeleton: EvaluatedSkeleton,
  items:    Item[],
): EvaluatedScene {
  const visuals: EvaluatedVisual[] = [];
  const layers:  SceneLayer[]      = [];

  const fw = template.previewWidth;
  const fh = template.previewHeight;

  // ── 1. Entity visuals (full-vector body, v2.0) ─────────────────────────────
  for (const visual of entity.visuals ?? []) {
    const svgData = applyPaletteToSvg(visual.svgData, template.paletteTokens, entity.palette);

    const wb = skeleton.bones.get(visual.boneId);
    const boneM: Matrix2D = wb ? worldBoneToMatrix(wb) : identity();

    const piv = visual.pivot;
    const lt  = visual.localTransform;
    const localM = localTransformToMatrix(lt.x, lt.y, lt.rotation, lt.scaleX, lt.scaleY, piv.x, piv.y);
    const worldM = multiply(boneM, localM);

    const vw = visual.metrics.visualWidth;
    const vh = visual.metrics.visualHeight;
    const localBounds = makeLocalBounds(vw, vh);
    const worldBounds = transformAABB(worldM, localBounds);

    visuals.push({ id: `vis__${visual.id}`, svgData, zIndex: visual.zIndex, worldMatrix: worldM, localBounds, worldBounds, sourceKind: "entity-visual", entityVisualId: visual.id });

    // Legacy layer (full-frame, boneId=null for Pixi/frameRenderer)
    layers.push({
      id: `vis__${visual.id}`, svgData, zIndex: visual.zIndex, opacity: 1,
      boneId: null, localX: 0, localY: 0, rotation: 0, scaleX: 1, scaleY: 1,
      naturalWidth: fw, naturalHeight: fh,
    });
  }

  // ── 2. Template body layers ────────────────────────────────────────────────
  if (template.boneParts && template.boneParts.length > 0) {
    // Stage 3: per-bone SVG parts
    for (const part of template.boneParts) {
      const svgData = applyPaletteToSvg(part.svgData, template.paletteTokens, entity.palette);

      const wb = skeleton.bones.get(part.boneId);
      const boneM: Matrix2D = wb ? worldBoneToMatrix(wb) : identity();
      const localM = translation(part.localX, part.localY);
      const worldM = multiply(boneM, localM);

      const localBounds = makeLocalBounds(part.naturalWidth, part.naturalHeight);
      const worldBounds = transformAABB(worldM, localBounds);

      visuals.push({ id: `part__${part.id}`, svgData, zIndex: part.zOffset, worldMatrix: worldM, localBounds, worldBounds, sourceKind: "bone-part" });

      // Legacy layer (bone-local)
      layers.push({
        id: `part__${part.id}`, svgData, zIndex: part.zOffset, opacity: 1,
        boneId: part.boneId, localX: part.localX, localY: part.localY,
        rotation: 0, scaleX: 1, scaleY: 1,
        naturalWidth: part.naturalWidth, naturalHeight: part.naturalHeight,
      });
    }
  } else if ((entity.visuals ?? []).length === 0) {
    // Fallback: full-frame base body layers (no boneParts, no entity.visuals)
    for (const bodyLayer of template.baseBodyLayers) {
      const svgData = applyPaletteToSvg(bodyLayer.svgData, template.paletteTokens, entity.palette);
      const zIndex  = -1000 + bodyLayer.zOffset;
      const worldM  = makeFullFrameMatrix();
      const localBounds = makeLocalBounds(fw, fh);
      const worldBounds = localBounds;

      visuals.push({ id: `base__${bodyLayer.id}`, svgData, zIndex, worldMatrix: worldM, localBounds, worldBounds, sourceKind: "base-layer" });

      layers.push({
        id: `base__${bodyLayer.id}`, svgData, zIndex, opacity: 1,
        boneId: null, localX: 0, localY: 0, rotation: 0, scaleX: 1, scaleY: 1,
        naturalWidth: fw, naturalHeight: fh,
      });
    }
  }

  // ── 3. Slot item layers ────────────────────────────────────────────────────
  for (const slotAssign of entity.slots) {
    if (!slotAssign.itemId) continue;
    const item    = items.find(i => i.id === slotAssign.itemId);
    const slotDef = template.slots.find(s => s.id === slotAssign.slotId);
    if (!item || !slotDef) continue;

    const effectivePalette: PaletteTokens = { ...entity.palette, ...slotAssign.paletteOverride };
    const overrideM = makeAttachmentOverrideMatrix(slotAssign.attachmentOverride);

    // defaultTransform shifts the slot's base position relative to the bone.
    const defaultTransformM: Matrix2D = slotDef.defaultTransform
      ? localTransformToMatrix(
          slotDef.defaultTransform.x, slotDef.defaultTransform.y,
          slotDef.defaultTransform.rotation,
          slotDef.defaultTransform.scaleX, slotDef.defaultTransform.scaleY,
        )
      : identity();

    const wb = skeleton.bones.get(slotDef.boneId);
    const boneM: Matrix2D = wb ? worldBoneToMatrix(wb) : identity();

    if (item.parts && item.parts.length > 0) {
      // v2.0: multi-bone item parts
      for (const part of item.parts) {
        const svgData = applyPaletteToSvg(part.svgData, template.paletteTokens, effectivePalette);
        const zIndex  = slotDef.zIndex + part.zOffset;
        const vid     = `slot__${slotAssign.slotId}__${item.id}__${part.id}`;

        if (part.coordinateMode === "legacy_full_frame") {
          const worldM      = makeFullFrameMatrix();
          const localBounds = makeLocalBounds(fw, fh);
          visuals.push({ id: vid, svgData, zIndex, worldMatrix: worldM, localBounds, worldBounds: localBounds, sourceKind: "item-part", slotId: slotAssign.slotId, itemId: item.id, partId: part.id });
          layers.push({ id: vid, svgData, zIndex, opacity: 1, boneId: null, localX: 0, localY: 0, rotation: 0, scaleX: 1, scaleY: 1, naturalWidth: fw, naturalHeight: fh });
        } else {
          const partBoneWb  = skeleton.bones.get(part.boneId);
          const partBoneM: Matrix2D = partBoneWb ? worldBoneToMatrix(partBoneWb) : boneM;
          const piv    = part.pivot;
          const lt     = part.localTransform;
          const partLocalM = localTransformToMatrix(lt.x, lt.y, lt.rotation, lt.scaleX, lt.scaleY, piv.x, piv.y);
          // worldM = partBoneM × defaultTransformM × overrideM × partLocalM
          const worldM = multiply(partBoneM, multiply(defaultTransformM, multiply(overrideM, partLocalM)));
          const vw = part.metrics.visualWidth;
          const vh = part.metrics.visualHeight;
          const localBounds = makeLocalBounds(vw, vh);
          const worldBounds = transformAABB(worldM, localBounds);
          visuals.push({ id: vid, svgData, zIndex, worldMatrix: worldM, localBounds, worldBounds, sourceKind: "item-part", slotId: slotAssign.slotId, itemId: item.id, partId: part.id });
          layers.push({ id: vid, svgData, zIndex, opacity: 1, boneId: part.boneId, localX: lt.x, localY: lt.y, rotation: lt.rotation, scaleX: lt.scaleX, scaleY: lt.scaleY, naturalWidth: vw, naturalHeight: vh });
        }
      }
    } else {
      // Legacy: item has only svgLayers → full-frame overlays
      for (const svgLayer of item.svgLayers) {
        const svgData = applyPaletteToSvg(svgLayer.svgData, template.paletteTokens, effectivePalette);
        const zIndex  = slotDef.zIndex + svgLayer.zOffset;
        const worldM  = makeFullFrameMatrix();
        const localBounds = makeLocalBounds(fw, fh);
        const id = `slot__${slotAssign.slotId}__${item.id}__${svgLayer.id}`;
        visuals.push({ id, svgData, zIndex, worldMatrix: worldM, localBounds, worldBounds: localBounds, sourceKind: "item-part", slotId: slotAssign.slotId, itemId: item.id, partId: svgLayer.id });
        layers.push({ id, svgData, zIndex, opacity: 1, boneId: null, localX: 0, localY: 0, rotation: 0, scaleX: 1, scaleY: 1, naturalWidth: fw, naturalHeight: fh });
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
