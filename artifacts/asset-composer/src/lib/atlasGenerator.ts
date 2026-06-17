import type { Entity, AnimationClip } from "@/domain/types";
import type {
  AtlasJson,
  AtlasFrameEntry,
  AtlasClipMeta,
  PhaserAtlasJson,
  FrameRegion,
} from "@/lib/exportTypes";
import { pivotForClipPolicy } from "@/lib/exportTypes";

export function buildAtlasJson(opts: {
  regions: Record<string, { x: number; y: number; w: number; h: number }>;
  clips: AnimationClip[];
  entity: Entity;
  sheetW: number;
  sheetH: number;
  imageName: string;
  pivotPolicy: "center" | "feet" | "per_animation";
}): AtlasJson {
  const { regions, clips, entity, sheetW, sheetH, imageName, pivotPolicy } = opts;

  const frames: Record<string, AtlasFrameEntry> = {};
  for (const [frameName, r] of Object.entries(regions)) {
    // For per_animation pivot, derive clip name from frame name if possible
    const clipName = clips.find(c => frameName.includes(`_${c.name.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}_`))?.name;
    const pivot = pivotForClipPolicy(pivotPolicy, clipName);
    frames[frameName] = {
      frame: { x: r.x, y: r.y, w: r.w, h: r.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: r.w, h: r.h },
      sourceSize: { w: r.w, h: r.h },
      pivot,
    };
  }

  // Build animations map: group frame names by clip
  const animations: Record<string, string[]> = {};
  const clipsMeta: Record<string, AtlasClipMeta> = {};

  for (const clip of clips) {
    const safeClipName = clip.name.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const matching = Object.keys(regions)
      .filter(k => k.includes(`_${safeClipName}_`) || k.endsWith(`_${safeClipName}`))
      .sort();

    if (matching.length > 0) {
      animations[clip.name] = matching;
    }

    // Always include timing metadata for all clips
    const fps    = Math.max(1, clip.fps);
    const frames_ = Math.max(1, Math.ceil((clip.durationMs / 1000) * fps));
    clipsMeta[clip.name] = {
      fps:        clip.fps,
      durationMs: clip.durationMs,
      loops:      clip.loops,
      frameCount: frames_,
      pivot:      pivotForClipPolicy(pivotPolicy, clip.name),
    };
  }

  return {
    frames,
    animations,
    clipsMeta,
    meta: {
      app:     "Asset Composer",
      version: "1.0",
      image:   imageName,
      format:  "RGBA8888",
      size:    { w: sheetW, h: sheetH },
      scale:   "1",
      entity:  { id: entity.id, name: entity.name },
      licenseMeta: {
        source:              entity.licenseMeta.source,
        author:              entity.licenseMeta.author,
        licenseType:         entity.licenseMeta.licenseType,
        aiGenerated:         entity.licenseMeta.aiGenerated,
        commercialUseAllowed: entity.licenseMeta.commercialUseAllowed,
        purchaseRef:         entity.licenseMeta.purchaseRef,
        derivativePolicy:    entity.licenseMeta.derivativePolicy,
      },
    },
  };
}

export function buildPhaserAtlasJson(atlasJson: AtlasJson): PhaserAtlasJson {
  const frames = Object.entries(atlasJson.frames).map(([filename, entry]) => ({
    filename,
    trimmed:           entry.trimmed,
    rotated:           entry.rotated,
    sourceSize:        entry.sourceSize,
    spriteSourceSize:  entry.spriteSourceSize,
    frame:             entry.frame,
    pivot:             entry.pivot,
  }));

  return {
    textures: [
      {
        image:      atlasJson.meta.image,
        format:     atlasJson.meta.format,
        size:       atlasJson.meta.size,
        scale:      1,
        frames,
        animations: atlasJson.animations,
      },
    ],
    meta: {
      app:       "Asset Composer / Phaser",
      version:   "1.0",
      clipsMeta: atlasJson.clipsMeta,
    },
  };
}

export function buildRegionMap(
  regions: Record<string, { x: number; y: number; w: number; h: number }>,
  pivotPolicy: "center" | "feet" | "per_animation"
): Record<string, FrameRegion> {
  const result: Record<string, FrameRegion> = {};
  for (const [k, r] of Object.entries(regions)) {
    result[k] = { ...r, pivot: pivotForClipPolicy(pivotPolicy) };
  }
  return result;
}
