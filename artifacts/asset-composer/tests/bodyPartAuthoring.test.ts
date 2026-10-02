// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { useStore } from "../src/store";
import { resolveTemplate } from "../src/data/templates";
import { createEditableBodyPart } from "../src/lib/bodyPartAuthoring";
import { evaluateRestSkeleton, evaluateScene } from "../src/lib/evaluationPipeline";
import { isLegacyBodyCloneVisual } from "../src/lib/projectNormalization";
import { animController } from "../src/core-v2/AnimationController";
import { PEASANT_EQUIPMENT } from "../src/data/peasantEquipment";
import { getCharacterBodyParts } from "../src/data/chibiBody";

afterEach(() => animController.pause());

function fixture() {
  const store = useStore.getState();
  store.newProject();
  store.createEntity("character", "biped_profile_base_v1", "Body test");
  const project = useStore.getState().project;
  const entity = project.entities[0];
  const template = resolveTemplate(project, entity.templateId)!;
  return { entity, template };
}

describe("body part authoring", () => {
  it("starts with a clean character library", () => {
    fixture();
    const project = useStore.getState().project;
    expect(project.items.map(item => item.id)).toEqual(PEASANT_EQUIPMENT.map(item => item.id));
    expect(project.templates).toHaveLength(3);
    expect(project.templates.every(template => template.id.startsWith("biped_profile_"))).toBe(true);
  });

  it("replaces only the selected body part at the same bounds and restores it on undo", () => {
    const { entity, template } = fixture();
    const part = getCharacterBodyParts(template, entity).find(part => part.id === "hero_foot_r")!;
    const skeleton = evaluateRestSkeleton(template.bones);
    const before = evaluateScene(entity, template, skeleton, []);
    const replacement = createEditableBodyPart(part);
    replacement.bodyView = "side";
    replacement.editorDocumentId = "edited-foot";
    expect(isLegacyBodyCloneVisual(replacement, template)).toBe(false);
    useStore.getState().addEntityVisual(entity.id, replacement);
    const after = evaluateScene(useStore.getState().project.entities[0], template, skeleton, []);
    expect(after.visuals).toHaveLength(before.visuals.length);
    expect(after.visuals.find(visual => visual.id === `part__${part.id}`)).toBeUndefined();
    const edited = after.visuals.find(visual => visual.entityVisualId === replacement.id)!;
    expect(edited.worldBounds).toEqual(before.visuals.find(visual => visual.id === `part__${part.id}`)!.worldBounds);
    useStore.getState().undo();
    expect(evaluateScene(useStore.getState().project.entities[0], template, skeleton, []).visuals.some(visual => visual.id === `part__${part.id}`)).toBe(true);
  });

  it("retains edited body bindings and authored attachments when reopening a project", () => {
    const { entity, template } = fixture();
    const replacement = createEditableBodyPart(template.boneParts![0]);
    replacement.editorDocumentId = "body-document";
    const detail = { ...createEditableBodyPart(template.boneParts![1]), id: "new-detail", bodyPartId: undefined, editorDocumentId: "detail-document" };
    useStore.getState().addEntityVisual(entity.id, replacement);
    useStore.getState().addEntityVisual(entity.id, detail);
    useStore.getState().loadProject(JSON.parse(JSON.stringify(useStore.getState().project)));
    expect(useStore.getState().project.entities[0].visuals).toHaveLength(2);
    expect(useStore.getState().project.entities[0].visuals![0].bodyPartId).toBe(replacement.bodyPartId);
  });
});
