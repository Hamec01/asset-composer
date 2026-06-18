import { describe, expect, it } from "vitest";

import { ITEMS } from "../src/data/items";
import { TEMPLATES } from "../src/data/templates";
import type { Entity, Item, ItemFitProfile, LocalTransform } from "../src/domain/types";
import { evaluateScene, evaluateSkeleton } from "../src/lib/evaluationPipeline";
import { resolveItemFitPartTransform, resolveItemFitProfile } from "../src/lib/itemFitProfiles";
import { transformPoint } from "../src/lib/matrixUtils";

const template = TEMPLATES.find(t => t.id === "humanoid_topdown_v1")!;

function makeEntity(item: Item): Entity {
  return {
    id: "entity",
    name: "Fit Profile Test",
    entityType: "character",
    templateId: template.id,
    styleSetId: "style_default",
    species: "",
    palette: template.paletteTokens,
    slots: [{
      slotId: "slot_hair",
      itemId: item.id,
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
  };
}

describe("item fit profiles", () => {
  it("prefers exact-template fit profiles over family profiles", () => {
    const item = ITEMS.find(candidate => candidate.id === "hair_test_v2")!;
    const slotDef = template.slots.find(slot => slot.id === "slot_hair")!;
    const exact: LocalTransform = { x: 3, y: 4, rotation: 7, scaleX: 1.2, scaleY: 0.9 };
    const family: LocalTransform = { x: 11, y: 12, rotation: -2, scaleX: 0.8, scaleY: 0.8 };
    const profiles: ItemFitProfile[] = [
      {
        id: "family",
        fitProfile: item.fitProfile,
        templateId: "other_template",
        family: template.skeletonFamily,
        slotId: "slot_hair",
        partTransforms: { crown: family },
      },
      {
        id: "exact",
        fitProfile: item.fitProfile,
        templateId: template.id,
        family: template.skeletonFamily,
        slotId: "slot_hair",
        partTransforms: { crown: exact },
      },
    ];

    const resolved = resolveItemFitProfile(item, template, slotDef, profiles);
    expect(resolved?.id).toBe("exact");
    expect(resolveItemFitPartTransform(item, template, slotDef, "crown", profiles)).toEqual(exact);
  });

  it("falls back to family profiles when exact-template profiles are missing", () => {
    const item = ITEMS.find(candidate => candidate.id === "hair_test_v2")!;
    const slotDef = template.slots.find(slot => slot.id === "slot_hair")!;
    const family: LocalTransform = { x: 7, y: -5, rotation: 0, scaleX: 0.95, scaleY: 0.95 };
    const profiles: ItemFitProfile[] = [
      {
        id: "family",
        fitProfile: item.fitProfile,
        templateId: "different_template",
        family: template.skeletonFamily,
        slotId: "slot_hair",
        partTransforms: { crown: family },
      },
    ];

    const resolved = resolveItemFitProfile(item, template, slotDef, profiles);
    expect(resolved?.id).toBe("family");
  });

  it("falls back to item part localTransform when no fit profile exists", () => {
    const item: Item = {
      id: "fit_profile_fallback_item",
      name: "Fallback Item",
      description: "fallback",
      category: "hair",
      compatibility: {
        skeletonFamilies: [template.skeletonFamily],
        species: [],
        viewProfiles: [template.viewProfile],
      },
      allowedSlots: ["slot_hair"],
      fitProfile: "custom_profile",
      paletteChannels: ["hair", "outline"],
      hasOwnAnimation: false,
      animationClipId: null,
      anchorRules: {},
      svgLayers: [],
      parts: [{
        id: "main",
        boneId: "head",
        svgData: "<svg viewBox='0 0 10 10'></svg>",
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
        localTransform: { x: 9, y: -6, rotation: 0, scaleX: 1, scaleY: 1 },
        coordinateMode: "bone_local",
        zOffset: 0,
      }],
      coordinateMode: "bone_local",
      licenseMeta: {
        source: "test",
        author: "test",
        licenseType: "cc0",
        aiGenerated: false,
        commercialUseAllowed: true,
        purchaseRef: null,
        derivativePolicy: "unrestricted",
      },
      tags: [],
    };
    const entity = makeEntity(item);
    const zeroItem: Item = {
      ...item,
      parts: item.parts?.map(part => ({
        ...part,
        localTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      })),
    };
    const zeroEntity = makeEntity(zeroItem);

    const scene = evaluateScene(entity, template, evaluateSkeleton(template.bones, new Map()), [item]);
    const zeroScene = evaluateScene(zeroEntity, template, evaluateSkeleton(template.bones, new Map()), [zeroItem]);
    const visual = scene.visuals.find(v => v.itemId === item.id && v.partId === "main");
    const zeroVisual = zeroScene.visuals.find(v => v.itemId === zeroItem.id && v.partId === "main");
    expect(visual).toBeTruthy();
    expect(zeroVisual).toBeTruthy();
    expect(transformPoint(visual!.worldMatrix, 5, 5)).not.toEqual(transformPoint(zeroVisual!.worldMatrix, 5, 5));
  });
});
