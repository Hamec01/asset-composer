// @vitest-environment jsdom
import { it, expect } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { buildGodotPack, defaultGodotPeople, godotHeadVisuals } from '../src/lib/godotPack';
import { tokenPreviewAssets, tokenTemplate, tokenItems } from '../src/data/chibiTokenPack';
import { evaluateExportScene } from '../src/lib/exportFrames';

it('exports slotted facial features and headgear together with the head',()=>{
  const e=defaultGodotPeople()[0],t=tokenTemplate(0);
  e.slots.find(s=>s.slotId==='token_headgear')!.itemId='token_item_helmets_0';
  const scene=evaluateExportScene(e,t,[],tokenItems(),[],{key:'head',clip:null,frame:0,timeMs:0},undefined,{assets:tokenPreviewAssets(),documents:[]});
  const visuals=godotHeadVisuals(scene,t);
  for(const slot of ['token_eyes','token_brows','token_nose','token_mouth','token_headgear']) expect(visuals.some(v=>v.slotId===slot)).toBe(true);
  expect(visuals.some(v=>v.boneId==='chest')).toBe(false);
});

it('keeps deterministic individual identities across export runs',()=>{
  const a=defaultGodotPeople(),b=defaultGodotPeople();
  expect(a.map(e=>({id:e.id,slots:e.slots}))).toEqual(b.map(e=>({id:e.id,slots:e.slots})));
  expect(a.filter(e=>e.appearance?.sex==='female')).toHaveLength(4);
});
it.skipIf(!process.env.GODOT_PACK_OUTPUT)('compiles actual Godot package through the scene evaluator',async()=>{
  const assets=tokenPreviewAssets();
  for(const a of Object.values(assets)) a.dataUri='data:image/png;base64,'+readFileSync(resolve('public/asset-packs/chibi-tokens-v1',a.dataUri.split('/').at(-1)!)).toString('base64');
  const files=await buildGodotPack(defaultGodotPeople(),{assets,documents:[]},async svg=>new Resvg(svg).render().asPng(),message=>console.log(message));
  const manifest=JSON.parse(new TextDecoder().decode(files['manifest.json']));
  const clips=JSON.parse(new TextDecoder().decode(files['animations.json']));
  expect(manifest.looks).toHaveLength(8);
  expect(Object.keys(clips.adult)).toHaveLength(123);
  expect(clips.child.idle.frames[0].root[0]).toBeLessThan(clips.adult.idle.frames[0].root[0]);
  for(const [name,bytes] of Object.entries(files)){const p=resolve(process.env.GODOT_PACK_OUTPUT!,name);mkdirSync(dirname(p),{recursive:true});writeFileSync(p,bytes);}
},900000);
