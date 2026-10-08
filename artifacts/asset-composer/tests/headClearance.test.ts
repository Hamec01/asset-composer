// @vitest-environment jsdom
import {it,expect} from "vitest";
import {useStore} from "../src/store";
import {resolveTemplate} from "../src/data/templates";
import {twoHandedSwordStrike as clip} from "../src/data/twoHandedSwordAnimation";
import {resolveClipPose} from "../src/lib/animationRuntime";
import {evaluateScene,evaluateSkeleton} from "../src/lib/evaluationPipeline";
import {headClearance,validateHeadClearance,isPointInsideHeadClearance,segmentIntersectsHeadClearance,allowsHeadOverlap,validateAnimationDepth} from "../src/lib/headClearance";
import {resolveLimbDepth,resolveArmRoles} from "../src/lib/limbDepth";
import {ProjectSchema} from "../src/domain/schema";
import {twoHandedSwordStrike as originalClip} from "./fixtures/originalTwoHandedSword";

export function swordScene(time:number,view:"left"|"right"="right",candidate=clip) {
  const project=useStore.getState().project;
  const entity=structuredClone(project.entities[0]);
  entity.slots.forEach(s=>s.itemId=null);
  entity.appearance={...entity.appearance!,view};
  const template=resolveTemplate(project,entity.templateId)!;
  return evaluateScene(entity,template,evaluateSkeleton(template.bones,resolveClipPose(candidate,time),undefined,entity.appearance),project.items);
}
useStore.getState().newProject();
useStore.getState().createEntity("character","biped_profile_base_v1","Clearance");
it("keeps palms, grips and forearms outside the real head core across the whole strike",()=>{
  const failures:unknown[]=[];
  for(const view of ["left","right"] as const)for(let i=0;i<=120;i++) {
    const time=i*clip.durationMs/120,scene=swordScene(time,view);
    expect(headClearance(scene.visuals)).not.toBeNull();
    const violations=validateHeadClearance(scene,clip,time);
    if(violations.length)failures.push({view,time,violations});
  }
  expect(failures.length,JSON.stringify(failures.slice(0,3))).toBe(0);
},15000);
it("detects a crossing even when both endpoints are outside",()=>{
  const core={center:{x:10,y:20},radiusX:4,radiusY:2};
  expect(isPointInsideHeadClearance({x:10,y:20},core)).toBe(true);
  expect(isPointInsideHeadClearance({x:14,y:20},core)).toBe(false);
  expect(segmentIntersectsHeadClearance({x:0,y:20},{x:20,y:20},core)).toBe(true);
  expect(segmentIntersectsHeadClearance({x:0,y:23},{x:20,y:23},core)).toBe(false);
  expect(segmentIntersectsHeadClearance({x:10,y:20},{x:10,y:20},core)).toBe(true);
  expect(headClearance([])).toBeNull();
});
it("rejects the original face-crossing pose even with HAND_FRONT and honors only marked phases",()=>{
  const scene=swordScene(280,"right",originalClip);
  const failures=validateHeadClearance(scene,originalClip,280);
  expect(failures.some(f=>f.kind==="hand")).toBe(true);
  expect(failures.some(f=>f.kind==="forearm")).toBe(true);
  const marked={...originalClip,headOverlap:[{startMs:280,endMs:300,bones:["hand_l","hand_r","elbow_l","elbow_r"],reason:"Intentional face gesture test"}]};
  expect(validateHeadClearance(scene,marked,280)).toEqual([]);
  expect(validateHeadClearance(scene,marked,300).length).toBeGreaterThan(0);
});
it("requires a reason, exact bone and explicit time window for intentional face contact",()=>{
  const candidate={...clip,headOverlap:[{startMs:100,endMs:200,bones:["hand_l"],reason:"Drinking gesture"}]};
  expect(allowsHeadOverlap(candidate,100,"hand_l")).toBe(true);
  expect(allowsHeadOverlap(candidate,99,"hand_l")).toBe(false);
  expect(allowsHeadOverlap(candidate,200,"hand_l")).toBe(false);
  expect(allowsHeadOverlap(candidate,150,"elbow_l")).toBe(false);
  expect(allowsHeadOverlap(candidate,150,"hand_r")).toBe(false);
  const schema=ProjectSchema.shape.animationClips.element;
  expect(schema.parse(candidate).headOverlap).toEqual(candidate.headOverlap);
  expect(schema.safeParse({...candidate,headOverlap:[{...candidate.headOverlap[0],reason:" "}]}).success).toBe(false);
});
it("keeps head above ordinary hands and uses semantic roles for both facings",()=>{
  expect(resolveLimbDepth().nearHand).toBe("NEAR_LIMB");
  expect(validateAnimationDepth(clip)).toEqual([]);
  for(const view of ["left","right"] as const)for(const time of [0,280,600,760,880,1060,1600]) {
    const scene=swordScene(time,view),roles=resolveArmRoles(view);
    const part=(id:string)=>scene.visuals.find(v=>v.sourceKind==="bone-part"&&v.boneId===id)!;
    expect(part(`hand_${roles.near}`).renderDepth?.slot).toBe("NEAR_LIMB");
    expect(part(`hand_${roles.far}`).renderDepth?.slot).toBe("CROSS_BODY");
    expect(part(`elbow_${roles.far}`).renderDepth?.slot).toBe("CROSS_BODY");
    expect(part(`shoulder_${roles.far}`).renderDepth?.slot).toBe("FAR_LIMB");
    expect(part("head").zIndex).toBeGreaterThan(part("hand_l").zIndex);
    expect(part("head").zIndex).toBeGreaterThan(part("hand_r").zIndex);
  }
});
it("warns about blanket front depth rather than treating it as a clearance exemption",()=>{
  const candidate={...clip,limbDepth:[{timeMs:0,state:{nearHand:"HAND_FRONT" as const,farHand:"HAND_FRONT" as const,nearForearm:"HAND_FRONT" as const}}]};
  const warnings=validateAnimationDepth(candidate);
  expect(warnings.some(w=>w.includes("both hands"))).toBe(true);
  expect(warnings.some(w=>w.includes("100%"))).toBe(true);
  expect(warnings.some(w=>w.includes("nearForearm")&&w.includes("without explicit"))).toBe(true);
  expect(allowsHeadOverlap(candidate,300,"hand_l")).toBe(false);
});
it.skipIf(!process.env.HEAD_REVIEW)("reports measured head and joint coordinates",()=>{
  for(const time of [0,280,600,760,880,1060,1600]) {
    const scene=swordScene(time);
    console.log(JSON.stringify({time,core:headClearance(scene.visuals),bones:Object.fromEntries([...scene.skeleton.bones].filter(([id])=>/head|shoulder|elbow|hand/.test(id)))}));
  }
});
