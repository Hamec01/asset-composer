// @vitest-environment jsdom
import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { useStore } from "../src/store";
import { resolveTemplate } from "../src/data/templates";
import { resolveClipPose } from "../src/lib/animationRuntime";
import { evaluateSkeleton, evaluateScene } from "../src/lib/evaluationPipeline";
import { CHIBI_ANIMATIONS } from "../src/data/chibiAnimations";
import { animController } from "../src/core-v2/AnimationController";

it.skipIf(!process.env.BOW_REVIEW)("renders a contact sheet for visual review", () => {
  useStore.getState().newProject();
  useStore.getState().createEntity("character","biped_profile_base_v1","Review");
  const project=useStore.getState().project;
  const entity=structuredClone(project.entities[0]);
  const template=resolveTemplate(project,entity.templateId)!;
  for (const [slot,item] of Object.entries({side_slot_torso:"trader_tunic_25d",side_slot_legs:"trader_breeches_25d",side_slot_foot_l:"trader_boots_25d",side_slot_weapon_main:"bow_25d"})) entity.slots.find(s=>s.slotId===slot)!.itemId=item;
  const panels=[["bow_shoot",.32],["bow_shoot",.6],["bow_shoot",.9],["bow_shoot",1]].map(([name,fraction],index)=>{
    if (process.env.APPEARANCE_REVIEW) {
      entity.appearance = { ...entity.appearance!, sex: index === 3 ? "female" : "male", slimness: index===0?1:0, muscle:index===1?1:0, fat:index===2?1:0 };
      entity.slots.find(s=>s.slotId==="side_slot_torso")!.itemId=index===3?"trader_tunic_female_25d":"trader_tunic_25d";
      entity.slots.find(s=>s.slotId==="side_slot_legs")!.itemId=index===3?"trader_breeches_female_25d":"trader_breeches_25d";
      entity.slots.find(s=>s.slotId==="side_slot_weapon_main")!.itemId=null;
      name="idle_full"; fraction=0;
    }
    const clip=CHIBI_ANIMATIONS.find(c=>c.name===name)!;
    entity.activeAnimationClipId=clip.id;
    const scene=evaluateScene(entity,template,evaluateSkeleton(template.bones,resolveClipPose(clip,clip.durationMs*Number(fraction)),undefined,entity.appearance),project.items);
    const art=scene.visuals.sort((a,b)=>a.zIndex-b.zIndex).map(v=>{
      const b=v.localBounds;
      return `<g transform="matrix(${v.worldMatrix.join(' ')})">${v.svgData.replace('<svg ',`<svg x="${b.minX}" y="${b.minY}" width="${b.maxX-b.minX}" height="${b.maxY-b.minY}" `)}</g>`;
    }).join('');
    return `<g transform="translate(${index*300+110} 290) scale(2.5)">${art}</g>`;
  }).join('');
  writeFileSync(process.env.BOW_REVIEW!,`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="430"><rect width="1200" height="430" fill="#252729"/>${panels}</svg>`);
  animController.pause();
});
