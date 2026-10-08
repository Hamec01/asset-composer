import type { SpriteEditorDocument, Project, Matrix2D } from "@/domain/types";
import { evaluateScene, evaluateSkeleton } from "./evaluationPipeline";
import { identity, multiply, translation } from "./matrixUtils";
/** Canonical setup placement for a document mounted on an existing visual or item. */
export function documentSetupSpace(
  doc: SpriteEditorDocument,
  project: Project,
): Matrix2D {
  if (doc.studioEntityId) return identity();
  const entity = project.entities.find(
      (e) => e.id === (doc.target.entityId ?? project.activeEntityId),
    ),
    template = project.templates.find((t) => t.id === entity?.templateId);
  if (!entity || !template) return identity();
  const empty = { kind: "vector" as const, svgData: "" },
    target = doc.target;
  const subject = {
    ...entity,
    visuals: entity.visuals?.map((v) =>
      v.id === target.visualId ? { ...v, content: empty, svgData: "" } : v,
    ),
    faceCustomization: entity.faceCustomization
      ? {
          ...entity.faceCustomization,
          overlays: entity.faceCustomization.overlays.map((v) =>
            v.id === target.overlayId
              ? { ...v, content: empty, svgData: "" }
              : v,
          ),
        }
      : undefined,
  };
  const items = project.items.map((item) =>
    item.id === target.itemId
      ? {
          ...item,
          parts: item.parts?.map((p) =>
            p.id === target.partId ? { ...p, content: empty, svgData: "" } : p,
          ),
        }
      : item,
  );
  const skeleton = evaluateSkeleton(
      template.bones,
      new Map(),
      entity.bodyMorphs,
      entity.appearance,
    ),
    scene = evaluateScene(
      subject,
      template,
      skeleton,
      items,
      project.itemFitProfiles,
    );
  const visual = scene.visuals.find((v) =>
    target.kind === "entity-visual"
      ? v.entityVisualId === target.visualId
      : target.kind === "face-overlay"
        ? v.entityVisualId === target.overlayId
        : v.itemId === target.itemId && v.partId === target.partId,
  );
  return visual
    ? multiply(
        visual.worldMatrix,
        translation(visual.localBounds.minX, visual.localBounds.minY),
      )
    : identity();
}
