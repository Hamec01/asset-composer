import { beforeEach, describe, expect, it } from "vitest";

import { resolveTemplate } from "../src/data/templates";
import type { AttachmentOverride, Entity, LocalTransform, Template } from "../src/domain/types";
import { evaluateScene, evaluateSkeleton } from "../src/lib/evaluationPipeline";
import { useStore } from "../src/store";

function resetHistory() {
  useStore.setState(state => ({
    history: {
      ...state.history,
      past: [],
      future: [],
    },
  }));
}

function normalizeOverride(override: Partial<AttachmentOverride> | undefined): AttachmentOverride {
  return {
    anchorId: override?.anchorId ?? "",
    bindMode: override?.bindMode ?? "",
    offsetX: override?.offsetX ?? 0,
    offsetY: override?.offsetY ?? 0,
    rotation: override?.rotation ?? 0,
    scaleX: override?.scaleX ?? 1,
    scaleY: override?.scaleY ?? 1,
  };
}

function setupCharacterWithItem(slotId: string, itemId: string) {
  const store = useStore.getState();
  store.newProject();
  store.createEntity("character", "humanoid_topdown_v1", "History Test");
  const entityId = useStore.getState().project.activeEntityId!;
  useStore.getState().setEntitySlot(entityId, slotId, itemId);
  resetHistory();
  const entity = useStore.getState().project.entities.find(e => e.id === entityId)!;
  const template = resolveTemplate(useStore.getState().project, entity.templateId)!;
  return { entityId, entity, template };
}

function getEntity(entityId: string): Entity {
  return useStore.getState().project.entities.find(entity => entity.id === entityId)!;
}

function getTemplate(templateId: string): Template {
  return useStore.getState().project.templates.find(template => template.id === templateId)!;
}

function sceneForEntity(entityId: string, templateId: string) {
  const entity = getEntity(entityId);
  const template = getTemplate(templateId);
  const skeleton = evaluateSkeleton(template.bones, new Map());
  return evaluateScene(entity, template, skeleton, useStore.getState().project.items);
}

beforeEach(() => {
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    return 1;
  }) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;
  useStore.getState().newProject();
  resetHistory();
});

