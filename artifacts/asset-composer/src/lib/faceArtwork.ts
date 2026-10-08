import type {
  AABB,
  EvaluatedVisual,
  Matrix2D,
  VisualContent,
} from "@/domain/types";
import { transformAABB } from "./matrixUtils";
import type { VisualResources } from "./visualContent";
import { eyelidArt } from "./faceAnimation";

/** Separate upper/lower texture regions around the authored mouth seam. */
export function mouthArtworkVisuals(
  content: VisualContent,
  bounds: AABB,
  matrix: Matrix2D,
  id: string,
  zIndex: number,
  resources: VisualResources,
  opening: number,
): EvaluatedVisual[] {
  const base = faceArtworkVisuals(
    content,
    bounds,
    matrix,
    id,
    "mouth",
    zIndex,
    resources,
  )[0];
  const seam = 12.35,
    gap = Math.max(0, Math.min(1, opening)) * 2.2;
  const half = (upper: boolean): EvaluatedVisual => {
    const minY = upper ? bounds.minY : seam,
      maxY = upper ? seam : bounds.maxY,
      dy = upper ? -gap : gap;
    const vertex = (x: number, y: number) => ({
      x,
      y: y + dy,
      u: (x - bounds.minX) / (bounds.maxX - bounds.minX),
      v: (y - bounds.minY) / (bounds.maxY - bounds.minY),
    });
    return {
      ...base,
      id: id + (upper ? "_upper" : "_lower"),
      surface: {
        ...base.surface!,
        clipToMesh: true,
        vertices: [
          vertex(bounds.minX, minY),
          vertex(bounds.maxX, minY),
          vertex(bounds.maxX, maxY),
          vertex(bounds.minX, maxY),
        ],
        triangles: [0, 1, 2, 0, 2, 3],
      },
    };
  };
  const cavity: EvaluatedVisual = {
    ...base,
    id: id + "_cavity",
    surface: undefined,
    zIndex: zIndex - 0.001,
    opacity: gap > 0.02 ? 1 : 0,
    content: {
      kind: "vector",
      svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bounds.minX} ${bounds.minY} ${bounds.maxX - bounds.minX} ${bounds.maxY - bounds.minY}"><defs><clipPath id="${id}_opening"><ellipse cx="0" cy="${seam}" rx="3" ry="${gap + 0.1}"/></clipPath></defs><g clip-path="url(#${id}_opening)"><ellipse cx="0" cy="${seam}" rx="3" ry="${gap + 0.1}" fill="#593a38"/><ellipse cx="0" cy="${seam + gap}" rx="2" ry="${gap * 0.6}" fill="#d98b86"/></g></svg>`,
    },
  };
  return [cavity, half(true), half(false)];
}

/** Native artwork and UV clipping; no PNG-in-SVG intermediate representation. */
export function faceArtworkVisuals(
  content: VisualContent,
  bounds: AABB,
  matrix: Matrix2D,
  id: string,
  feature: string,
  zIndex: number,
  resources: VisualResources,
  openness?: number,
): EvaluatedVisual[] {
  const base: EvaluatedVisual = {
    id,
    content,
    worldMatrix: matrix,
    localBounds: bounds,
    worldBounds: transformAABB(matrix, bounds),
    zIndex,
    sourceKind: "entity-visual",
    entityVisualId: `face__${feature}`,
    boneId: "head",
    svgFitMode: "v2_vector",
    assetResources: resources.assets,
  };
  const asset =
    content.kind === "raster" ? resources.assets[content.assetId] : undefined;
  const width = asset?.width ?? 256,
    height = asset?.height ?? 256;
  const vertex = (x: number, y: number) => ({
    x,
    y,
    u: (x - bounds.minX) / (bounds.maxX - bounds.minX),
    v: (y - bounds.minY) / (bounds.maxY - bounds.minY),
  });
  const lid: EvaluatedVisual = {
    ...base,
    id: id + "_lid",
    opacity: openness !== undefined && openness < 0.999 ? 1 : 0,
    content: {
      kind: "vector",
      svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bounds.minX} ${bounds.minY} ${bounds.maxX - bounds.minX} ${bounds.maxY - bounds.minY}">${eyelidArt(openness ?? 1, "#493735")}</svg>`,
    },
  };
  if (openness === undefined || openness >= 0.999) {
    base.surface = {
      sourceWidth: width,
      sourceHeight: height,
      vertices: [
        vertex(bounds.minX, bounds.minY),
        vertex(bounds.maxX, bounds.minY),
        vertex(bounds.maxX, bounds.maxY),
        vertex(bounds.minX, bounds.maxY),
      ],
      triangles: [0, 1, 2, 0, 2, 3],
    };
    return openness === undefined ? [base] : [base, lid];
  }
  if (openness <= 0.025) {
    base.opacity = 0;
    base.surface = {
      sourceWidth: width,
      sourceHeight: height,
      vertices: [
        vertex(bounds.minX, bounds.minY),
        vertex(bounds.maxX, bounds.minY),
        vertex(bounds.maxX, bounds.maxY),
        vertex(bounds.minX, bounds.maxY),
      ],
      triangles: [0, 1, 2, 0, 2, 3],
    };
    return [base, lid];
  }
  const vertices = [vertex(0, 4)];
  for (const side of [-1, 1])
    for (let step = 0; step < 12; step++) {
      const t = step / 12,
        x = side * (3.8 - 7.6 * t),
        y = 4 + side * 14 * openness * t * (1 - t);
      vertices.push(vertex(x, y));
    }
  const triangles: number[] = [];
  for (let i = 1; i < vertices.length; i++)
    triangles.push(0, i, i === vertices.length - 1 ? 1 : i + 1);
  base.surface = {
    sourceWidth: width,
    sourceHeight: height,
    vertices,
    triangles,
    clipToMesh: true,
  };
  return [base, lid];
}
