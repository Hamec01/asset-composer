import type { Entity, Template, Item, AnimationClip, ExportProfile } from "@/domain/types";

export interface FrameRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  pivot: { x: number; y: number };
}

export interface AtlasFrameEntry {
  frame: { x: number; y: number; w: number; h: number };
  rotated: boolean;
  trimmed: boolean;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
  pivot: { x: number; y: number };
}

/** Per-clip timing data included in every atlas JSON output. */
export interface AtlasClipMeta {
  fps: number;
  durationMs: number;
  loops: boolean;
  frameCount: number;
  pivot: { x: number; y: number };
}

export interface AtlasJson {
  frames: Record<string, AtlasFrameEntry>;
  animations: Record<string, string[]>;
  /** Per-clip timing metadata for runtime playback (duration, FPS, loop flag). */
  clipsMeta: Record<string, AtlasClipMeta>;
  meta: {
    app: string;
    version: string;
    image: string;
    format: string;
    size: { w: number; h: number };
    scale: string;
    entity?: { id: string; name: string };
    licenseMeta?: Record<string, unknown>;
  };
}

export interface PhaserAtlasJson {
  textures: Array<{
    image: string;
    format: string;
    size: { w: number; h: number };
    scale: number;
    frames: Array<{
      filename: string;
      trimmed: boolean;
      rotated: boolean;
      sourceSize: { w: number; h: number };
      spriteSourceSize: { x: number; y: number; w: number; h: number };
      frame: { x: number; y: number; w: number; h: number };
      pivot: { x: number; y: number };
    }>;
    animations?: Record<string, string[]>;
  }>;
  meta: { app: string; version: string; clipsMeta?: Record<string, AtlasClipMeta> };
}

export interface ExportWorkerJob {
  entities: Entity[];
  templates: Template[];
  items: Item[];
  animationClips: AnimationClip[];
  profile: ExportProfile;
  /**
   * Pre-rasterized PNG images keyed by cache key (produced on the main thread).
   * Keys:  "base:{entityId}:{layerId}"  and  "slot:{entityId}:{slotId}"
   * This avoids SVG-in-createImageBitmap failures inside the Web Worker.
   */
  rasterizedImages: Record<string, ArrayBuffer>;
  /**
   * Clip IDs to include in the export. When absent/empty, all clips are included.
   * Allows the user to select a subset of animations to pack.
   */
  selectedClipIds?: string[];
}

export type WorkerOutputMessage =
  | { type: "progress"; pct: number; msg: string }
  | {
      type: "done";
      zipBuffer: ArrayBuffer;
      fileCount: number;
      /** Present when exactly one file was produced — allows direct (non-ZIP) download. */
      singleFile?: { filename: string; mimeType: string; buffer: ArrayBuffer };
    }
  | { type: "error"; message: string };

export type WorkerInputMessage =
  | { type: "start"; job: ExportWorkerJob };

export function formatFrameName(template: string, vars: {
  entity: string;
  animation: string;
  frame: number;
  slot?: string;
}): string {
  const safe = (s: string) => s.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  return template
    .replace(/\{entity\}/g, safe(vars.entity))
    .replace(/\{animation\}/g, safe(vars.animation))
    .replace(/\{slot\}/g, safe(vars.slot ?? ""))
    .replace(/\{frame:0?(\d+)d\}/g, (_m, width) =>
      String(vars.frame).padStart(parseInt(width, 10), "0")
    )
    .replace(/\{frame\}/g, String(vars.frame));
}

/**
 * Pivot point for a clip under the given policy.
 * For "per_animation", the clip name is used as a heuristic:
 *   - jump / fly / fall / air / leap / float → center (0.5, 0.5)
 *   - all others → feet (0.5, 0.85)
 */
export function pivotForClipPolicy(
  policy: ExportProfile["pivotPolicy"],
  clipName?: string
): { x: number; y: number } {
  if (policy === "center") return { x: 0.5, y: 0.5 };
  if (policy === "feet")   return { x: 0.5, y: 0.85 };
  // per_animation — heuristic
  const name = (clipName ?? "").toLowerCase();
  if (/\b(jump|fly|fall|air|leap|float)\b/.test(name)) return { x: 0.5, y: 0.5 };
  return { x: 0.5, y: 0.85 };
}

/** Convenience: pivot without a specific clip name. */
export function pivotForPolicy(
  policy: ExportProfile["pivotPolicy"]
): { x: number; y: number } {
  return pivotForClipPolicy(policy);
}
