// @vitest-environment jsdom
import { expect, it } from "vitest";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { applyLimbDepth, resolveEquipmentDepth } from "../src/lib/limbDepth";
import { visualSvg } from "../src/lib/visualRenderer";
import { visualKey } from "../src/lib/visualContent";
import { ProjectSchema } from "../src/domain/schema";
import { useStore } from "../src/store";
import { resolveTemplate } from "../src/data/templates";
import { evaluateExportScene } from "../src/lib/exportFrames";
import { buildAnimationReview, animationReviewArchive } from "../src/lib/animationReview";
import { twoHandedSwordStrike } from "../src/data/twoHandedSwordAnimation";
import type { EvaluatedVisual, Item } from "../src/domain/types";

const clip = {...twoHandedSwordStrike, equipmentDepth:[{slotId:"weapon",keyframes:[
  {timeMs:0,slot:"EQUIPMENT_FRONT" as const,occludedByBones:["hand_l","hand_r"]},
  {timeMs:500,slot:"FAR_BACK" as const},
  {timeMs:500,facing:"left" as const,slot:"BODY_BACK" as const},
  {timeMs:1000,slot:null},
]}]};
function visual(id:string, boneId:string, color:string):EvaluatedVisual {
  return {id,boneId,svgData:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="${color}"/></svg>`,
    worldMatrix:[1,0,0,1,0,0],localBounds:{minX:0,minY:0,maxX:10,maxY:10},worldBounds:{minX:0,minY:0,maxX:10,maxY:10},zIndex:0,svgFitMode:"v2_vector",anatomicalBody:true};
}
it("steps equipment independently of wrist depth with facing, part overrides and a setup reset",()=>{
  expect(resolveEquipmentDepth(clip,"weapon","blade",499.999,"right")?.slot).toBe("EQUIPMENT_FRONT");
  expect(resolveEquipmentDepth(clip,"weapon","blade",500,"right")?.slot).toBe("FAR_BACK");
  expect(resolveEquipmentDepth(clip,"weapon","blade",500,"left")?.slot).toBe("BODY_BACK");
  expect(resolveEquipmentDepth(clip,"weapon","blade",1000,"left")?.slot).toBeNull();
  const specific={...clip,equipmentDepth:[...clip.equipmentDepth,{slotId:"weapon",partId:"blade",keyframes:[{timeMs:600,slot:"HAND_FRONT" as const}]}]};
  expect(resolveEquipmentDepth(specific,"weapon","blade",600,"left")?.slot).toBe("HAND_FRONT");
  expect(resolveEquipmentDepth(specific,"weapon","guard",600,"left")?.slot).toBe("BODY_BACK");
  expect(ProjectSchema.shape.animationClips.element.parse(clip).equipmentDepth).toEqual(clip.equipmentDepth);
});
it.each(["left","right"] as const)("places a rigid sword over the head and cuts out only body palms in %s",facing=>{
  const head=visual("head","head","#ff0000"), palm=visual("palm","hand_l","#00ff00");
  const sword={...visual("sword","hand_r","#0000ff"),anatomicalBody:false,itemId:"sword",partId:"blade",slotId:"weapon"};
  const item={id:"sword",category:"weapon_main",parts:[{id:"blade",boneId:"hand_r",zOffset:-.5}]} as Item;
  const geometry=structuredClone([head,palm,sword].map(v=>[v.worldMatrix,v.localBounds,v.worldBounds]));
  applyLimbDepth([head,palm,sword],[item],facing,clip,0);
  expect(sword.zIndex).toBeGreaterThan(head.zIndex);
  expect(sword.occlusionMasks?.map(v=>v.id)).toEqual(["palm"]);
  expect(sword.occlusionMasks?.every(v=>!v.occlusionMasks)).toBe(true);
  expect([head,palm,sword].map(v=>[v.worldMatrix,v.localBounds,v.worldBounds])).toEqual(geometry);
  applyLimbDepth([head,palm,sword],[item],facing,clip,1000);
  const inherited={...sword};
  applyLimbDepth([inherited],[item],facing,{...clip,equipmentDepth:undefined},1000);
  expect(sword.renderDepth).toEqual(inherited.renderDepth);
  expect(sword.occlusionMasks).toBeUndefined();
});
it("renders actual alpha cutouts in SVG, retaining holes and uniquely scoped mask IDs",()=>{
  const sword=visual("cell_0_sword","hand_r","#0000ff"), palm=visual("palm","hand_l","#00ff00");
  palm.svgData='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path fill="green" fill-rule="evenodd" d="M0 0H5V10H0Z M1 3H4V7H1Z"/></svg>';
  sword.occlusionMasks=[palm];
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">${visualSvg(sword)}</svg>`;
  const pixels=new Resvg(svg).render().pixels;
  const rgba=(x:number,y:number)=>Array.from(pixels.slice((y*10+x)*4,(y*10+x)*4+4));
  expect(rgba(2,1)[3]).toBe(0); // solid palm hides sword
  expect(rgba(2,5)).toEqual([0,0,255,255]); // hole in palm preserves sword
  expect(rgba(8,5)).toEqual([0,0,255,255]); // uninterrupted blade
  expect(visualSvg({...sword,id:"cell_1_sword"})).not.toContain('id="v_cell_0_sword');
  const key=visualKey(sword);
  palm.worldMatrix=[1,0,0,1,2,0];
  expect(visualKey(sword)).not.toBe(key);
  const movedKey=visualKey(sword);
  sword.worldMatrix=[1,0,0,1,100,200];
  palm.worldMatrix=[1,0,0,1,102,200];
  expect(visualKey(sword)).toBe(movedKey); // moving a rigid grip does not re-encode its texture
});
it.each(["right","left"] as const)("uses item setup layers across clips and covers all head details on the near side in %s",facing=>{
  const head=visual("head","head","#ff0000"),eyes={...visual("eyes","head","#ff0000"),entityVisualId:"face__eyes"},hair={...visual("hair","head","#ff0000"),entityVisualId:"face__hair"};
  const sword={...visual("sword","hand_r","#0000ff"),anatomicalBody:false,itemId:"sword",partId:"blade",slotId:"weapon"};
  const palm={...visual("palm","hand_r","#00ff00"),localBounds:{minX:0,minY:0,maxX:2,maxY:2},worldBounds:{minX:0,minY:0,maxX:2,maxY:2}};
  const item={id:"sword",category:"weapon_main",parts:[{id:"blade",boneId:"hand_r",zOffset:-.5,depthBinding:{boneId:"hand_r",nearSlot:"EQUIPMENT_FRONT",farSlot:"BODY_BACK"},occludedByBones:["hand_l","hand_r"]}]} as Item;
  const rows=[head,eyes,hair,sword,palm];
  const geometry=structuredClone(rows.map(v=>[v.worldMatrix,v.worldBounds]));
  applyLimbDepth(rows,[item],facing); // setup, idle, walk: no clip depth key required
  const near=facing==="left";
  for(const detail of [head,eyes,hair]) expect(sword.zIndex>detail.zIndex).toBe(near);
  expect(sword.renderDepth?.source).toBe("binding");
  expect(sword.occlusionMasks?.map(v=>v.id)).toEqual(["palm"]);
  expect(rows.map(v=>[v.worldMatrix,v.worldBounds])).toEqual(geometry);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">${[...rows].sort((a,b)=>a.zIndex-b.zIndex).map(v=>visualSvg(v)).join("")}</svg>`;
  const pixels=new Resvg(svg).render().pixels;
  expect(Array.from(pixels.slice((5*10+5)*4,(5*10+5)*4+4))).toEqual(near?[0,0,255,255]:[255,0,0,255]);
  applyLimbDepth(rows,[item],facing,{...clip,equipmentDepth:[{slotId:"weapon",keyframes:[{timeMs:0,slot:"FAR_BACK"}]}]},0);
  expect(sword.renderDepth?.slot).toBe("FAR_BACK"); // authored animation still overrides setup
});
it("keeps evaluated bones and item matrices unchanged through equipment depth edits",()=>{
  useStore.getState().newProject(); useStore.getState().createEntity("character","biped_profile_base_v1","Depth test");
  const p=useStore.getState().project,e=structuredClone(p.entities[0]),t=resolveTemplate(p,e.templateId)!;
  e.slots.find(s=>s.slotId==="side_slot_weapon_main")!.itemId=p.items.find(i=>i.category==="weapon_main")!.id;
  const edited={...twoHandedSwordStrike,equipmentDepth:[{slotId:"side_slot_weapon_main",keyframes:[{timeMs:0,slot:"EQUIPMENT_FRONT" as const,occludedByBones:["hand_l","hand_r"]}]}]};
  for (const facing of ["right","left"] as const) for (const timeMs of [0,280,600,880,1060,1600]) {
    e.appearance={...e.appearance!,view:facing};
    const scene=(c:typeof edited|typeof twoHandedSwordStrike)=>evaluateExportScene(e,t,[c],p.items,p.itemFitProfiles,{key:"test",clip:c,frame:timeMs*c.fps/1000,timeMs});
    const before=scene(twoHandedSwordStrike),after=scene(edited);
    expect(after.skeleton.bones).toEqual(before.skeleton.bones);
    expect(after.visuals.map(v=>[v.id,v.worldMatrix,v.worldBounds]).sort()).toEqual(before.visuals.map(v=>[v.id,v.worldMatrix,v.worldBounds]).sort());
  }
});
it.skipIf(!process.env.EQUIPMENT_REVIEW_PROJECT)("generates shared reviews for an equipped project",async()=>{
  const p=ProjectSchema.parse(JSON.parse(readFileSync(process.env.EQUIPMENT_REVIEW_PROJECT!,"utf8")));
  useStore.getState().loadProject(p);
  const project=useStore.getState().project,e=project.entities.find(e=>e.id===project.activeEntityId)!;
  const c=project.animationClips.find(c=>c.id===(process.env.EQUIPMENT_REVIEW_CLIP??e.activeAnimationClipId))!;
  const review=buildAnimationReview({entity:e,template:resolveTemplate(project,e.templateId)!,clips:project.animationClips,clip:c,items:project.items,fitProfiles:project.itemFitProfiles,options:{showEquipment:true}});
  const out=process.env.EQUIPMENT_REVIEW_OUTPUT!; mkdirSync(out,{recursive:true});
  for(const sheet of review.sheets) {
    writeFileSync(`${out}/review-${sheet.facing}.svg`,sheet.svg);
    writeFileSync(`${out}/review-${sheet.facing}.png`,new Resvg(sheet.svg).render().asPng());
  }
  writeFileSync(`${out}/review.json`,JSON.stringify(review.report,null,2));
  writeFileSync(`${out}/review.zip`,await animationReviewArchive(review,async svg=>new Resvg(svg).render().asPng()));
  if(c.equipmentDepth?.length) for(const sample of review.report.samples) {
    const sword=sample.normalVisuals.find(v=>v.itemId==="studio_greatsword_bronze")!;
    expect(sword.depth?.slot).toBe("EQUIPMENT_FRONT");
    expect(sword.occludedBy.map(v=>v.boneId).sort()).toEqual(["hand_l","hand_r"]);
  }
});
