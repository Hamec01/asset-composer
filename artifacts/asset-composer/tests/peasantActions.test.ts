// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { CHIBI_ANIMATIONS, upgradeChibiActionClip } from "../src/data/chibiAnimations";
import { PEASANT_EQUIPMENT } from "../src/data/peasantEquipment";
import { DEFAULT_APPEARANCE } from "../src/data/characterAppearance";
import { bipedProfileChibiBones } from "../src/data/chibiRig";
import { resolveClipPose } from "../src/lib/animationRuntime";
import { buildMultiClipPose, evaluateSkeleton, evaluateScene } from "../src/lib/evaluationPipeline";
import { resolveTemplate } from "../src/data/templates";
import { useStore } from "../src/store";
import { animController } from "../src/core-v2/AnimationController";
import { transformPoint } from "../src/lib/matrixUtils";

afterEach(() => animController.pause());
const actions = CHIBI_ANIMATIONS.filter(clip => ["axe_strike", "sword_strike", "laugh", "pickup", "carry"].includes(clip.name));

describe("2.5D peasant actions", () => {
  for (const clip of actions) {
    it(`${clip.name} has finite mirrored poses and a stable ending`, () => {
      for (let frame = 0; frame <= 30; frame++) {
        const pose = resolveClipPose(clip, clip.durationMs * frame / 30);
        const right = evaluateSkeleton(bipedProfileChibiBones, pose, undefined, DEFAULT_APPEARANCE);
        const left = evaluateSkeleton(bipedProfileChibiBones, pose, undefined, { ...DEFAULT_APPEARANCE, view: "left" });
        for (const [id, bone] of right.bones) {
          expect(Object.values(bone).every(Number.isFinite)).toBe(true);
          if (!id.endsWith("_l") && !id.endsWith("_r")) {
            expect(left.bones.get(id)!.x).toBeCloseTo(-bone.x);
            expect(left.bones.get(id)!.y).toBeCloseTo(bone.y);
          }
          expect(bone.scaleX).toBeGreaterThan(0);
          expect(bone.scaleY).toBeGreaterThan(0);
        }
      }
      expect(resolveClipPose(clip, 0)).toEqual(resolveClipPose(clip, clip.durationMs));
      expect(clip.loops).toBe(["laugh", "carry"].includes(clip.name));
    });
  }

  it("keeps pickup feet close to the ground throughout the crouch", () => {
    const clip = actions.find(clip => clip.name === "pickup")!;
    const standing = evaluateSkeleton(bipedProfileChibiBones, new Map(), undefined, DEFAULT_APPEARANCE);
    for (let frame = 0; frame <= 40; frame++) {
      const skeleton = evaluateSkeleton(bipedProfileChibiBones, resolveClipPose(clip, clip.durationMs * frame / 40), undefined, DEFAULT_APPEARANCE);
      for (const id of ["foot_l", "foot_r"]) {
        expect(Math.abs(skeleton.bones.get(id)!.y - standing.bones.get(id)!.y)).toBeLessThan(1.5);
        expect(skeleton.bones.get(id)!.rotation).toBeCloseTo(0);
      }
    }
  });

  it("raises the axe upright then swings its blade forwards", () => {
    const clip = actions.find(clip => clip.name === "axe_strike")!;
    const raised = evaluateSkeleton(bipedProfileChibiBones, resolveClipPose(clip, 495), undefined, DEFAULT_APPEARANCE);
    const impact = evaluateSkeleton(bipedProfileChibiBones, resolveClipPose(clip, 660), undefined, DEFAULT_APPEARANCE);
    const axeRotation = PEASANT_EQUIPMENT.find(item => item.id === "peasant_axe_25d")!.parts![0].localTransform.rotation;
    expect(raised.bones.get("hand_l")!.rotation + axeRotation).toBeCloseTo(0);
    expect(raised.bones.get("hand_l")!.x).toBeGreaterThan(15);
    expect(impact.bones.get("hand_l")!.rotation + axeRotation).toBeCloseTo(90);
  });

  it("keeps the torso waist attached to the pelvis while picking up in either direction", () => {
    const clip = actions.find(clip => clip.name === "pickup")!;
    const waistY = -bipedProfileChibiBones.find(bone => bone.id === "spine")!.restPose.ty;
    for (const view of ["right", "left"] as const) {
      for (let frame = 0; frame <= 40; frame++) {
        const skeleton = evaluateSkeleton(bipedProfileChibiBones, resolveClipPose(clip, clip.durationMs * frame / 40), undefined,
          { ...DEFAULT_APPEARANCE, view });
        const spine = skeleton.bones.get("spine")!;
        const pelvis = skeleton.bones.get("pelvis")!;
        const angle = spine.rotation * Math.PI / 180;
        expect(spine.x - waistY * spine.scaleY * Math.sin(angle)).toBeCloseTo(pelvis.x);
        expect(spine.y + waistY * spine.scaleY * Math.cos(angle)).toBeCloseTo(pelvis.y);
      }
    }
  });

  it("upgrades the earlier axe gesture without overwriting edited keyframes", () => {
    const canonical = actions.find(clip => clip.name === "axe_strike")!;
    const old = structuredClone(canonical);
    const rotations: Record<string, number[]> = { hand_l: [0, -25, -30, 45, 20, 0],
      shoulder_l: [0, -150, -165, -45, -35, 0], elbow_l: [0, 55, 45, -25, -10, 0],
      shoulder_r: [0, -85, -110, -60, -25, 0], elbow_r: [0, -25, -25, -25, 0, 0] };
    for (const track of old.layers[0].tracks) {
      if (rotations[track.boneId]) track.keyframes.forEach((frame, index) => { frame.transform.rotation = rotations[track.boneId][index]; });
    }
    expect(upgradeChibiActionClip(old)).toEqual(canonical);
    old.layers[0].tracks[0].keyframes[1].transform.rotation = 42;
    expect(upgradeChibiActionClip(old)).toBe(old);
  });

  it("loads clothing on compatible bones and keeps front / rear depth", () => {
    useStore.getState().newProject();
    useStore.getState().createEntity("character", "biped_profile_base_v1", "Peasant");
    const project = useStore.getState().project;
    const entity = structuredClone(project.entities[0]);
    const template = resolveTemplate(project, entity.templateId)!;
    for (const item of PEASANT_EQUIPMENT) {
      expect(template.slots.some(slot => item.allowedSlots.includes(slot.id))).toBe(true);
      entity.slots.find(slot => slot.slotId === item.allowedSlots[0])!.itemId = item.id;
      for (const part of item.parts!) expect(template.bones.some(bone => bone.id === part.boneId)).toBe(true);
    }
    const skeleton = evaluateSkeleton(template.bones, new Map(), undefined, entity.appearance);
    const scene = evaluateScene(entity, template, skeleton, PEASANT_EQUIPMENT);
    const near = scene.visuals.find(visual => visual.partId === "sleeve_upper_l")!;
    const far = scene.visuals.find(visual => visual.partId === "sleeve_upper_r")!;
    expect(near.zIndex).toBeGreaterThan(far.zIndex);
    expect(scene.visuals.filter(visual => visual.sourceKind === "item-part")).toHaveLength(17);
  });

  it("keeps an axe grip inside its hand and swaps weapon / shield depth when turning", () => {
    useStore.getState().newProject();
    useStore.getState().createEntity("character", "biped_profile_base_v1", "Hands");
    const project = useStore.getState().project;
    const entity = structuredClone(project.entities[0]);
    const template = resolveTemplate(project, entity.templateId)!;
    const axe = PEASANT_EQUIPMENT.find(item => item.id === "peasant_axe_25d")!;
    const shield = structuredClone(axe);
    shield.id = "test-shield";
    shield.category = "shield";
    shield.tags = [];
    shield.allowedSlots = ["side_slot_weapon_off"];
    shield.parts![0].boneId = "hand_r";
    entity.slots.find(slot => slot.slotId === "side_slot_weapon_main")!.itemId = axe.id;
    entity.slots.find(slot => slot.slotId === "side_slot_weapon_off")!.itemId = shield.id;
    for (const view of ["right", "left"] as const) {
      entity.appearance = { ...DEFAULT_APPEARANCE, view };
      const skeleton = evaluateSkeleton(template.bones, new Map(), undefined, entity.appearance);
      const scene = evaluateScene(entity, template, skeleton, [axe, shield]);
      const axeVisual = scene.visuals.find(visual => visual.itemId === axe.id)!;
      const shieldVisual = scene.visuals.find(visual => visual.itemId === shield.id)!;
      const grip = transformPoint(axeVisual.worldMatrix, 0, 0);
      const hand = skeleton.bones.get("hand_l")!;
      expect(grip.x).toBeCloseTo(hand.x);
      expect(grip.y).toBeCloseTo(hand.y);
      expect(axeVisual.zIndex > shieldVisual.zIndex).toBe(view === "right");
      const near = scene.visuals.find(visual => visual.boneId === `hand_${view === "right" ? "l" : "r"}`)!;
      expect(near.zIndex).toBeGreaterThan(-900);
    }
    expect(axe.parts![0].metrics.visualMinX).toBe(axe.parts![0].metrics.viewBoxX);
    expect(axe.parts![0].metrics.visualWidth).toBe(axe.parts![0].metrics.viewBoxWidth);
  });

  it("laughs without changing the selected face presets", () => {
    useStore.getState().newProject();
    useStore.getState().createEntity("character", "biped_profile_base_v1", "Face");
    const project = useStore.getState().project;
    const entity = structuredClone(project.entities[0]);
    const template = resolveTemplate(project, entity.templateId)!;
    entity.faceCustomization!.eyes.visible = true;
    entity.faceCustomization!.eyes.presetId = "dot_cute";
    const skeleton = evaluateSkeleton(template.bones, new Map(), undefined, entity.appearance);
    const before = evaluateScene(entity, template, skeleton, []);
    const selected = structuredClone(entity.faceCustomization);
    entity.activeAnimationClipId = "chibi_front__laugh";
    const laughing = evaluateScene(entity, template, skeleton, []);
    const eyes = (scene: typeof before) => scene.visuals.find(visual => visual.entityVisualId === "face__eyes")!.svgData;
    expect(eyes(laughing)).not.toBe(eyes(before));
    expect(entity.faceCustomization).toEqual(selected);
    entity.activeAnimationClipId = "chibi_front__idle";
    expect(eyes(evaluateScene(entity, template, skeleton, []))).toBe(eyes(before));
  });

  it.each(["peasant_axe_25d", "iron_sword_25d"])("walks with %s in its hand without tipping it or dragging its blade", itemId => {
    useStore.getState().newProject();
    useStore.getState().createEntity("character", "biped_profile_base_v1", "Walk armed");
    const project = useStore.getState().project;
    const entity = structuredClone(project.entities[0]);
    const template = resolveTemplate(project, entity.templateId)!;
    const weapon = PEASANT_EQUIPMENT.find(item => item.id === itemId)!;
    entity.slots.find(slot => slot.slotId === "side_slot_weapon_main")!.itemId = itemId;
    for (const view of ["left", "right"] as const) {
      entity.appearance = { ...DEFAULT_APPEARANCE, view };
      for (let frame = 0; frame <= 24; frame++) {
        const pose = buildMultiClipPose(project.animationClips, "chibi_front__walk", null, null, 1, 900 * frame / 24, entity, [weapon]);
        expect(Math.abs(pose.get("shoulder_l")!.rotation)).toBeLessThanOrEqual(10);
        const skeleton = evaluateSkeleton(template.bones, pose, undefined, entity.appearance);
        expect(skeleton.bones.get("hand_l")!.rotation).toBeCloseTo(0);
        const visual = evaluateScene(entity, template, skeleton, [weapon]).visuals.find(visual => visual.itemId === itemId)!;
        const grip = transformPoint(visual.worldMatrix, 0, 0);
        const hand = skeleton.bones.get("hand_l")!;
        expect(grip.x).toBeCloseTo(hand.x);
        expect(grip.y).toBeCloseTo(hand.y);
        const tip = transformPoint(visual.worldMatrix, 0, itemId === "iron_sword_25d" ? -35 : -30);
        expect(tip.y).toBeGreaterThan(grip.y);
        expect(tip.y).toBeLessThanOrEqual(36);
      }
    }
  });
});
