import { drawVisual, visualSvg, createSvgAssetRegistry, type SvgAssetRegistry } from "./visualRenderer";
import type { AnimationClip, Entity, Item, ItemFitProfile, Template } from "@/domain/types";
import type { EvaluatedScene } from "./evaluationPipeline";
import { templateSupportsAnimationClip } from "./animationCompatibility";
import { buildMultiClipPose, evaluateSkeleton } from "./evaluationPipeline";
import { scaleSvgToFit, svgToDataUrl } from "./svgUtils";
import { evaluatePresentedScene, xrayOverlaySvg, type AnimationXRayOptions } from "./animationXRay";
import type { VisualResources } from "./visualContent";

export interface ExportFrameSpec { key: string; clip: AnimationClip | null; frame: number; timeMs: number }

export const exportFrameKey = (entityId: string, clipId: string | null, frame: number) => `${entityId}|${clipId ?? "rest"}|${frame}`;

export function exportClipsFor(template: Template, clips: AnimationClip[], selectedClipIds?: string[]) {
  return clips.filter(c => templateSupportsAnimationClip(template, c) && (!selectedClipIds?.length || selectedClipIds.includes(c.id)));
}

/** Every frame the worker will pack, in order. A rest frame stands in when no clip applies. */
export function exportFramePlan(entity: Entity, template: Template, clips: AnimationClip[], selectedClipIds?: string[]): ExportFrameSpec[] {
  const plan = exportClipsFor(template, clips, selectedClipIds).flatMap(clip => {
    const fps = Math.max(1, clip.fps);
    const total = Math.max(1, Math.ceil(clip.durationMs / 1000 * fps));
    return Array.from({ length: total }, (_, frame) => ({ key: exportFrameKey(entity.id, clip.id, frame), clip, frame, timeMs: frame / fps * 1000 }));
  });
  return plan.length ? plan : [{ key: exportFrameKey(entity.id, null, 0), clip: null, frame: 0, timeMs: 0 }];
}

/** Same pose and scene evaluation as the editor canvas, so skinning, attachments and draw order match. */
export function evaluateExportScene(entity: Entity, template: Template, clips: AnimationClip[], items: Item[], fitProfiles: ItemFitProfile[], spec: ExportFrameSpec, options?: AnimationXRayOptions, resources?: VisualResources): EvaluatedScene {
  const playing = { ...entity, activeAnimationClipId: spec.clip?.id ?? entity.activeAnimationClipId };
  const pose = spec.clip ? buildMultiClipPose(clips, spec.clip.id, null, null, 0, spec.timeMs, playing, items) : new Map();
  const skeleton = evaluateSkeleton(template.bones, pose, entity.bodyMorphs, entity.appearance);
  return evaluatePresentedScene(playing, template, skeleton, items, fitProfiles, options, resources);
}

export interface ExportCamera { x: number; y: number; size: number }

/** One square camera for all of an entity's frames: tight around the character, stable across clips. */
export function exportCamera(scenes: EvaluatedScene[], padding = 0.06): ExportCamera {
  const bounds = scenes.flatMap(scene => scene.visuals.map(v => v.worldBounds))
    .filter(b => [b.minX, b.minY, b.maxX, b.maxY].every(Number.isFinite));
  if (!bounds.length) return { x: -50, y: -50, size: 100 };
  const minX = Math.min(...bounds.map(b => b.minX)), maxX = Math.max(...bounds.map(b => b.maxX));
  const minY = Math.min(...bounds.map(b => b.minY)), maxY = Math.max(...bounds.map(b => b.maxY));
  const size = Math.max(maxX - minX, maxY - minY) * (1 + padding * 2);
  // Feet stay on the bottom edge so the "feet" pivot is meaningful.
  return { x: (minX + maxX - size) / 2, y: maxY + size * padding - size, size };
}

/** One vector document per frame, drawn exactly like the editor canvas places each visual. */
export function composeFrameSvg(scene: EvaluatedScene, camera: ExportCamera, frameSz: number, sharedAssets?: SvgAssetRegistry): string {
  const assets = sharedAssets ?? createSvgAssetRegistry();
  const images = [...scene.visuals].sort((a,b)=>a.zIndex-b.zIndex).map(v=>visualSvg(v,frameSz/camera.size,assets)).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${frameSz}" height="${frameSz}" viewBox="${camera.x} ${camera.y} ${camera.size} ${camera.size}">${sharedAssets ? "" : assets.definitions()}${images}${xrayOverlaySvg(scene, frameSz / camera.size)}</svg>`;
}

export function rasterizeFrame(svg: string, frameSz: number): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = frameSz; canvas.height = frameSz;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas 2D is unavailable")); return; }
      ctx.drawImage(img, 0, 0, frameSz, frameSz);
      createImageBitmap(canvas).then(resolve, reject);
    };
    img.onerror = () => reject(new Error("Failed to rasterize export frame"));
    img.src = svgToDataUrl(svg);
  });
}

/** Raster formats consume the same evaluated textured triangles directly. */
export async function rasterizeScene(scene:EvaluatedScene,camera:ExportCamera,size:number):Promise<ImageBitmap>{
  const canvas=document.createElement("canvas");canvas.width=size;canvas.height=size;
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Canvas 2D is unavailable");
  ctx.scale(size/camera.size,size/camera.size);ctx.translate(-camera.x,-camera.y);
  for(const visual of scene.visuals)await drawVisual(ctx,visual);
  return createImageBitmap(canvas);
}
