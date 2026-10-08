// @vitest-environment jsdom
import { it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { useStore } from "../src/store";
import { resolveTemplate } from "../src/data/templates";
import { resolveClipPose } from "../src/lib/animationRuntime";
import { evaluateSkeleton, evaluateScene, type EvaluatedScene } from "../src/lib/evaluationPipeline";
import { CHIBI_ANIMATIONS } from "../src/data/chibiAnimations";
import { animController } from "../src/core-v2/AnimationController";
import { archeryHandSketchSheet } from "../src/data/archeryArt";
import { buildAnimationReview } from "../src/lib/animationReview";

function sceneArt(scene:EvaluatedScene) {
  return scene.visuals.sort((a,b)=>a.zIndex-b.zIndex).map(v=>{
    const b=v.localBounds;
    return `<g transform="matrix(${v.worldMatrix.join(' ')})">${v.svgData.replace('<svg ',`<svg x="${b.minX}" y="${b.minY}" width="${b.maxX-b.minX}" height="${b.maxY-b.minY}" `)}</g>`;
  }).join('');
}

it.skipIf(!process.env.BOW_REVIEW)("renders a contact sheet for visual review", () => {
  useStore.getState().newProject();
  useStore.getState().createEntity("character","biped_profile_base_v1","Review");
  const project=useStore.getState().project;
  const entity=structuredClone(project.entities[0]);
  const template=resolveTemplate(project,entity.templateId)!;
  for (const [slot,item] of Object.entries({side_slot_torso:"trader_tunic_25d",side_slot_legs:"trader_breeches_25d",side_slot_foot_l:"trader_boots_25d",side_slot_weapon_main:"bow_25d"})) entity.slots.find(s=>s.slotId===slot)!.itemId=item;
  if (process.env.BOW_BARE) entity.slots.forEach(slot => { if (slot.slotId !== "side_slot_weapon_main") slot.itemId = null; });
  const frames = [["bow_shoot",0],["bow_shoot",.2],["bow_shoot",process.env.BOW_REACH ? .26 : .46],["bow_shoot",.64],["bow_shoot",.73],["bow_shoot",1]] as const;
  const labels = ["Rest", "Raise bow", "Draw string", "Aim", "Release", "Return"];
  const small: string[] = [];
  const joints: unknown[] = [];
  const panels=["right", "left"].flatMap(view => frames.map(([name,fraction],index)=>{
    entity.appearance = { ...entity.appearance!, view: view as "right" | "left" };
    let clipName: string = name;
    let time: number = fraction;
    if (process.env.APPEARANCE_REVIEW) {
      entity.appearance = { ...entity.appearance!, sex: index === 3 ? "female" : "male", slimness: index===0?1:0, muscle:index===1?1:0, fat:index===2?1:0 };
      entity.slots.find(s=>s.slotId==="side_slot_torso")!.itemId=index===3?"trader_tunic_female_25d":"trader_tunic_25d";
      entity.slots.find(s=>s.slotId==="side_slot_legs")!.itemId=index===3?"trader_breeches_female_25d":"trader_breeches_25d";
      entity.slots.find(s=>s.slotId==="side_slot_weapon_main")!.itemId=null;
      clipName="idle_full"; time=0;
    }
    const clip=process.env.BOW_BASELINE ? JSON.parse(readFileSync(process.env.BOW_BASELINE,"utf8")).animationClips.find((c: {name:string})=>c.name===clipName) : CHIBI_ANIMATIONS.find(c=>c.name===clipName)!;
    entity.activeAnimationClipId=clip.id;
    const skeleton = evaluateSkeleton(template.bones,resolveClipPose(clip,clip.durationMs*time),undefined,entity.appearance);
    const scene=evaluateScene(entity,template,skeleton,project.items);
    joints.push({view,fraction,bones:Object.fromEntries([...skeleton.bones].filter(([id])=> /^(shoulder|elbow|hand|head|chest|neck)/.test(id))),visuals:scene.visuals.filter(v=>v.renderDepth?.segment || v.boneId === "head").map(v=>({id:v.id,matrix:v.worldMatrix,bounds:v.worldBounds,depth:v.renderDepth}))});
    const art=sceneArt(scene);
    const row = view === "right" ? 0 : 430;
    small.push(`<g transform="translate(${index*140+70} ${view === "right" ? 90 : 230}) scale(.55)">${art}</g>`);
    return `<g transform="translate(${index*300+(view === "right" ? 135 : 165)} ${row+290}) scale(2.25)">${art}</g><text x="${index*300+150}" y="${row+405}" text-anchor="middle" fill="#ddd" font-family="sans-serif" font-size="16">${labels[index]}</text>`;
  })).join('');
  writeFileSync(process.env.BOW_REVIEW!,`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="860"><rect width="1800" height="860" fill="#252729"/>${panels}</svg>`);
  if(process.env.BOW_JOINTS) writeFileSync(process.env.BOW_JOINTS,JSON.stringify(joints,null,2));
  if (!process.env.APPEARANCE_REVIEW) {
    const clip = CHIBI_ANIMATIONS.find(c => c.name === "bow_shoot")!;
    const review = buildAnimationReview({ entity, template, clips: project.animationClips, clip, items: project.items,
      fitProfiles: project.itemFitProfiles, markers: frames.map(([, fraction], i) => ({ label: labels[i], timeMs: clip.durationMs * fraction })) });
    const prefix = (process.env.BOW_RIG ?? process.env.BOW_REVIEW!).replace(/\.svg$/i, "");
    for (const sheet of review.sheets) writeFileSync(`${prefix}-xray-${sheet.facing}.svg`, sheet.svg);
    writeFileSync(`${prefix}-xray-review.json`, JSON.stringify(review.report, null, 2));
  }
  if (process.env.BOW_HANDS) writeFileSync(process.env.BOW_HANDS, archeryHandSketchSheet());
  if (process.env.BOW_SMALL) writeFileSync(process.env.BOW_SMALL, `<svg xmlns="http://www.w3.org/2000/svg" width="840" height="280"><rect width="840" height="280" fill="#252729"/>${small.join("")}</svg>`);
  if (process.env.BOW_PROJECT) {
    entity.appearance = { ...entity.appearance!, view: "right" };
    entity.name = "Лучник — проверка выстрела";
    writeFileSync(process.env.BOW_PROJECT, JSON.stringify({ ...project, name: "Archery pose review",
      entities: [entity], activeEntityId: entity.id }, null, 2));
  }
  if(process.env.BOW_ALL_FRAMES) {
    const clip=CHIBI_ANIMATIONS.find(c=>c.name==="bow_shoot")!;
    for(const view of ["left","right"] as const) {
      entity.appearance={...entity.appearance!,view};
      const tiles=Array.from({length:49},(_,frame)=>{
        const skeleton=evaluateSkeleton(template.bones,resolveClipPose(clip,frame*1000/clip.fps),undefined,entity.appearance);
        const art=sceneArt(evaluateScene(entity,template,skeleton,project.items));
        const x=(frame%7)*180,y=Math.floor(frame/7)*180;
        return `<g transform="translate(${x+90} ${y+130}) scale(1.15)">${art}</g><text x="${x+90}" y="${y+170}" fill="white" text-anchor="middle" font-family="sans-serif" font-size="12">${frame}f</text>`;
      }).join('');
      writeFileSync(`${process.env.BOW_ALL_FRAMES}-${view}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="1260" height="1260"><rect width="1260" height="1260" fill="#252729"/>${tiles}</svg>`);
    }
  }
  animController.pause();
});
