// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { useStore } from "../src/store";
import { resolveTemplate } from "../src/data/templates";
import { resolveClipPose } from "../src/lib/animationRuntime";
import { evaluateSkeleton, evaluateScene } from "../src/lib/evaluationPipeline";
import { CHIBI_ANIMATIONS } from "../src/data/chibiAnimations";
import { animController } from "../src/core-v2/AnimationController";
import type { AnimationClip } from "../src/domain/types";

describe("attachment timeline and bone inheritance", () => {
  it("are driven by clip data, not by the built-in clip ID", () => {
    useStore.getState().newProject();
    useStore.getState().createEntity("character", "biped_profile_base_v1", "Archer");
    const project = useStore.getState().project;
    const entity = structuredClone(project.entities[0]);
    const template = resolveTemplate(project, entity.templateId)!;
    entity.slots.find(s => s.slotId === "side_slot_torso")!.itemId = "trader_tunic_25d";
    entity.slots.find(s => s.slotId === "side_slot_weapon_main")!.itemId = "bow_25d";
    const builtIn = CHIBI_ANIMATIONS.find(c => c.name === "bow_shoot")!;
    const copy: AnimationClip = { ...structuredClone(builtIn), id: "user_archery_copy" };

    const scene = (clip: AnimationClip, fraction: number) => {
      entity.activeAnimationClipId = clip.id;
      const pose = resolveClipPose(clip, clip.durationMs * fraction);
      return evaluateScene(entity, template, evaluateSkeleton(template.bones, pose, undefined, entity.appearance), project.items);
    };
    const hand = (clip: AnimationClip, fraction: number) =>
      scene(clip, fraction).visuals.find(v => v.sourceKind === "bone-part" && v.boneId === "hand_l")!;

    const openHand = hand(builtIn, 0).svgData;
    expect(hand(builtIn, .5).svgData).not.toBe(openHand);
    expect(hand(copy, .5).svgData).toBe(hand(builtIn, .5).svgData);
    expect(hand(copy, 1).svgData).toBe(openHand);

    // Sleeves follow the stretched arm without the renderer correcting their width.
    const sleeve = (clip: AnimationClip) => scene(clip, .5).visuals.find(v => v.partId === "sleeve_upper_l")!.worldMatrix;
    expect(sleeve(copy)).toEqual(sleeve(builtIn));
    expect(Math.hypot(sleeve(copy)[0], sleeve(copy)[1])).toBeLessThan(1.2);
    animController.pause();
  });
});
