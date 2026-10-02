// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthoringPanel } from "../src/components/panels/AuthoringPanel";
import { useStore } from "../src/store";
import { createDocumentFromFaceOverlay } from "../src/lib/spriteEditor";
import { animController } from "../src/core-v2/AnimationController";
import { parseProjectSnapshot } from "../src/lib/projectValidation";

vi.mock("../src/lib/frameRenderer", () => ({ renderFrameToCanvas: vi.fn().mockResolvedValue(undefined) }));

let root: ReturnType<typeof createRoot> | undefined;
let container: HTMLDivElement | undefined;
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  container?.remove();
  root = undefined;
  animController.pause();
});

async function mount() {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root!.render(<AuthoringPanel standalone />));
}

describe("drawing workspace", () => {
  it("preserves the tracing reference and its placement when loading a project", () => {
    useStore.getState().newProject();
    useStore.getState().createEntity("character", "biped_profile_base_v1", "Drawing test");
    const entity = useStore.getState().project.entities[0];
    const doc = createDocumentFromFaceOverlay(entity.id);
    doc.tracingAsset = { format: "png", name: "Ref", originalFileName: "ref.png", mimeType: "image/png", dataUri: "data:image/png;base64,AAAA" };
    doc.tracingOpacity = 0.4;
    doc.tracingVisible = false;
    doc.tracingTransform = { x: -10, y: 20, scale: 3 };
    useStore.getState().upsertSpriteEditorDocument(doc);
    const restored = parseProjectSnapshot(JSON.parse(JSON.stringify(useStore.getState().project)));
    expect(restored.editorMeta.spriteEditorDocuments[0]).toMatchObject({
      tracingAsset: doc.tracingAsset, tracingOpacity: 0.4,
      tracingVisible: false, tracingTransform: doc.tracingTransform,
    });
  });
  it("keeps a face overlay selected without a recursive update loop", async () => {
    useStore.getState().newProject();
    useStore.getState().createEntity("character", "biped_profile_base_v1", "Drawing test");
    const entity = useStore.getState().project.entities[0];
    const doc = createDocumentFromFaceOverlay(entity.id);
    useStore.getState().upsertSpriteEditorDocument(doc);
    useStore.getState().setActiveSpriteDocument(doc.id);
    useStore.getState().setActiveAuthoringMode("sprite-editor");
    await mount();
    expect(useStore.getState().editor.selection.kind).toBe("face-overlay");
    const after = useStore.getState().editor.selection;
    await act(async () => useStore.getState().upsertSpriteEditorDocument({ ...doc, name: "Renamed" }));
    expect(useStore.getState().editor.selection).toEqual(after);
    expect(document.body.textContent).toContain("Renamed");
  });

  it("creates an empty bone-bound body piece and opens the drawing tools", async () => {
    useStore.getState().newProject();
    useStore.getState().createEntity("character", "biped_profile_base_v1", "Drawing test");
    await mount();
    const button = [...container!.querySelectorAll("button")].find(node => node.textContent?.includes("Нарисовать с нуля"))!;
    await act(async () => button.click());
    const state = useStore.getState();
    const doc = state.project.editorMeta.spriteEditorDocuments.find(candidate => candidate.id === state.project.editorMeta.activeSpriteDocumentId)!;
    expect(doc.layers.flatMap(layer => layer.shapes)).toHaveLength(0);
    expect(doc.referenceAsset).toBeNull();
    const visual = state.project.entities[0].visuals!.find(candidate => candidate.id === doc.target.visualId)!;
    expect(visual.boneId).toBe("head");
    expect(visual.bodyPartId).toBe("hero_head");
    expect(visual.bodyView).toBe("side");
    expect(document.querySelector('[aria-label="Привязка рисунка к кости"]')).not.toBeNull();
  });
});
