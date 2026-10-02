import { describe, expect, it } from "vitest";
import { CHIBI_ANIMATIONS } from "../src/data/chibiAnimations";
import { bipedProfileChibiBones } from "../src/data/chibiRig";
import { resolveClipPose } from "../src/lib/animationRuntime";

describe("front chibi locomotion", () => {
  for (const clip of CHIBI_ANIMATIONS.filter(clip => ["idle_full", "walk", "run"].includes(clip.name))) {
    it(`${clip.name} keeps legs facing forward and closes its loop`, () => {
      for (let frame = 0; frame <= 24; frame += 1) {
        const pose = resolveClipPose(clip, clip.durationMs * frame / 24);
        for (const bone of bipedProfileChibiBones.filter(bone => /^(hip|knee|foot)_/.test(bone.id))) {
          expect(pose.get(bone.id)?.rotation ?? 0).toBe(0);
          expect(pose.get(bone.id)?.tx ?? 0).toBe(0);
          expect(pose.get(bone.id)?.scaleY ?? 1).toBeGreaterThan(0.75);
        }
      }
      expect(resolveClipPose(clip, 0)).toEqual(resolveClipPose(clip, clip.durationMs));
    });
  }
  it("anticipates, bends the limbs, lands and holds a settled pose", () => {
    const clip = CHIBI_ANIMATIONS.find(clip => clip.name === "death")!;
    expect(clip.loops).toBe(false);
    expect(resolveClipPose(clip, 160).get("root")!.rotation).toBeGreaterThan(0);
    expect(resolveClipPose(clip, 340).get("knee_l")!.rotation).toBeGreaterThan(40);
    expect(resolveClipPose(clip, 760).get("root")!.rotation).toBe(-88);
    expect(resolveClipPose(clip, 850).get("root")!.ty).toBeLessThan(resolveClipPose(clip, 760).get("root")!.ty);
    expect(resolveClipPose(clip, 1040)).toEqual(resolveClipPose(clip, clip.durationMs));
    for (let time = 0; time <= clip.durationMs; time += 40) {
      for (const transform of resolveClipPose(clip, time).values()) {
        expect(transform.scaleX).toBe(1);
        expect(transform.scaleY).toBe(1);
        expect(Number.isFinite(transform.rotation)).toBe(true);
      }
    }
  });
});
