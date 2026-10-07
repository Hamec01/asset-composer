import { describe, it, expect } from "vitest";
import { CHIBI_ANIMATIONS, upgradeBowClip } from "../src/data/chibiAnimations";
import { bipedProfileChibiBones } from "../src/data/chibiRig";
import { DEFAULT_APPEARANCE } from "../src/data/characterAppearance";
import { resolveClipPose } from "../src/lib/animationRuntime";
import { evaluateSkeleton } from "../src/lib/evaluationPipeline";
import { worldBoneToMatrix } from "../src/lib/matrixUtils";
import { attachmentAt, getAnimationContext } from "../src/lib/animationContext";
import { ProjectSchema } from "../src/domain/schema";
import { armDiagnostics } from "../src/lib/armDiagnostics";
import { ikKeyAt } from "../src/lib/ikConstraint";
import { readFileSync, writeFileSync } from "node:fs";

describe("bow shot wrist geometry", () => {
  const clip = CHIBI_ANIMATIONS.find(c => c.name === "bow_shoot")!;
  const at = (t: number) => evaluateSkeleton(bipedProfileChibiBones, resolveClipPose(clip,t*clip.durationMs), undefined, DEFAULT_APPEARANCE).bones;
  it("checks every exported frame and half-frame with the shared diagnostics", () => {
    expect(clip.durationMs*clip.fps/1000).toBe(48);
    expect(clip.ik!.every(c => c.keyframes.length<20)).toBe(true);
    for (const view of ["right","left"] as const) {
      const appearance={...DEFAULT_APPEARANCE,view};
      const rest=evaluateSkeleton(bipedProfileChibiBones,new Map(),undefined,appearance);
      let previous=evaluateSkeleton(bipedProfileChibiBones,resolveClipPose(clip,0),undefined,appearance);
      for(let frame=0;frame<=96;frame++) {
        const time=frame*500/clip.fps;
        const pose=evaluateSkeleton(bipedProfileChibiBones,resolveClipPose(clip,time),undefined,appearance);
        for(const d of armDiagnostics(clip,time,pose,rest,previous,view === "left")) {
          expect(d.lengthError).toBeLessThan(1);
          if(d.mix>=.999) expect(d.gripError).toBeLessThan(2);
          expect(d.turn,`${view} ${frame/2} ${d.id}`).toBeLessThan(45);
          expect(d.velocity,`${view} ${frame/2} ${d.id}`).toBeLessThan(10);
          const constraint=clip.ik!.find(c => c.bones[0]===d.id)!;
          if(d.bend && d.mix>=.999) expect(d.bend).toBe(-(ikKeyAt(constraint.keyframes,time)!.bend ?? constraint.bend));
        }
        previous=pose;
      }
    }
    if (process.env.ARM_REPORT) {
      const audit=(candidate: typeof clip) => {
        const rest=evaluateSkeleton(bipedProfileChibiBones,new Map(),undefined,DEFAULT_APPEARANCE);
        let previous=evaluateSkeleton(bipedProfileChibiBones,resolveClipPose(candidate,0),undefined,DEFAULT_APPEARANCE);
        const samples=Array.from({length:97},(_,i) => {
          const time=i*500/candidate.fps;
          const pose=evaluateSkeleton(bipedProfileChibiBones,resolveClipPose(candidate,time),undefined,DEFAULT_APPEARANCE);
          const arms=armDiagnostics(candidate,time,pose,rest,previous);
          previous=pose;
          return {frame:i/2,timeMs:time,arms};
        });
        const arms=samples.flatMap(s => s.arms);
        return {maxLengthError:Math.max(...arms.map(a => a.lengthError)),
          maxGripError:Math.max(...arms.filter(a => a.mix>=.999).map(a => a.gripError ?? Infinity)),
          maxTurn:Math.max(...arms.map(a => a.turn)),maxJointStep:Math.max(...arms.map(a => a.velocity)),samples};
      };
      const before=process.env.ARM_BEFORE ? JSON.parse(readFileSync(process.env.ARM_BEFORE,"utf8")).animationClips.find((c: typeof clip) => c.name === "bow_shoot") : null;
      writeFileSync(process.env.ARM_REPORT,JSON.stringify({note:"Before target path replayed with the corrected solver, not the old engine render.",
        before:before ? audit(before) : null,after:audit(clip)},null,2));
    }
  });
  it("preserves profile shoulder anchors on save and leaves authored rigs unchanged", () => {
    const parsed = ProjectSchema.shape.animationClips.element.parse(JSON.parse(JSON.stringify(clip)));
    expect(parsed.ik?.map(constraint => constraint.profileRootX)).toEqual([0, -4]);
    const withoutAnchors = structuredClone(clip);
    withoutAnchors.ik?.forEach(constraint => delete constraint.profileRootX);
    const appearance = { ...DEFAULT_APPEARANCE, projection: "authored" as const };
    const evaluate = (candidate: typeof clip) => evaluateSkeleton(bipedProfileChibiBones,
      resolveClipPose(candidate, candidate.durationMs*.6), undefined, appearance).bones;
    expect(evaluate(clip)).toEqual(evaluate(withoutAnchors));
  });
  it("upgrades the saved canonical reach but preserves user-authored IK", () => {
    const legacy=structuredClone(clip);
    legacy.layers[0].tracks.filter(t=>/^shoulder_[lr]$/.test(t.boneId)).forEach(t=>t.keyframes.forEach(k=>k.transform.ty=0));
    legacy.ik![0].keyframes.forEach(k=>{if(k.timeMs>=400 && k.timeMs<=1640) k.y=-37;});
    const arm=legacy.ik!.find(c=>c.bones[0]==="shoulder_r")!;
    arm.keyframes=arm.keyframes.filter(k=>k.timeMs!==900 && k.timeMs!==1060);
    const hand=legacy.attachments!.find(track=>track.boneId === "hand_r")!;
    hand.keyframes.find(key=>key.name === "string_hook")!.timeMs=640;
    hand.keyframes.at(-1)!.timeMs=1680;
    const oldTargets:Record<number,[number,number]>={560:[-14,-21],640:[-14,-29],1140:[-8,-38],1360:[-8,-38],1420:[-11,-38],1520:[-11,-38],1640:[-4,-47],1720:[8,-43],1840:[16,-23],1920:[8.832000000000004,-13.144000000000005],1940:[8,-12]};
    for (const key of arm.keyframes) {
      key.bend=1;
      const target=oldTargets[key.timeMs];
      if(target) Object.assign(key,{x:target[0],y:target[1]});
    }
    expect(upgradeBowClip(ProjectSchema.shape.animationClips.element.parse(legacy)).ik).toEqual(clip.ik);
    const authored=structuredClone(legacy);
    authored.ik![1].keyframes[2].x=18;
    expect(upgradeBowClip(authored).ik).toEqual(authored.ik);
  });
  it("upgrades the actual browser-saved clip rather than only a reconstructed canonical fixture",()=>{
    const saved=ProjectSchema.shape.animationClips.element.parse(JSON.parse(readFileSync(new URL("./fixtures/bow-browser-v20.json",import.meta.url),"utf8")));
    const upgraded=upgradeBowClip(saved);
    expect(upgraded.layers).toEqual(clip.layers);
    expect(upgraded.ik).toEqual(clip.ik);
    expect(upgraded.limbDepth).toEqual(clip.limbDepth);
    expect(upgraded.attachments).toEqual(clip.attachments);
    const authored=structuredClone(saved);
    authored.ik![1].keyframes[2].x=18;
    expect(upgradeBowClip(authored).ik).toEqual(authored.ik);
  });
  it("holds the bow upright and stationary throughout draw and release", () => {
    for (let i=20; i<=82; i++) {
      const hand = at(i/100).get("hand_l")!;
      expect(hand.x).toBeCloseTo(27, 4);
      expect(hand.x).toBeGreaterThan(at(i/100).get("head")!.x + 20);
      expect(hand.scaleX).toBeCloseTo(1);
      expect(hand.y).toBeCloseTo(-35, 4);
      expect(hand.rotation).toBeCloseTo(0, 4);
    }
  });
  it("takes the string then pulls it towards the face before releasing", () => {
    const start = at(.32).get("hand_r")!;
    const draw = at(.57).get("hand_r")!;
    expect(start.x).toBeCloseTo(-3.990381056766578);
    expect(draw.x).toBeCloseTo(-6);
    expect(start.y).toBeCloseTo(-26.5);
    expect(draw.y).toBeCloseTo(-35);
    expect(draw.rotation).toBeCloseTo(0);
    expect(at(.71).get("hand_r")!.rotation).toBeCloseTo(4);
    expect(at(.71).get("hand_r")!.x).toBeCloseTo(-6.3);
    expect(at(.71).get("hand_r")!.y).toBeCloseTo(-35.5);
  });
  it("raises the bow before reaching for the string", () => {
    expect(at(.2).get("hand_l")!.y).toBeCloseTo(-35);
    expect(at(.2).get("hand_r")!.y).toBeCloseTo(-7);
    expect(at(.25).get("hand_r")!.y).toBeGreaterThan(at(.32).get("hand_r")!.y);
  });
  it("keeps the lifting elbow below the head, then moves it behind the shoulder with separated wrists", () => {
    for (const view of ["left","right"] as const) {
      const pose=(time:number) => evaluateSkeleton(bipedProfileChibiBones,resolveClipPose(clip,time),undefined,{...DEFAULT_APPEARANCE,view}).bones;
      for (const time of [440,480,520,560,600,640,900,1140]) {
        const bones=pose(time), a=bones.get("shoulder_r")!, b=bones.get("elbow_r")!, c=bones.get("hand_r")!;
        const direction=view === "right" ? 1 : -1;
        if(time>=560) expect(direction*(b.x-a.x)).toBeLessThan(-2);
        expect(b.y).toBeGreaterThan(-35);
        expect(Math.abs(c.x-bones.get("hand_l")!.x)).toBeGreaterThan(25);
      }
      for (const id of ["elbow_r","hand_r"]) {
        const a=pose(559.999).get(id)!,b=pose(560.001).get(id)!;
        expect(Math.hypot(a.x-b.x,a.y-b.y)).toBeLessThan(.01);
      }
    }
  });
  it("lifts and lowers the rear elbow without a dangling folded forearm or an IK branch jump",()=>{
    for(const view of ["left","right"] as const) {
      const direction=view === "right" ? 1 : -1;
      const pose=(time:number)=>evaluateSkeleton(bipedProfileChibiBones,resolveClipPose(clip,time),undefined,{...DEFAULT_APPEARANCE,view}).bones;
      for(const time of [560,640,900,1060,1520,1640,1720]) {
        const bones=pose(time),elbow=bones.get("elbow_r")!,wrist=bones.get("hand_r")!,shoulder=bones.get("shoulder_r")!;
        expect(direction*(elbow.x-shoulder.x)).toBeLessThan(-4);
        expect(direction*(wrist.x-elbow.x)).toBeGreaterThan(12);
        expect(Math.abs(wrist.y-elbow.y)).toBeLessThan(1);
      }
      for(const time of [1060,1520]) {
        const before=pose(time-.001),after=pose(time+.001);
        for(const id of ["elbow_r","hand_r"]) expect(Math.hypot(before.get(id)!.x-after.get(id)!.x,before.get(id)!.y-after.get(id)!.y)).toBeLessThan(.01);
      }
    }
  });
  it("keeps the drawing elbow behind the shoulder and away from the bow arm in either facing", () => {
    for (const view of ["right", "left"] as const) {
      const direction = view === "right" ? 1 : -1;
      for (const t of [.57, .62, .68]) {
        const bones = evaluateSkeleton(bipedProfileChibiBones, resolveClipPose(clip, t*clip.durationMs), undefined,
          { ...DEFAULT_APPEARANCE, view }).bones;
        const shoulder = bones.get("shoulder_r")!;
        const elbow = bones.get("elbow_r")!;
        const wrist = bones.get("hand_r")!;
        expect(direction * (elbow.x - shoulder.x)).toBeLessThan(-5);
        expect(Math.abs(elbow.y - shoulder.y)).toBeLessThan(1);
        expect(Math.abs(elbow.y - wrist.y)).toBeLessThan(1);
        expect(direction * (wrist.x - elbow.x)).toBeGreaterThan(12);
        expect(Math.abs(elbow.x - bones.get("elbow_l")!.x)).toBeGreaterThan(15);
        const bowWrist = bones.get("hand_l")!;
        expect(direction*(bowWrist.x-wrist.x)).toBeGreaterThan(30);
      }
    }
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
  it("recovers without a full joint spin or a wrist teleport", () => {
    for (const view of ["left", "right"] as const) {
      let previous = evaluateSkeleton(bipedProfileChibiBones, resolveClipPose(clip, .82*clip.durationMs), undefined,
        { ...DEFAULT_APPEARANCE, view }).bones;
      for (let i = 83; i <= 100; i++) {
        const current = evaluateSkeleton(bipedProfileChibiBones, resolveClipPose(clip, i/100*clip.durationMs), undefined,
          { ...DEFAULT_APPEARANCE, view }).bones;
        for (const id of ["shoulder_l", "elbow_l", "hand_l", "shoulder_r", "elbow_r", "hand_r"]) {
          const a = previous.get(id)!, b = current.get(id)!;
          const turn = ((b.rotation-a.rotation+180)%360+360)%360-180;
          expect(Math.abs(turn), `${view} ${id} frame ${i}`).toBeLessThan(45);
          expect(Math.hypot(b.x-a.x, b.y-a.y), `${view} ${id} frame ${i}`).toBeLessThan(10);
        }
        previous = current;
      }
    }
  });
  it("keeps both arm lengths constant throughout the clip instead of stretching sleeves", () => {
    const pose = at(.6);
    const columns = (id: string) => {
      const [a,b,c,d] = worldBoneToMatrix(pose.get(id)!);
      return { width: Math.hypot(a,b), length: Math.hypot(c,d), shear: (a*c+b*d)/(Math.hypot(a,b)*Math.hypot(c,d)) };
    };
    for (const id of ["shoulder_l","elbow_l"]) {
      expect(columns(id).width).toBeCloseTo(1, 6);
      expect(columns(id).length).toBeCloseTo(1, 6);
      expect(columns(id).shear).toBeCloseTo(0, 6);
    }
    expect(columns("shoulder_r").length).toBeCloseTo(1, 6);
    expect(columns("elbow_r").length).toBeCloseTo(1, 6);
    expect(clip.ik?.every(constraint => !constraint.stretch)).toBe(true);
    for (let frame=0; frame<=100; frame++) {
      const bones=at(frame/100);
      for (const side of ["l", "r"]) {
        const shoulder=bones.get(`shoulder_${side}`)!, elbow=bones.get(`elbow_${side}`)!, wrist=bones.get(`hand_${side}`)!;
        expect(Math.hypot(elbow.x-shoulder.x, elbow.y-shoulder.y)).toBeCloseTo(15, 5);
        expect(Math.hypot(wrist.x-elbow.x, wrist.y-elbow.y)).toBeCloseTo(13, 5);
      }
    }
    for (const id of ["hand_l","hand_r"]) {
      expect(columns(id).width).toBeCloseTo(1, 6);
      expect(columns(id).length).toBeCloseTo(1, 6);
      expect(columns(id).shear).toBeCloseTo(0, 6);
    }
  });
  it("switches hand drawings from the attachment timeline", () => {
    const context = (t: number) => getAnimationContext(resolveClipPose(clip, t*clip.durationMs));
    expect(attachmentAt(context(0), "hand_l")).toBe("bow_grip");
    expect(attachmentAt(context(.5), "hand_l")).toBe("bow_grip");
    expect(attachmentAt(context(.5), "hand_r")).toBe("string_hook");
    expect(attachmentAt(context(.75), "hand_r")).toBe("string_release");
    expect(attachmentAt(context(1), "hand_l")).toBe("bow_grip");
  });
  it("reaches the same targets facing left, where the shoulders swap depth", () => {
    const left = (t: number) => evaluateSkeleton(bipedProfileChibiBones, resolveClipPose(clip,t*clip.durationMs), undefined, { ...DEFAULT_APPEARANCE, view: "left" }).bones;
    for (const t of [.32, .57]) {
      for (const id of ["shoulder_l", "elbow_l", "hand_l", "shoulder_r", "elbow_r", "hand_r"]) {
        expect(left(t).get(id)!.x).toBeCloseTo(-at(t).get(id)!.x, 4);
        expect(left(t).get(id)!.y).toBeCloseTo(at(t).get(id)!.y, 4);
      }
    }
  });
});
