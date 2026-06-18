/**
 * Export Web Worker — Sprite Sheet Packer & Atlas Pipeline
 *
 * Receives an ExportWorkerJob with pre-rasterized PNG images (produced on the
 * main thread to work around SVG-in-createImageBitmap failures inside workers).
 *
 * Rendering model: every layer (base body + items) is a full-frame overlay
 * scaled to fit the template frame. Item SVGs are authored as 64×64 viewBox
 * full-body composites — not bone-local art — so they are drawn over the
 * entire character frame in z-index order.
 */

import { resolveClipPose } from "@/lib/animationRuntime";
import { evaluateSkeleton, evaluateScene } from "@/lib/evaluationPipeline";
import { refreshCanonicalBuiltInTypedItems } from "@/lib/canonicalItems";
import { packSprites } from "@/lib/spritePacker";
import { buildAtlasJson, buildPhaserAtlasJson } from "@/lib/atlasGenerator";
import { formatFrameName } from "@/lib/exportTypes";
import { zipSync, strToU8 } from "fflate";
import type {
  ExportWorkerJob,
  WorkerOutputMessage,
  WorkerInputMessage,
} from "@/lib/exportTypes";
import type {
  Entity,
  Template,
  Item,
  AnimationClip,
  ExportProfile,
} from "@/domain/types";
import type { BoneTransformMap } from "@/lib/animationRuntime";

// ── PNG ArrayBuffer → ImageBitmap cache ───────────────────────────────────────

const bitmapCache = new Map<string, ImageBitmap>();

async function loadPngBitmap(
  key: string,
  buf: ArrayBuffer,
  w: number,
  h: number
): Promise<ImageBitmap | null> {
  const cacheKey = `${key}:${w}:${h}`;
  const cached = bitmapCache.get(cacheKey);
  if (cached) return cached;
  try {
    const blob = new Blob([buf], { type: "image/png" });
    const bm   = await createImageBitmap(blob, { resizeWidth: w, resizeHeight: h });
    bitmapCache.set(cacheKey, bm);
    return bm;
  } catch {
    return null;
  }
}

// ── Single-frame renderer ─────────────────────────────────────────────────────

/**
 * Render one animation frame to an OffscreenCanvas bitmap.
 *
 * Stage 3 support:
 *   - When template.boneParts is defined, bone parts are drawn using the
 *     skeleton pose (evaluateSkeleton) for proper animation deformation.
 *     Each part bitmap was pre-rasterized at 8× natural size on the main
 *     thread (key: `part:entityId:partId`) and is resized to skelScale at
 *     render time.
 *   - Without boneParts, base body PNGs are drawn as full-frame overlays
 *     (legacy path, key: `base:entityId:layerId`).
 *   - Item layers are always full-frame (key: `slot:entityId:slotId:index`).
 */
