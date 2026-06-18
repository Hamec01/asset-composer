import type { LocalTransform, SlotDef } from "@/domain/types";
import { identity, inverse, localTransformToMatrix, transformPoint, worldBoneToMatrix } from "@/lib/matrixUtils";
import type { WorldBone } from "@/lib/evaluationPipeline";

export function getTemplateSlotDefaultTransform(slotDef: SlotDef): LocalTransform {
  return slotDef.defaultTransform ?? { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
}

export function getTemplateSlotWorldCenter(slotDef: SlotDef, bone: WorldBone | null | undefined): { x: number; y: number } {
  const dt = getTemplateSlotDefaultTransform(slotDef);
  const boneMatrix = bone ? worldBoneToMatrix(bone) : identity();
  const slotMatrix = localTransformToMatrix(dt.x, dt.y, dt.rotation, dt.scaleX, dt.scaleY);
  return transformPoint(boneMatrix, slotMatrix[4], slotMatrix[5]);
}

export function getTemplateSlotTransformFromWorldCenter(
  slotDef: SlotDef,
  bone: WorldBone | null | undefined,
  worldCenter: { x: number; y: number },
): LocalTransform {
  const current = getTemplateSlotDefaultTransform(slotDef);
  const boneMatrix = bone ? worldBoneToMatrix(bone) : identity();
  const localCenter = transformPoint(inverse(boneMatrix), worldCenter.x, worldCenter.y);
  return {
    x: localCenter.x,
    y: localCenter.y,
    rotation: current.rotation,
    scaleX: current.scaleX,
    scaleY: current.scaleY,
  };
}
