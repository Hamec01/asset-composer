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

function setTextInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  if (!setter) {
    throw new Error("Missing HTMLInputElement value setter");
  }
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function focusInput(input: HTMLInputElement) {
  input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
}

function blurInput(input: HTMLInputElement) {
  input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
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
    state.editor.selection = { kind: "item-part", entityId, slotId: "slot_hair", itemId: "hair_test_v2", partId: "crown" };
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

function setBoneSelection() {
  useStore.getState().newProject();
  useStore.getState().createEntity("character", "humanoid_topdown_v1", "Bone Inspector");
  const entityId = useStore.getState().project.activeEntityId!;
  useStore.setState(state => {
    state.editor.selection = { kind: "bone", entityId, boneId: "head" };
    state.editor.selectedSlotId = null;
  });
}

function setAnchorSelection() {
  useStore.getState().newProject();
  useStore.getState().createEntity("character", "humanoid_topdown_v1", "Anchor Inspector");
  useStore.setState(state => {
    state.editor.selection = {
      kind: "anchor",
      templateId: "humanoid_topdown_v1",
      boneId: "head",
      anchorId: "hair_top",
    };
    state.editor.selectedSlotId = "slot_hair";
  });
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

  it("shows bone inspector for bone selection", () => {
    setBoneSelection();
    renderInspector();

    expect(document.body.textContent).toContain("Bone");
    expect(document.body.textContent).toContain("Rest Rotation");
    expect(document.body.textContent).toContain("Assigned Parts");
  });

  it("shows anchor inspector for anchor selection", () => {
    setAnchorSelection();
    renderInspector();

    expect(document.body.textContent).toContain("Anchor");
    expect(document.body.textContent).toContain("Usage");
    expect(document.body.textContent).toContain("hair_top");
  });

  it("shows equipped-item inspector for equipped-item selection", () => {
    setEquippedItemSelection();
    renderInspector();

    expect(document.body.textContent).toContain("Equipped Item");
    expect(document.body.textContent).toContain("Edit Default Fit");
    expect(document.body.textContent).toContain("Palette Override");
  });

  it("Edit Default Fit switches equipped-item selection into item-part editing", () => {
    const entityId = setEquippedItemSelection();
    renderInspector();

    act(() => {
      getButton("Edit Default Fit").click();
    });

    expect(useStore.getState().editor.canvasMode).toBe("edit-attachment");
    expect(useStore.getState().editor.selection).toEqual({
      kind: "item-part",
      entityId,
      slotId: "slot_hair",
      itemId: "hair_test_v2",
      partId: "crown",
    });
    expect(useStore.getState().editor.fitAuthoring).toEqual({
      scope: "template",
      entityId,
      slotId: "slot_hair",
      itemId: "hair_test_v2",
      partId: "crown",
    });
  });

  it("item-part inspector edits fit profile instead of attachment override while fit authoring is active", () => {
    const entityId = setItemPartSelection();
    const item = useStore.getState().project.items.find(candidate => candidate.id === "hair_test_v2")!;
    const template = resolveTemplate(useStore.getState().project, "humanoid_topdown_v1")!;
    useStore.getState().saveItemPartFitProfile(
      item,
      template,
      "slot_hair",
      "crown",
      { x: 11, y: -4, rotation: 9, scaleX: 1.3, scaleY: 0.7 },
      "template",
      "hair_top",
    );
    useStore.getState().beginItemPartFitAuthoring("template", entityId, "slot_hair", "hair_test_v2", "crown");
    renderInspector();

    expect(getInput("inspector-attach-x").value).toBe("11");

    const input = getInput("inspector-attach-scale-x");
    act(() => {
      focusInput(input);
      setTextInputValue(input, "1.6");
      blurInput(input);
    });

    const profile = useStore.getState().project.itemFitProfiles.find(candidate =>
      candidate.templateId === "humanoid_topdown_v1" &&
      candidate.slotId === "slot_hair",
    );
    const entity = useStore.getState().project.entities.find(candidate => candidate.id === entityId)!;
    const slot = entity.slots.find(candidate => candidate.slotId === "slot_hair")!;

    expect(profile?.partTransforms.crown.scaleX).toBe(1.6);
    expect(slot.attachmentOverride.scaleX).toBe(1);
  });

  it("commits one history entry after numeric edit", async () => {
    setItemPartSelection();
    renderInspector();

    useStore.setState(state => {
      state.history.past = [];
      state.history.future = [];
    });

    const input = getInput("inspector-attach-scale-x");
    act(() => {
      focusInput(input);
      setTextInputValue(input, "1.25");
    });

    expect(useStore.getState().history.past).toHaveLength(0);

    act(() => {
      blurInput(input);
    });

    expect(useStore.getState().history.past).toHaveLength(1);
    const entity = useStore.getState().project.entities.find(e => e.id === useStore.getState().project.activeEntityId)!;
    const slot = entity.slots.find(s => s.slotId === "slot_hair")!;
    expect(slot.attachmentOverride.scaleX).toBe(1.25);
  });

  it("does not create history entries during live slot preview", () => {
    setTemplateSlotSelection();
    renderInspector();
    useStore.setState(state => {
      state.history.past = [];
      state.history.future = [];
    });

    const input = getInput("inspector-slot-x");
    act(() => {
      focusInput(input);
      setTextInputValue(input, "8");
    });

    expect(useStore.getState().history.past).toHaveLength(0);

    act(() => {
      blurInput(input);
    });

    expect(useStore.getState().history.past).toHaveLength(1);
  });

  it("Esc cancels numeric edit", () => {
    setItemPartSelection();
    renderInspector();

    const input = getInput("inspector-attach-scale-y");
    act(() => {
      focusInput(input);
      setTextInputValue(input, "2");
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      blurInput(input);
    });

    const entity = useStore.getState().project.entities.find(e => e.id === useStore.getState().project.activeEntityId)!;
    const slot = entity.slots.find(s => s.slotId === "slot_hair")!;
    expect(slot.attachmentOverride.scaleY).toBe(1);
  });

  it("Reset Scale restores 1,1", () => {
    const entityId = setItemPartSelection();
    useStore.getState().setAttachmentOverride(entityId, "slot_hair", { scaleX: 0.3, scaleY: 0.2 });
    useStore.setState(state => {
      state.history.past = [];
      state.history.future = [];
    });
    renderInspector();

    act(() => {
      getButton("Reset Scale").click();
    });

    const entity = useStore.getState().project.entities.find(e => e.id === entityId)!;
    const slot = entity.slots.find(s => s.slotId === "slot_hair")!;
    expect(slot.attachmentOverride.scaleX).toBe(1);
    expect(slot.attachmentOverride.scaleY).toBe(1);
    expect(useStore.getState().history.past).toHaveLength(1);
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

  it("Lock Aspect scales both axes from item-part inspector", () => {
    setItemPartSelection();
    renderInspector();

    act(() => {
      getButton("Lock Aspect").click();
    });

    const input = getInput("inspector-attach-scale-x");
    act(() => {
      focusInput(input);
      setTextInputValue(input, "1.5");
      blurInput(input);
    });

    const entity = useStore.getState().project.entities.find(e => e.id === useStore.getState().project.activeEntityId)!;
    const slot = entity.slots.find(s => s.slotId === "slot_hair")!;
    expect(slot.attachmentOverride.scaleX).toBe(1.5);
    expect(slot.attachmentOverride.scaleY).toBe(1.5);
  });

  it("saves selected part fit for the current template", () => {
    setItemPartSelection();
    useStore.getState().setAttachmentOverride(useStore.getState().project.activeEntityId!, "slot_hair", {
      offsetX: 6,
      offsetY: -2,
      rotation: 14,
      scaleX: 1.2,
      scaleY: 0.85,
    });
    renderInspector();

    act(() => {
      getButton("Save Fit For This Template").click();
    });

    const profile = useStore.getState().project.itemFitProfiles.find(candidate =>
      candidate.templateId === "humanoid_topdown_v1" &&
      candidate.slotId === "slot_hair",
    );
    expect(profile?.partTransforms.crown).toEqual({
      x: 6,
      y: -2,
      rotation: 14,
      scaleX: 1.2,
      scaleY: 0.85,
    });
  });

  it("resets selected part fit back to item default", () => {
    setItemPartSelection();
    const item = useStore.getState().project.items.find(candidate => candidate.id === "hair_test_v2")!;
    const template = resolveTemplate(useStore.getState().project, "humanoid_topdown_v1")!;
    useStore.getState().saveItemPartFitProfile(
      item,
      template,
      "slot_hair",
      "crown",
      { x: 6, y: -2, rotation: 14, scaleX: 1.2, scaleY: 0.85 },
      "template",
      "hair_top",
    );
    renderInspector();

    act(() => {
      getButton("Reset To Item Default").click();
    });

    expect(useStore.getState().project.itemFitProfiles.some(candidate =>
      candidate.templateId === "humanoid_topdown_v1" &&
      candidate.slotId === "slot_hair" &&
      candidate.partTransforms.crown != null,
    )).toBe(false);
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
    useStore.setState(state => {
      state.history.past = [];
      state.history.future = [];
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
    expect(useStore.getState().history.past).toHaveLength(1);
  });

  it("resets item rotation to zero", () => {
    const entityId = setItemPartSelection();
    useStore.getState().setAttachmentOverride(entityId, "slot_hair", {
      rotation: 33,
    });
    useStore.setState(state => {
      state.history.past = [];
      state.history.future = [];
    });
    renderInspector();

    act(() => {
      getButton("Reset Rotation").click();
    });

    const entity = useStore.getState().project.entities.find(e => e.id === entityId)!;
    const slot = entity.slots.find(s => s.slotId === "slot_hair")!;
    expect(slot.attachmentOverride.rotation).toBe(0);
    expect(useStore.getState().history.past).toHaveLength(1);
  });

  it("template slot reset creates one history entry", () => {
    setTemplateSlotSelection();
    const template = resolveTemplate(useStore.getState().project, "humanoid_topdown_v1")!;
    useStore.getState().updateTemplateSlotTransform(template.id, "slot_hair", {
      x: 6,
      y: -4,
      rotation: 12,
      scaleX: 1.2,
      scaleY: 0.8,
    });
    useStore.setState(state => {
      state.history.past = [];
      state.history.future = [];
    });
    renderInspector();

    act(() => {
      getButton("Reset slot transform").click();
    });

    const slot = useStore.getState().project.templates
      .find(candidate => candidate.id === template.id)!
      .slots.find(candidate => candidate.id === "slot_hair")!;
    expect(slot.defaultTransform).toEqual({
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    });
    expect(useStore.getState().history.past).toHaveLength(1);
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

  it("setSelectedSlot preserves item-part selection for the same slot", () => {
    const entityId = setItemPartSelection();

    act(() => {
      useStore.getState().setSelectedSlot("slot_hair");
    });

    expect(useStore.getState().editor.selection).toEqual({
      kind: "item-part",
      entityId,
      slotId: "slot_hair",
      itemId: "hair_test_v2",
      partId: "crown",
    });
  });

  it("setSelectedSlot preserves template-slot selection for the same slot", () => {
    setTemplateSlotSelection();

    act(() => {
      useStore.getState().setSelectedSlot("slot_hair");
    });

    expect(useStore.getState().editor.selection).toEqual({
      kind: "template-slot",
      templateId: "humanoid_topdown_v1",
      slotId: "slot_hair",
    });
  });
});