async function renderFrame(
  entity: Entity,
  template: Template,
  itemsMap: Map<string, Item>,
  rasterizedImages: Record<string, ArrayBuffer>,
  pose: BoneTransformMap,
  frameSz: number,
  profile: ExportProfile
): Promise<ImageBitmap> {
  const canvas = new OffscreenCanvas(frameSz, frameSz);
  const ctx    = canvas.getContext("2d")!;

  ctx.imageSmoothingEnabled = profile.antiAlias;
  if (profile.antiAlias) ctx.imageSmoothingQuality = "high";

  if (profile.bgColor) {
    ctx.fillStyle = profile.bgColor;
    ctx.fillRect(0, 0, frameSz, frameSz);
  }

  const canonicalSkeleton = evaluateSkeleton(template.bones, pose);
  const canonicalScene = evaluateScene(entity, template, canonicalSkeleton, [...itemsMap.values()]);
  const canonicalScale = frameSz / Math.max(template.previewWidth, template.previewHeight);

  for (const visual of canonicalScene.visuals) {
    const key = `visual:${entity.id}:${visual.id}`;
    const buf = rasterizedImages[key];
    if (!buf) continue;

    const localWidth = Math.max(1, Math.ceil(visual.localBounds.maxX - visual.localBounds.minX));
    const localHeight = Math.max(1, Math.ceil(visual.localBounds.maxY - visual.localBounds.minY));
    const bitmap = await loadPngBitmap(key, buf, localWidth, localHeight);
    if (!bitmap) continue;

    const [wa, wb, wc, wd, we, wf] = visual.worldMatrix;
    ctx.save();
    ctx.setTransform(
      canonicalScale * wa,
      canonicalScale * wb,
      canonicalScale * wc,
      canonicalScale * wd,
      canonicalScale * we + frameSz / 2,
      canonicalScale * wf + frameSz / 2,
    );
    ctx.drawImage(
      bitmap,
      visual.localBounds.minX,
      visual.localBounds.minY,
      visual.localBounds.maxX - visual.localBounds.minX,
      visual.localBounds.maxY - visual.localBounds.minY,
    );
    ctx.restore();
  }

  if (profile.outlinePadding > 0) {
    const p = profile.outlinePadding;
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth   = p;
    ctx.strokeRect(p / 2, p / 2, frameSz - p, frameSz - p);
  }

  return canvas.transferToImageBitmap();
  /*

  const fittingScale = frameSz / Math.max(template.previewWidth, template.previewHeight);
  const dw = template.previewWidth  * fittingScale;
  const dh = template.previewHeight * fittingScale;
  const dx = (frameSz - dw) / 2;
  const dy = (frameSz - dh) / 2;

  // Bone-local positioning params (Stage 3)
  const skelScale = frameSz / 220;
  const cx        = frameSz / 2;
  const cy        = frameSz / 2;
  const skeleton  = evaluateSkeleton(template.bones, pose);

  type DrawCall = { zIndex: number; draw: () => Promise<void> };
  const calls: DrawCall[] = [];

  if (template.boneParts && template.boneParts.length > 0) {
    // ── Stage 3: bone-local body parts ──────────────────────────────────────
    for (const part of template.boneParts) {
      const key = `part:${entity.id}:${part.id}`;
      const buf = rasterizedImages[key];
      if (!buf) continue;

      const wb = skeleton.bones.get(part.boneId);
      if (!wb) continue;

      const partW = Math.max(1, Math.ceil(part.naturalWidth  * skelScale));
      const partH = Math.max(1, Math.ceil(part.naturalHeight * skelScale));
      const bx    = cx + (wb.x + part.localX) * skelScale;
      const by    = cy + (wb.y + part.localY) * skelScale;
      const rot   = (wb.rotation * Math.PI) / 180;
      const zIdx  = part.zOffset;

      calls.push({
        zIndex: zIdx,
        draw: async () => {
          const bm = await loadPngBitmap(key, buf, partW, partH);
          if (!bm) return;
          ctx.save();
          ctx.translate(bx, by);
          ctx.rotate(rot);
          ctx.drawImage(bm, -partW / 2, -partH / 2, partW, partH);
          ctx.restore();
        },
      });
    }
  } else {
    // ── Legacy: full-frame base body layers ──────────────────────────────────
    for (const layer of template.baseBodyLayers) {
      const key = `base:${entity.id}:${layer.id}`;
      const buf = rasterizedImages[key];
      if (!buf) continue;

      calls.push({
        zIndex: (layer.zOffset ?? 0) - 1000,
        draw: async () => {
          const bm = await loadPngBitmap(key, buf, template.previewWidth, template.previewHeight);
          if (!bm) return;
          ctx.drawImage(bm, dx, dy, dw, dh);
        },
      });
    }
  }

  // ── Entity visuals (v2.0 EntityVisual imports, bone-local or full-frame) ──
  for (const visual of entity.visuals ?? []) {
    const key = `visual:${entity.id}:${visual.id}`;
    const buf = rasterizedImages[key];
    if (!buf) continue;

    const wb2  = skeleton.bones.get(visual.boneId);
    const boneM = wb2 ? worldBoneToMatrix(wb2) : identity();
    const lt   = visual.localTransform;
    const piv  = visual.pivot;
    const localM = localTransformToMatrix(
      lt.x, lt.y, lt.rotation, lt.scaleX, lt.scaleY, piv.x, piv.y,
    );
    const [wa, wbr, wc, wd, we, wf] = multiply(boneM, localM);

    const vw   = visual.metrics.visualWidth;
    const vh_  = visual.metrics.visualHeight;
    const pxW  = Math.max(1, Math.ceil(vw  * fittingScale));
    const pxH  = Math.max(1, Math.ceil(vh_ * fittingScale));
    const zIdx = visual.zIndex;

    calls.push({
      zIndex: zIdx,
      draw: async () => {
        const bm = await loadPngBitmap(key, buf, pxW, pxH);
        if (!bm) return;
        ctx.save();
        ctx.setTransform(
          fittingScale * wa,  fittingScale * wbr,
          fittingScale * wc,  fittingScale * wd,
          fittingScale * we + cx, fittingScale * wf + cy,
        );
        ctx.drawImage(bm, -vw / 2, -vh_ / 2, vw, vh_);
        ctx.restore();
      },
    });
  }

  // ── Item layers (always full-frame) ──────────────────────────────────────
  for (const slotAssign of entity.slots) {
    if (!slotAssign.itemId) continue;
    const item    = itemsMap.get(slotAssign.itemId);
    if (!item)    continue;
    const slotDef = template.slots.find(s => s.id === slotAssign.slotId);
    if (!slotDef) continue;

    for (let li = 0; li < item.svgLayers.length; li++) {
      const svgLayer = item.svgLayers[li];
      const key = `slot:${entity.id}:${slotAssign.slotId}:${li}`;
      const buf = rasterizedImages[key];
      if (!buf) continue;

      const zIndex = (slotDef.zIndex ?? 1) + (svgLayer.zOffset ?? 0);
      calls.push({
        zIndex,
        draw: async () => {
          const bm = await loadPngBitmap(key, buf, template.previewWidth, template.previewHeight);
          if (!bm) return;
          ctx.drawImage(bm, dx, dy, dw, dh);
        },
      });
    }
  }

  calls.sort((a, b) => a.zIndex - b.zIndex);
  for (const c of calls) await c.draw();

  if (profile.outlinePadding > 0) {
    const p = profile.outlinePadding;
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth   = p;
    ctx.strokeRect(p / 2, p / 2, frameSz - p, frameSz - p);
  }

  return canvas.transferToImageBitmap();
*/
}

