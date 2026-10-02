import type { BonePart, EntityVisual } from "@/domain/types";
import { buildImportedEntityVisual } from "./entityVisualImport";

export function createEditableBodyPart(part: BonePart): EntityVisual {
  const visual = buildImportedEntityVisual({
    id: crypto.randomUUID(), boneId: part.boneId, svgData: part.svgData,
    zIndex: part.zOffset, pivotPreset: "center",
  });
  visual.bodyPartId = part.id;
  // Center on the viewBox, not the painted bounds: every build uses the same joint.
  visual.pivot.x = visual.metrics.viewBoxX + visual.metrics.viewBoxWidth / 2;
  visual.pivot.y = visual.metrics.viewBoxY + visual.metrics.viewBoxHeight / 2;
  visual.localTransform = {
    x: part.localX, y: part.localY, rotation: 0,
    scaleX: part.naturalWidth / visual.metrics.viewBoxWidth,
    scaleY: part.naturalHeight / visual.metrics.viewBoxHeight,
  };
  return visual;
}
