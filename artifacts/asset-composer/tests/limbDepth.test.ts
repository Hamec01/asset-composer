// @vitest-environment jsdom
import { describe,expect,it } from "vitest";
import { writeFileSync } from "node:fs";
import { resolveArmRoles,resolveLimbDepth,applyLimbDepth } from "../src/lib/limbDepth";
import { CHIBI_ANIMATIONS,upgradeBowClip } from "../src/data/chibiAnimations";
import { ProjectSchema } from "../src/domain/schema";
import { useStore } from "../src/store";
import { resolveTemplate } from "../src/data/templates";
import { resolveClipPose } from "../src/lib/animationRuntime";
import { evaluateSkeleton,evaluateScene } from "../src/lib/evaluationPipeline";
import { refreshCanonicalBuiltInTypedItems } from "../src/lib/canonicalItems";
import { animController } from "../src/core-v2/AnimationController";

describe("2.5D segment depth",()=>{
  const clip=CHIBI_ANIMATIONS.find(c=>c.name === "bow_shoot")!;
  it("exchanges anatomical near/far roles on mirror",()=>{
    expect(resolveArmRoles("right")).toEqual({near:"l",far:"r"});
    expect(resolveArmRoles("left")).toEqual({near:"r",far:"l"});
    expect(resolveArmRoles("right").near).toBe(resolveArmRoles("left").far);
  });
  it("uses safe defaults for clips without depth keys",()=>{
    expect(resolveLimbDepth()).toEqual({farUpperArm:"FAR_LIMB",farForearm:"FAR_LIMB",farHand:"FAR_LIMB",
      nearUpperArm:"NEAR_LIMB",nearForearm:"NEAR_LIMB",nearHand:"NEAR_LIMB"});
  });
  it("switches discrete slots at the key, never between keys",()=>{
    expect(resolveLimbDepth(clip,159.999,"left").farForearm).toBe("FAR_LIMB");
    expect(resolveLimbDepth(clip,160,"left").farForearm).toBe("CROSS_BODY");
    expect(resolveLimbDepth(clip,599.999,"right").farForearm).toBe("FAR_LIMB");
    expect(resolveLimbDepth(clip,600,"right").farForearm).toBe("FAR_LIMB");
    expect(resolveLimbDepth(clip,600,"right").farHand).toBe("FAR_LIMB");
    expect(resolveLimbDepth(clip,1139.999,"right").farForearm).toBe("FAR_LIMB");
    expect(resolveLimbDepth(clip,1140,"right").farForearm).toBe("CROSS_BODY");
    expect(resolveLimbDepth(clip,1519.999,"right").farForearm).toBe("CROSS_BODY");
    expect(resolveLimbDepth(clip,1520,"right").farForearm).toBe("FAR_LIMB");
    expect(resolveLimbDepth(clip,1140,"right").farHand).toBe("HAND_FRONT");
    expect(resolveLimbDepth(clip,1520,"right").farHand).toBe("FAR_LIMB");
    expect(resolveLimbDepth(clip,1879.999).farHand).toBe("FAR_LIMB");
    expect(resolveLimbDepth(clip,1880).farForearm).toBe("FAR_LIMB");
  });
  it("never reveals a detached far hand on the torso during lift or recovery",()=>{
    for(let frame=0;frame<=96;frame++) {
      const time=frame*500/clip.fps,state=resolveLimbDepth(clip,time,"right");
      if(state.farForearm === "FAR_LIMB") expect(state.farHand).toBe("FAR_LIMB");
    }
  });
  it("has no frame-to-frame flicker in any segment",()=>{
    for(const facing of ["left","right"] as const) {
    const history=Array.from({length:193},(_,i)=>resolveLimbDepth(clip,i*clip.durationMs/192,facing));
    for(const key of Object.keys(history[0]) as (keyof typeof history[0])[]) {
      const switches=history.slice(1).filter((state,i)=>state[key]!==history[i][key]).length;
      expect(switches).toBe(key === "farForearm" || key === "farHand" ? 2 : 0);
    }
    }
  });
  it("roundtrips depth keys and upgrades old canonical clips without touching IK",()=>{
    expect(ProjectSchema.shape.animationClips.element.parse(clip).limbDepth).toEqual(clip.limbDepth);
    const old=structuredClone(clip); delete old.limbDepth;
    const upgraded=upgradeBowClip(old);
    expect(upgraded.limbDepth).toEqual(clip.limbDepth);
    expect(upgraded.ik).toEqual(old.ik);
    expect(upgraded.layers).toEqual(old.layers);
  });
  for(const facing of ["right","left"] as const) {
    it(`resolves skin, sleeves and grips for every ${facing} bow phase without changing skeleton`,()=>{
      useStore.getState().newProject();
      useStore.getState().createEntity("character","biped_profile_base_v1","Depth review");
      const project=useStore.getState().project,entity=structuredClone(project.entities[0]);
      entity.appearance={...entity.appearance!,view:facing};
      for(const [slot,item] of Object.entries({side_slot_torso:"trader_tunic_25d",side_slot_weapon_main:"bow_25d"})) entity.slots.find(s=>s.slotId===slot)!.itemId=item;
      const template=resolveTemplate(project,entity.templateId)!,items=refreshCanonicalBuiltInTypedItems(project.items);
      const roles=resolveArmRoles(facing),stacks=[];
      for(const fraction of [0,.2,.32,.46,.57,.68,.71,.82,.97,1]) {
        const skeleton=evaluateSkeleton(template.bones,resolveClipPose(clip,fraction*clip.durationMs),undefined,entity.appearance);
        const joints=structuredClone([...skeleton.bones]);
        const scene=evaluateScene(entity,template,skeleton,items);
        expect([...skeleton.bones]).toEqual(joints);
        const z=(id:string)=>scene.visuals.find(v=>v.id===id)!.zIndex;
        const torso=z("slot__side_slot_torso__trader_tunic_25d__shirt_chest");
        const string=scene.visuals.find(v=>v.partId === "bow_string")!;
        expect(string.renderDepth).toMatchObject({boneId:"hand_l",depthBoneId:"hand_r",role:facing === "right" ? "far" : "near",source:"binding",slot:facing === "right" ? "BODY_BACK" : "CROSS_BODY"});
        if(facing === "right") expect(string.zIndex).toBeLessThan(torso);
        else {
          expect(string.zIndex).toBeGreaterThan(torso);
          if(fraction*clip.durationMs>=160 && fraction*clip.durationMs<1880) {
            expect(string.zIndex).toBeLessThan(z(`slot__side_slot_torso__trader_tunic_25d__sleeve_lower_${roles.far}`));
            expect(string.zIndex).toBeLessThan(z(`part__hero_hand_${roles.far}`));
          }
          expect(string.zIndex).toBeLessThan(z(`slot__side_slot_torso__trader_tunic_25d__sleeve_lower_${roles.near}`));
          expect(string.zIndex).toBeLessThan(z(`part__hero_hand_${roles.near}`));
        }
        expect(ProjectSchema.shape.items.element.parse(items.find(item=>item.id === "bow_25d")).parts.find(part=>part.id === "bow_string")?.depthBinding).toEqual({boneId:"hand_r",nearSlot:"CROSS_BODY",farSlot:"BODY_BACK"});
        expect(z(`slot__side_slot_torso__trader_tunic_25d__sleeve_upper_${roles.far}`)).toBeLessThan(torso);
        expect(z(`slot__side_slot_torso__trader_tunic_25d__sleeve_upper_${roles.near}`)).toBeGreaterThan(torso);
        if(resolveLimbDepth(clip,fraction*clip.durationMs,facing).farHand === "HAND_FRONT") expect(z(`part__hero_hand_${roles.far}`)).toBeGreaterThan(torso);
        else expect(z(`part__hero_hand_${roles.far}`)).toBeLessThan(torso);
        const bareEntity=structuredClone(entity);
        bareEntity.slots.find(s=>s.slotId === "side_slot_torso")!.itemId=null;
        const bare=evaluateScene(bareEntity,template,skeleton,items);
        expect(bare.visuals.find(v=>v.boneId===`shoulder_${roles.far}`)!.zIndex).toBeLessThan(bare.visuals.find(v=>v.boneId === "chest")!.zIndex);
        const matrices=scene.visuals.map(v=>[v.id,[...v.worldMatrix],{...v.worldBounds}]);
        applyLimbDepth(scene.visuals,items,facing === "left" ? "right" : "left",clip,fraction*clip.durationMs);
        expect(scene.visuals.map(v=>[v.id,[...v.worldMatrix],{...v.worldBounds}])).toEqual(matrices);
        expect([...skeleton.bones]).toEqual(joints);
        const mirroredHand=scene.visuals.find(v=>v.partId === "bow")!;
        expect(mirroredHand.renderDepth?.role).toBe(facing === "right" ? "far" : "near");
        expect(string.renderDepth?.role).toBe(facing === "right" ? "near" : "far");
        expect(string.renderDepth?.slot).toBe(facing === "right" ? "CROSS_BODY" : "BODY_BACK");
        applyLimbDepth(scene.visuals,items,facing,clip,fraction*clip.durationMs);
        for(const v of scene.visuals.filter(v=>v.partId?.startsWith("sleeve"))) {
          const body=bare.visuals.find(body=>body.sourceKind === "bone-part" && body.boneId === v.renderDepth?.boneId)!;
          expect(v.renderDepth?.slot).toBe(body.renderDepth?.slot);
        }
        stacks.push({timeMs:fraction*clip.durationMs,visuals:[...scene.visuals].sort((a,b)=>a.zIndex-b.zIndex).map(v=>({id:v.id,zIndex:v.zIndex,...v.renderDepth}))});
      }
      if(process.env.DEPTH_STACK) writeFileSync(`${process.env.DEPTH_STACK}-${facing}.json`,JSON.stringify(stacks,null,2));
      animController.pause();
    });
  }
});