// ── Blob helpers ──────────────────────────────────────────────────────────────

async function sheetToBlob(
  sheet: OffscreenCanvas,
  format: "image/png" | "image/webp" | "image/jpeg",
  quality?: number
): Promise<Blob> {
  return await sheet.convertToBlob({ type: format, quality });
}

async function blobToU8(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

function guessMime(filename: string): string {
  if (filename.endsWith(".json"))                    return "application/json";
  if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) return "image/jpeg";
  if (filename.endsWith(".png"))                     return "image/png";
  if (filename.endsWith(".webp"))                    return "image/webp";
  if (filename.endsWith(".svg"))                     return "image/svg+xml";
  return "application/octet-stream";
}

// ── Entity-level export (per_entity mode) ─────────────────────────────────────

async function exportEntity(
  entity: Entity,
  templates: Template[],
  itemsMap: Map<string, Item>,
  rasterizedImages: Record<string, ArrayBuffer>,
  allClips: AnimationClip[],
  profile: ExportProfile,
  entityIdx: number,
  totalEntities: number,
  onProgress: (pct: number, msg: string) => void,
  selectedClipIds?: string[]
): Promise<Record<string, Uint8Array>> {
  const template = templates.find(t => t.id === entity.templateId);
  if (!template) throw new Error(`Template ${entity.templateId} not found`);

  const frameSz    = parseInt(profile.frameSizeKey, 10);
  const files: Record<string, Uint8Array> = {};
  const entitySlug = entity.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
  const entityBase = entitySlug;

  if (profile.formats.includes("entity_json")) {
    const json = JSON.stringify(
      { ...entity, _exportedBy: "Asset Composer", _exportedAt: new Date().toISOString() },
      null, 2
    );
    files[`${entityBase}/${entitySlug}.entity.json`] = strToU8(json);
    onProgress(0.02 + entityIdx / totalEntities, `${entity.name}: entity JSON`);
  }

  const needsRendering = profile.formats.some(f =>
    ["png_sheet", "webp_sheet", "frame_sequence", "jpeg_preview"].includes(f)
  );
  if (!needsRendering) return files;

  const entityClips = allClips.filter(c =>
    c.skeletonFamily === template.skeletonFamily &&
    (!selectedClipIds?.length || selectedClipIds.includes(c.id))
  );
  const renderedFrames: { frameName: string; bitmap: ImageBitmap; clipName: string }[] = [];
  const frameSeqFiles: Record<string, Uint8Array> = {};

  let clipsDone = 0;
  for (const clip of entityClips) {
    const fps         = Math.max(1, clip.fps);
    const totalFrames = Math.max(1, Math.ceil((clip.durationMs / 1000) * fps));

    for (let fi = 0; fi < totalFrames; fi++) {
      const timeMs    = (fi / fps) * 1000;
      const pose      = resolveClipPose(clip, timeMs);
      const frameName = formatFrameName(profile.namingTemplate, {
        entity: entity.name, animation: clip.name, frame: fi,
      });

      const bitmap = await renderFrame(
        entity, template, itemsMap, rasterizedImages, pose, frameSz, profile
      );
      renderedFrames.push({ frameName, bitmap, clipName: clip.name });

      if (profile.formats.includes("frame_sequence")) {
        const seq  = new OffscreenCanvas(frameSz, frameSz);
        seq.getContext("2d")!.drawImage(bitmap, 0, 0);
        const blob = await seq.convertToBlob({ type: "image/png" });
        frameSeqFiles[`${entityBase}/frames/${frameName}.png`] = await blobToU8(blob);
      }
    }

    clipsDone++;
    const basePct = entityIdx / totalEntities;
    const clipPct = clipsDone / Math.max(1, entityClips.length);
    onProgress(basePct + clipPct * 0.7 / totalEntities, `${entity.name}: ${clip.name}`);
  }

  // Fallback: rest-pose frame when no clips matched
  if (renderedFrames.length === 0) {
    const frameName = formatFrameName(profile.namingTemplate, {
      entity: entity.name, animation: "idle", frame: 0,
    });
    const bitmap = await renderFrame(
      entity, template, itemsMap, rasterizedImages, new Map(), frameSz, profile
    );
    renderedFrames.push({ frameName, bitmap, clipName: "idle" });
  }

  if (profile.formats.includes("jpeg_preview")) {
    const prev = new OffscreenCanvas(frameSz, frameSz);
    prev.getContext("2d")!.drawImage(renderedFrames[0].bitmap, 0, 0);
    const blob = await prev.convertToBlob({ type: "image/jpeg", quality: 0.9 });
    files[`${entityBase}/${entitySlug}_preview.jpg`] = await blobToU8(blob);
    onProgress(0.8 + entityIdx / totalEntities, `${entity.name}: JPEG preview`);
  }

  for (const [k, v] of Object.entries(frameSeqFiles)) files[k] = v;

  const needsSheet = profile.formats.some(f => ["png_sheet", "webp_sheet"].includes(f));
  if (needsSheet && renderedFrames.length > 0) {
    const { sheet, regions, sheetW, sheetH } = packSprites(renderedFrames, frameSz);

    const atlasJson  = buildAtlasJson({
      regions,
      clips:       entityClips,
      entity,
      sheetW, sheetH,
      imageName:   `${entitySlug}.png`,
      pivotPolicy: profile.pivotPolicy,
    });
    const phaserJson = buildPhaserAtlasJson(atlasJson);

    files[`${entityBase}/${entitySlug}.atlas.json`]  = strToU8(JSON.stringify(atlasJson, null, 2));
    files[`${entityBase}/${entitySlug}.phaser.json`] = strToU8(JSON.stringify(phaserJson, null, 2));

    if (profile.formats.includes("png_sheet")) {
      const blob = await sheetToBlob(sheet, "image/png");
      files[`${entityBase}/${entitySlug}.png`] = await blobToU8(blob);
    }
    if (profile.formats.includes("webp_sheet")) {
      const blob = await sheetToBlob(sheet, "image/webp", 0.92);
      files[`${entityBase}/${entitySlug}.webp`] = await blobToU8(blob);
    }

    onProgress(0.9 + entityIdx / totalEntities, `${entity.name}: packing sheet`);
  }

  for (const { bitmap } of renderedFrames) bitmap.close();
  return files;
}

