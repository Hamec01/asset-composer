import type {
  SpriteEditorDocument,
  SpriteEditorLayer,
  VisualContent,
  EvaluatedVisual,
  Matrix2D,
} from "@/domain/types";
import type { EvaluatedSkeleton } from "./evaluationPipeline";
import { spriteEditorDocumentToSvg } from "./spriteEditor";
import {
  identity,
  multiply,
  inverse,
  worldBoneToMatrix,
  localTransformToMatrix,
  transformAABB,
} from "./matrixUtils";
import { skinVertices } from "./skinning";
import { getVisualResources, type VisualResources } from "./visualContent";

export const layerMatrix = (l: SpriteEditorLayer): Matrix2D =>
  l.transform
    ? localTransformToMatrix(
        l.transform.x,
        l.transform.y,
        l.transform.rotation,
        l.transform.scaleX,
        l.transform.scaleY,
      )
    : identity();
export function layerSetupMatrix(
  doc: SpriteEditorDocument,
  layer: SpriteEditorLayer,
): Matrix2D {
  const seen = new Set<string>();
  let result = layerMatrix(layer),
    parent = layer.parentId;
  while (parent) {
    if (seen.has(parent)) throw new Error("Layer hierarchy cycle");
    seen.add(parent);
    const p = doc.layers.find((l) => l.id === parent);
    if (!p) throw new Error("Missing layer parent");
    result = multiply(layerMatrix(p), result);
    parent = p.parentId;
  }
  return result;
}
export function artLayerContent(
  doc: SpriteEditorDocument,
  layer: SpriteEditorLayer,
): VisualContent {
  if (layer.kind === "raster") {
    if (!layer.assetId) throw new Error("Raster layer has no asset");
    return { kind: "raster", assetId: layer.assetId };
  }
  if (layer.kind === "group")
    return {
      kind: "composite",
      width: doc.width,
      height: doc.height,
      children: doc.layers
        .filter((l) => l.parentId === layer.id && l.visible)
        .sort((a, b) => a.zIndex - b.zIndex)
        .map((l) => ({
          content: artLayerContent(doc, l),
          matrix: layerMatrix(l),
          opacity: l.opacity ?? 1,
        })),
    };
  if (layer.sourceSvg) {
    const source: VisualContent = { kind: "vector", svgData: layer.sourceSvg };
    if (!layer.shapes.length) return source;
    return {
      kind: "composite",
      width: doc.width,
      height: doc.height,
      children: [
        { content: source, matrix: identity(), opacity: 1 },
        {
          content: artLayerContent(doc, { ...layer, sourceSvg: undefined }),
          matrix: identity(),
          opacity: 1,
        },
      ],
    };
  }
  return {
    kind: "vector",
    svgData: spriteEditorDocumentToSvg({
      ...doc,
      referenceAsset: null,
      tracingAsset: null,
      layers: [{ ...layer, opacity: 1 }],
    }),
  };
}
export function evaluateArtDocument(
  documentId: string,
  skeleton: EvaluatedSkeleton,
  prefix: string,
  nodeId?: string,
  resources: VisualResources = getVisualResources(),
  rootMatrix: Matrix2D = identity(),
): EvaluatedVisual[] {
  const doc = resources.documents.find((d) => d.id === documentId);
  if (!doc) throw new Error("Missing art document: " + documentId);
  const result: EvaluatedVisual[] = [];
  const visit = (
    layer: SpriteEditorLayer,
    inherited?: SpriteEditorLayer["binding"],
    opacity = 1,
  ) => {
    if (!layer.visible) return;
    const binding = layer.binding ?? inherited;
    const children = doc.layers
      .filter((l) => l.parentId === layer.id)
      .sort((a, b) => a.zIndex - b.zIndex);
    const hasBoundDescendant = (l: SpriteEditorLayer): boolean =>
      doc.layers.some(
        (c) => c.parentId === l.id && (!!c.binding || hasBoundDescendant(c)),
      );
    if (layer.kind === "group" && hasBoundDescendant(layer)) {
      children.forEach((c) =>
        visit(c, binding, opacity * (layer.opacity ?? 1)),
      );
      return;
    }
    const setup = layerSetupMatrix(doc, layer);
    const bone = binding ? skeleton.bones.get(binding.boneId) : undefined;
    const delta =
      binding && bone
        ? multiply(worldBoneToMatrix(bone), inverse(binding.bindMatrix))
        : identity();
    const worldMatrix = binding?.setupMatrix
        ? multiply(delta, multiply(binding.setupMatrix, setup))
        : multiply(rootMatrix, multiply(delta, setup)),
      localBounds = { minX: 0, minY: 0, maxX: doc.width, maxY: doc.height };
    const visual: EvaluatedVisual = {
      id: prefix + "__" + layer.id,
      content: artLayerContent(doc, layer),
      zIndex: layer.zIndex,
      worldMatrix,
      localBounds,
      worldBounds: transformAABB(worldMatrix, localBounds),
      sourceKind: "entity-visual",
      boneId: layer.anatomicalOwner ?? binding?.boneId,
      depthBinding: layer.depthBinding,
      anatomicalBody: !!layer.anatomicalOwner,
      opacity: opacity * (layer.opacity ?? 1),
      sampling: layer.sampling ?? doc.sampling ?? "smooth",
      svgFitMode: "v2_vector",
    };
    if (binding?.mode === "weighted") {
      const matrices = new Map(
        [...skeleton.bones].map(([id, b]) => [id, worldBoneToMatrix(b)]),
      );
      const vertices = skinVertices(
        { ...binding.mesh, paths: [] },
        matrices,
      ).map((p, i) => ({
        ...p,
        u: binding.mesh.vertices[i].u,
        v: binding.mesh.vertices[i].v,
        weights: binding.mesh.vertices[i].weights,
      }));
      visual.surface = {
        vertices,
        triangles: binding.mesh.triangles,
        sourceWidth: doc.width,
        sourceHeight: doc.height,
      };
      visual.worldMatrix = binding.setupMatrix ? identity() : rootMatrix;
      visual.worldBounds = {
        minX: Math.min(...vertices.map((p) => p.x)),
        minY: Math.min(...vertices.map((p) => p.y)),
        maxX: Math.max(...vertices.map((p) => p.x)),
        maxY: Math.max(...vertices.map((p) => p.y)),
      };
      visual.localBounds = visual.worldBounds;
      visual.worldBounds = transformAABB(
        visual.worldMatrix,
        visual.localBounds,
      );
    }
    result.push(visual);
  };
  doc.layers
    .filter((l) => (nodeId ? l.id === nodeId : !l.parentId))
    .sort((a, b) => a.zIndex - b.zIndex)
    .forEach((l) => visit(l));
  return result;
}

/** Resolve editable art in setup coordinates for thumbnails and source previews. */
export function resolveArtworkContent(
  content: VisualContent,
  resources: VisualResources = getVisualResources(),
): VisualContent {
  if (content.kind !== "document") return content;
  const doc = resources.documents.find((d) => d.id === content.documentId);
  if (!doc) throw new Error("Missing artwork document");
  if (content.nodeId) {
    const layer = doc.layers.find((l) => l.id === content.nodeId);
    if (!layer) throw new Error("Missing artwork node");
    return artLayerContent(doc, layer);
  }
  return {
    kind: "composite",
    width: doc.width,
    height: doc.height,
    children: doc.layers
      .filter((l) => !l.parentId && l.visible)
      .sort((a, b) => a.zIndex - b.zIndex)
      .map((l) => ({
        content: artLayerContent(doc, l),
        matrix: layerMatrix(l),
        opacity: l.opacity ?? 1,
      })),
  };
}