describe("history transactions", () => {
  it("creates one history entry for one attachment scale gesture", () => {
    const { entityId } = setupCharacterWithItem("slot_hair", "hair_test_v2");
    const before = normalizeOverride(getEntity(entityId).slots.find(slot => slot.slotId === "slot_hair")?.attachmentOverride);
    const after = { ...before, scaleX: 1.5, scaleY: 1.5 };

    useStore.getState().previewAttachmentOverride(entityId, "slot_hair", { scaleX: 1.1, scaleY: 1.1 });
    useStore.getState().previewAttachmentOverride(entityId, "slot_hair", { scaleX: 1.3, scaleY: 1.3 });
    expect(useStore.getState().history.past).toHaveLength(0);

    useStore.getState().commitAttachmentOverride(entityId, "slot_hair", before, after, "Scale attachment");

    expect(useStore.getState().history.past).toHaveLength(1);
    const committed = normalizeOverride(getEntity(entityId).slots.find(slot => slot.slotId === "slot_hair")?.attachmentOverride);
    expect(committed.scaleX).toBe(1.5);
    expect(committed.scaleY).toBe(1.5);
  });

  it("undoes and redoes attachment scale", () => {
    const { entityId } = setupCharacterWithItem("slot_hair", "hair_test_v2");
    const before = normalizeOverride(getEntity(entityId).slots.find(slot => slot.slotId === "slot_hair")?.attachmentOverride);
    const after = { ...before, scaleX: 1.5, scaleY: 1.5 };

    useStore.getState().previewAttachmentOverride(entityId, "slot_hair", after);
    useStore.getState().commitAttachmentOverride(entityId, "slot_hair", before, after, "Scale attachment");
    expect(normalizeOverride(getEntity(entityId).slots.find(slot => slot.slotId === "slot_hair")?.attachmentOverride).scaleX).toBe(1.5);

    useStore.getState().undo();
    expect(normalizeOverride(getEntity(entityId).slots.find(slot => slot.slotId === "slot_hair")?.attachmentOverride).scaleX).toBe(1);

    useStore.getState().redo();
    expect(normalizeOverride(getEntity(entityId).slots.find(slot => slot.slotId === "slot_hair")?.attachmentOverride).scaleX).toBe(1.5);
  });

  it("commits one history entry for one rotation gesture", () => {
    const { entityId } = setupCharacterWithItem("slot_hair", "hair_test_v2");
    const before = normalizeOverride(getEntity(entityId).slots.find(slot => slot.slotId === "slot_hair")?.attachmentOverride);
    const after = { ...before, rotation: 30 };

    useStore.getState().previewAttachmentOverride(entityId, "slot_hair", { rotation: 12 });
    useStore.getState().previewAttachmentOverride(entityId, "slot_hair", { rotation: 24 });
    expect(useStore.getState().history.past).toHaveLength(0);

    useStore.getState().commitAttachmentOverride(entityId, "slot_hair", before, after, "Rotate attachment");

    expect(useStore.getState().history.past).toHaveLength(1);
    expect(normalizeOverride(getEntity(entityId).slots.find(slot => slot.slotId === "slot_hair")?.attachmentOverride).rotation).toBe(30);
  });

  it("undoes and redoes item rotation", () => {
    const { entityId } = setupCharacterWithItem("slot_hair", "hair_test_v2");
    const before = normalizeOverride(getEntity(entityId).slots.find(slot => slot.slotId === "slot_hair")?.attachmentOverride);
    const after = { ...before, rotation: -45 };

    useStore.getState().previewAttachmentOverride(entityId, "slot_hair", after);
    useStore.getState().commitAttachmentOverride(entityId, "slot_hair", before, after, "Rotate attachment");
    expect(normalizeOverride(getEntity(entityId).slots.find(slot => slot.slotId === "slot_hair")?.attachmentOverride).rotation).toBe(-45);

    useStore.getState().undo();
    expect(normalizeOverride(getEntity(entityId).slots.find(slot => slot.slotId === "slot_hair")?.attachmentOverride).rotation).toBe(0);

    useStore.getState().redo();
    expect(normalizeOverride(getEntity(entityId).slots.find(slot => slot.slotId === "slot_hair")?.attachmentOverride).rotation).toBe(-45);
  });

  it("undoes all sibling parts through one SlotAssignment override", () => {
    const { entityId, template } = setupCharacterWithItem("slot_legs", "pants_leather");
    const beforeScene = sceneForEntity(entityId, template.id);
    const before = normalizeOverride(getEntity(entityId).slots.find(slot => slot.slotId === "slot_legs")?.attachmentOverride);
    const after = { ...before, scaleX: 1.2, scaleY: 1.2, offsetY: 3 };

    useStore.getState().previewAttachmentOverride(entityId, "slot_legs", after);
    useStore.getState().commitAttachmentOverride(entityId, "slot_legs", before, after, "Scale pants");
    const afterScene = sceneForEntity(entityId, template.id);

    for (const partId of ["waist", "thigh_l", "shin_l", "thigh_r", "shin_r"]) {
      const beforeVisual = beforeScene.visuals.find(visual => visual.itemId === "pants_leather" && visual.partId === partId);
      const afterVisual = afterScene.visuals.find(visual => visual.itemId === "pants_leather" && visual.partId === partId);
      expect(afterVisual?.worldMatrix).not.toEqual(beforeVisual?.worldMatrix);
    }

    useStore.getState().undo();
    const undoneScene = sceneForEntity(entityId, template.id);
    for (const partId of ["waist", "thigh_l", "shin_l", "thigh_r", "shin_r"]) {
      const beforeVisual = beforeScene.visuals.find(visual => visual.itemId === "pants_leather" && visual.partId === partId);
      const undoneVisual = undoneScene.visuals.find(visual => visual.itemId === "pants_leather" && visual.partId === partId);
      expect(undoneVisual?.worldMatrix).toEqual(beforeVisual?.worldMatrix);
    }

    useStore.getState().redo();
    const redoneScene = sceneForEntity(entityId, template.id);
    for (const partId of ["waist", "thigh_l", "shin_l", "thigh_r", "shin_r"]) {
      const afterVisual = afterScene.visuals.find(visual => visual.itemId === "pants_leather" && visual.partId === partId);
      const redoneVisual = redoneScene.visuals.find(visual => visual.itemId === "pants_leather" && visual.partId === partId);
      expect(redoneVisual?.worldMatrix).toEqual(afterVisual?.worldMatrix);
    }
  });

  it("creates one history entry for one template slot drag", () => {
    const { template } = setupCharacterWithItem("slot_hair", "hair_test_v2");
    const slotId = "slot_hair";
    const before = {
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    };
    const after: LocalTransform = {
      x: 6,
      y: -3,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    };

    useStore.getState().previewTemplateSlotTransform(template.id, slotId, { ...before, x: 2 });
    useStore.getState().previewTemplateSlotTransform(template.id, slotId, { ...before, x: 4 });
    expect(useStore.getState().history.past).toHaveLength(0);

    useStore.getState().commitTemplateSlotTransform(template.id, slotId, before, after, "Move slot");

    expect(useStore.getState().history.past).toHaveLength(1);
    expect(getTemplate(template.id).slots.find(slot => slot.id === slotId)?.defaultTransform).toEqual(after);
  });

  it("does not create history entries during live preview updates", () => {
    const { entityId, template } = setupCharacterWithItem("slot_hair", "hair_test_v2");

    useStore.getState().previewAttachmentOverride(entityId, "slot_hair", { offsetX: 4 });
    useStore.getState().previewAttachmentOverride(entityId, "slot_hair", { offsetX: 7 });
    useStore.getState().previewTemplateSlotTransform(template.id, "slot_hair", {
      x: 3,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    });

    expect(useStore.getState().history.past).toHaveLength(0);
    expect(useStore.getState().history.future).toHaveLength(0);
  });

  it("clears redo future only when a new committed command is made", () => {
    const { entityId } = setupCharacterWithItem("slot_hair", "hair_test_v2");
    const before = normalizeOverride(getEntity(entityId).slots.find(slot => slot.slotId === "slot_hair")?.attachmentOverride);
    const firstAfter = { ...before, scaleX: 1.25, scaleY: 1.25 };
    const secondAfter = { ...before, scaleX: 1.5, scaleY: 1.5 };

    useStore.getState().commitAttachmentOverride(entityId, "slot_hair", before, firstAfter, "Scale attachment");
    useStore.getState().undo();
    expect(useStore.getState().history.future).toHaveLength(1);

    useStore.getState().previewAttachmentOverride(entityId, "slot_hair", secondAfter);
    expect(useStore.getState().history.future).toHaveLength(1);

    useStore.getState().commitAttachmentOverride(entityId, "slot_hair", before, secondAfter, "Scale attachment");
    expect(useStore.getState().history.future).toHaveLength(0);
  });

  it("undoes and redoes saving a template-scoped item fit profile", () => {
    const { entityId, template } = setupCharacterWithItem("slot_hair", "hair_test_v2");
    const item = useStore.getState().project.items.find(candidate => candidate.id === "hair_test_v2")!;

    useStore.getState().saveItemPartFitProfile(
      item,
      template,
      "slot_hair",
      "crown",
      { x: 9, y: -4, rotation: 3, scaleX: 1.1, scaleY: 0.95 },
      "template",
      "hair_top",
    );

    expect(useStore.getState().project.itemFitProfiles.some(profile =>
      profile.templateId === template.id &&
      profile.slotId === "slot_hair" &&
      profile.partTransforms.crown?.x === 9,
    )).toBe(true);

    useStore.getState().undo();
    expect(useStore.getState().project.itemFitProfiles.some(profile =>
      profile.templateId === template.id &&
      profile.slotId === "slot_hair" &&
      profile.partTransforms.crown?.x === 9,
    )).toBe(false);

    useStore.getState().redo();
    expect(useStore.getState().project.itemFitProfiles.some(profile =>
      profile.templateId === template.id &&
      profile.slotId === "slot_hair" &&
      profile.partTransforms.crown?.x === 9,
    )).toBe(true);
    expect(getEntity(entityId).id).toBe(entityId);
  });
});
