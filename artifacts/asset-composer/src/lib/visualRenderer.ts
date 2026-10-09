import type {
  EvaluatedVisual,
  VisualContent,
  Matrix2D,
  VisualAsset,
} from "@/domain/types";
import {
  contentOf,
  contentUri,
  getVisualResources,
  resourceRevision,
} from "./visualContent";
import { inverse, multiply } from "./matrixUtils";
import { svgToDataUrl, scaleSvgToFit } from "./svgUtils";

const images = new Map<string, Promise<HTMLImageElement>>();
const live = new Map<string, HTMLCanvasElement>();
const surfaces = new Map<string, Promise<HTMLCanvasElement>>();
function hasLive(content: VisualContent): boolean {
  return content.kind === "raster"
    ? live.has(content.assetId)
    : content.kind === "composite"
      ? content.children.some((c) => hasLive(c.content))
      : false;
}
function cachedSurface(
  content: VisualContent,
  width: number,
  height: number,
  assets: Record<string, VisualAsset>,
) {
  if (hasLive(content)) return renderContent(content, width, height, assets);
  const key = JSON.stringify([
    content,
    width,
    height,
    resourceRevision(content, assets),
  ]);
  let pending = surfaces.get(key);
  if (!pending) {
    pending = renderContent(content, width, height, assets).catch((error) => {
      surfaces.delete(key);
      throw error;
    });
    if (surfaces.size >= 32) surfaces.delete(surfaces.keys().next().value!);
    surfaces.set(key, pending);
  }
  return pending;
}
export function setLiveRaster(id: string, canvas: HTMLCanvasElement | null) {
  if (canvas) live.set(id, canvas);
  else live.delete(id);
}
export function loadImage(uri: string): Promise<HTMLImageElement> {
  let p = images.get(uri);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => {
        images.delete(uri);
        reject(new Error("Cannot decode artwork"));
      };
      image.src = uri;
    });
    if (images.size > 128) images.delete(images.keys().next().value!);
    images.set(uri, p);
  }
  return p;
}
export async function renderContent(
  content: VisualContent,
  width: number,
  height: number,
  assets = getVisualResources().assets,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  const ctx = canvas.getContext("2d")!;
  if (content.kind === "composite") {
    ctx.scale(width / content.width, height / content.height);
    for (const child of content.children) {
      // Atlas windows magnify a small part of a large image. Keep the original
      // raster until the final draw instead of shrinking the entire atlas first.
      const image = child.content.kind === "raster"
        ? live.get(child.content.assetId) ?? await loadImage(contentUri(child.content, { assets, documents: [] }))
        : await renderContent(child.content, width, height, assets);
      ctx.save();
      ctx.transform(...child.matrix);
      ctx.globalAlpha = child.opacity;
      ctx.drawImage(image, 0, 0, content.width, content.height);
      ctx.restore();
    }
  } else {
    const source =
      content.kind === "raster" ? live.get(content.assetId) : undefined;
    const image =
      source ??
      (await loadImage(
        content.kind === "vector"
          ? svgToDataUrl(
              scaleSvgToFit(content.svgData, width, height, "v2_vector"),
            )
          : contentUri(content, { assets, documents: [] }),
      ));
    ctx.drawImage(image, 0, 0, width, height);
  }
  return canvas;
}
/** Affine map from a source UV triangle to the evaluated triangle. */
export function triangleMatrix(
  src: { x: number; y: number }[],
  dst: { x: number; y: number }[],
): Matrix2D | null {
  const a: Matrix2D = [
    src[1].x - src[0].x,
    src[1].y - src[0].y,
    src[2].x - src[0].x,
    src[2].y - src[0].y,
    src[0].x,
    src[0].y,
  ];
  if (Math.abs(a[0] * a[3] - a[1] * a[2]) < 1e-9) return null;
  const b: Matrix2D = [
    dst[1].x - dst[0].x,
    dst[1].y - dst[0].y,
    dst[2].x - dst[0].x,
    dst[2].y - dst[0].y,
    dst[0].x,
    dst[0].y,
  ];
  return multiply(b, inverse(a));
}
/** A setup or rigidly transformed mesh can be rendered as one exact image. */
function surfaceAffine(
  surface: NonNullable<EvaluatedVisual["surface"]>,
): Matrix2D | null {
  if (surface.clipToMesh) return null;
  const vertices = surface.vertices;
  for (let i = 0; i < surface.triangles.length; i += 3) {
    const p = surface.triangles.slice(i, i + 3).map((n) => vertices[n]);
    const matrix = triangleMatrix(
      p.map((v) => ({
        x: v.u * surface.sourceWidth,
        y: v.v * surface.sourceHeight,
      })),
      p,
    );
    if (!matrix) continue;
    return vertices.every(
      (v) =>
        Math.abs(
          matrix[0] * v.u * surface.sourceWidth +
            matrix[2] * v.v * surface.sourceHeight +
            matrix[4] -
            v.x,
        ) < 1e-5 &&
        Math.abs(
          matrix[1] * v.u * surface.sourceWidth +
            matrix[3] * v.v * surface.sourceHeight +
            matrix[5] -
            v.y,
        ) < 1e-5,
    )
      ? matrix
      : null;
  }
  return null;
}
const edgeCounts = new WeakMap<number[], Map<string, number>>();
/** Overlap internal clipping edges by half a pixel; outer silhouette edges stay exact. */
function triangleClip(
  vertices: { x: number; y: number }[],
  triangles: number[],
  index: number,
  margin: number,
) {
  let counts = edgeCounts.get(triangles);
  const key = (a: number, b: number) => (a < b ? a + "," + b : b + "," + a);
  if (!counts) {
    counts = new Map();
    for (let i = 0; i < triangles.length; i += 3)
      for (let j = 0; j < 3; j++) {
        const edge = key(triangles[i + j], triangles[i + ((j + 1) % 3)]);
        counts.set(edge, (counts.get(edge) ?? 0) + 1);
      }
    edgeCounts.set(triangles, counts);
  }
  const ids = triangles.slice(index, index + 3),
    p = ids.map((i) => vertices[i]),
    sign =
      (p[1].x - p[0].x) * (p[2].y - p[0].y) -
        (p[1].y - p[0].y) * (p[2].x - p[0].x) >=
      0
        ? 1
        : -1;
  const lines = p.map((a, j) => {
    const b = p[(j + 1) % 3],
      dx = b.x - a.x,
      dy = b.y - a.y,
      len = Math.hypot(dx, dy) || 1,
      amount = counts!.get(key(ids[j], ids[(j + 1) % 3])) === 2 ? margin : 0;
    return {
      x: a.x + (dy / len) * amount * sign,
      y: a.y - (dx / len) * amount * sign,
      dx,
      dy,
    };
  });
  return lines.map((b, i) => {
    const a = lines[(i + 2) % 3],
      den = a.dx * b.dy - a.dy * b.dx;
    if (Math.abs(den) < 1e-9) return p[i];
    const t = ((b.x - a.x) * b.dy - (b.y - a.y) * b.dx) / den;
    return { x: a.x + t * a.dx, y: a.y + t * a.dy };
  });
}
export async function drawVisual(
  ctx: CanvasRenderingContext2D,
  v: EvaluatedVisual,
): Promise<void> {
  const b = v.localBounds,
    w = v.surface?.sourceWidth ?? b.maxX - b.minX,
    h = v.surface?.sourceHeight ?? b.maxY - b.minY;
  if (w <= 0 || h <= 0) return;
  // Composite a translucent mesh once; overlapping triangle clips must not
  // apply layer opacity repeatedly along their shared edges.
  if (v.occlusionMasks?.length || (v.surface && (v.opacity ?? 1) < 1)) {
    const texture = await visualCanvas({ ...v, opacity: 1 });
    ctx.save();
    ctx.globalAlpha *= v.opacity ?? 1;
    ctx.imageSmoothingEnabled = v.sampling !== "pixel";
    ctx.transform(...v.worldMatrix);
    ctx.drawImage(texture, b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
    ctx.restore();
    return;
  }
  let content = contentOf(v);
  if (content.kind === "vector" && v.svgFitMode === "legacy_full_frame")
    content = {
      kind: "vector",
      svgData: scaleSvgToFit(content.svgData, w, h, "legacy_full_frame"),
    };
  // Rasterize vectors at the actual target density before masks/meshes bake
  // them into a bitmap. Enlarging a low-resolution source afterwards blurs it.
  const targetTransform = ctx.getTransform?.();
  const targetMatrix = targetTransform ? multiply([targetTransform.a,targetTransform.b,targetTransform.c,targetTransform.d,targetTransform.e,targetTransform.f],v.worldMatrix) : v.worldMatrix;
  const rasterScale = Math.max(1,Math.min(8,Math.ceil(Math.max(Math.hypot(targetMatrix[0],targetMatrix[1]),Math.hypot(targetMatrix[2],targetMatrix[3])) - 1e-6)));
  let source = await cachedSurface(
    content,
    w*rasterScale,
    h*rasterScale,
    v.assetResources ?? getVisualResources().assets,
  );
  if (v.tint) {
    const copy = document.createElement("canvas");
    copy.width = source.width;
    copy.height = source.height;
    copy.getContext("2d")!.drawImage(source, 0, 0);
    source = copy;
  }
  const sctx = source.getContext("2d")!;
  if (v.tint) {
    sctx.globalCompositeOperation = "source-in";
    sctx.fillStyle = v.tint;
    sctx.fillRect(0, 0, source.width, source.height);
  }
  ctx.save();
  ctx.globalAlpha *= v.opacity ?? 1;
  ctx.imageSmoothingEnabled = v.sampling !== "pixel";
  ctx.transform(...v.worldMatrix);
  const affine = v.surface ? surfaceAffine(v.surface) : null;
  if (affine) {
    ctx.transform(...affine);
    ctx.drawImage(source, 0, 0, w, h);
  } else if (v.surface) {
    const { vertices, triangles } = v.surface;
    for (let i = 0; i < triangles.length; i += 3) {
      const p = triangles.slice(i, i + 3).map((n) => vertices[n]);
      if (p.some((v) => !v)) continue;
      const m = triangleMatrix(
        p.map((v) => ({ x: v.u * w, y: v.v * h })),
        p,
      );
      if (!m) continue;
      const t = ctx.getTransform(),
        clip = triangleClip(
          vertices,
          triangles,
          i,
          0.6 / Math.max(0.01, Math.hypot(t.a, t.b), Math.hypot(t.c, t.d)),
        );
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(clip[0].x, clip[0].y);
      ctx.lineTo(clip[1].x, clip[1].y);
      ctx.lineTo(clip[2].x, clip[2].y);
      ctx.closePath();
      ctx.clip();
      ctx.transform(...m);
      ctx.drawImage(source, 0, 0, w, h);
      ctx.restore();
    }
  } else ctx.drawImage(source, b.minX, b.minY, w, h);
  ctx.restore();
}
const esc = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
/** Share bitmap bytes across body parts, alpha masks and review cells. */
export function createSvgAssetRegistry(prefix = "artwork") {
  const ids = new Map<string, string>();
  let serial = 0;
  return {
    uniqueId(base: string) { return `${prefix.replace(/[^a-zA-Z0-9_]/g, "_")}_${base}_${serial++}`; },
    reference(uri: string) {
      let id = ids.get(uri);
      if (!id) { id = `${prefix}_${ids.size}`; ids.set(uri, id); }
      return id;
    },
    definitions() {
      return `<defs>${Array.from(ids, ([uri, id]) => `<image id="${id}" width="1" height="1" preserveAspectRatio="none" href="${esc(uri)}"/>`).join("")}</defs>`;
    },
  };
}
export type SvgAssetRegistry = ReturnType<typeof createSvgAssetRegistry>;
export function contentSvg(
  content: VisualContent,
  width: number,
  height: number,
  assets = getVisualResources().assets,
  registry?: SvgAssetRegistry,
): string {
  if (content.kind === "composite")
    return (
      '<svg width="' + width + '" height="' + height +
      '" viewBox="0 0 ' + content.width + ' ' + content.height +
      '" preserveAspectRatio="none" overflow="hidden">' +
      content.children
        .map(
          (c) =>
            '<g opacity="' +
            c.opacity +
            '" transform="matrix(' +
            c.matrix.join(" ") +
            ')">' +
            contentSvg(c.content, content.width, content.height, assets, registry) +
            "</g>",
        )
        .join("") +
      "</svg>"
    );
  const uri =
    content.kind === "vector"
      ? svgToDataUrl(scaleSvgToFit(content.svgData, width, height, "v2_vector"))
      : contentUri(content, { assets, documents: [] });
  if (registry && content.kind === "raster") return `<svg width="${width}" height="${height}" viewBox="0 0 1 1" preserveAspectRatio="none"><use href="#${registry.reference(uri)}"/></svg>`;
  return (
    '<image width="' +
    width +
    '" height="' +
    height +
    '" preserveAspectRatio="none" href="' +
    esc(uri) +
    '"/>'
  );
}
export function visualSvg(v: EvaluatedVisual, pixelScale = 1, registry?: SvgAssetRegistry): string {
  const b = v.localBounds,
    w = v.surface?.sourceWidth ?? b.maxX - b.minX,
    h = v.surface?.sourceHeight ?? b.maxY - b.minY,
    art = contentSvg(
      v.svgFitMode === "legacy_full_frame" && contentOf(v).kind === "vector"
        ? {
            kind: "vector",
            svgData: scaleSvgToFit(
              (contentOf(v) as { svgData: string }).svgData,
              w,
              h,
              "legacy_full_frame",
            ),
          }
        : contentOf(v),
      w,
      h,
      v.assetResources ?? getVisualResources().assets,
      registry,
    ),
    id = registry?.uniqueId("v_" + v.id.replace(/[^a-zA-Z0-9_]/g, "_")) ?? "v_" + v.id.replace(/[^a-zA-Z0-9_]/g, "_");
  const filter = v.tint
    ? '<filter id="' +
      id +
      '_t" color-interpolation-filters="sRGB"><feFlood flood-color="' +
      esc(v.tint) +
      '"/><feComposite in2="SourceAlpha" operator="in"/></filter>'
    : "";
  let body =
    '<g transform="translate(' + b.minX + " " + b.minY + ')">' + art + "</g>";
  const affine = v.surface ? surfaceAffine(v.surface) : null;
  if (affine)
    body = '<g transform="matrix(' + affine.join(" ") + ')">' + art + "</g>";
  else if (v.surface)
    body = v.surface.triangles
      .reduce<string[]>((out, _, i, triangles) => {
        if (i % 3) return out;
        const p = triangles.slice(i, i + 3).map((n) => v.surface!.vertices[n]);
        const m = triangleMatrix(
          p.map((v) => ({ x: v.u * w, y: v.v * h })),
          p,
        );
        if (m)
          out.push(
            '<clipPath id="' +
              id +
              "_" +
              i +
              '" clipPathUnits="userSpaceOnUse"><path d="M' +
              triangleClip(
                v.surface!.vertices,
                triangles,
                i,
                0.6 /
                  Math.max(
                    0.01,
                    pixelScale * Math.hypot(v.worldMatrix[0], v.worldMatrix[1]),
                    pixelScale * Math.hypot(v.worldMatrix[2], v.worldMatrix[3]),
                  ),
              )
                .map((v) => v.x + " " + v.y)
                .join("L") +
              'Z"/></clipPath><g clip-path="url(#' +
              id +
              "_" +
              i +
              ')"><g transform="matrix(' +
              m.join(" ") +
              ')">' +
              '<use href="#' +
              id +
              '_art"/>' +
              "</g></g>",
          );
        return out;
      }, [])
      .join("");
  let maskDefinition = "";
  if (v.occlusionMasks?.length) {
    maskDefinition = `<defs><mask id="${id}_occlusion" maskUnits="userSpaceOnUse" x="${b.minX}" y="${b.minY}" width="${b.maxX-b.minX}" height="${b.maxY-b.minY}" style="mask-type:luminance"><rect x="${b.minX}" y="${b.minY}" width="${b.maxX-b.minX}" height="${b.maxY-b.minY}" fill="white"/>` +
      v.occlusionMasks.map((mask, index) => visualSvg({...mask, id: `${v.id}_mask_${index}`, tint: "#000000", opacity: 1, occlusionMasks: undefined, worldMatrix: multiply(inverse(v.worldMatrix), mask.worldMatrix)}, pixelScale, registry)).join("") + "</mask></defs>";
    body = `<g mask="url(#${id}_occlusion)">${body}</g>`;
  }
  return (
    filter + maskDefinition +
    (v.surface && !affine
      ? '<defs><g id="' + id + '_art">' + art + "</g></defs>"
      : "") +
    '<g opacity="' +
    (v.opacity ?? 1) +
    '" transform="matrix(' +
    v.worldMatrix.join(" ") +
    ')"' +
    (v.tint ? ' filter="url(#' + id + '_t)"' : "") +
    (v.sampling === "pixel" ? ' style="image-rendering:pixelated"' : "") +
    ">" +
    body +
    "</g>"
  );
}
export async function visualCanvas(
  v: EvaluatedVisual,
): Promise<HTMLCanvasElement> {
  const b = v.localBounds,
    canvas = document.createElement("canvas");
  const density = v.surface
    ? Math.max(1, Math.min(4,
        v.surface.sourceWidth / Math.max(1e-6, b.maxX - b.minX),
        v.surface.sourceHeight / Math.max(1e-6, b.maxY - b.minY)))
    : v.content?.kind === "composite" || v.occlusionMasks?.length || v.entityVisualId === "face__eyes" || v.entityVisualId === "face__mouth" ? 4 : 1;
  canvas.width = Math.max(2, Math.ceil((b.maxX - b.minX) * density));
  canvas.height = Math.max(2, Math.ceil((b.maxY - b.minY) * density));
  const ctx = canvas.getContext("2d")!;
  ctx.scale(canvas.width / Math.max(1e-6, b.maxX-b.minX), canvas.height / Math.max(1e-6, b.maxY-b.minY));
  ctx.translate(-b.minX, -b.minY);
  await drawVisual(ctx, { ...v, opacity: 1, occlusionMasks: undefined, worldMatrix: [1, 0, 0, 1, 0, 0] });
  ctx.globalCompositeOperation = "destination-out";
  for (const mask of v.occlusionMasks ?? []) {
    await drawVisual(ctx, {...mask, opacity: 1, occlusionMasks: undefined, worldMatrix: multiply(inverse(v.worldMatrix), mask.worldMatrix)});
  }
  ctx.globalCompositeOperation = "source-over";
  return canvas;
}
