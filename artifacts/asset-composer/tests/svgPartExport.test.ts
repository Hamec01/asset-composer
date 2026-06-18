import { describe, expect, it } from "vitest";

import { DEFAULT_EXPORT_PROFILES } from "../src/data/exportProfiles";
import { ITEM_FIT_PROFILES } from "../src/data/itemFitProfiles";
import { ITEMS } from "../src/data/items";
import { TEMPLATES } from "../src/data/templates";
import type { Entity } from "../src/domain/types";
import { buildSvgPartExportFiles } from "../src/lib/svgPartExport";

const template = TEMPLATES.find(candidate => candidate.id === "humanoid_topdown_v1")!;
const hair = ITEMS.find(candidate => candidate.id === "hair_test_v2")!;
const svgProfile = DEFAULT_EXPORT_PROFILES.find(profile => profile.formats.includes("svg_parts"))!;

function makeEntity(): Entity {
  return {
    id: "entity-svg-export",
    name: "SVG Export Hero",
    entityType: "character",
    templateId: template.id,
    styleSetId: "style_default",
    species: "",
    palette: template.paletteTokens,
    slots: [{
      slotId: "slot_hair",
      itemId: hair.id,
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
    createdAt: 1,
    updatedAt: 1,
  };
}

describe("svg part export", () => {
  it("exports canonical evaluated visuals plus manifest metadata for V2 items", async () => {
    const files = await buildSvgPartExportFiles(
      [makeEntity()],
      ITEMS,
      ITEM_FIT_PROFILES,
      svgProfile,
      templateId => TEMPLATES.find(candidate => candidate.id === templateId),
    );

    const manifestKey = Object.keys(files).find(key => key.endsWith("/manifest.json"));
    expect(manifestKey).toBeTruthy();

    const manifest = JSON.parse(new TextDecoder().decode(files[manifestKey!])) as {
      visuals: Array<{ file: string; sourceKind: string | null; itemId: string | null }>;
    };

    expect(manifest.visuals.some(visual => visual.sourceKind === "bone-part")).toBe(true);
    expect(manifest.visuals.some(visual => visual.itemId === hair.id)).toBe(true);

    for (const visual of manifest.visuals) {
      expect(files[`svg_export_hero/${visual.file}`]).toBeInstanceOf(Uint8Array);
    }
  });
});
