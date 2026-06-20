import { describe, expect, it } from "vitest";

import { ITEMS } from "../src/data/items";
import { TEMPLATES } from "../src/data/templates";
import type { Entity } from "../src/domain/types";
import { evaluateRestSkeleton, evaluateScene } from "../src/lib/evaluationPipeline";

const template = TEMPLATES.find(candidate => candidate.id === "humanoid_topdown_v1")!;
const hair = ITEMS.find(candidate => candidate.id === "hair_test_v2")!;

function makeEntity(hairColor: string): Entity {
  return {
    id: "entity_hair",
    name: "Hair Test",
    entityType: "character",
    templateId: template.id,
    styleSetId: "style_default",
    species: "",
    palette: {
      ...template.paletteTokens,
      hair: hairColor,
    },
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
    createdAt: 0,
    updatedAt: 0,
  };
}

describe("V2 hair palette", () => {
  it("recolors V2 hair when the Hair palette token changes", () => {
    const baseScene = evaluateScene(
      makeEntity("#2B1D18"),
      template,
      evaluateRestSkeleton(template.bones),
      [hair],
    );
    const recoloredScene = evaluateScene(
      makeEntity("#ff33aa"),
      template,
      evaluateRestSkeleton(template.bones),
      [hair],
    );

    const baseHairVisual = baseScene.visuals.find(visual => visual.itemId === hair.id);
    const recoloredHairVisual = recoloredScene.visuals.find(visual => visual.itemId === hair.id);

    expect(baseHairVisual).toBeTruthy();
    expect(recoloredHairVisual).toBeTruthy();
    expect(baseHairVisual!.svgData).toContain("#2B1D18");
    expect(recoloredHairVisual!.svgData).toContain("#ff33aa");
    expect(recoloredHairVisual!.svgData).not.toContain("#2B1D18");
  });
});
