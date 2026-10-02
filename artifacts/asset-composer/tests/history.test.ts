// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useStore } from "../src/store";
import { animController } from "../src/core-v2/AnimationController";
import { resolveTemplate } from "../src/data/templates";
import { createEditableBodyPart } from "../src/lib/bodyPartAuthoring";
import { createDocumentFromEntityVisual } from "../src/lib/spriteEditor";

beforeEach(() => {
  useStore.getState().newProject();
  useStore.getState().createEntity("character", "biped_profile_base_v1", "Hero");
});
afterEach(() => animController.pause());

describe("editor history", () => {
  it("undoes and redoes appearance and face presets", () => {
    const store = useStore.getState();
    const id = store.getActiveEntity()!.id;
    store.setEntityAppearance(id, { view: "left" });
    store.setEntityFaceFeature(id, "eyes", { presetId: "iris_round", visible: true });
    store.undo();
    expect(useStore.getState().getActiveEntity()!.faceCustomization!.eyes.visible).toBe(false);
    store.undo();
    expect(useStore.getState().getActiveEntity()!.appearance?.view).toBe("right");
    store.redo();
    expect(useStore.getState().getActiveEntity()!.appearance!.view).toBe("left");
    store.redo();
    expect(useStore.getState().getActiveEntity()!.faceCustomization!.eyes.visible).toBe(true);
  });
  it("restores a removed head with its drawing, attachment and document", () => {
    const store = useStore.getState();
    const entity = store.getActiveEntity()!;
    const template = resolveTemplate(store.project, entity.templateId)!;
    const visual = createEditableBodyPart(template.boneParts!.find(part => part.boneId === "head")!);
    const doc = createDocumentFromEntityVisual(entity.id, visual);
    visual.editorDocumentId = doc.id;
    store.upsertSpriteEditorDocument(doc);
    store.addEntityVisual(entity.id, visual);
    store.removeEntityVisual(entity.id, visual.id);
    expect(useStore.getState().getActiveEntity()!.visuals).not.toContainEqual(visual);
    store.undo();
    expect(useStore.getState().getActiveEntity()!.visuals).toContainEqual(visual);
    expect(useStore.getState().project.editorMeta.spriteEditorDocuments).toContainEqual(doc);
    store.redo();
    expect(useStore.getState().getActiveEntity()!.visuals).not.toContainEqual(visual);
  });

  it("keeps only the latest 20 changes and invalidates redo after a new edit", () => {
    const store = useStore.getState();
    const id = store.getActiveEntity()!.id;
    for (let i = 1; i <= 25; i++) store.renameEntity(id, `Hero ${i}`);
    expect(useStore.getState().history.maxDepth).toBe(20);
    expect(useStore.getState().history.past).toHaveLength(20);
    for (let i = 0; i < 21; i++) store.undo();
    expect(useStore.getState().getActiveEntity()!.name).toBe("Hero 5");
    expect(useStore.getState().history.future).toHaveLength(20);
    store.redo();
    expect(useStore.getState().getActiveEntity()!.name).toBe("Hero 6");
    store.renameEntity(id, "New edit");
    expect(useStore.getState().history.future).toHaveLength(0);
  });

  it("does not record removal of a missing visual", () => {
    const store = useStore.getState();
    const before = store.history.past.length;
    store.removeEntityVisual(store.getActiveEntity()!.id, "missing");
    expect(useStore.getState().history.past).toHaveLength(before);
  });
});
