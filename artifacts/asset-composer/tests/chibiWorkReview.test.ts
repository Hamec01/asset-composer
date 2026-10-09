// @vitest-environment jsdom
import { it } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { TOKEN_AGES } from '../src/lib/chibiAge';
import { TOKEN_WORK_ACTIONS, TOKEN_TASKS } from '../src/data/chibiWorkAnimations';
import { TOKEN_MODULES, tokenEntity, tokenTemplate, tokenItems, tokenClips, tokenPreviewAssets } from '../src/data/chibiTokenPack';
import { evaluateExportScene, composeFrameSvg, exportFramePlan, exportCamera } from '../src/lib/exportFrames';
import { createSvgAssetRegistry } from '../src/lib/visualRenderer';

it.skipIf(!process.env.CHIBI_PACK_OUTPUT)('renders ages and occupations with separate bare age animation sheets', () => {
  const out = resolve(process.env.CHIBI_PACK_OUTPUT!); mkdirSync(resolve(out, 'fit-review'), { recursive: true });
  const assets = tokenPreviewAssets();
  for (const [id, a] of Object.entries(assets)) a.dataUri = 'data:image/png;base64,' + readFileSync(resolve(out, id.replace('token_atlas_', '') + '.png')).toString('base64');
  const resources = { assets, documents: [] }, t = tokenTemplate(), clips = tokenClips(t.id), items = tokenItems();
  const registry = createSvgAssetRegistry('work-age'), cells: string[] = [];
  for (const [index, age] of TOKEN_AGES.entries()) for (let dressed = 0; dressed < 2; dressed++) {
    const e = tokenEntity(age.label, 0, { token_eyes: 'face_0', token_brows: 'brows_extra_0', token_mouth: 'face_plus_16', token_hair: 'hair_0', ...(dressed ? { token_torso: `work_clothes_${index}` } : {}) }, 'idle', {}, 'male', age.value);
    const scene = evaluateExportScene(e, t, clips, items, [], { key: 'age', clip: null, frame: 0, timeMs: 0 }, undefined, resources);
    const i = dressed * 4 + index;
    cells.push(`<g transform="translate(${index * 300},${dressed * 300})">${composeFrameSvg(scene, { x: -145, y: -250, size: 290 }, 300, registry)}<text x="150" y="290" fill="#eed4a4" text-anchor="middle" font-family="sans-serif" font-size="16">${age.label}${dressed ? ' · одежда' : ''}</text></g>`);
  }
  const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600">${registry.definitions()}<rect width="1200" height="600" fill="#27282b"/>${cells.join('')}</svg>`;
  writeFileSync(resolve(out, 'fit-review/ages.png'), new Resvg(sheet).render().asPng());
  const roles = ['mine', 'fish', 'anvil_hammer', 'pottery_wheel', 'oven_paddle', 'sweep_clean', 'rock_baby', 'carry_stretcher'];
  const roleRegistry = createSvgAssetRegistry('roles');
  const roleCells = roles.map((name, i) => {
    const action = TOKEN_WORK_ACTIONS.find(a => a.name === name)!, c = clips.find(c => c.name === name)!;
    const selected: Record<string,string> = { token_eyes: 'face_0', token_brows: 'brows_extra_0', token_mouth: 'face_plus_16', token_torso: `work_clothes_${[11,7,10,12,9,8,0,11][i]}` };
    if (action.props[0]) selected.token_main = action.props[0];
    if (action.props[1]) selected.token_support = `${action.props[1]}_support`;
    if (action.station) selected.token_station = action.station;
    const e = tokenEntity(action.label, 0, selected, name);
    const scene = evaluateExportScene(e, t, clips, items, [], { key: 'role', clip: c, frame: 0, timeMs: c.durationMs * .52 }, undefined, resources);
    return `<g transform="translate(${i % 4 * 340},${Math.floor(i / 4) * 340})">${composeFrameSvg(scene, { x: -145, y: -265, size: 350 }, 340, roleRegistry)}<text x="170" y="330" fill="#eed4a4" text-anchor="middle" font-family="sans-serif" font-size="14">${action.label}</text></g>`;
  }).join('');
  writeFileSync(resolve(out, 'fit-review/occupations.png'), new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="1360" height="680">${roleRegistry.definitions()}<rect width="1360" height="680" fill="#27282b"/>${roleCells}</svg>`).render().asPng());
  for (const age of ['child', 'teen', 'elder'] as const) for (const name of ['idle', 'walk', 'run', ...(age === 'child' ? ['child_run_play','child_hide_cower','child_help_light'] : age === 'teen' ? ['teen_apprentice'] : ['walk_with_staff','tell_stories'])]) {
    const c = clips.find(c => c.name === name)!, e = tokenEntity(age, 0, {}, name, {}, 'male', age);
    const plan = exportFramePlan(e, t, clips, [c.id]), registry = createSvgAssetRegistry(`${age}-${name}`);
    const adult = tokenEntity('adult', 0, {}, name);
    const camera = exportCamera(plan.map(spec => evaluateExportScene(adult, t, clips, items, [], spec, undefined, resources)), .1);
    const rows = Math.ceil(plan.length / 8);
    const cells = plan.map((spec,i) => `<g transform="translate(${i % 8 * 256},${Math.floor(i / 8) * 256})">${composeFrameSvg(evaluateExportScene(e,t,clips,items,[],spec,undefined,resources),camera,256,registry)}</g>`).join('');
    writeFileSync(resolve(out, `sprites/${age}__${name}.png`), new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="${rows * 256}">${registry.definitions()}${cells}</svg>`).render().asPng());
    writeFileSync(resolve(out, `sprites/${age}__${name}.json`), JSON.stringify({ name, age, appearance:'bare', fps:c.fps, loops:c.loops, durationMs:c.durationMs, cols:8, rows, camera, frameWidth:256, frameHeight:256, frames:plan.map((spec,i) => ({x:i%8*256,y:Math.floor(i/8)*256,w:256,h:256,timeMs:spec.timeMs,rootPivot:{x:-camera.x/camera.size*256,y:-camera.y/camera.size*256}})) },null,2));
  }
  writeFileSync(resolve(out, 'work-actions.json'), JSON.stringify(TOKEN_WORK_ACTIONS, null, 2));
  const table = TOKEN_WORK_ACTIONS.map(a => `| \`${a.name}\` | ${a.label} | ${TOKEN_TASKS.find(t => t.value === a.task)?.label} | ${[...a.props, ...(a.station ? [a.station] : [])].map(id => TOKEN_MODULES.find(m => m.id === id)?.name).join(', ') || 'Не требуется'} |`).join('\n');
  writeFileSync(resolve(out, 'Действия-и-предметы.md'), '# Действия и отдельный реквизит\n\nПредметы — подсказки, выбор клипа ничего не надевает. Все клипы доступны каждому возрасту. У токенов нет рук и ног: приседание и работа передаются движением корпуса и головы, выбранные инструменты плавают рядом.\n\n| ID клипа | Название в приложении | Группа | Подходящий реквизит |\n|---|---|---|---|\n' + table + '\n');
}, 120000);
