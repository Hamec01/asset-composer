// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";

import { InspectorPanel } from "../src/components/panels/InspectorPanel";
import { resolveTemplate } from "../src/data/templates";
import type { EntityVisual, LocalTransform } from "../src/domain/types";
import { useStore } from "../src/store";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderInspector() {
  if (!container) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  }
  act(() => {
    root!.render(<InspectorPanel />);
  });
}

function cleanupInspector() {
  act(() => {
    root?.unmount();
  });
  root = null;
  if (container) {
    container.remove();
    container = null;
  }
}

function getInput(testId: string): HTMLInputElement {
  const el = document.querySelector(`[data-testid="${testId}"]`);
  if (!(el instanceof HTMLInputElement)) {
    throw new Error(`Missing input ${testId}`);
  }
  return el;
}

function getButton(text: string): HTMLButtonElement {
  const buttons = [...document.querySelectorAll("button")];
  const found = buttons.find(button => button.textContent?.includes(text));
  if (!(found instanceof HTMLButtonElement)) {
    throw new Error(`Missing button ${text}`);
  }
  return found;
}

function setItemPartSelection() {
  useStore.getState().newProject();
  useStore.getState().createEntity("character", "humanoid_topdown_v1", "Inspector Test");
  const entityId = useStore.getState().project.activeEntityId!;
  useStore.getState().setEntitySlot(entityId, "slot_hair", "hair_test_v2");
  useStore.setState(state => {
    const entity = state.project.entities.find(e => e.id === entityId);
    if (entity) {
      entity.slots = entity.slots.map(slot =>
        slot.slotId === "slot_hair"
          ? { ...slot, attachmentOverride: { offsetX: 0, offsetY: 0, rotation: 0, scaleX: 1, scaleY: 1 } }
          : slot,
      );
    }
    state.editor.selection = { kind: "item-part", entityId, slotId: "slot_hair", itemId: "hair_test_v2", partId: "hair" };
    state.editor.selectedSlotId = "slot_hair";
  });
  return entityId;
}

function setTemplateSlotSelection() {
  useStore.getState().newProject();
  useStore.getState().createEntity("character", "humanoid_topdown_v1", "Template Inspector");
  const template = resolveTemplate(useStore.getState().project, "humanoid_topdown_v1");
  if (!template) throw new Error("Missing template");
  useStore.setState(state => {
    state.editor.appState = "ide";
    state.editor.selection = { kind: "template-slot", templateId: template.id, slotId: "slot_hair" };
    state.editor.selectedSlotId = "slot_hair";
  });
}

function setEquippedItemSelection() {
  useStore.getState().newProject();
  useStore.getState().createEntity("character", "humanoid_topdown_v1", "Equipped Inspector");
  const entityId = useStore.getState().project.activeEntityId!;
  useStore.getState().setEntitySlot(entityId, "slot_hair", "hair_test_v2");
  useStore.getState().setSelectedSlot("slot_hair");
  return entityId;
}

function setEntityVisualSelection() {
  useStore.getState().newProject();
  useStore.getState().createEntity("character", "humanoid_topdown_v1", "Visual Inspector");
  const entityId = useStore.getState().project.activeEntityId!;
  const visual: EntityVisual = {
    id: "visual-1",
    svgData: "<svg viewBox='0 0 10 10'><rect x='0' y='0' width='10' height='10'/></svg>",
    boneId: "head",
    metrics: {
      viewBoxX: 0,
      viewBoxY: 0,
      viewBoxWidth: 10,
      viewBoxHeight: 10,
      visualMinX: 0,
      visualMinY: 0,
      visualWidth: 10,
      visualHeight: 10,
    },
    pivot: { x: 5, y: 5, preset: "center" },
    localTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    zIndex: 12,
  };
  useStore.setState(state => {
    const entity = state.project.entities.find(e => e.id === entityId);
    if (!entity) return;
    entity.visuals = [visual];
    state.editor.selection = { kind: "entity-visual", entityId, visualId: visual.id };
    state.editor.selectedSlotId = null;
  });
  return { entityId, visualId: visual.id };
}

beforeEach(() => {
  window.localStorage.clear();
  cleanupInspector();
  useStore.getState().newProject();
});

