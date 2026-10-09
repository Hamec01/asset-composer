// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "../src/store";
import { useWorkbench } from "../src/store/workbench";
import { assetDocument, buildAssetCatalog, exportEntityFor } from "../src/lib/assetCatalog";
import { openAsset, switchWorkspace, resumeProject, showLibrary } from "../src/lib/assetNavigation";
import { createStudioRig, editStudioDocument, newStudioDocument, newStudioLayer, studioCommit } from "../src/lib/studioActions";
import { duplicateAsset, deleteAsset } from "../src/lib/assetOperations";
import { animController } from "../src/core-v2/AnimationController";

beforeEach(() => {
  animController.pause(); useStore.getState().newProject();
  useWorkbench.setState({ activeAsset: null, contexts: {}, screen: "library" });
});
describe("task-based workbench", () => {
  it("never uses the current character skeleton for a newly created environment object", () => {
    useStore.getState().createEntity("character", "biped_profile_base_v1", "Персонаж");
    const character = useStore.getState().project.entities[0];
    const item = useStore.getState().createWorldObject({ name: "Дерево", type: "world_flora" });
    openAsset({ kind: "item", id: item.id }, "rig");
    expect(useStore.getState().project.activeEntityId).toBeNull();
    expect(useStore.getState().animPlayback.activeClipId).toBeNull();
    expect(useStore.getState().project.entities.some(e => e.id === character.id)).toBe(true);
  });
  it("creates and opens equipment without a character", () => {
    const item = useStore.getState().createEquipmentItem({ name: "Меч", type: "weapon_1h" });
    openAsset({ kind: "item", id: item.id });
    expect(useStore.getState().project.entities).toHaveLength(0);
    expect(useWorkbench.getState().workspace).toBe("draw");
    expect(useStore.getState().project.editorMeta.activeSpriteDocumentId).toBe(item.parts![0].editorDocumentId);
    expect(exportEntityFor(useStore.getState().project, { kind: "item", id: item.id })).toBeUndefined();
  });
  it("restores the open equipment document even when a fitting character is selected", () => {
    useStore.getState().createEntity("character", "biped_profile_base_v1", "Персонаж");
    const item = useStore.getState().createEquipmentItem({ name: "Меч", type: "weapon_1h" });
    openAsset({ kind: "item", id: item.id }, "fit");
    expect(useStore.getState().project.activeEntityId).not.toBeNull();
    resumeProject();
    expect(useWorkbench.getState().activeAsset).toEqual({ kind: "item", id: item.id });
  });
  it("keeps an environment object and its generated rig under one library card", () => {
    const item = useStore.getState().createWorldObject({ name: "Дерево", type: "world_flora" });
    const ref = { kind: "item" as const, id: item.id };
    const doc = assetDocument(useStore.getState().project, ref)!;
    createStudioRig(doc.id, "tree");
    const project = useStore.getState().project;
    expect(assetDocument(project, ref)?.id).toBe(doc.id);
    expect(buildAssetCatalog(project).filter(e => e.name === "Дерево")).toHaveLength(1);
    expect(buildAssetCatalog(project).some(e => e.ref.kind === "entity")).toBe(false);
    expect(exportEntityFor(project, ref)?.id).toBe(project.entities[0].id);
    openAsset(ref, "animate");
    expect(useStore.getState().project.activeEntityId).toBe(project.entities[0].id);
  });
  it("restores artwork-only projects and retains the selected document", () => {
    const doc = newStudioDocument(); doc.name = "Без персонажа";
    studioCommit("Create", p => { p.editorMeta.spriteEditorDocuments.push(doc); p.editorMeta.activeSpriteDocumentId = doc.id; });
    const snapshot = structuredClone(useStore.getState().project);
    useStore.getState().newProject(); useStore.getState().loadProject(snapshot); resumeProject();
    expect(useWorkbench.getState().activeAsset).toEqual({ kind: "artwork", id: doc.id });
    expect(useStore.getState().project.entities).toHaveLength(0);
  });
  it("preserves clip, time, document, project revision and history while changing workspaces", () => {
    const doc = newStudioDocument(); studioCommit("Create", p => p.editorMeta.spriteEditorDocuments.push(doc));
    createStudioRig(doc.id, "tree"); openAsset({ kind: "artwork", id: doc.id }, "animate");
    useStore.getState().setPlaybackTime(350);
    const before = useStore.getState(), history = before.history.past.length;
    switchWorkspace("draw"); switchWorkspace("rig"); switchWorkspace("animate");
    const after = useStore.getState();
    expect(after.animPlayback.activeClipId).toBe(before.animPlayback.activeClipId);
    expect(after.animPlayback.timeMs).toBe(350);
    expect(after.project.updatedAt).toBe(before.project.updatedAt);
    expect(after.history.past.length).toBe(history);
    expect(after.project.editorMeta.activeSpriteDocumentId).toBe(doc.id);
  });
  it("keeps edits undoable after visiting the library and another workspace", () => {
    const doc = newStudioDocument(); studioCommit("Create", p => p.editorMeta.spriteEditorDocuments.push(doc));
    openAsset({ kind: "artwork", id: doc.id });
    editStudioDocument(doc.id, "Layer", d => d.layers.push(newStudioLayer("vector")));
    showLibrary(); openAsset({ kind: "artwork", id: doc.id }, "rig");
    useStore.getState().undo();
    expect(assetDocument(useStore.getState().project, { kind: "artwork", id: doc.id })?.layers).toHaveLength(0);
    useStore.getState().redo();
    expect(assetDocument(useStore.getState().project, { kind: "artwork", id: doc.id })?.layers).toHaveLength(1);
  });
  it("duplicates document-backed items without sharing editable drawings or rigs", () => {
    const item = useStore.getState().createWorldObject({ name: "Дерево", type: "world_flora" });
    const ref = { kind: "item" as const, id: item.id }, source = assetDocument(useStore.getState().project, ref)!;
    createStudioRig(source.id, "tree");
    const copy = duplicateAsset(ref)!;
    const doc = assetDocument(useStore.getState().project, copy)!;
    expect(doc.id).not.toBe(source.id); expect(doc.studioEntityId).not.toBe(assetDocument(useStore.getState().project, ref)!.studioEntityId);
    editStudioDocument(doc.id, "Rename", d => { d.name = "Изменена копия"; });
    expect(assetDocument(useStore.getState().project, ref)?.name).toBe("Дерево");
    deleteAsset(copy);
    expect(useStore.getState().project.entities).toHaveLength(1);
    expect(assetDocument(useStore.getState().project, ref)?.id).toBe(source.id);
  });
  it("does not duplicate character part or face documents in the library", () => {
    useStore.getState().createEntity("character", "biped_profile_base_v1", "Персонаж");
    const id = useStore.getState().project.activeEntityId!;
    const doc = newStudioDocument(); doc.target = { kind: "face-overlay", entityId: id };
    studioCommit("Part", p => p.editorMeta.spriteEditorDocuments.push(doc));
    expect(buildAssetCatalog(useStore.getState().project).filter(e => e.ref.kind === "artwork")).toHaveLength(0);
  });
  it("deletes a character's documents while preserving independently authored equipment", () => {
    useStore.getState().createEntity("character", "biped_profile_base_v1", "Персонаж");
    const id = useStore.getState().project.activeEntityId!;
    const doc = newStudioDocument(); doc.target = { kind: "face-overlay", entityId: id };
    studioCommit("Part", p => p.editorMeta.spriteEditorDocuments.push(doc));
    const item = useStore.getState().createEquipmentItem({ name: "Меч", type: "weapon_1h" });
    deleteAsset({ kind: "entity", id });
    expect(useStore.getState().project.editorMeta.spriteEditorDocuments.some(d => d.id === doc.id)).toBe(false);
    expect(assetDocument(useStore.getState().project, { kind: "item", id: item.id })).toBeDefined();
  });
});
