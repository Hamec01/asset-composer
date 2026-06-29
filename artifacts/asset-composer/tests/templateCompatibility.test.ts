import { describe, expect, it } from "vitest";

import { cloneTemplates } from "../src/data/templates";
import type { Item, Template } from "../src/domain/types";
import {
  getTemplateCompatibilityFamilies,
  getTemplateCompatibilityViewProfiles,
  itemSupportsTemplate,
  templateMatchesCompatibilityFamily,
} from "../src/lib/templateCompatibility";

describe("template compatibility", () => {
  it("exposes both legacy skeleton family and explicit rig family ids", () => {
    const template = cloneTemplates().find(candidate => candidate.id === "humanoid_topdown_v1");
    expect(template).toBeTruthy();

    expect(getTemplateCompatibilityFamilies(template!)).toEqual([
      "humanoid_topdown_v1",
      "biped_directional_v1",
    ]);
  });

  it("matches items against explicit rig families and resolved views", () => {
    const template = cloneTemplates().find(candidate => candidate.id === "humanoid_topdown_v1");
    expect(template).toBeTruthy();

    const item: Item = {
      id: "rig-family-item",
      name: "Rig Family Item",
      description: "compat test",
      category: "hair",
      compatibility: {
        skeletonFamilies: ["biped_directional_v1"],
        species: [],
        viewProfiles: ["topdown_45"],
      },
      allowedSlots: ["slot_hair"],
      fitProfile: "standard",
      paletteChannels: [],
      hasOwnAnimation: false,
      animationClipId: null,
      anchorRules: {},
      svgLayers: [],
      parts: [],
      coordinateMode: "legacy_full_frame",
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

    expect(itemSupportsTemplate(item, template!)).toBe(true);
    expect(templateMatchesCompatibilityFamily(template!, "biped_directional_v1")).toBe(true);
    expect(getTemplateCompatibilityViewProfiles(template!)).toContain("topdown_45");
  });

  it("supports legacy-only templates without explicit rig metadata", () => {
    const source = cloneTemplates().find(candidate => candidate.id === "humanoid_side_v1");
    expect(source).toBeTruthy();
    const template: Template = {
      ...source!,
      rigFamilyId: undefined,
      defaultFacing: undefined,
      views: undefined,
    };

    expect(getTemplateCompatibilityFamilies(template)).toEqual(["humanoid_side_v1"]);
    expect(getTemplateCompatibilityViewProfiles(template)).toEqual(["side_view"]);
  });
});
