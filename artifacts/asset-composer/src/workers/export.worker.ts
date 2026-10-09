/**
 * Export Web Worker — Sprite Sheet Packer & Atlas Pipeline
 *
 * Receives whole frames rendered on the main thread from the same evaluated
 * scene as the editor (see lib/exportFrames). The worker only composes
 * backgrounds/padding, packs sheets, encodes images and builds the ZIP.
 */

import { packSprites } from "@/lib/spritePacker";
import { buildAtlasJson, buildPhaserAtlasJson } from "@/lib/atlasGenerator";
import { exportSlug, formatFrameName } from "@/lib/exportTypes";
import { exportClipsFor, exportFramePlan } from "@/lib/exportFrames";
import { zipSync, strToU8 } from "fflate";
import type {
  ExportWorkerJob,
  WorkerOutputMessage,
  WorkerInputMessage,
} from "@/lib/exportTypes";
import type { AnimationClip, Entity, Template, ExportProfile } from "@/domain/types";

function renderFrame(frames: Record<string, ImageBitmap>, key: string, frameSz: number, profile: ExportProfile): ImageBitmap {
  const source = frames[key];
  if (!source) throw new Error(`Не подготовлен кадр экспорта: ${key}. Повторите экспорт.`);
  const canvas = new OffscreenCanvas(frameSz, frameSz);
  const ctx    = canvas.getContext("2d")!;
  if (profile.bgColor) {
    ctx.fillStyle = profile.bgColor;
    ctx.fillRect(0, 0, frameSz, frameSz);
  }
  ctx.drawImage(source, 0, 0, frameSz, frameSz);
  if (profile.outlinePadding > 0) {
    const p = profile.outlinePadding;
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth   = p;
    ctx.strokeRect(p / 2, p / 2, frameSz - p, frameSz - p);
  }
  return canvas.transferToImageBitmap();
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

async function encodeFrame(bitmap: ImageBitmap, frameSz: number, type: "image/png" | "image/jpeg"): Promise<Uint8Array> {
  const canvas = new OffscreenCanvas(frameSz, frameSz);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  return blobToU8(await canvas.convertToBlob(type === "image/jpeg" ? { type, quality: 0.9 } : { type }));
}

function guessMime(filename: string): string {
  if (filename.endsWith(".json"))                    return "application/json";
  if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) return "image/jpeg";
  if (filename.endsWith(".png"))                     return "image/png";
  if (filename.endsWith(".webp"))                    return "image/webp";
  if (filename.endsWith(".svg"))                     return "image/svg+xml";
  return "application/octet-stream";
}

const slugOf = (entity: Entity) => exportSlug(entity.name);
const needsFrames = (profile: ExportProfile) =>
  profile.formats.some(f => ["png_sheet", "webp_sheet", "frame_sequence", "jpeg_preview"].includes(f));
const needsSheet = (profile: ExportProfile) => profile.formats.some(f => ["png_sheet", "webp_sheet"].includes(f));
const entityJson = (entity: Entity) =>
  strToU8(JSON.stringify({ ...entity, _exportedBy: "Asset Composer", _exportedAt: new Date().toISOString() }, null, 2));

type Progress = (step: number, msg: string) => void;

// ── Entity-level export (per_entity mode) ─────────────────────────────────────

async function exportEntity(job: ExportWorkerJob, entity: Entity, template: Template, progress: Progress): Promise<Record<string, Uint8Array>> {
  const { profile } = job;
  const frameSz = parseInt(profile.frameSizeKey, 10);
  const files: Record<string, Uint8Array> = {};
  const slug = slugOf(entity);

  if (profile.formats.includes("entity_json")) files[`${slug}/${slug}.entity.json`] = entityJson(entity);
  if (!needsFrames(profile)) return files;

  const rendered: { frameName: string; bitmap: ImageBitmap }[] = [];
  for (const spec of exportFramePlan(entity, template, job.animationClips, job.selectedClipIds)) {
    const frameName = formatFrameName(profile.namingTemplate, { entity: entity.name, animation: spec.clip?.name ?? "idle", frame: spec.frame });
    const bitmap = renderFrame(job.frames, spec.key, frameSz, profile);
    rendered.push({ frameName, bitmap });
    if (profile.formats.includes("frame_sequence")) files[`${slug}/frames/${frameName}.png`] = await encodeFrame(bitmap, frameSz, "image/png");
    progress(1, `${entity.name}: ${frameName}`);
  }

  if (profile.formats.includes("jpeg_preview")) files[`${slug}/${slug}_preview.jpg`] = await encodeFrame(rendered[0].bitmap, frameSz, "image/jpeg");

  if (needsSheet(profile)) {
    progress(0, `${entity.name}: сборка листа`);
    const { sheet, regions, sheetW, sheetH } = packSprites(rendered, frameSz);
    const atlasJson = buildAtlasJson({
      regions, clips: exportClipsFor(template, job.animationClips, job.selectedClipIds), entity,
      sheetW, sheetH, imageName: `${slug}.png`, pivotPolicy: profile.pivotPolicy,
    });
    files[`${slug}/${slug}.atlas.json`]  = strToU8(JSON.stringify(atlasJson, null, 2));
    files[`${slug}/${slug}.phaser.json`] = strToU8(JSON.stringify(buildPhaserAtlasJson(atlasJson), null, 2));
    if (profile.formats.includes("png_sheet"))  files[`${slug}/${slug}.png`]  = await blobToU8(await sheetToBlob(sheet, "image/png"));
    if (profile.formats.includes("webp_sheet")) files[`${slug}/${slug}.webp`] = await blobToU8(await sheetToBlob(sheet, "image/webp", 0.92));
  }

  for (const { bitmap } of rendered) bitmap.close();
  return files;
}

