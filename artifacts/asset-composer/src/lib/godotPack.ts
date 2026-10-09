import type { Entity, Matrix2D, Template } from '@/domain/types';
import { TOKEN_MODULES, tokenEntity, tokenItems, tokenTemplate, tokenClips, tokenPreviewAssets } from '@/data/chibiTokenPack';
import atlasData from '../../public/asset-packs/chibi-tokens-v1/atlases.json';
import { randomTokenAppearance } from './chibiAppearance';
import { evaluateSkeleton } from './evaluationPipeline';
import { resolveClipPose } from './animationRuntime';
import { evaluateExportScene } from './exportFrames';
import { inverse, multiply, worldBoneToMatrix } from './matrixUtils';
import { visualSvg, createSvgAssetRegistry, loadImage } from './visualRenderer';
import type { VisualResources } from './visualContent';
import { svgToDataUrl } from './svgUtils';

export const GODOT_PACK_ID = 'planetki-chibi';
export const GODOT_AGES = ['child', 'teen', 'adult', 'elder'] as const;
const rounded = (m: number[]) => m.map(n => Math.round(n * 100000) / 100000);
export function godotHeadVisuals(scene: ReturnType<typeof evaluateExportScene>, template: Template) {
  const headSlots = new Set(template.slots.filter(s=>s.boneId==='head').map(s=>s.id));
  return scene.visuals.filter(v=>v.boneId==='head' || (v.slotId && headSlots.has(v.slotId)));
}
export function defaultGodotPeople(): Entity[] {
  return Array.from({length: 8}, (_, i) => {
    let state = 3741 + i * 1987;
    const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
    const sex = i % 2 ? 'female' : 'male';
    const { selected } = randomTokenAppearance(random, sex);
    const skin = Math.floor(i / 2);
    selected.token_headshape = `heads_${skin}`;
    const e = tokenEntity(`Житель ${i+1}`, skin, selected, 'idle', {}, sex);
    e.id = `citizen-look-${i}`;
    return e;
  });
}

