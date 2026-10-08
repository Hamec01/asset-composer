import type {
  VisualContent,
  VisualAsset,
  SpriteEditorDocument,
  EvaluatedVisual,
} from "@/domain/types";
import { scaleSvgToFit, svgToDataUrl } from "./svgUtils";
import { inverse, multiply } from "./matrixUtils";

export interface VisualResources {
  assets: Record<string, VisualAsset>;
  documents: SpriteEditorDocument[];
}
let active: VisualResources = { assets: {}, documents: [] };
export const setVisualResources = (resources: VisualResources) => {
  active = resources;
};
export const getVisualResources = () => active;
/** Read legacy SVG at the compatibility boundary, without disguising raster art. */
export function vectorSource(value: {
  content?: VisualContent;
  svgData?: string;
}): string {
  return (
    value.svgData ??
    (value.content?.kind === "vector" ? value.content.svgData : "")
  );
}
export function contentOf(value: {
  content?: VisualContent;
  svgData?: string;
}): VisualContent {
  return value.content?.kind === "vector" && value.svgData !== undefined
    ? { kind: "vector", svgData: value.svgData }
    : (value.content ?? { kind: "vector", svgData: value.svgData ?? "" });
}
const revisions = new WeakMap<VisualAsset, string>();
export function resourceRevision(
  content: VisualContent,
  assets: Record<string, VisualAsset>,
): unknown {
  if (content.kind === "composite")
    return content.children.map((c) => resourceRevision(c.content, assets));
  if (content.kind !== "raster") return null;
  const asset = assets[content.assetId];
  if (!asset) return "missing:" + content.assetId;
  let revision = revisions.get(asset);
  if (!revision) {
    let hash = 2166136261;
    for (let i = 0; i < asset.dataUri.length; i++)
      hash = Math.imul(hash ^ asset.dataUri.charCodeAt(i), 16777619);
    revision = asset.id + ":" + asset.dataUri.length + ":" + (hash >>> 0);
    revisions.set(asset, revision);
  }
  return revision;
}
export function visualKey(v: EvaluatedVisual): string {
  if (!v.surface && !v.tint && !v.occlusionMasks?.length && (!v.content || v.content.kind === "vector"))
    return vectorSource(v);
  return JSON.stringify([
    v.content ?? v.svgData,
    v.surface,
    v.tint,
    v.opacity,
    v.localBounds,
    resourceRevision(contentOf(v), v.assetResources ?? active.assets),
    v.occlusionMasks?.map(mask => [visualKey(mask), multiply(inverse(v.worldMatrix), mask.worldMatrix).map(n => Math.round(n * 1e8) / 1e8)]),
  ]);
}
export function contentUri(content: VisualContent, resources = active): string {
  if (content.kind === "vector") return svgToDataUrl(content.svgData);
  if (content.kind === "raster") {
    const asset = resources.assets[content.assetId];
    if (!asset) throw new Error("Missing visual asset: " + content.assetId);
    return asset.dataUri;
  }
  throw new Error("Document content must be evaluated before rendering");
}
export async function loadVisualImage(
  v: EvaluatedVisual,
): Promise<HTMLImageElement> {
  const content = contentOf(v),
    b = v.localBounds;
  const uri =
    content.kind === "vector"
      ? svgToDataUrl(
          scaleSvgToFit(
            content.svgData,
            Math.max(2, b.maxX - b.minX),
            Math.max(2, b.maxY - b.minY),
            v.svgFitMode ?? "v2_vector",
          ),
        )
      : contentUri(content);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image decode failed"));
    image.src = uri;
  });
}
export function makeRasterAsset(
  dataUri: string,
  width: number,
  height: number,
  name = "Artwork",
): VisualAsset {
  const mimeType = /^data:(image\/(?:png|webp|jpeg));/.exec(dataUri)?.[1] as
    | VisualAsset["mimeType"]
    | undefined;
  if (
    !mimeType ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    throw new Error("Invalid raster resource");
  let hash = 2166136261;
  for (let i = 0; i < dataUri.length; i++)
    hash = Math.imul(hash ^ dataUri.charCodeAt(i), 16777619);
  let id =
    "raster_" +
    (hash >>> 0).toString(16) +
    "_" +
    dataUri.length +
    "_" +
    width +
    "x" +
    height;
  if (active.assets[id] && active.assets[id].dataUri !== dataUri)
    id += "_" + crypto.randomUUID();
  return { id, mimeType, width, height, name, dataUri };
}
