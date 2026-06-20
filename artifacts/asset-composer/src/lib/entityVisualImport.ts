import type { EntityVisual } from "@/domain/types";
import { computePivotXY, parseMetrics } from "@/lib/svgMetrics";

type PivotPreset = "center" | "feet" | "custom";

export function getDefaultImportPivot(
  svgData: string,
  preset: Exclude<PivotPreset, "custom"> = "center",
): { x: number; y: number } {
  const metrics = parseMetrics(svgData);
  return computePivotXY(metrics, preset);
}

export function buildImportedEntityVisual(options: {
  id: string;
  svgData: string;
  boneId: string;
  zIndex: number;
  pivotPreset?: PivotPreset;
  pivotX?: number;
  pivotY?: number;
}): EntityVisual {
  const metrics = parseMetrics(options.svgData);
  const pivot =
    options.pivotPreset === "feet"
      ? computePivotXY(metrics, "feet")
      : options.pivotPreset === "center" || options.pivotPreset == null
        ? computePivotXY(metrics, "center")
        : {
            x: options.pivotX ?? computePivotXY(metrics, "center").x,
            y: options.pivotY ?? computePivotXY(metrics, "center").y,
          };

  return {
    id: options.id,
    boneId: options.boneId,
    svgData: options.svgData,
    pivot: {
      x: pivot.x,
      y: pivot.y,
      preset: options.pivotPreset ?? "center",
    },
    localTransform: {
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    },
    metrics,
    zIndex: options.zIndex,
  };
}
