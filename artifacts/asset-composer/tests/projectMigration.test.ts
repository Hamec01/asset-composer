import { describe, expect, it } from "vitest";

import { ITEMS } from "../src/data/items";
import { TEMPLATES } from "../src/data/templates";
import type { Template } from "../src/domain/types";
import { migrateProject } from "../src/lib/projectMigration";

const pantsBuiltin = ITEMS.find(item => item.id === "pants_leather")!;
const bootsBuiltin = ITEMS.find(item => item.id === "boots_leather")!;
const humanoidBuiltin = TEMPLATES.find(template => template.id === "humanoid_topdown_v1")!;

describe("project migration built-in item refresh", () => {
  it("replaces outdated built-in pants and boots with canonical V2 definitions", () => {
    const migrated = migrateProject({
      id: "project",
      version: "2.0",
      name: "Legacy embedded items",
      description: "",
      entities: [],
      templates: [],
      items: [
        {
          id: "pants_leather",
          name: "Legacy Pants",
          description: "old",
          category: "legs",
          compatibility: { skeletonFamilies: [], species: [], viewProfiles: [] },
          allowedSlots: ["slot_legs"],
          fitProfile: "standard",
          paletteChannels: [],
          hasOwnAnimation: false,
          animationClipId: null,
          anchorRules: {},
          svgLayers: [{ id: "legacy", styleSetId: null, svgData: "<svg/>", paletteChannels: [], zOffset: 0 }],
          parts: [],
          coordinateMode: "legacy_full_frame",
          licenseMeta: {
            source: "legacy",
            author: "legacy",
            licenseType: "cc0",
            aiGenerated: false,
            commercialUseAllowed: true,
            purchaseRef: null,
            derivativePolicy: "unrestricted",
          },
          tags: ["legacy"],
        },
        {
          id: "boots_leather",
          name: "Legacy Boots",
          description: "old",
          category: "feet",
          compatibility: { skeletonFamilies: [], species: [], viewProfiles: [] },
          allowedSlots: ["slot_feet"],
          fitProfile: "standard",
          paletteChannels: [],
          hasOwnAnimation: false,
          animationClipId: null,
          anchorRules: {},
          svgLayers: [{ id: "legacy", styleSetId: null, svgData: "<svg/>", paletteChannels: [], zOffset: 0 }],
          parts: [],
          coordinateMode: "legacy_full_frame",
          licenseMeta: {
            source: "legacy",
            author: "legacy",
            licenseType: "cc0",
            aiGenerated: false,
            commercialUseAllowed: true,
            purchaseRef: null,
            derivativePolicy: "unrestricted",
          },
          tags: ["legacy"],
        },
      ],
      animationClips: [],
      stateMachines: [],
      styleSets: [],
      exportProfiles: [],
      activeEntityId: null,
      createdAt: 0,
      updatedAt: 0,
    }) as { items: typeof ITEMS };

    const pants = migrated.items.find(item => item.id === "pants_leather")!;
    const boots = migrated.items.find(item => item.id === "boots_leather")!;

    expect(pants.coordinateMode).toBe("bone_local");
    expect(boots.coordinateMode).toBe("bone_local");
    expect(pants.parts.map(part => part.id)).toEqual(pantsBuiltin.parts!.map(part => part.id));
    expect(boots.parts.map(part => part.id)).toEqual(bootsBuiltin.parts!.map(part => part.id));
    expect(pants.name).toBe(pantsBuiltin.name);
    expect(boots.name).toBe(bootsBuiltin.name);
  });

  it("keeps non-refreshed items intact while normalizing missing fields", () => {
    const migrated = migrateProject({
      id: "project",
      version: "2.0",
      name: "Custom items",
      description: "",
      entities: [],
      templates: [],
      items: [
        {
          id: "custom_pants",
          name: "Custom Pants",
          description: "custom",
          category: "legs",
          compatibility: { skeletonFamilies: [], species: [], viewProfiles: [] },
          allowedSlots: ["slot_legs"],
          fitProfile: "standard",
          paletteChannels: [],
          hasOwnAnimation: false,
          animationClipId: null,
          svgLayers: [],
          licenseMeta: {
            source: "user",
            author: "user",
            licenseType: "cc0",
            aiGenerated: false,
            commercialUseAllowed: true,
            purchaseRef: null,
            derivativePolicy: "unrestricted",
          },
          tags: [],
        },
      ],
      animationClips: [],
      stateMachines: [],
      styleSets: [],
      exportProfiles: [],
      activeEntityId: null,
      createdAt: 0,
      updatedAt: 0,
    }) as { items: Array<{ id: string; name: string; coordinateMode?: string; parts?: unknown[]; anchorRules?: unknown }> };

    expect(migrated.items).toHaveLength(1);
    expect(migrated.items[0].id).toBe("custom_pants");
    expect(migrated.items[0].name).toBe("Custom Pants");
    expect(migrated.items[0].coordinateMode).toBe("legacy_full_frame");
    expect(migrated.items[0].parts).toEqual([]);
    expect(migrated.items[0].anchorRules).toEqual({});
  });
});

describe("project migration built-in template refresh", () => {
  it("replaces outdated built-in humanoid template geometry while preserving slot edits", () => {
    const savedSlotTransform = {
      x: 7,
      y: -3,
      rotation: 5,
      scaleX: 1.2,
      scaleY: 0.9,
    };
    const staleHumanoid: Template = {
      ...humanoidBuiltin,
      anchors: {},
      boneParts: [],
      slots: humanoidBuiltin.slots.map(slot => (
        slot.id === "slot_legs"
          ? { ...slot, defaultTransform: savedSlotTransform }
          : slot
      )),
    };

    const migrated = migrateProject({
      id: "project",
      version: "2.0",
      name: "Legacy embedded template",
      description: "",
      entities: [],
      templates: [staleHumanoid],
      items: [],
      animationClips: [],
      stateMachines: [],
      styleSets: [],
      exportProfiles: [],
      activeEntityId: null,
      createdAt: 0,
      updatedAt: 0,
    }) as { templates: Template[] };

    const humanoid = migrated.templates.find(template => template.id === humanoidBuiltin.id)!;
    const legsSlot = humanoid.slots.find(slot => slot.id === "slot_legs")!;

    expect(humanoid.anchors).toEqual(humanoidBuiltin.anchors);
    expect(humanoid.boneParts?.map(part => part.id)).toEqual(humanoidBuiltin.boneParts?.map(part => part.id));
    expect(legsSlot.defaultTransform).toEqual(savedSlotTransform);
  });
});
