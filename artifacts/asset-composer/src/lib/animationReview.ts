import type { AnimationClip, Entity, Item, ItemFitProfile, Template } from "@/domain/types";
import { composeFrameSvg, evaluateExportScene, exportCamera } from "./exportFrames";
import { evaluateSkeleton } from "./evaluationPipeline";
import { ANATOMY_COLORS, DEFAULT_XRAY_OPTIONS, XRAY_PALETTE_VERSION, XRAY_UNSUPPORTED,
  evaluatePresentedScene, escapeSvgText, shoulderRoots, type AnimationXRayOptions } from "./animationXRay";
import { DEPTH_COLORS } from "./limbDepth";
import { validateAnimationDepth, validateHeadClearance } from "./headClearance";
import { armDiagnostics } from "./armDiagnostics";
import { strToU8, zipSync } from "fflate";
import { createSvgAssetRegistry } from "./visualRenderer";

export type ReviewMarker = NonNullable<AnimationClip["reviewMarkers"]>[number];
export const REVIEW_COLUMNS = [
  { mode: "normal", label: "NORMAL" }, { mode: "rig", label: "RIG COLORS" },
  { mode: "depth", label: "DEPTH COLORS" }, { mode: "skeleton", label: "SKELETON" },
] as const;

export function reviewMarkersFor(clip: AnimationClip): ReviewMarker[] {
  return clip.reviewMarkers?.length ? clip.reviewMarkers.map(m => ({ ...m })) : Array.from({ length: 6 }, (_, i) => {
    const timeMs = clip.durationMs * i / 5;
    return { label: `${Math.round(timeMs)} ms`, timeMs };
  });
}

export function validateReviewMarkers(markers: ReviewMarker[], durationMs: number): string | null {
  if (!markers.length) return "Add at least one review marker.";
  if (markers.some(m => !m.label.trim() || !Number.isFinite(m.timeMs) || m.timeMs < 0 || m.timeMs > durationMs)) {
    return "Every marker needs a name and a time between 0 and the clip duration.";
  }
  return null;
}

export interface AnimationReviewInput {
  entity: Entity;
  template: Template;
  clips: AnimationClip[];
  clip: AnimationClip;
  items: Item[];
  fitProfiles?: ItemFitProfile[];
  markers?: ReviewMarker[];
  options?: AnimationXRayOptions;
}

