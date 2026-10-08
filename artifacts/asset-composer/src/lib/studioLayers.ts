import { layerSetupMatrix } from "./artDocument";
import { identity, inverse, multiply, transformPoint } from "./matrixUtils";
import type { SpriteEditorDocument, SpriteEditorLayer } from "@/domain/types";
export function layerSubtree(
  doc: SpriteEditorDocument,
  id: string,
): SpriteEditorLayer[] {
  const layer = doc.layers.find((l) => l.id === id);
  if (!layer) return [];
  return [
    layer,
    ...doc.layers
      .filter((l) => l.parentId === id)
      .flatMap((l) => layerSubtree(doc, l.id)),
  ];
}
export function duplicateLayerTree(
  doc: SpriteEditorDocument,
  id: string,
): string {
  const source = layerSubtree(doc, id),
    ids = new Map(source.map((l) => [l.id, crypto.randomUUID()]));
  for (const node of source) {
    const copy = structuredClone(node);
    copy.id = ids.get(node.id)!;
    copy.parentId = ids.get(node.parentId ?? "") ?? node.parentId;
    if (node.id === id) {
      copy.name += " copy";
      copy.zIndex += 0.1;
    }
    doc.layers.push(copy);
  }
  return ids.get(id)!;
}
export function deleteLayerTree(doc: SpriteEditorDocument, id: string) {
  const ids = new Set(layerSubtree(doc, id).map((l) => l.id));
  doc.layers = doc.layers.filter((l) => !ids.has(l.id));
}
export function reorderLayer(
  doc: SpriteEditorDocument,
  id: string,
  direction: 1 | -1,
) {
  const layer = doc.layers.find((l) => l.id === id);
  if (!layer) return;
  const siblings = doc.layers
      .filter((l) => l.parentId === layer.parentId)
      .sort((a, b) => a.zIndex - b.zIndex),
    i = siblings.indexOf(layer),
    j = i + direction;
  if (j < 0 || j >= siblings.length) return;
  [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
  siblings.forEach((l, n) => (l.zIndex = n));
}

/** Apply setup transforms to every descendant surface, including during a drag. */
export function transformedArtwork(
  doc: SpriteEditorDocument,
  layer: SpriteEditorLayer,
): SpriteEditorDocument {
  const candidate = {
    ...doc,
    layers: doc.layers.map((l) => (l.id === layer.id ? layer : l)),
  };
  return {
    ...candidate,
    layers: candidate.layers.map((node) => {
      const old = doc.layers.find((l) => l.id === node.id)!;
      const delta = multiply(
        layerSetupMatrix(candidate, node),
        inverse(layerSetupMatrix(doc, old)),
      );
      const space = node.binding?.setupMatrix ?? identity(),
        worldDelta = multiply(multiply(space, delta), inverse(space));
      const adjust = (mesh: NonNullable<SpriteEditorLayer["savedMesh"]>) => ({
        ...mesh,
        vertices: mesh.vertices.map((v) => ({
          ...v,
          ...transformPoint(worldDelta, v.x, v.y),
        })),
      });
      return {
        ...node,
        binding:
          node.binding?.mode === "weighted"
            ? { ...node.binding, mesh: adjust(node.binding.mesh) }
            : node.binding,
        savedMesh: node.savedMesh ? adjust(node.savedMesh) : undefined,
      };
    }),
  };
}
