/**
 * frameRenderer.ts — Main-thread frame renderer for the Export Dialog preview.
 *
 * Uses evaluateScene (canonical EvaluatedVisual pipeline).  Each EvaluatedVisual
 * carries a pre-computed worldMatrix (in template/scene units).  The renderer
 * applies a viewport transform that maps template space → canvas pixels:
 *
 *   scale  = frameSz / max(template.previewWidth, template.previewHeight)
 *   origin = (frameSz/2, frameSz/2)  →  template (0, 0)
 *
 * Per-visual rendering:
 *   ctx.setTransform(scale*wa, scale*wb, scale*wc, scale*wd,
 *                    scale*we + frameSz/2, scale*wf + frameSz/2)
 *   ctx.drawImage(img, lb.minX, lb.minY, lw, lh)   // local-space rect
 *
 * Uses HTMLImageElement (DOM), so must run on the main thread only.
 * The export worker uses an identical transform model on OffscreenCanvas.
 */

import { scaleSvgToFit, svgToDataUrl } from "@/lib/svgUtils";
import { evaluateRestSkeleton, evaluateScene } from "@/lib/evaluationPipeline";
import type { EvaluatedVisual } from "@/domain/types";
import type { Entity, Template, Item } from "@/domain/types";

async function loadSvgAsImage(
  svgData: string,
  w: number,
  h: number,
  fitMode: "legacy_full_frame" | "v2_vector" = "legacy_full_frame",
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const sized = scaleSvgToFit(svgData, w, h, fitMode);
    const img   = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error("SVG load failed"));
    img.src     = svgToDataUrl(sized);
  });
}

async function drawVisual(
  ctx:     CanvasRenderingContext2D,
  visual:  EvaluatedVisual,
  frameSz: number,
  scale:   number,
): Promise<void> {
  const [wa, wb, wc, wd, we, wf] = visual.worldMatrix;
  const lb  = visual.localBounds;
  const lw  = lb.maxX - lb.minX;
  const lh  = lb.maxY - lb.minY;
  if (lw <= 0 || lh <= 0) return;

  const pxW = Math.max(1, Math.ceil(lw * scale));
  const pxH = Math.max(1, Math.ceil(lh * scale));

  const img = await loadSvgAsImage(visual.svgData, pxW, pxH, visual.svgFitMode ?? "legacy_full_frame");
  ctx.save();
  ctx.setTransform(
    scale * wa, scale * wb,
    scale * wc, scale * wd,
    scale * we + frameSz / 2,
    scale * wf + frameSz / 2,
  );
  ctx.drawImage(img, lb.minX, lb.minY, lw, lh);
  ctx.restore();
}

/**
 * Render one rest-pose entity frame onto an existing HTML canvas element.
 *
 * Uses evaluateScene (canonical pipeline) so the preview is consistent with
 * the Pixi and canvas-engine renderers.
 *
 * Pass an empty items array for a body-only preview.
 * The canvas is set to frameSz × frameSz — the caller may CSS-scale it.
 */
export async function renderFrameToCanvas(opts: {
  canvas:         HTMLCanvasElement;
  entity:         Entity;
  template:       Template;
  items:          Item[];
  frameSz:        number;
  bgColor:        string | null;
  outlinePadding: number;
  antiAlias?:     boolean;
}): Promise<void> {
  const { canvas, entity, template, items, frameSz, bgColor, outlinePadding } = opts;
  const antiAlias = opts.antiAlias ?? true;
  const scale = frameSz / Math.max(template.previewWidth, template.previewHeight);

  canvas.width  = frameSz;
  canvas.height = frameSz;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = antiAlias;
  if (antiAlias) ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, frameSz, frameSz);

  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, frameSz, frameSz);
  }

  const skeleton = evaluateRestSkeleton(template.bones);
  const scene    = evaluateScene(entity, template, skeleton, items);

  for (const visual of scene.visuals) {
    try {
      await drawVisual(ctx, visual, frameSz, scale);
    } catch {
      // Skip visuals that fail to load (e.g. malformed SVG)
    }
  }

  if (outlinePadding > 0) {
    const p = outlinePadding;
    ctx.resetTransform();
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth   = p;
    ctx.strokeRect(p / 2, p / 2, frameSz - p, frameSz - p);
  }
}