/** Pure entry point used by the editor and opt-in visual tests. No store/DOM/filesystem. */
export function buildAnimationReview(input: AnimationReviewInput) {
  const { entity, template, clips, clip, items, fitProfiles = [] } = input;
  // The explicitly supplied clip is authoritative, including unsaved authoring edits.
  const reviewClips = [...clips.filter(candidate => candidate.id !== clip.id), clip];
  const markers = (input.markers ?? reviewMarkersFor(clip)).map(m => ({ label: m.label.trim(), timeMs: m.timeMs })).sort((a, b) => a.timeMs - b.timeMs);
  const error = validateReviewMarkers(markers, clip.durationMs);
  if (error) throw new Error(error);
  const options = { ...DEFAULT_XRAY_OPTIONS, ...input.options, depthShading: true };
  const groups = (["right", "left"] as const).map(facing => {
    const subject = { ...entity, activeAnimationClipId: clip.id, appearance: { ...entity.appearance!, view: facing } };
    const rest = evaluateSkeleton(template.bones, new Map(), subject.bodyMorphs, subject.appearance);
    const rows = markers.map(marker => {
      const spec = { key: "review", clip, frame: marker.timeMs * clip.fps / 1000, timeMs: marker.timeMs };
      const normal = evaluateExportScene(subject, template, reviewClips, items, fitProfiles, spec);
      const scenes = REVIEW_COLUMNS.map(column => column.mode === "normal" ? normal
        : evaluatePresentedScene(subject, template, normal.skeleton, items, fitProfiles, { ...options, mode: column.mode }));
      if (scenes.some(scene => scene.presentation?.supported === false)) throw new Error(XRAY_UNSUPPORTED);
      const previous = evaluateExportScene(subject, template, reviewClips, items, fitProfiles,
        { ...spec, timeMs: Math.max(0, marker.timeMs - 1000 / Math.max(1, clip.fps)) });
      const bare = scenes[1];
      const describeVisuals = (scene: typeof normal) => scene.visuals.map(v => ({
        id: v.id, boneId: v.boneId, sourceKind: v.sourceKind, anatomicalBody: !!v.anatomicalBody,
        itemId: v.itemId, partId: v.partId, entityVisualId: v.entityVisualId,
        worldMatrix: v.worldMatrix, localBounds: v.localBounds, worldBounds: v.worldBounds,
        zIndex: v.zIndex, depth: v.renderDepth ?? null, occludedBy: v.occlusionMasks?.map(mask => ({id:mask.id,boneId:mask.boneId,worldMatrix:mask.worldMatrix})) ?? [],
      }));
      return { marker, scenes, diagnostics: {
        ...marker, frame: spec.frame, facing, joints: Object.fromEntries(normal.skeleton.bones),
        shoulders: shoulderRoots(normal), normalVisuals: describeVisuals(normal), anatomyVisuals: describeVisuals(bare),
        headClearance: validateHeadClearance(bare, clip, marker.timeMs),
        arms: armDiagnostics(clip, marker.timeMs, normal.skeleton, rest, previous.skeleton, facing === "left"),
      } };
    });
    return { facing, rows };
  });
  const camera = exportCamera(groups.flatMap(group => group.rows.flatMap(row => row.scenes)), .18);
  const size = 320, rowHeight = size + 36, header = 72, footer = 160;
  const width = size * REVIEW_COLUMNS.length, height = header + rowHeight * markers.length + footer;
  const anatomyLegend = Object.entries(ANATOMY_COLORS).map(([label, color], i) =>
    `<rect x="${16 + i * 175}" y="${height - 124}" width="12" height="12" fill="${color}" stroke="#DDD"/><text x="${34 + i * 175}" y="${height - 113}">${label}</text>`).join("");
  const depthLegend = Object.entries(DEPTH_COLORS).map(([label, color], i) =>
    `<rect x="${16 + (i % 5) * 250}" y="${height - 92 + Math.floor(i / 5) * 22}" width="12" height="12" fill="${color}"/><text x="${34 + (i % 5) * 250}" y="${height - 81 + Math.floor(i / 5) * 22}">${label}</text>`).join("");
  const sheets = groups.map(group => {
    const assets = createSvgAssetRegistry(`review_${group.facing}`);
    const title = `<text x="16" y="24" font-size="17">${escapeSvgText(clip.label)} · ${group.facing.toUpperCase()} · Animation X-Ray v${XRAY_PALETTE_VERSION}</text>`;
    const headings = REVIEW_COLUMNS.map((column, i) => `<text x="${i * size + size / 2}" y="54" text-anchor="middle" font-size="15">${column.label}</text>`).join("");
    const cells = group.rows.flatMap((row, rowIndex) => row.scenes.map((scene, columnIndex) => {
      const x = columnIndex * size, y = header + rowIndex * rowHeight;
      const frame = composeFrameSvg({...scene,visuals:scene.visuals.map(v=>({...v,id:`cell_${rowIndex}_${columnIndex}_${v.id}`}))}, camera, size, assets).replace("<svg ", `<svg x="${x}" y="${y}" `);
      const caption = `${row.marker.label} · ${Math.round(row.marker.timeMs)} ms`;
      return `<rect x="${x + 1}" y="${y}" width="${size - 2}" height="${rowHeight - 2}" fill="#303338"/>${frame}<text x="${x + size / 2}" y="${y + size + 22}" text-anchor="middle" font-size="13">${escapeSvgText(caption)}</text>`;
    })).join("");
    const footerText = `<text x="16" y="${height - 140}">L/R = anatomical side · N/F = near/far shoulder · SL/EL/HL, SR/ER/HR = shoulder/elbow/hand</text><text x="16" y="${height - 31}">Rig brightness: dark = FAR/behind · base = CROSS_BODY/BODY · bright = NEAR/FRONT · equipment: ${options.showEquipment ? "on" : "off"}</text><text x="16" y="${height - 12}">Review: Rig Colors → Depth → Skeleton → Normal → Accept. Colors show actual layers, not proof of correctness.</text>`;
    return { facing: group.facing, width, height, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${assets.definitions()}<rect width="100%" height="100%" fill="#252729"/><g font-family="sans-serif" fill="#E8E8EA" font-size="12">${title}${headings}${cells}${anatomyLegend}${depthLegend}${footerText}</g></svg>` };
  });
  const report = { formatVersion: 1, paletteVersion: XRAY_PALETTE_VERSION, anatomyColors: ANATOMY_COLORS, depthColors: DEPTH_COLORS,
    entityId: entity.id, templateId: template.id, clip: { id: clip.id, name: clip.name, durationMs: clip.durationMs, fps: clip.fps },
    markers, options, columns: REVIEW_COLUMNS, camera, warnings: validateAnimationDepth(clip),
    samples: groups.flatMap(group => group.rows.map(row => row.diagnostics)),
  };
  return { sheets, report };
}

export type ReviewPngRenderer = (svg: string, width: number, height: number) => Promise<Uint8Array>;

export const renderReviewPng: ReviewPngRenderer = (svg, width, height) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) { reject(new Error("Canvas 2D is unavailable")); return; }
    context.drawImage(image, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) reject(new Error("Failed to encode review PNG"));
      else blob.arrayBuffer().then(buffer => resolve(new Uint8Array(buffer)), reject);
    }, "image/png");
  };
  image.onerror = () => reject(new Error("Failed to rasterize animation review"));
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
});

/** Inject a PNG renderer for node/CI callers; the editor uses browser Canvas2D. */
export async function animationReviewArchive(review: ReturnType<typeof buildAnimationReview>, png: ReviewPngRenderer = renderReviewPng) {
  const files: Record<string, Uint8Array> = { "review.json": strToU8(JSON.stringify(review.report, null, 2)) };
  for (const sheet of review.sheets) {
    files[`review-${sheet.facing}.svg`] = strToU8(sheet.svg);
    files[`review-${sheet.facing}.png`] = await png(sheet.svg, sheet.width, sheet.height);
  }
  return zipSync(files, { level: 6 });
}
