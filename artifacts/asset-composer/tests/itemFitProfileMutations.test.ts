import { describe, expect, it } from "vitest";

import { ITEMS } from "../src/data/items";
import { TEMPLATES } from "../src/data/templates";
import type { ItemFitProfile, LocalTransform } from "../src/domain/types";
import {
  resetItemFitProfilePartToItemDefault,
  upsertItemFitProfilePartTransform,
} from "../src/lib/itemFitProfileMutations";

const template = TEMPLATES.find(candidate => candidate.id === "humanoid_topdown_v1")!;
const hair = ITEMS.find(candidate => candidate.id === "hair_test_v2")!;
const transform: LocalTransform = { x: 4, y: -3, rotation: 12, scaleX: 1.1, scaleY: 0.9 };

describe("itemFitProfileMutations", () => {
  it("creates an exact-template fit profile when none exists", () => {
    const profiles = upsertItemFitProfilePartTransform([], {
      item: hair,
      template,
      slotId: "slot_hair",
      partId: "crown",
      transform,
      scope: "template",
      anchorId: "hair_top",
    });

    expect(profiles).toHaveLength(1);
    expect(profiles[0].templateId).toBe(template.id);
    expect(profiles[0].slotId).toBe("slot_hair");
    expect(profiles[0].partTransforms.crown).toEqual(transform);
    expect(profiles[0].anchorOverrides).toEqual({ slot_hair: "hair_top" });
  });

  it("updates an existing family-scoped fit profile", () => {
    const existing: ItemFitProfile[] = [{
      id: "family",
      fitProfile: hair.fitProfile,
      templateId: "",
      family: template.skeletonFamily,
      slotId: "slot_hair",
      partTransforms: {
        crown: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      },
    }];

    const profiles = upsertItemFitProfilePartTransform(existing, {
      item: hair,
      template,
      slotId: "slot_hair",
      partId: "crown",
      transform,
      scope: "family",
    });

    expect(profiles).toHaveLength(1);
    expect(profiles[0].family).toBe(template.skeletonFamily);
    expect(profiles[0].partTransforms.crown).toEqual(transform);
  });

  it("removes a part override and deletes empty profiles on reset", () => {
    const existing: ItemFitProfile[] = [{
      id: "exact",
      fitProfile: hair.fitProfile,
      templateId: template.id,
      family: template.skeletonFamily,
      slotId: "slot_hair",
      partTransforms: {
        crown: transform,
      },
      anchorOverrides: {
        slot_hair: "hair_top",
      },
    }];

    const profiles = resetItemFitProfilePartToItemDefault(existing, {
      item: hair,
      template,
      slotId: "slot_hair",
      partId: "crown",
      scope: "template",
    });

    expect(profiles).toEqual([]);
  });
});