describe("InspectorPanel", () => {
  it("shows item-part inspector for item-part selection", () => {
    setItemPartSelection();
    renderInspector();

    expect(document.body.textContent).toContain("Entity Type");
    expect(document.body.textContent).toContain("Root Transform");
    expect(document.body.textContent).toContain("Item Part");
    expect(document.body.textContent).toContain("Anchor");
    expect(document.body.textContent).toContain("Attachment Transform");
    expect(getInput("inspector-attach-x")).toBeTruthy();
  });

  it("shows template-slot inspector for template-slot selection", () => {
    setTemplateSlotSelection();
    renderInspector();

    expect(document.body.textContent).toContain("Template Slot");
    expect(document.body.textContent).toContain("Allowed");
    expect(document.body.textContent).toContain("Slot Transform");
    expect(getInput("inspector-slot-x")).toBeTruthy();
  });

  it("shows entity-visual inspector for entity-visual selection", () => {
    setEntityVisualSelection();
    renderInspector();

    expect(document.body.textContent).toContain("Entity Visual");
    expect(getInput("inspector-visual-x")).toBeTruthy();
  });

  it("shows equipped-item inspector for equipped-item selection", () => {
    setEquippedItemSelection();
    renderInspector();

    expect(document.body.textContent).toContain("Equipped Item");
    expect(document.body.textContent).toContain("Edit Default Fit");
    expect(document.body.textContent).toContain("Palette Override");
  });

  it("commits one history entry after numeric edit", async () => {
    setItemPartSelection();
    renderInspector();

    const entityId = useStore.getState().project.activeEntityId!;
    const before = useStore.getState().project.entities.find(e => e.id === entityId)!.slots.find(s => s.slotId === "slot_hair")!.attachmentOverride;
    expect(useStore.getState().history.past).toHaveLength(1);

    useStore.getState().previewAttachmentOverride(entityId, "slot_hair", { scaleX: 1.25, scaleY: 1.25 });
    useStore.getState().commitAttachmentOverride(
      entityId,
      "slot_hair",
      {
        anchorId: before.anchorId ?? "",
        bindMode: before.bindMode ?? "",
        offsetX: before.offsetX ?? 0,
        offsetY: before.offsetY ?? 0,
        rotation: before.rotation ?? 0,
        scaleX: before.scaleX ?? 1,
        scaleY: before.scaleY ?? 1,
      },
      {
        anchorId: before.anchorId ?? "",
        bindMode: before.bindMode ?? "",
        offsetX: 0,
        offsetY: 0,
        rotation: 0,
        scaleX: 1.25,
        scaleY: 1.25,
      },
      "Scale attachment",
    );
    expect(useStore.getState().history.past).toHaveLength(2);
    const entity = useStore.getState().project.entities.find(e => e.id === useStore.getState().project.activeEntityId)!;
    const slot = entity.slots.find(s => s.slotId === "slot_hair")!;
    expect(slot.attachmentOverride.scaleX).toBe(1.25);
  });

  it("Esc cancels numeric edit", () => {
    setItemPartSelection();
    renderInspector();

    const input = getInput("inspector-attach-scale-y");
    act(() => {
      input.focus();
      input.value = "2";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      input.blur();
    });

    const entity = useStore.getState().project.entities.find(e => e.id === useStore.getState().project.activeEntityId)!;
    const slot = entity.slots.find(s => s.slotId === "slot_hair")!;
    expect(slot.attachmentOverride.scaleY).toBe(1);
  });

  it("Reset Scale restores 1,1", () => {
    const entityId = setItemPartSelection();
    useStore.getState().setAttachmentOverride(entityId, "slot_hair", { scaleX: 0.3, scaleY: 0.2 });
    renderInspector();

    act(() => {
      getButton("Reset Scale").click();
    });

    const entity = useStore.getState().project.entities.find(e => e.id === entityId)!;
    const slot = entity.slots.find(s => s.slotId === "slot_hair")!;
    expect(slot.attachmentOverride.scaleX).toBe(1);
    expect(slot.attachmentOverride.scaleY).toBe(1);
  });

  it("Flip X toggles sign without losing Y scale", () => {
    const entityId = setItemPartSelection();
    useStore.getState().setAttachmentOverride(entityId, "slot_hair", { scaleX: 0.3, scaleY: 0.2 });
    renderInspector();

    act(() => {
      getButton("Flip X").click();
    });

    const entity = useStore.getState().project.entities.find(e => e.id === entityId)!;
    const slot = entity.slots.find(s => s.slotId === "slot_hair")!;
    expect(slot.attachmentOverride.scaleX).toBe(-0.3);
    expect(slot.attachmentOverride.scaleY).toBe(0.2);
  });

  it("Reset All restores attachment position, rotation and scale", () => {
    const entityId = setItemPartSelection();
    useStore.getState().setAttachmentOverride(entityId, "slot_hair", {
      offsetX: 5,
      offsetY: -2,
      rotation: 17,
      scaleX: 0.3,
      scaleY: 0.2,
    });
    renderInspector();

    act(() => {
      getButton("Reset All").click();
    });

    const entity = useStore.getState().project.entities.find(e => e.id === entityId)!;
    const slot = entity.slots.find(s => s.slotId === "slot_hair")!;
    expect(slot.attachmentOverride.offsetX).toBe(0);
    expect(slot.attachmentOverride.offsetY).toBe(0);
    expect(slot.attachmentOverride.rotation).toBe(0);
    expect(slot.attachmentOverride.scaleX).toBe(1);
    expect(slot.attachmentOverride.scaleY).toBe(1);
  });

  it("Remove from Character clears the slot assignment", () => {
    const entityId = setItemPartSelection();
    renderInspector();

    act(() => {
      getButton("Remove from character").click();
    });

    const entity = useStore.getState().project.entities.find(e => e.id === entityId)!;
    const slot = entity.slots.find(s => s.slotId === "slot_hair")!;
    expect(slot.itemId).toBeNull();
  });

  it("selecting an equipped slot creates equipped-item selection", () => {
    const entityId = setEquippedItemSelection();
    const selection = useStore.getState().editor.selection;
    expect(selection).toEqual({
      kind: "equipped-item",
      entityId,
      slotId: "slot_hair",
      itemId: "hair_test_v2",
    });
  });
});
