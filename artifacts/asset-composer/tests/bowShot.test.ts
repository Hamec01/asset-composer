import { describe, it, expect } from "vitest";
import { CHIBI_ANIMATIONS } from "../src/data/chibiAnimations";
import { bipedProfileChibiBones } from "../src/data/chibiRig";
import { DEFAULT_APPEARANCE } from "../src/data/characterAppearance";
import { resolveClipPose } from "../src/lib/animationRuntime";
import { evaluateSkeleton } from "../src/lib/evaluationPipeline";
import { worldBoneToMatrix } from "../src/lib/matrixUtils";
import { attachmentAt, getAnimationContext } from "../src/lib/animationContext";

describe("bow shot wrist geometry", () => {
  const clip = CHIBI_ANIMATIONS.find(c => c.name === "bow_shoot")!;
  const at = (t: number) => evaluateSkeleton(bipedProfileChibiBones, resolveClipPose(clip,t*clip.durationMs), undefined, DEFAULT_APPEARANCE).bones;
  it("holds the bow upright and stationary throughout draw and release", () => {
    for (let i=20; i<=82; i++) {
      const hand = at(i/100).get("hand_l")!;
      expect(hand.x).toBeCloseTo(38, 4);
      expect(hand.x).toBeGreaterThan(at(i/100).get("head")!.x + 30);
      expect(hand.scaleX).toBeCloseTo(1);
      expect(hand.y).toBeCloseTo(-42, 4);
      expect(hand.rotation).toBeCloseTo(0, 4);
    }
  });
  it("takes the string then pulls it towards the face before releasing", () => {
    const start = at(.32).get("hand_r")!;
    const draw = at(.57).get("hand_r")!;
    expect(start.x).toBeCloseTo(28);
    expect(draw.x).toBeCloseTo(10);
    expect(start.y).toBeCloseTo(-42);
    expect(draw.y).toBeCloseTo(-42);
    expect(draw.rotation).toBeCloseTo(0);
    expect(at(.71).get("hand_r")!.rotation).toBeCloseTo(75);
  });
  it("steps one foot back and plants both feet throughout the shot", () => {
    const rest = at(0);
    for (const t of [.2,.32,.57,.68,.71,.82]) {
      const pose = at(t);
      expect(pose.get("foot_l")!.x).toBeCloseTo(rest.get("foot_l")!.x-10);
      expect(pose.get("foot_r")!.x).toBeCloseTo(rest.get("foot_r")!.x);
      for (const id of ["foot_l","foot_r"]) {
        expect(pose.get(id)!.y).toBeCloseTo(rest.get(id)!.y);
        expect(pose.get(id)!.rotation).toBeCloseTo(0);
      }
    }
    expect(at(.1).get("foot_l")!.y).toBeLessThan(rest.get("foot_l")!.y);
    for (const id of ["foot_l","foot_r"]) expect(at(1).get(id)).toEqual(rest.get(id));
  });
  it("stretches arm segments along the bone without widening them or the hands", () => {
    const pose = at(.5);
    const columns = (id: string) => {
      const [a,b,c,d] = worldBoneToMatrix(pose.get(id)!);
      return { width: Math.hypot(a,b), length: Math.hypot(c,d), shear: (a*c+b*d)/(Math.hypot(a,b)*Math.hypot(c,d)) };
    };
    for (const id of ["shoulder_l","elbow_l"]) {
      expect(columns(id).width).toBeCloseTo(1, 6);
      expect(columns(id).length).toBeGreaterThan(1.5);
      expect(columns(id).length).toBeLessThan(1.7);
      expect(columns(id).shear).toBeCloseTo(0, 6);
    }
    for (const id of ["hand_l","hand_r","elbow_r"]) {
      expect(columns(id).width).toBeCloseTo(1, 6);
      expect(columns(id).length).toBeCloseTo(1, 6);
      expect(columns(id).shear).toBeCloseTo(0, 6);
    }
  });
  it("switches hand drawings from the attachment timeline", () => {
    const context = (t: number) => getAnimationContext(resolveClipPose(clip, t*clip.durationMs));
    expect(attachmentAt(context(0), "hand_l")).toBeNull();
    expect(attachmentAt(context(.5), "hand_l")).toBe("grip");
    expect(attachmentAt(context(.5), "hand_r")).toBe("grip");
    expect(attachmentAt(context(.75), "hand_r")).toBeNull();
    expect(attachmentAt(context(1), "hand_l")).toBeNull();
  });
  it("reaches the same targets facing left, where the shoulders swap depth", () => {
    const left = (t: number) => evaluateSkeleton(bipedProfileChibiBones, resolveClipPose(clip,t*clip.durationMs), undefined, { ...DEFAULT_APPEARANCE, view: "left" }).bones;
    for (const t of [.32, .57]) {
      for (const id of ["hand_l", "hand_r"]) {
        expect(left(t).get(id)!.x).toBeCloseTo(-at(t).get(id)!.x, 4);
        expect(left(t).get(id)!.y).toBeCloseTo(at(t).get(id)!.y, 4);
      }
    }
  });
});
