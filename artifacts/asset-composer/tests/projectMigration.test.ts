import { describe, expect, it } from "vitest";

import { ITEM_FIT_PROFILES } from "../src/data/itemFitProfiles";
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
      itemFitProfiles: ITEM_FIT_PROFILES,
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
      itemFitProfiles: ITEM_FIT_PROFILES,
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
      itemFitProfiles: ITEM_FIT_PROFILES,
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

  it("hydrates built-in fit profiles when older projects do not store them yet", () => {
    const migrated = migrateProject({
      id: "project",
      version: "2.0",
      name: "Missing fit profiles",
      description: "",
      entities: [],
      templates: [],
      items: [],
      animationClips: [],
      stateMachines: [],
      styleSets: [],
      exportProfiles: [],
      activeEntityId: null,
      createdAt: 0,
      updatedAt: 0,
    }) as { itemFitProfiles: typeof ITEM_FIT_PROFILES };

    expect(migrated.itemFitProfiles).toEqual(ITEM_FIT_PROFILES);
  });

  it("auto-splits legacy shared feet slots into canonical left/right slots", () => {
    const migrated = migrateProject({
      id: "project",
      version: "2.0",
      name: "Legacy shared feet",
      description: "",
      entities: [{
        id: "entity-1",
        name: "Entity",
        entityType: "character",
        templateId: humanoidBuiltin.id,
        styleSetId: "style_default",
        species: "",
        palette: humanoidBuiltin.paletteTokens,
        slots: [{
          slotId: "slot_feet",
          itemId: "boots_leather",
          paletteOverride: {},
          attachmentOverride: { offsetX: 3, offsetY: -2, rotation: 4, scaleX: 1.1, scaleY: 0.9 },
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
      templates: [humanoidBuiltin],
      items: ITEMS,
      itemFitProfiles: ITEM_FIT_PROFILES,
      animationClips: [],
      stateMachines: [],
      styleSets: [],
      exportProfiles: [],
      activeEntityId: "entity-1",
      createdAt: 0,
      updatedAt: 0,
    }) as { entities: Array<{ slots: Array<{ slotId: string; itemId: string | null; attachmentOverride: Record<string, unknown> }> }> };

    const slots = migrated.entities[0].slots;
    expect(slots.map(slot => slot.slotId)).toEqual(["slot_foot_l", "slot_foot_r"]);
    expect(slots.map(slot => slot.itemId)).toEqual(["boot_leather_l", "boot_leather_r"]);
    expect(slots[0].attachmentOverride).toMatchObject({ offsetX: 3, offsetY: -2, rotation: 4, scaleX: 1.1, scaleY: 0.9 });
    expect(slots.some(slot => slot.slotId === "slot_feet")).toBe(false);
  });

  it("drops shared limb assignment when split assignments already exist", () => {
    const migrated = migrateProject({
      id: "project",
      version: "2.0",
      name: "Conflicting shared/split feet",
      description: "",
      entities: [{
        id: "entity-1",
        name: "Entity",
        entityType: "character",
        templateId: humanoidBuiltin.id,
        styleSetId: "style_default",
        species: "",
        palette: humanoidBuiltin.paletteTokens,
        slots: [
          { slotId: "slot_feet", itemId: "boots_leather", paletteOverride: {}, attachmentOverride: {} },
          { slotId: "slot_foot_l", itemId: "boot_chain_l", paletteOverride: {}, attachmentOverride: {} },
          { slotId: "slot_foot_r", itemId: "boot_chain_r", paletteOverride: {}, attachmentOverride: {} },
        ],
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
      templates: [humanoidBuiltin],
      items: ITEMS,
      itemFitProfiles: ITEM_FIT_PROFILES,
      animationClips: [],
      stateMachines: [],
      styleSets: [],
      exportProfiles: [],
      activeEntityId: "entity-1",
      createdAt: 0,
      updatedAt: 0,
    }) as { entities: Array<{ slots: Array<{ slotId: string; itemId: string | null }> }> };

    const slots = migrated.entities[0].slots;
    expect(slots).toEqual([
      { slotId: "slot_foot_l", itemId: "boot_chain_l", paletteOverride: {}, attachmentOverride: {} },
      { slotId: "slot_foot_r", itemId: "boot_chain_r", paletteOverride: {}, attachmentOverride: {} },
    ]);
  });

  it("keeps custom non-body entity visuals while pruning template body clones", () => {
    const chestPart = humanoidBuiltin.boneParts!.find(part => part.boneId === "chest")!;
    const migrated = migrateProject({
      id: "project",
      version: "2.0",
      name: "Mixed visuals",
      description: "",
      entities: [{
        id: "entity-1",
        name: "Entity",
        entityType: "character",
        templateId: humanoidBuiltin.id,
        styleSetId: "style_default",
        species: "",
        palette: humanoidBuiltin.paletteTokens,
        slots: [],
        visuals: [
          {
            id: "body-clone",
            boneId: chestPart.boneId,
            svgData: chestPart.svgData,
            metrics: {
              viewBoxX: 0,
              viewBoxY: 0,
              viewBoxWidth: chestPart.naturalWidth,
              viewBoxHeight: chestPart.naturalHeight,
              visualMinX: 0,
              visualMinY: 0,
              visualWidth: chestPart.naturalWidth,
              visualHeight: chestPart.naturalHeight,
            },
            pivot: { x: chestPart.naturalWidth / 2, y: chestPart.naturalHeight / 2, preset: "custom" },
            localTransform: { x: chestPart.localX, y: chestPart.localY, rotation: 0, scaleX: 1, scaleY: 1 },
            zIndex: chestPart.zOffset,
          },
          {
            id: "custom-banner",
            boneId: chestPart.boneId,
            svgData: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 10 10\"><rect x=\"1\" y=\"1\" width=\"8\" height=\"8\" fill=\"#ff0000\"/></svg>",
            metrics: {
              viewBoxX: 0,
              viewBoxY: 0,
              viewBoxWidth: 10,
              viewBoxHeight: 10,
              visualMinX: 1,
              visualMinY: 1,
              visualWidth: 8,
              visualHeight: 8,
            },
            pivot: { x: 5, y: 5, preset: "custom" },
            localTransform: { x: 2, y: 3, rotation: 0, scaleX: 1, scaleY: 1 },
            zIndex: 99,
          },
        ],
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
      templates: [humanoidBuiltin],
      items: ITEMS,
      itemFitProfiles: ITEM_FIT_PROFILES,
      animationClips: [],
      stateMachines: [],
      styleSets: [],
      exportProfiles: [],
      activeEntityId: "entity-1",
      createdAt: 0,
      updatedAt: 0,
    }) as { entities: Array<{ visuals: Array<{ id: string }> }> };

    expect(migrated.entities[0].visuals.map(visual => visual.id)).toEqual(["custom-banner"]);
  });

  it("prunes partial hand and foot body-clone visuals even when only limb fragments remain", () => {
    const handPart = humanoidBuiltin.boneParts!.find(part => part.boneId === "hand_l")!;
    const footPart = humanoidBuiltin.boneParts!.find(part => part.boneId === "foot_r")!;
    const migrated = migrateProject({
      id: "project",
      version: "2.0",
      name: "Partial limb clone",
      description: "",
      entities: [{
        id: "entity-1",
        name: "Entity",
        entityType: "character",
        templateId: humanoidBuiltin.id,
        styleSetId: "style_default",
        species: "",
        palette: humanoidBuiltin.paletteTokens,
        slots: [],
        visuals: [
          {
            id: "stale-hand",
            boneId: handPart.boneId,
            svgData: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1 1\"><circle cx=\"0.5\" cy=\"0.5\" r=\"0.5\" fill=\"#000\"/></svg>",
            metrics: {
              viewBoxX: 0,
              viewBoxY: 0,
              viewBoxWidth: 1,
              viewBoxHeight: 1,
              visualMinX: 0,
              visualMinY: 0,
              visualWidth: 1,
              visualHeight: 1,
            },
            pivot: { x: 0.5, y: 0.5, preset: "custom" },
            localTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            zIndex: handPart.zOffset,
          },
          {
            id: "stale-foot",
            boneId: footPart.boneId,
            svgData: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 2 2\"><rect x=\"0\" y=\"0\" width=\"2\" height=\"2\" fill=\"#000\"/></svg>",
            metrics: {
              viewBoxX: 0,
              viewBoxY: 0,
              viewBoxWidth: 2,
              viewBoxHeight: 2,
              visualMinX: 0,
              visualMinY: 0,
              visualWidth: 2,
              visualHeight: 2,
            },
            pivot: { x: 1, y: 1, preset: "custom" },
            localTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            zIndex: footPart.zOffset,
          },
        ],
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
      templates: [humanoidBuiltin],
      items: ITEMS,
      itemFitProfiles: ITEM_FIT_PROFILES,
      animationClips: [],
      stateMachines: [],
      styleSets: [],
      exportProfiles: [],
      activeEntityId: "entity-1",
      createdAt: 0,
      updatedAt: 0,
    }) as { entities: Array<{ visuals: Array<{ id: string }> }> };

    expect(migrated.entities[0].visuals).toEqual([]);
  });

  it("prunes root-level full body clone visuals during migration", () => {
    const baseLayer = humanoidBuiltin.baseBodyLayers[0]!;
    const migrated = migrateProject({
      id: "project",
      version: "2.0",
      name: "Root body clone",
      description: "",
      entities: [{
        id: "entity-1",
        name: "Entity",
        entityType: "character",
        templateId: humanoidBuiltin.id,
        styleSetId: "style_default",
        species: "",
        palette: humanoidBuiltin.paletteTokens,
        slots: [],
        visuals: [{
          id: "legacy-root-clone",
          boneId: "root",
          svgData: baseLayer.svgData,
          metrics: {
            viewBoxX: 0,
            viewBoxY: 0,
            viewBoxWidth: humanoidBuiltin.previewWidth,
            viewBoxHeight: humanoidBuiltin.previewHeight,
            visualMinX: 0,
            visualMinY: 0,
            visualWidth: humanoidBuiltin.previewWidth,
            visualHeight: humanoidBuiltin.previewHeight,
          },
          pivot: { x: humanoidBuiltin.previewWidth / 2, y: humanoidBuiltin.previewHeight / 2, preset: "custom" },
          localTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
          zIndex: 0,
        }],
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
      templates: [humanoidBuiltin],
      items: ITEMS,
      itemFitProfiles: ITEM_FIT_PROFILES,
      animationClips: [],
      stateMachines: [],
      styleSets: [],
      exportProfiles: [],
      activeEntityId: "entity-1",
      createdAt: 0,
      updatedAt: 0,
    }) as { entities: Array<{ visuals: Array<{ id: string }> }> };

    expect(migrated.entities[0].visuals).toEqual([]);
  });
});