// ── Combined multi-entity atlas ───────────────────────────────────────────────

async function exportCombined(
  job: ExportWorkerJob,
  itemsMap: Map<string, Item>,
  onProgress: (pct: number, msg: string) => void
): Promise<Record<string, Uint8Array>> {
  const { entities, templates, animationClips, profile, rasterizedImages } = job;
  const frameSz = parseInt(profile.frameSizeKey, 10);
  const files: Record<string, Uint8Array> = {};

  for (const entity of entities) {
    const template   = templates.find(t => t.id === entity.templateId);
    const entitySlug = entity.name.toLowerCase().replace(/[^a-z0-9]/g, "_");

    if (profile.formats.includes("entity_json")) {
      const json = JSON.stringify(
        { ...entity, _exportedBy: "Asset Composer", _exportedAt: new Date().toISOString() },
        null, 2
      );
      files[`combined/${entitySlug}.entity.json`] = strToU8(json);
    }

    if (!template) continue;

    const entityClips = animationClips.filter(c =>
      c.skeletonFamily === template.skeletonFamily &&
      (!job.selectedClipIds?.length || job.selectedClipIds.includes(c.id))
    );

    if (profile.formats.includes("jpeg_preview") || profile.formats.includes("frame_sequence")) {
      let firstBitmap: ImageBitmap | null = null;

      for (const clip of entityClips) {
        const fps         = Math.max(1, clip.fps);
        const totalFrames = Math.max(1, Math.ceil((clip.durationMs / 1000) * fps));

        for (let fi = 0; fi < totalFrames; fi++) {
          const timeMs    = (fi / fps) * 1000;
          const pose      = resolveClipPose(clip, timeMs);
          const frameName = formatFrameName(profile.namingTemplate, {
            entity: entity.name, animation: clip.name, frame: fi,
          });

          const bitmap = await renderFrame(entity, template, itemsMap, rasterizedImages, pose, frameSz, profile);
          if (!firstBitmap) firstBitmap = bitmap;

          if (profile.formats.includes("frame_sequence")) {
            const seq  = new OffscreenCanvas(frameSz, frameSz);
            seq.getContext("2d")!.drawImage(bitmap, 0, 0);
            const blob = await seq.convertToBlob({ type: "image/png" });
            files[`combined/frames/${entitySlug}/${frameName}.png`] = await blobToU8(blob);
          }

          if (bitmap !== firstBitmap) bitmap.close();
        }
      }

      if (profile.formats.includes("jpeg_preview") && firstBitmap) {
        const prev = new OffscreenCanvas(frameSz, frameSz);
        prev.getContext("2d")!.drawImage(firstBitmap, 0, 0);
        const blob = await prev.convertToBlob({ type: "image/jpeg", quality: 0.9 });
        files[`combined/${entitySlug}_preview.jpg`] = await blobToU8(blob);
        firstBitmap.close();
      }
    }
  }

  const allRendered: { frameName: string; bitmap: ImageBitmap }[] = [];
  const allClipsUsed = new Set<AnimationClip>();

  for (let ei = 0; ei < entities.length; ei++) {
    const entity   = entities[ei];
    const template = templates.find(t => t.id === entity.templateId);
    if (!template) continue;

    const entityClips = animationClips.filter(c =>
      c.skeletonFamily === template.skeletonFamily &&
      (!job.selectedClipIds?.length || job.selectedClipIds.includes(c.id))
    );
    for (const clip of entityClips) allClipsUsed.add(clip);

    for (const clip of entityClips) {
      const fps         = Math.max(1, clip.fps);
      const totalFrames = Math.max(1, Math.ceil((clip.durationMs / 1000) * fps));

      for (let fi = 0; fi < totalFrames; fi++) {
        const timeMs    = (fi / fps) * 1000;
        const pose      = resolveClipPose(clip, timeMs);
        const frameName = formatFrameName(profile.namingTemplate, {
          entity: `${entity.id}_${entity.name}`, animation: clip.name, frame: fi,
        });
        const bitmap = await renderFrame(entity, template, itemsMap, rasterizedImages, pose, frameSz, profile);
        allRendered.push({ frameName, bitmap });
      }
    }

    onProgress(0.1 + (ei + 1) / entities.length * 0.7, `Rendered: ${entity.name}`);
  }

  if (allRendered.length > 0 && profile.formats.some(f => ["png_sheet", "webp_sheet"].includes(f))) {
    const { sheet, regions, sheetW, sheetH } = packSprites(allRendered, frameSz);
    const combinedEntity = entities[0];

    const atlasJson = buildAtlasJson({
      regions,
      clips:       Array.from(allClipsUsed),
      entity:      combinedEntity,
      sheetW, sheetH,
      imageName:   "combined.png",
      pivotPolicy: profile.pivotPolicy,
    });

    files["combined/combined.atlas.json"]  = strToU8(JSON.stringify(atlasJson, null, 2));
    files["combined/combined.phaser.json"] = strToU8(JSON.stringify(buildPhaserAtlasJson(atlasJson), null, 2));

    if (profile.formats.includes("png_sheet")) {
      const blob = await sheetToBlob(sheet, "image/png");
      files["combined/combined.png"] = await blobToU8(blob);
    }
    if (profile.formats.includes("webp_sheet")) {
      const blob = await sheetToBlob(sheet, "image/webp", 0.92);
      files["combined/combined.webp"] = await blobToU8(blob);
    }
  }

  for (const { bitmap } of allRendered) bitmap.close();
  return files;
}

