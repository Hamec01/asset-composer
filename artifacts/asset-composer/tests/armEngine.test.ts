import { describe, expect, it } from "vitest";
import type { AnimationClip, BoneTransform } from "../src/domain/types";
import { bipedProfileChibiBones } from "../src/data/chibiRig";
import { evaluateSkeleton } from "../src/lib/evaluationPipeline";
import { resolveClipPose, getTrackTransformAt } from "../src/lib/animationRuntime";
import { ikKeyAt, virtualGripTarget } from "../src/lib/ikConstraint";
import { transformPoint, worldBoneToMatrix } from "../src/lib/matrixUtils";
import { ProjectSchema } from "../src/domain/schema";
import { DEFAULT_APPEARANCE } from "../src/data/characterAppearance";

const transform: BoneTransform = { tx:0,ty:0,rotation:0,scaleX:1,scaleY:1 };
const makeClip = (): AnimationClip => ({id:"engine-test",name:"test",label:"Test",durationMs:1000,fps:24,loops:false,skeletonFamily:"humanoid",
  layers:[{mask:"full",tracks:[]}], ik:[{bones:["shoulder_l","elbow_l","hand_l"],bend:-1,fixedLength:true,
    keyframes:[{timeMs:0,x:-2,y:-30,rotation:0,mix:1}]}]});
const at = (clip: AnimationClip, time = 0, left = false) => evaluateSkeleton(bipedProfileChibiBones,
  resolveClipPose(clip,time),undefined,{...DEFAULT_APPEARANCE,projection:"authored",view:left ? "left" : "right"}).bones;
const length = (world: ReturnType<typeof at>, a:string,b:string) => Math.hypot(world.get(a)!.x-world.get(b)!.x,world.get(a)!.y-world.get(b)!.y);