// ── Combined multi-entity atlas ───────────────────────────────────────────────

async function exportCombined(job: ExportWorkerJob, progress: Progress): Promise<Record<string, Uint8Array>> {
  const { entities, templates, profile } = job;
  const frameSz = parseInt(profile.frameSizeKey, 10);
  const files: Record<string, Uint8Array> = {};
  const allRendered: { frameName: string; bitmap: ImageBitmap }[] = [];
  const allClipsUsed = new Set<AnimationClip>();

  for (const entity of entities) {
    const template = templates.find(t => t.id === entity.templateId);
    const slug = slugOf(entity);
    if (profile.formats.includes("entity_json")) files[`combined/${slug}.entity.json`] = entityJson(entity);
    if (!template || !needsFrames(profile)) continue;
    for (const clip of exportClipsFor(template, job.animationClips, job.selectedClipIds)) allClipsUsed.add(clip);

    let first = true;
    for (const spec of exportFramePlan(entity, template, job.animationClips, job.selectedClipIds)) {
      const animation = spec.clip?.name ?? "idle";
      const bitmap = renderFrame(job.frames, spec.key, frameSz, profile);
      if (profile.formats.includes("frame_sequence")) {
        const name = formatFrameName(profile.namingTemplate, { entity: entity.name, animation, frame: spec.frame });
        files[`combined/frames/${slug}/${name}.png`] = await encodeFrame(bitmap, frameSz, "image/png");
      }
      if (first && profile.formats.includes("jpeg_preview")) files[`combined/${slug}_preview.jpg`] = await encodeFrame(bitmap, frameSz, "image/jpeg");
      first = false;
      allRendered.push({ frameName: formatFrameName(profile.namingTemplate, { entity: `${entity.id}_${entity.name}`, animation, frame: spec.frame }), bitmap });
      progress(1, `${entity.name}: ${animation} ${spec.frame}`);
    }
  }

  if (allRendered.length > 0 && needsSheet(profile)) {
    progress(0, "Сборка общего листа…");
    const { sheet, regions, sheetW, sheetH } = packSprites(allRendered, frameSz);
    const atlasJson = buildAtlasJson({
      regions, clips: Array.from(allClipsUsed), entity: entities[0],
      sheetW, sheetH, imageName: "combined.png", pivotPolicy: profile.pivotPolicy,
    });
    files["combined/combined.atlas.json"]  = strToU8(JSON.stringify(atlasJson, null, 2));
    files["combined/combined.phaser.json"] = strToU8(JSON.stringify(buildPhaserAtlasJson(atlasJson), null, 2));
    if (profile.formats.includes("png_sheet"))  files["combined/combined.png"]  = await blobToU8(await sheetToBlob(sheet, "image/png"));
    if (profile.formats.includes("webp_sheet")) files["combined/combined.webp"] = await blobToU8(await sheetToBlob(sheet, "image/webp", 0.92));
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
    const total = Math.max(1, Object.keys(job.frames).length);
    let done = 0;
    // Frame-level progress: long exports must never look stalled.
    const progress: Progress = (step, msg) => {
      done += step;
      post({ type: "progress", pct: Math.min(done / total, 0.98), msg });
    };

    let allFiles: Record<string, Uint8Array> = {};
    if (job.profile.atlasMode === "combined" && job.entities.length > 1) {
      allFiles = await exportCombined(job, progress);
    } else {
      for (const entity of job.entities) {
        const template = job.templates.find(t => t.id === entity.templateId);
        if (!template) throw new Error(`Не найдена основа ${entity.templateId}. Откройте объект и проверьте проект.`);
        Object.assign(allFiles, await exportEntity(job, entity, template, progress));
      }
    }

    const svgParts = (job as unknown as { svgPartFiles?: Record<string, Uint8Array> }).svgPartFiles;
    if (svgParts) Object.assign(allFiles, svgParts);

    post({ type: "progress", pct: 0.99, msg: "Сборка ZIP…" });
    const zipData   = zipSync(allFiles, { level: 6 });
    const zipBuffer = zipData.buffer.slice(zipData.byteOffset, zipData.byteOffset + zipData.byteLength) as ArrayBuffer;
    const fileCount = Object.keys(allFiles).length;

    if (fileCount === 1) {
      const [filename, data] = Object.entries(allFiles)[0];
      const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
      post({ type: "done", zipBuffer, fileCount: 1, singleFile: { filename, mimeType: guessMime(filename), buffer } });
    } else {
      post({ type: "done", zipBuffer, fileCount });
    }
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  } finally {
    for (const bitmap of Object.values(job.frames)) bitmap.close();
  }
};
