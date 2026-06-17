/**
 * sceneUtils.ts
 *
 * Scene-level helpers: computing visual bounds and fitting the camera.
 *
 * All values are in template/scene units (origin = template centre).
 * Renderers convert to screen pixels via the viewport matrix.
 */

import type { EvaluatedVisual } from "@/domain/types";
import { unionAABB } from "@/lib/matrixUtils";
import type { AABB } from "@/lib/matrixUtils";

// ── Scene bounds ──────────────────────────────────────────────────────────────

const EMPTY_AABB: AABB = { minX: 0, minY: 0, maxX: 0, maxY: 0 };

/**
 * Compute the axis-aligned bounding box of all visuals in a scene.
 * Uses each visual's pre-computed worldBounds (four-corner transform of localBounds).
 *
 * Falls back to a 128×128 box around the origin if there are no visuals.
 */
export function computeSceneBounds(
  visuals:      EvaluatedVisual[],
  frameWidth?:  number,
  frameHeight?: number,
): AABB {
  if (visuals.length === 0) {
    const hw = (frameWidth  ?? 128) / 2;
    const hh = (frameHeight ?? 128) / 2;
    return { minX: -hw, minY: -hh, maxX: hw, maxY: hh };
  }

  return visuals.reduce<AABB>(
    (acc, v) => acc === EMPTY_AABB ? v.worldBounds : unionAABB(acc, v.worldBounds),
    EMPTY_AABB,
  );
}

// ── Camera / viewport fit ─────────────────────────────────────────────────────

export interface CameraState {
  zoom:  number;
  panX:  number;
  panY:  number;
}

/**
 * Compute a camera state that fits the given scene bounds in the viewport
 * with a padding border.
 *
 * @param bounds       World-space AABB to fit (template units)
 * @param viewportW    Viewport width in screen pixels
 * @param viewportH    Viewport height in screen pixels
 * @param paddingFrac  Fraction of the smaller viewport dimension to use as padding
 */
export function fitSceneToViewport(
  bounds:      AABB,
  viewportW:   number,
  viewportH:   number,
  paddingFrac  = 0.12,
): CameraState {
  const boundsW = bounds.maxX - bounds.minX;
  const boundsH = bounds.maxY - bounds.minY;

  if (boundsW < 1 || boundsH < 1) {
    return { zoom: 1, panX: 0, panY: 0 };
  }

  const padding   = Math.min(viewportW, viewportH) * paddingFrac;
  const availW    = Math.max(1, viewportW - 2 * padding);
  const availH    = Math.max(1, viewportH - 2 * padding);
  const zoom      = Math.min(availW / boundsW, availH / boundsH);

  // Centre of scene bounds in template units → should map to viewport centre (0,0 in pan space)
  const sceneCX   = (bounds.minX + bounds.maxX) / 2;
  const sceneCY   = (bounds.minY + bounds.maxY) / 2;

  // panX/panY: additional offset applied after zoom in the viewport matrix.
  // Viewport contract: [zoom,0,0,zoom, vW/2+panX, vH/2+panY]
  // We want template (sceneCX, sceneCY) → screen (vW/2, vH/2):
  //   zoom * sceneCX + (vW/2 + panX) = vW/2  →  panX = -zoom * sceneCX
  const panX = -zoom * sceneCX;
  const panY = -zoom * sceneCY;

  return { zoom, panX, panY };
}

/**
 * Center the viewport on the given template-space point without changing zoom.
 */
export function centerOnPoint(
  x:          number,
  y:          number,
  zoom:       number,
): CameraState {
  return { zoom, panX: -zoom * x, panY: -zoom * y };
}