describe("shared arm engine", () => {
  it("uses shortest rotation but permits explicitly authored revolutions", () => {
    const track={boneId:"head",keyframes:[{timeMs:0,transform:{...transform,rotation:350}},
      {timeMs:1000,transform:{...transform,rotation:10}}]};
    expect(getTrackTransformAt(track,500).rotation).toBe(360);
    expect(getTrackTransformAt({...track,rotationMode:"unwrapped"},500).rotation).toBe(180);
  });
  it("does not inherit animated torso stretching or independent elbow translation", () => {
    const clip=makeClip();
    clip.layers[0].tracks=["chest","shoulder_l","elbow_l","hand_l"].map(boneId => ({boneId,keyframes:[
      {timeMs:0,transform:{...transform,tx:boneId === "elbow_l" ? 9 : 0,scaleX:1.5,scaleY:2}}]}));
    const world=at(clip);
    expect(length(world,"shoulder_l","elbow_l")).toBeCloseTo(15,6);
    expect(length(world,"elbow_l","hand_l")).toBeCloseTo(13,6);
    delete clip.ik;
    const fk=at(clip);
    expect(length(fk,"shoulder_l","elbow_l")).toBeCloseTo(15,6);
    expect(length(fk,"elbow_l","hand_l")).toBeCloseTo(13,6);
  });
  it("supports custom bone names and off-axis rig segments", () => {
    const bones=structuredClone(bipedProfileChibiBones);
    const rename:Record<string,string>={shoulder_l:"upper",elbow_l:"lower",hand_l:"palm"};
    for(const bone of bones) {
      bone.id=rename[bone.id] ?? bone.id;
      bone.parentId=bone.parentId ? rename[bone.parentId] ?? bone.parentId : null;
      if(bone.id === "lower") bone.restPose.tx=3;
      if(bone.id === "palm") bone.restPose.tx=-2;
    }
    const clip=makeClip();
    clip.ik![0].bones=["upper","lower","palm"];
    const world=evaluateSkeleton(bones,resolveClipPose(clip,0)).bones;
    expect(length(world,"upper","lower")).toBeCloseTo(Math.hypot(3,15),5);
    expect(length(world,"lower","palm")).toBeCloseTo(Math.hypot(2,13),5);
    expect(world.get("palm")!.x).toBeCloseTo(-2,5);
    expect(world.get("palm")!.y).toBeCloseTo(-30,5);
  });
  it("solves the actual palm socket, not the wrist or image centre, in both directions", () => {
    const clip=makeClip();
    clip.ik![0].gripSocket={x:2,y:4,rotation:10};
    clip.ik![0].keyframes[0].rotation=40;
    for (const left of [false,true]) {
      const wrist=at(clip,0,left).get("hand_l")!;
      const contact=transformPoint(worldBoneToMatrix(wrist),2,4);
      expect(contact.x).toBeCloseTo(left ? 2 : -2,5);
      expect(contact.y).toBeCloseTo(-30,5);
      expect(((wrist.rotation+180)%360+360)%360-180).toBeCloseTo(left ? -30 : 30,5);
    }
    const rig=structuredClone(bipedProfileChibiBones);
    rig.find(b => b.id === "hand_l")!.restPose.scaleX=2;
    const wrist=evaluateSkeleton(rig,resolveClipPose(clip,0),undefined,{...DEFAULT_APPEARANCE,projection:"authored"}).bones.get("hand_l")!;
    const contact=transformPoint(worldBoneToMatrix(wrist),2,4);
    expect(contact.x).toBeCloseTo(-2,5);
    expect(contact.y).toBeCloseTo(-30,5);
  });
  it("shares a moving virtual object between both hands without equipped artwork", () => {
    const clip=makeClip();
    clip.gripObjects=[{id:"staff",sockets:{primary:{x:-5,y:0},secondary:{x:5,y:0}},keyframes:[
      {timeMs:0,x:0,y:-20,rotation:-10},{timeMs:1000,x:2,y:-22,rotation:10}]}];
    clip.ik=["l","r"].map(side => ({bones:[`shoulder_${side}`,`elbow_${side}`,`hand_${side}`] as [string,string,string],
      bend:side === "l" ? -1 : 1,fixedLength:true,gripSocket:{x:1,y:2},
      target:{objectId:"staff",socketId:side === "l" ? "primary" : "secondary"},keyframes:[{timeMs:0,x:0,y:0,mix:1}]}));
    for(let frame=0;frame<=48;frame++) {
      const time=frame*1000/48, world=at(clip,time);
      for(const constraint of clip.ik) {
        const goal=virtualGripTarget(clip,constraint.target!,time)!;
        const palm=transformPoint(worldBoneToMatrix(world.get(constraint.bones[2])!),1,2);
        expect(Math.hypot(palm.x-goal.x,palm.y-goal.y)).toBeLessThan(.001);
      }
    }
    const restored=ProjectSchema.shape.animationClips.element.parse(JSON.parse(JSON.stringify(clip)));
    expect(restored.gripObjects).toEqual(clip.gripObjects);
    expect(restored.ik).toEqual(clip.ik);
  });
  it("keeps a pole branch stable in forward and reverse seeking", () => {
    const clip=makeClip();
    clip.ik![0].pole={x:-35,y:-20};
    clip.ik![0].keyframes=[{timeMs:0,x:-2,y:-30,mix:1},{timeMs:1000,x:0,y:-25,mix:1}];
    let sign=0;
    const forward=[];
    for(let i=0;i<=48;i++) {
      const world=at(clip,i*1000/48);
      forward.push(world);
      const a=world.get("shoulder_l")!,b=world.get("elbow_l")!,c=world.get("hand_l")!;
      const next=Math.sign((c.x-a.x)*(b.y-a.y)-(c.y-a.y)*(b.x-a.x));
      if (sign) expect(next).toBe(sign);
      sign=next;
    }
    for(let i=48;i>=0;i--) expect(at(clip,i*1000/48)).toEqual(forward[i]);
  });
  it("cannot stretch fixed arms to unreachable targets and remains finite at the shoulder", () => {
    const clip=makeClip();
    clip.ik![0].stretch=true;
    for(const [x,y] of [[1000,-35],[-16,-35],[-15,-35]]) {
      clip.ik![0].keyframes=[{timeMs:0,x,y,mix:1}];
      const world=at(clip);
      expect(length(world,"shoulder_l","elbow_l")).toBeCloseTo(15,6);
      expect(length(world,"elbow_l","hand_l")).toBeCloseTo(13,6);
      for(const bone of world.values()) expect([bone.x,bone.y,bone.rotation].every(Number.isFinite)).toBe(true);
    }
  });
  it("keeps explicit bend changes through the last frame", () => {
    expect(ikKeyAt([{timeMs:0,x:0,y:0,mix:1,bend:1},{timeMs:100,x:1,y:1,mix:1}],200)?.bend).toBe(1);
  });
  it("ignores missing virtual socket references rather than snapping to the origin", () => {
    const clip=makeClip();
    clip.ik![0].target={objectId:"missing",socketId:"missing"};
    const world=at(clip);
    delete clip.ik;
    expect(world).toEqual(at(clip));
  });
});
