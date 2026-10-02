import type { Entity } from "@/domain/types";

export function entityVisualRevision(entity: Entity | undefined): string {
  if (!entity) return "";
  return JSON.stringify({
    id: entity.id, templateId: entity.templateId, style: entity.styleSetId,
    slots: entity.slots, palette: entity.palette, visuals: entity.visuals,
    face: entity.faceCustomization, appearance: entity.appearance,
    morphs: entity.bodyMorphs, pose: entity.poseOverrides, root: entity.rootTransform,
  });
}
