import { describe, expect, it } from "vitest";

import { DEFAULT_EXPORT_PROFILES } from "../src/data/exportProfiles";
import { ITEM_FIT_PROFILES } from "../src/data/itemFitProfiles";
import { ITEMS } from "../src/data/items";
import { PRESET_ANIMATIONS } from "../src/data/presetAnimations";
import { PRESET_STATE_MACHINES } from "../src/data/presetStateMachines";
import { STYLE_SETS } from "../src/data/styleSets";
import { TEMPLATES } from "../src/data/templates";
import type { Project, Template } from "../src/domain/types";
import { parseProjectSnapshot } from "../src/lib/projectValidation";

const template = TEMPLATES.find(candidate => candidate.id === "humanoid_topdown_v1")!;

function makeProject(): Project {
  return {
    id: "validation-project",
    version: "2.0",
    name: "Validation Project",
    description: "",
    entities: [{
      id: "entity-1",
      name: "Hero",
      entityType: "character",
      templateId: template.id,
      styleSetId: "style_default",
      species: "",
      palette: template.paletteTokens,
      slots: [{
        slotId: "slot_hair",
        itemId: "hair_test_v2",
        paletteOverride: {},
        attachmentOverride: { offsetX: 3, offsetY: -2, scaleX: 1.1, scaleY: 0.9 },
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
      createdAt: 1,
      updatedAt: 1,
    }],
    templates: TEMPLATES,
    items: ITEMS,
    itemFitProfiles: ITEM_FIT_PROFILES,
    animationClips: PRESET_ANIMATIONS,
    stateMachines: PRESET_STATE_MACHINES,
    styleSets: STYLE_SETS,
    exportProfiles: DEFAULT_EXPORT_PROFILES,
    activeEntityId: "entity-1",
    createdAt: 1,
    updatedAt: 2,
  };
}

describe("project validation", () => {
  it("round-trips V2 project without field loss", () => {
    const parsed = parseProjectSnapshot(JSON.parse(JSON.stringify(makeProject())));
    const reparsed = parseProjectSnapshot(JSON.parse(JSON.stringify(parsed)));
    expect(reparsed).toEqual(parsed);
  });

  it("preserves custom templates", () => {
    const customTemplate: Template = {
      ...template,
      id: "custom_template",
      name: "Custom Template",
      slots: template.slots.map(slot =>
        slot.id === "slot_hair"
          ? {
              ...slot,
              defaultTransform: { x: 4, y: -6, rotation: 8, scaleX: 0.95, scaleY: 1.05 },
            }
          : slot,
      ),
    };
    const project = makeProject();
    project.templates = [...project.templates, customTemplate];
    project.entities[0].templateId = customTemplate.id;

    const parsed = parseProjectSnapshot(JSON.parse(JSON.stringify(project)));
    const restored = parsed.templates.find(candidate => candidate.id === customTemplate.id);

    expect(restored).toBeTruthy();
    expect(restored?.slots.find(slot => slot.id === "slot_hair")?.defaultTransform).toEqual(
      customTemplate.slots.find(slot => slot.id === "slot_hair")?.defaultTransform,
    );
  });

  it("reports invalid item references", () => {
    const project = makeProject();
    project.entities[0].slots[0].itemId = "missing_item";

    expect(() => parseProjectSnapshot(project)).toThrow(/missing item "missing_item"/i);
  });

  it("reports invalid bone references", () => {
    const project = makeProject();
    project.items = project.items.map(item =>
      item.id === "hair_test_v2"
        ? {
            ...item,
            parts: item.parts?.map(part =>
              part.id === "crown"
                ? { ...part, boneId: "missing_bone" }
                : part,
            ) ?? [],
          }
        : item,
    );

    expect(() => parseProjectSnapshot(project)).toThrow(/missing bone "missing_bone"/i);
  });
});
