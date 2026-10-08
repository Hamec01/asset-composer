import bob from "@/assets/appearance/painted_bob.png";
import curls from "@/assets/appearance/painted_curls.png";
import braid from "@/assets/appearance/painted_braid.png";
import eye from "@/assets/appearance/painted_eye.png";
import lips from "@/assets/appearance/painted_lips.png";
import nose from "@/assets/appearance/painted_nose.png";
import metadata from "@/assets/appearance/metadata.json";
import type { AABB, VisualAsset } from "@/domain/types";

export const PAINTED_APPEARANCE = {
  painted_bob: {
    url: bob,
    feature: "hair",
    bounds: { minX: -29, minY: -29, maxX: 29, maxY: 29 },
  },
  painted_curls: {
    url: curls,
    feature: "hair",
    bounds: { minX: -29, minY: -29, maxX: 29, maxY: 29 },
  },
  painted_braid: {
    url: braid,
    feature: "hair",
    bounds: { minX: -29, minY: -29, maxX: 29, maxY: 38 },
  },
  painted_eye: {
    url: eye,
    feature: "eyes",
    bounds: fitAlpha("painted_eye", {
      minX: -3.8,
      minY: 1.4,
      maxX: 3.8,
      maxY: 6.6,
    }),
  },
  painted_lips: {
    url: lips,
    feature: "mouth",
    bounds: fitAlpha("painted_lips", {
      minX: -3.6,
      minY: 10.7,
      maxX: 3.6,
      maxY: 14.2,
    }),
  },
  painted_nose: {
    url: nose,
    feature: "nose",
    bounds: fitAlpha("painted_nose", {
      minX: -1.5,
      minY: 5.3,
      maxX: 1.5,
      maxY: 9.7,
    }),
  },
} as const;
function fitAlpha(id: keyof typeof metadata, target: AABB): AABB {
  const {
    width,
    height,
    alphaBounds: [left, top, right, bottom],
  } = metadata[id];
  const sx = (target.maxX - target.minX) / (right - left),
    sy = (target.maxY - target.minY) / (bottom - top);
  return {
    minX: target.minX - left * sx,
    minY: target.minY - top * sy,
    maxX: target.minX + (width - left) * sx,
    maxY: target.minY + (height - top) * sy,
  };
}
export function paintedPreset(id: string) {
  return PAINTED_APPEARANCE[id as keyof typeof PAINTED_APPEARANCE];
}
const pending = new Map<string, Promise<VisualAsset>>();
/** Load only selected assets. Portable project resources contain bytes, never build URLs. */
export function loadPaintedPreset(id: string): Promise<VisualAsset> {
  let promise = pending.get(id);
  if (!promise) {
    promise = (async () => {
      const preset = paintedPreset(id);
      if (!preset) throw new Error("Unknown painted preset");
      const response = await fetch(preset.url);
      if (!response.ok) throw new Error("Could not load painted artwork");
      const blob = await response.blob();
      const dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () =>
          reject(new Error("Could not read painted artwork"));
        reader.readAsDataURL(blob);
      });
      const { width, height } = metadata[id as keyof typeof metadata];
      return {
        id: `appearance_${id}_v1`,
        name: id,
        mimeType: "image/png" as const,
        width,
        height,
        dataUri,
      };
    })().catch((error) => {
      pending.delete(id);
      throw error;
    });
    pending.set(id, promise);
  }
  return promise;
}
