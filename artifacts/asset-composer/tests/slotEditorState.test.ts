import { beforeEach, describe, expect, it } from "vitest";

import { ITEMS } from "../src/data/items";
import { TEMPLATES } from "../src/data/templates";
import type { Project } from "../src/domain/types";
import { evaluateRestSkeleton, evaluateScene } from "../src/lib/evaluationPipeline";
import { parseProjectSnapshot } from "../src/lib/projectValidation";
import { useStore } from "../src/store";

function makeProjectWithSlotEditorMeta(): Project {
  return {
    id: "slot-editor-meta",
    version: "2.0",
    name: "Slot Editor Meta",
    description: "",
    entities: [{
      id: "entity_1",
      name: "Entity",
      entityType: "character",
      templateId: "humanoid_topdown_v1",
      styleSetId: "style_default",
      species: "",
      palette: { ...TEMPLATES.find(template => template.id === "humanoid_topdown_v1")!.paletteTokens },
      slots: [{
        slotId: "slot_hair",
        itemId: "hair_test_v2",
        paletteOverride: {},
        attachmentOverride: {},
      }],
      visuals: [],
      rootTransform: null,
      activeAnimationClipId: null,
      activeStateMachineId: null,
      licenseMeta: {
        source: "test",
        author: "test",
        licenseType: "cc0",
        aiGenerated: false,
        commercialUseAllowed: true,
        purchaseRef: null,
        derivativePolicy: "unrestricted",
      },
      createdAt: 0,
      updatedAt: 0,
    }],
    templates: TEMPLATES,
    items: ITEMS,
    itemFitProfiles: [],
    animationClips: [],
    stateMachines: [],
    styleSets: [],
    exportProfiles: [],
    editorMeta: {
      slotEditorByTemplateId: {
        humanoid_topdown_v1: {
          hiddenSlotIds: ["slot_hair"],
          lockedSlotIds: ["slot_torso"],
        },
      },
    },
    activeEntityId: "entity_1",
    createdAt: 0,
    updatedAt: 0,
  };
}

describe("slot editor metadata", () => {
  beforeEach(() => {
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => 1) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;
  });

  it("save/load preserves slot gizmo preferences", () => {
    const parsed = parseProjectSnapshot(makeProjectWithSlotEditorMeta());

    expect(parsed.editorMeta.slotEditorByTemplateId.humanoid_topdown_v1.hiddenSlotIds).toEqual(["slot_hair"]);
    expect(parsed.editorMeta.slotEditorByTemplateId.humanoid_topdown_v1.lockedSlotIds).toEqual(["slot_torso"]);
  });

  it("slot visibility does not affect evaluated visuals", () => {
    useStore.getState().newProject();
    useStore.getState().createEntity("character", "humanoid_topdown_v1", "Slot Meta Entity");
    const entityId = useStore.getState().project.activeEntityId!;
    useStore.getState().setEntitySlot(entityId, "slot_hair", "hair_test_v2");

    const beforeProject = useStore.getState().project;
    const entity = beforeProject.entities.find(candidate => candidate.id === entityId)!;
    const template = beforeProject.templates.find(candidate => candidate.id === entity.templateId)!;
    const beforeScene = evaluateScene(entity, template, evaluateRestSkeleton(template.bones), beforeProject.items);

    useStore.getState().setSlotGizmoHidden(template.id, "slot_hair", true);

    const afterProject = useStore.getState().project;
    const afterEntity = afterProject.entities.find(candidate => candidate.id === entityId)!;
    const afterTemplate = afterProject.templates.find(candidate => candidate.id === afterEntity.templateId)!;
    const afterScene = evaluateScene(afterEntity, afterTemplate, evaluateRestSkeleton(afterTemplate.bones), afterProject.items);

    expect(afterScene.visuals).toEqual(beforeScene.visuals);
  });
});
