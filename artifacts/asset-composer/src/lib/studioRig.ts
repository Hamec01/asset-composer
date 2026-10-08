import type { Project, VisualMesh } from "@/domain/types";
import { evaluateSkeleton } from "./evaluationPipeline";
import { inverse, multiply, worldBoneToMatrix } from "./matrixUtils";
const refersToBone = (value: unknown, id: string): boolean => {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((v) => refersToBone(v, id));
  return Object.entries(value).some(
    ([key, v]) =>
      (["boneId", "parentId", "anatomicalOwner", "above"].includes(key) &&
        v === id) ||
      (["bones", "boneOrder", "occludedByBones"].includes(key) &&
        Array.isArray(v) &&
        v.includes(id)) ||
      (["inherit", "poseOverrides"].includes(key) &&
        v &&
        typeof v === "object" &&
        id in v) ||
      refersToBone(v, id),
  );
};
export function studioBoneHasDependents(
  project: Project,
  templateId: string,
  id: string,
): boolean {
  const template = project.templates.find((t) => t.id === templateId);
  const owners = project.entities.filter((e) => e.templateId === templateId);
  return (
    refersToBone(template, id) ||
    refersToBone(owners, id) ||
    refersToBone(
      project.editorMeta.spriteEditorDocuments.filter((d) =>
        owners.some((e) => e.id === (d.studioEntityId ?? d.target.entityId)),
      ),
      id,
    ) ||
    refersToBone(
      project.animationClips.filter((c) => c.templateId === templateId),
      id,
    )
  );
}
/** Explicit reassignment keeps every dependent studio part and track valid. */
export function reassignStudioBone(
  project: Project,
  templateId: string,
  id: string,
  replacement: string,
) {
  const template = project.templates.find((t) => t.id === templateId)!;
  if (id === replacement || !template.bones.some((b) => b.id === replacement))
    throw new Error("Choose a different surviving bone");
  let ancestor: string | null = replacement;
  while (ancestor) {
    if (ancestor === id)
      throw new Error("The replacement cannot descend from the deleted bone");
    ancestor = template.bones.find((b) => b.id === ancestor)?.parentId ?? null;
  }
  const rest = evaluateSkeleton(template.bones, new Map()),
    destination = worldBoneToMatrix(rest.bones.get(replacement)!);
  for (const bone of template.bones)
    if (bone.parentId === id) {
      const matrix = multiply(
        inverse(destination),
        worldBoneToMatrix(rest.bones.get(bone.id)!),
      );
      bone.parentId = replacement;
      bone.restPose = {
        tx: matrix[4],
        ty: matrix[5],
        rotation: (Math.atan2(matrix[1], matrix[0]) * 180) / Math.PI,
        scaleX: Math.hypot(matrix[0], matrix[1]),
        scaleY:
          (matrix[0] * matrix[3] - matrix[1] * matrix[2]) /
          Math.hypot(matrix[0], matrix[1]),
      };
    }
  const reweight = (mesh: VisualMesh) => {
    mesh.vertices = mesh.vertices.map((v) => {
      const weights = new Map<string, number>();
      for (const w of v.weights) {
        const boneId = w.boneId === id ? replacement : w.boneId;
        weights.set(boneId, (weights.get(boneId) ?? 0) + w.weight);
      }
      return {
        ...v,
        weights: [...weights].map(([boneId, weight]) => ({ boneId, weight })),
      };
    });
    if (mesh.bindMatrices[id]) {
      delete mesh.bindMatrices[id];
      mesh.bindMatrices[replacement] = destination;
    }
  };
  const owners = project.entities.filter((e) => e.templateId === templateId);
  for (const doc of project.editorMeta.spriteEditorDocuments)
    if (
      owners.some((e) => e.id === (doc.studioEntityId ?? doc.target.entityId))
    )
      for (const layer of doc.layers) {
        if (layer.anatomicalOwner === id) layer.anatomicalOwner = replacement;
        if (layer.depthBinding?.boneId === id)
          layer.depthBinding.boneId = replacement;
        if (layer.binding) {
          if (layer.binding.boneId === id) {
            layer.binding.boneId = replacement;
            layer.binding.bindMatrix = destination;
          }
          if (layer.binding.mode === "weighted") reweight(layer.binding.mesh);
        }
        if (layer.savedMesh) reweight(layer.savedMesh);
      }
  for (const clip of project.animationClips)
    if (clip.templateId === templateId) {
      for (const layer of clip.layers) {
        const removed = layer.tracks.find((t) => t.boneId === id),
          survivor = layer.tracks.find((t) => t.boneId === replacement);
        if (
          removed &&
          survivor &&
          removed.keyframes.length &&
          survivor.keyframes.length
        )
          throw new Error(
            "Both bones have animation tracks. Copy or remove the old keys before reassignment.",
          );
        if (removed) {
          if (survivor)
            layer.tracks = layer.tracks.filter((t) => t !== survivor);
          removed.boneId = replacement;
        }
      }
      for (const constraint of clip.ik ?? []) {
        const mapped = constraint.bones.map((b) =>
          b === id ? replacement : b,
        );
        if (new Set(mapped).size < 3)
          throw new Error("Rebuild the IK chain before deleting this bone");
        constraint.bones = mapped as [string, string, string];
      }
      clip.equipmentDepth?.forEach(track => track.keyframes.forEach(key => {
        if (key.occludedByBones) key.occludedByBones = [...new Set(key.occludedByBones.map(b => b === id ? replacement : b))];
      }));
      clip.headOverlap?.forEach((k) => {
        k.bones = [
          ...new Set(k.bones.map((b) => (b === id ? replacement : b))),
        ];
      });
      clip.drawOrder?.forEach((k) => {
        k.boneOrder = [
          ...new Set(k.boneOrder.map((b) => (b === id ? replacement : b))),
        ];
        k.raise?.forEach((r) => {
          if (r.boneId === id) r.boneId = replacement;
          if (r.above === id) r.above = replacement;
        });
      });
      if (clip.inherit?.[id]) {
        clip.inherit[replacement] = clip.inherit[id];
        delete clip.inherit[id];
      }
      clip.attachments?.forEach((t) => {
        if (t.boneId === id) t.boneId = replacement;
      });
    }
  for (const part of template.boneParts ?? [])
    if (part.boneId === id) part.boneId = replacement;
  for (const slot of template.slots)
    if (slot.boneId === id) slot.boneId = replacement;
  for (const anchor of Object.values(template.anchors ?? {}))
    if (anchor.boneId === id) anchor.boneId = replacement;
  for (const entity of owners) {
    if (entity.poseOverrides?.[id]) {
      entity.poseOverrides[replacement] = entity.poseOverrides[id];
      delete entity.poseOverrides[id];
    }
    for (const visual of entity.visuals ?? []) {
      if (visual.boneId === id) visual.boneId = replacement;
    }
  }
  template.bones = template.bones.filter((b) => b.id !== id);
}