/** Compiles through the editor evaluator; Godot does not reimplement interpolation. */
export async function buildGodotPack(people: Entity[], resources: VisualResources,
  rasterize: (svg: string) => Promise<Uint8Array>, progress?: (message: string) => void) {
  if (!people.length || people.some(e => !e.templateId.startsWith('chibi_token_skin_'))) throw new Error('Модульный профиль Godot поддерживает чиби-персонажей. Для других объектов используйте экспорт кадров.');
  people = [...new Map([...defaultGodotPeople(),...people].map(e=>[e.id,e])).values()];
  const files: Record<string, Uint8Array> = {};
  const json = (name: string, value: unknown) => files[name] = new TextEncoder().encode(JSON.stringify(value));
  const t = tokenTemplate(), clips = tokenClips(t.id), items = tokenItems();
  const animations: Record<string, unknown> = {};
  for (const age of GODOT_AGES) {
    progress?.(`Позы: ${age}`);
    animations[age] = {};
    for (const c of clips) {
      const e = tokenEntity('pose',0,{},c.name,{},'male',age);
      const frames = Array.from({length: Math.max(1,Math.ceil(c.durationMs*c.fps/1000))}, (_,f) => {
        const sk = evaluateSkeleton(t.bones,resolveClipPose(c,f*1000/c.fps),e.bodyMorphs,e.appearance);
        return Object.fromEntries([...sk.bones].map(([id,b]) => [id,rounded(worldBoneToMatrix(b))]));
      });
      (animations[age] as Record<string,unknown>)[c.name] = {fps:c.fps, duration:c.durationMs/1000, loop:c.loops, frames, depth:c.equipmentDepth ?? []};
      await new Promise<void>(r=>setTimeout(r,0));
    }
  }
  json('animations.json',animations);
  const modules = TOKEN_MODULES.map(m => ({...m, rect:atlasData[m.atlas].rects[m.index], z:t.slots.find(s=>s.id===m.slot)!.zIndex}));
  const looks: unknown[] = [];
  for (const [index, original] of people.entries()) {
    progress?.(`Внешность ${index+1} / ${people.length}`);
    const template = tokenTemplate(Number(original.templateId.split('_').at(-1)));
    const look = {id:original.id,sex:original.appearance?.sex ?? 'male',skin:Number(original.templateId.split('_').at(-1)),name:original.name, heads:{} as Record<string,string>, slots:original.slots, appearance:original.appearance};
    for (const young of [false,true]) for (const hat of ['',...TOKEN_MODULES.filter(m=>m.slot==='token_headgear').map(m=>m.id)]) for (const expression of ['neutral','happy','angry','sad','surprised','blink']) {
      const e = structuredClone(original);
      e.appearance = {...e.appearance!,tokenAge:young?'child':'adult',tokenFace:{emotion:expression==='blink'?'neutral':expression as 'neutral',blink:expression==='blink',mouthMotion:true}};
      e.slots = e.slots.map(s=>s.slotId==='token_headgear'?{...s,itemId:hat?`token_item_${hat}`:null}:s);
      const clip = tokenClips(template.id).find(c=>c.name==='idle')!;
      const time = expression==='blink'?Math.min(1100,clip.durationMs*.6):325;
      const scene = evaluateExportScene(e,template,[clip],items,[],{key:'head',clip,frame:0,timeMs:time},undefined,resources);
      const head = inverse(worldBoneToMatrix(scene.skeleton.bones.get('head')!));
      const registry = createSvgAssetRegistry('godot_head');
      const body = godotHeadVisuals(scene,template).map(v=>visualSvg({...v,worldMatrix:multiply(head,v.worldMatrix) as Matrix2D,occlusionMasks:v.occlusionMasks?.map(mask=>({...mask,worldMatrix:multiply(head,mask.worldMatrix) as Matrix2D}))},2,registry)).join('');
      const file = `heads/look-${index}-${young?'young':'adult'}-${hat||'bare'}-${expression}.png`;
      files[file] = await rasterize(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="500" viewBox="-120 -220 240 250">${registry.definitions()}${body}</svg>`);
      look.heads[`${young?'young':'adult'}/${hat}/${expression}`] = file;
    }
    looks.push(look);
    await new Promise<void>(r=>setTimeout(r,0));
  }
  const atlases: Record<string,unknown> = {};
  for (const [id, a] of Object.entries(tokenPreviewAssets())) {
    const key = id.replace('token_atlas_',''), file=`textures/${key}.png`;
    const resource = resources.assets[id] ?? a;
    files[file] = new Uint8Array(await (await fetch(resource.dataUri)).arrayBuffer());
    atlases[key] = {file,width:a.width,height:a.height,rects:atlasData[key as keyof typeof atlasData].rects};
  }
  json('manifest.json',{format:'asset-composer-godot',version:1,packId:GODOT_PACK_ID,rig:'chibi_token_v1',unitScale:.04,headRect:[-120,-220,240,250],looks,modules,atlases,animations:'animations.json'});
  files['README.ru.md'] = new TextEncoder().encode('Распакуйте содержимое ZIP в Planetki/Assets/composer/planetki-chibi и перезапустите игру. Требуется установленный Composer runtime (src/core/composer_assets.gd). Пакет содержит базовый каталог обоих полов плюс выбранных персонажей, все модули одежды/оружия и 123 анимации четырёх возрастов. Внешность сохраняется по ID, профессия её не меняет. Предметы выдаёт игровая экономика; экспорт не создаёт предметов на складе. При экспорте игры включите Assets/composer/**/*.json в фильтр дополнительных файлов. Деревья поставляются отдельно через «Три дерева» и Assets/composer/trees.');
  return files;
}

export async function browserRasterizeGodotSvg(svg: string) {
  const image = await loadImage(svgToDataUrl(svg));
  const canvas = document.createElement('canvas'); canvas.width=image.width;canvas.height=image.height;
  canvas.getContext('2d')!.drawImage(image,0,0);
  const blob = await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Не удалось подготовить рисунок Godot.')),'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}
