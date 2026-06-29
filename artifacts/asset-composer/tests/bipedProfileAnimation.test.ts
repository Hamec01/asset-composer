import { describe, expect, it } from "vitest";

import { PRESET_ANIMATIONS } from "../src/data/presetAnimations";
import { cloneTemplates } from "../src/data/templates";
import type { Entity } from "../src/domain/types";
import { buildMultiClipPose, evaluateScene, evaluateSkeleton } from "../src/lib/evaluationPipeline";

describe("biped profile base animation", () => {
  it("renders bone-part body visuals that move under walk animation", () => {
    const template = cloneTemplates().find(candidate => candidate.id === "biped_profile_base_v1");
    expect(template).toBeTruthy();
    expect(template?.boneParts?.length).toBeGreaterThan(0);

    const idleClip = PRESET_ANIMATIONS.find(clip => clip.id === "humanoid_side_v1__idle_full");
    const walkClip = PRESET_ANIMATIONS.find(clip => clip.id === "humanoid_side_v1__walk");
    expect(idleClip).toBeTruthy();
    expect(walkClip).toBeTruthy();

    const entity: Entity = {
      id: "entity",
      name: "Profile Hero",
      entityType: "character",
      templateId: template!.id,
      styleSetId: "style_default",
      species: "",
      palette: template!.paletteTokens,
      slots: [],
      visuals: [],
      rootTransform: null,
      activeAnimationClipId: walkClip!.id,
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

    const idlePose = buildMultiClipPose(PRESET_ANIMATIONS, idleClip!.id, null, null, 1, 0, entity, []);
    const walkPose = buildMultiClipPose(PRESET_ANIMATIONS, walkClip!.id, null, null, 1, 250, entity, []);

    const idleScene = evaluateScene(entity, template!, evaluateSkeleton(template!.bones, idlePose), []);
    const walkScene = evaluateScene(entity, template!, evaluateSkeleton(template!.bones, walkPose), []);

    const idleHand = idleScene.visuals.find(visual => visual.id === "part__hand_r_side");
    const walkHand = walkScene.visuals.find(visual => visual.id === "part__hand_r_side");
    const idleFoot = idleScene.visuals.find(visual => visual.id === "part__foot_r_side");
    const walkFoot = walkScene.visuals.find(visual => visual.id === "part__foot_r_side");

    expect(idleHand?.sourceKind).toBe("bone-part");
    expect(idleFoot?.sourceKind).toBe("bone-part");
    expect(walkHand?.worldMatrix).not.toEqual(idleHand?.worldMatrix);
    expect(walkFoot?.worldMatrix).not.toEqual(idleFoot?.worldMatrix);
  });
});
