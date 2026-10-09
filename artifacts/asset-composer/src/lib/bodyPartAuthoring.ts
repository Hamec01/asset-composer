import { vectorSource } from "@/lib/visualContent";
import type { BonePart, EntityVisual } from "@/domain/types";
import { buildImportedEntityVisual } from "./entityVisualImport";

export function createEditableBodyPart(part: BonePart): EntityVisual {
  if (part.content && part.content.kind !== "vector") {
    const w = part.naturalWidth, h = part.naturalHeight;
    return { id: crypto.randomUUID(), boneId: part.boneId, bodyPartId: part.id, content: part.content,
      metrics: { viewBoxX: 0, viewBoxY: 0, viewBoxWidth: w, viewBoxHeight: h, visualMinX: 0, visualMinY: 0, visualWidth: w, visualHeight: h },
      pivot: { x: 0, y: 0, preset: "custom" }, localTransform: { x: part.localX - w / 2, y: part.localY - h / 2, rotation: 0, scaleX: 1, scaleY: 1 }, zIndex: part.zOffset,
    };
  }
  const visual = buildImportedEntityVisual({
    id: crypto.randomUUID(), boneId: part.boneId, svgData: vectorSource(part),
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
