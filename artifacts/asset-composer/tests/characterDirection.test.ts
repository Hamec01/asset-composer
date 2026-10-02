// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { useStore } from "../src/store";
import { resolveTemplate } from "../src/data/templates";
import { buildMultiClipPose, evaluateSkeleton, evaluateScene } from "../src/lib/evaluationPipeline";
import { animController } from "../src/core-v2/AnimationController";
import { DEFAULT_APPEARANCE } from "../src/data/characterAppearance";
import { parseProjectSnapshot } from "../src/lib/projectValidation";
import { CHIBI_ANIMATIONS } from "../src/data/chibiAnimations";
import { createEditableBodyPart } from "../src/lib/bodyPartAuthoring";
import { getCharacterBodyParts } from "../src/data/chibiBody";

afterEach(() => animController.pause());
function expectTurnedBones(right: ReturnType<typeof evaluateSkeleton>, left: ReturnType<typeof evaluateSkeleton>) {
  for (const [id, bone] of right.bones) {
    const arm = /^(shoulder|elbow|hand)_[lr]$/.test(id);
    const leg = /^(hip|knee|foot)_[lr]$/.test(id);
    const parent = right.bones.get(arm ? "chest" : "pelvis")!;
    const offset = (arm ? 10 : leg ? 5 : 0) * (id.endsWith("_r") ? -1 : 1);
    const radians = parent.rotation * Math.PI / 180;
    expect(left.bones.get(id)!.x).toBeCloseTo(-bone.x - offset * Math.cos(radians) * parent.scaleX);
    expect(left.bones.get(id)!.y).toBeCloseTo(bone.y + offset * Math.sin(radians) * parent.scaleY);
    expect(left.bones.get(id)!.rotation).toBeCloseTo(-bone.rotation);
  }
}
describe("character direction", () => {
  it.each(["left", "right"] as const)("orders entire arms around the torso in %s view, including custom art", view => {
    useStore.getState().newProject();
    useStore.getState().createEntity("character", "biped_profile_base_v1", "Layers");
    const project = useStore.getState().project;
    const entity = { ...project.entities[0], appearance: { ...DEFAULT_APPEARANCE, view } };
    const template = resolveTemplate(project, entity.templateId)!;
    const parts = getCharacterBodyParts(template, entity);
    const near = view === "left" ? "r" : "l";
    const far = near === "l" ? "r" : "l";
    const custom = createEditableBodyPart(parts.find(part => part.boneId === `shoulder_${far}`)!);
    custom.bodyView = "side";
    custom.zIndex = 999;
    entity.visuals = [custom];
    const skeleton = evaluateSkeleton(template.bones, new Map(), entity.bodyMorphs, entity.appearance);
    const scene = evaluateScene(entity, template, skeleton, []);
    const z = (id: string) => scene.visuals.find(visual => visual.id === id)!.zIndex;
    for (const part of [`hero_arm_${far}_lower`, `hero_hand_${far}`]) expect(z(`part__${part}`)).toBeLessThan(z("part__hero_torso"));
    expect(z(`vis__${custom.id}`)).toBeLessThan(z("part__hero_torso"));
    for (const part of [`hero_arm_${near}_upper`, `hero_arm_${near}_lower`, `hero_hand_${near}`]) expect(z(`part__${part}`)).toBeGreaterThan(z("part__hero_pelvis"));
    expect(Math.abs(skeleton.bones.get("shoulder_l")!.x - skeleton.bones.get("shoulder_r")!.x)).toBe(10);
    expect(parts.find(part => part.boneId === `shoulder_${far}`)!.svgData).toContain('opacity=".12"');
    expect(parts.find(part => part.boneId === `foot_${far}`)!.svgData).toContain('opacity=".12"');
    expect(skeleton.bones.get("foot_l")!.rotation).toBeCloseTo(0);
    expect(skeleton.bones.get("foot_r")!.rotation).toBeCloseTo(0);
  });
  it("keeps the falling rig finite and mirrored throughout the clip", () => {
    useStore.getState().newProject();
    useStore.getState().createEntity("character", "biped_profile_base_v1", "Fall");
    const project = useStore.getState().project;
    const entity = { ...project.entities[0], appearance: { ...DEFAULT_APPEARANCE, view: "right" as const } };
    const template = resolveTemplate(project, entity.templateId)!;
    for (let time = 0; time <= 1300; time += 50) {
      const pose = buildMultiClipPose(project.animationClips, "chibi_front__death", null, null, 1, time, entity, []);
      const right = evaluateSkeleton(template.bones, pose, entity.bodyMorphs, entity.appearance);
      const left = evaluateSkeleton(template.bones, pose, entity.bodyMorphs, { ...entity.appearance, view: "left" });
      const front = evaluateSkeleton(template.bones, pose, entity.bodyMorphs, { ...entity.appearance, view: "front" });
      for (const [id, bone] of right.bones) {
        expect(Number.isFinite(bone.x + bone.y + front.bones.get(id)!.x)).toBe(true);
      }
      expectTurnedBones(right, left);
    }
  });

  it("upgrades the rigid built-in fall without replacing an edited clip", () => {
    useStore.getState().newProject();
    useStore.getState().createEntity("character", "biped_profile_base_v1", "Fall");
    const snapshot = JSON.parse(JSON.stringify(useStore.getState().project));
    const index = snapshot.animationClips.findIndex((clip: { id: string }) => clip.id === "chibi_front__death");
    const current = CHIBI_ANIMATIONS.find(clip => clip.id === "chibi_front__death")!;
    snapshot.animationClips[index] = {
      ...current, durationMs: 1100,
      layers: [{ mask: "full_body", tracks: [{ boneId: "root", keyframes: [{
        timeMs: 1100, easing: "ease_in_out", transform: { tx: -32, ty: 12, rotation: 90, scaleX: 1, scaleY: 1 },
      }] }] }],
    };
    useStore.getState().loadProject(snapshot);
    expect(useStore.getState().project.animationClips[index]).toEqual(current);
    snapshot.animationClips[index].durationMs = 1500;
    useStore.getState().loadProject(snapshot);
    expect(useStore.getState().project.animationClips[index].durationMs).toBe(1500);
  });

  it("mirrors the entire side rig and keeps the gait moving horizontally", () => {
    useStore.getState().newProject();
    useStore.getState().createEntity("character", "biped_profile_base_v1", "Directional");
    const project = useStore.getState().project;
    const entity = { ...project.entities[0], appearance: { ...DEFAULT_APPEARANCE, view: "right" as const } };
    const template = resolveTemplate(project, entity.templateId)!;
    const positions: number[] = [];
    for (const time of [0, 225, 450, 675]) {
      const pose = buildMultiClipPose(project.animationClips, "chibi_front__walk", null, null, 1, time, entity, []);
      const right = evaluateSkeleton(template.bones, pose, entity.bodyMorphs, entity.appearance);
      const left = evaluateSkeleton(template.bones, pose, entity.bodyMorphs, { ...entity.appearance, view: "left" });
      positions.push(right.bones.get("foot_l")!.x);
      expectTurnedBones(right, left);
      const scene = evaluateScene(entity, template, right, []);
      expect(scene.visuals.find(visual => visual.id === "part__hero_arm_r_upper")!.zIndex)
        .toBeLessThan(scene.visuals.find(visual => visual.id === "part__hero_torso")!.zIndex);
    }
    expect(Math.max(...positions) - Math.min(...positions)).toBeGreaterThan(10);
    useStore.getState().setEntityAppearance(entity.id, { view: "left" });
    expect(parseProjectSnapshot(JSON.parse(JSON.stringify(useStore.getState().project))).entities[0].appearance?.view).toBe("left");
  });
});