// ── Message handler ───────────────────────────────────────────────────────────

function post(msg: WorkerOutputMessage): void {
  self.postMessage(msg);
}

self.onmessage = async (e: MessageEvent<WorkerInputMessage>) => {
  if (e.data.type !== "start") return;
  const job = e.data.job;

  try {
    const canonicalItems = refreshCanonicalBuiltInTypedItems(job.items);
    const itemsMap = new Map(canonicalItems.map(i => [i.id, i]));

    const onProgress = (pct: number, msg: string) => {
      post({ type: "progress", pct: Math.min(pct, 0.99), msg });
    };

    let allFiles: Record<string, Uint8Array> = {};

    if (job.profile.atlasMode === "combined" && job.entities.length > 1) {
      onProgress(0, "Preparing combined export…");
      allFiles = await exportCombined(job, itemsMap, onProgress);
    } else {
      for (let ei = 0; ei < job.entities.length; ei++) {
        onProgress(ei / job.entities.length, `Exporting ${job.entities[ei].name}…`);
        const entityFiles = await exportEntity(
          job.entities[ei],
          job.templates,
          itemsMap,
          job.rasterizedImages,
          job.animationClips,
          job.profile,
          ei,
          job.entities.length,
          onProgress,
          job.selectedClipIds
        );
        Object.assign(allFiles, entityFiles);
      }
    }

    const svgParts = (job as unknown as { svgPartFiles?: Record<string, Uint8Array> }).svgPartFiles;
    if (svgParts) Object.assign(allFiles, svgParts);

    onProgress(0.99, "Assembling ZIP…");
    const zipData   = zipSync(allFiles, { level: 6 });
    const zipBuffer = zipData.buffer.slice(zipData.byteOffset, zipData.byteOffset + zipData.byteLength) as ArrayBuffer;
    const fileCount = Object.keys(allFiles).length;

    if (fileCount === 1) {
      const [filename, data] = Object.entries(allFiles)[0];
      const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
      post({
        type: "done",
        zipBuffer,
        fileCount: 1,
        singleFile: { filename, mimeType: guessMime(filename), buffer },
      });
    } else {
      post({ type: "done", zipBuffer, fileCount });
    }
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  } finally {
    bitmapCache.forEach(bm => bm.close());
    bitmapCache.clear();
  }
};
