// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { useStore } from "../src/store";
import { parseProjectSnapshot } from "../src/lib/projectValidation";
import { resolveTemplate } from "../src/data/templates";
import { buildMultiClipPose, evaluateRestSkeleton, evaluateSkeleton, evaluateScene } from "../src/lib/evaluationPipeline";
import { CHIBI_ANIMATIONS } from "../src/data/chibiAnimations";
import { spriteEditorDocumentToSvg } from "../src/lib/spriteEditor";
import { animController } from "../src/core-v2/AnimationController";

afterEach(() => animController.pause());

function fixture() {
  useStore.getState().newProject();
  useStore.getState().createEntity("character", "biped_profile_base_v1", "Existing drawing");
  const original = useStore.getState().project.entities[0];
  useStore.getState().createReferenceChibi({ format: "png", name: "Reference", originalFileName: "reference.png", mimeType: "image/jpeg", dataUri: "data:image/jpeg;base64,AAAA" });
  const project = useStore.getState().project;
  const entity = project.entities[1];
  return { original, project, entity, template: resolveTemplate(project, entity.templateId)! };
}

describe("reference chibi tracing", () => {
  it("creates 17 independent editable parts without changing the previous character", () => {
    const { original, project, entity } = fixture();
    expect(project.entities[0]).toEqual(original);
    expect(entity.visuals).toHaveLength(17);
    expect(project.animationClips.some(clip => clip.id === entity.activeAnimationClipId)).toBe(true);
    expect(new Set(entity.visuals!.map(visual => visual.boneId)).size).toBe(17);
    expect(entity.faceCustomization!.hair.visible).toBe(false);
    expect(entity.faceCustomization!.eyes.visible).toBe(false);
    const docs = project.editorMeta.spriteEditorDocuments.filter(doc => doc.target.entityId === entity.id);
    expect(docs).toHaveLength(17);
    for (const doc of docs) {
      expect(doc.layers[0].shapes.length).toBeGreaterThan(0);
      expect(doc.authoringHint?.preserveFrame).toBe(true);
      const visual = entity.visuals!.find(candidate => candidate.id === doc.target.visualId)!;
      expect(visual.metrics.viewBoxX).toBe(0);
      expect(visual.metrics.viewBoxY).toBe(0);
      expect(visual.metrics.visualWidth).toBe(doc.width);
      expect(visual.metrics.visualHeight).toBe(doc.height);
      expect(doc.tracingAsset?.name).toBe("Reference");
      expect(spriteEditorDocumentToSvg(doc)).not.toContain("<image");
      expect(spriteEditorDocumentToSvg(doc, { preview: true })).toContain("<image");
      expect(doc.tracingTransform!.scale).toBeLessThanOrEqual(20);
    }
    expect(parseProjectSnapshot(JSON.parse(JSON.stringify(project))).entities[1].appearance?.projection).toBe("authored");
  });

  it("preserves the traced joint layout, mirrors cleanly and renders only the new parts", () => {
    const { entity, template, project } = fixture();
    const right = evaluateRestSkeleton(template.bones, entity.bodyMorphs, undefined, entity.appearance);
    const left = evaluateRestSkeleton(template.bones, entity.bodyMorphs, undefined, { ...entity.appearance!, view: "left" });
    expect(right.bones.get("shoulder_l")!.x).toBeCloseTo((386 - 535) * 0.09);
    expect(right.bones.get("shoulder_r")!.x).toBeCloseTo((674 - 535) * 0.09);
    for (const [id, bone] of right.bones) {
      expect(left.bones.get(id)!.x).toBeCloseTo(-bone.x);
      expect(left.bones.get(id)!.y).toBeCloseTo(bone.y);
    }
    const scene = evaluateScene(entity, template, right, project.items);
    expect(scene.visuals).toHaveLength(17);
    expect(scene.visuals.every(visual => visual.sourceKind === "entity-visual")).toBe(true);
    expect(scene.visuals.every(visual => Number.isFinite(visual.worldBounds.minX))).toBe(true);
  });

  it("keeps parts attached to the same joints throughout walking in either direction", () => {
    const { entity, template, project } = fixture();
    for (const view of ["right", "left"] as const) {
      const character = { ...entity, appearance: { ...entity.appearance!, view }, activeAnimationClipId: "chibi_front__walk" };
      for (let t = 0; t < 1000; t += 100) {
        const pose = buildMultiClipPose(CHIBI_ANIMATIONS, character.activeAnimationClipId, null, null, 1, t, character, project.items);
        const skeleton = evaluateSkeleton(template.bones, pose, character.bodyMorphs, character.appearance);
        const scene = evaluateScene(character, template, skeleton, project.items);
        expect(scene.visuals).toHaveLength(17);
        expect(scene.visuals.every(visual => visual.worldMatrix.every(Number.isFinite))).toBe(true);
      }
    }
  });
});
