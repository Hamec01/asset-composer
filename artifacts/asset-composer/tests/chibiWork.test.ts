// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { TOKEN_WORK_ACTIONS, TOKEN_TASKS, tokenTaskMatches } from '../src/data/chibiWorkAnimations';
import { TOKEN_ANIMATIONS } from '../src/data/chibiTokenAnimations';
import { TOKEN_MODULES, tokenEntity, tokenTemplate, tokenClips, tokenItems, addTokenToProject } from '../src/data/chibiTokenPack';
import { TOKEN_AGES } from '../src/lib/chibiAge';
import { randomTokenAppearance } from '../src/lib/chibiAppearance';
import { evaluateExportScene } from '../src/lib/exportFrames';
import { ProjectSchema } from '../src/domain/schema';
import { useStore } from '../src/store';

describe('age groups and occupation animations', () => {
  it('keeps the arrow behind the head while reaching for the quiver, then brings it to the bow', () => {
    const t = tokenTemplate(), clips = tokenClips(t.id), c = clips.find(c => c.name === 'draw_quiver')!;
    const e = tokenEntity('Лучник', 0, { token_main:'weapons_0', token_projectile:'weapons_7' }, c.name);
    for (const timeMs of [200, 720]) {
      const scene = evaluateExportScene(e, t, clips, tokenItems(), [], {key:'arrow-depth',clip:c,frame:timeMs*c.fps/1000,timeMs});
      const arrow = scene.visuals.find(v => v.slotId === 'token_projectile')!, head = scene.visuals.find(v => v.anatomicalBody && v.boneId === 'head')!;
      if (timeMs === 200) expect(arrow.zIndex).toBeLessThan(head.zIndex);
      else expect(arrow.zIndex).toBeGreaterThan(head.zIndex);
    }
  });
  it('covers the supplied action list with valid independent props and task filters', () => {
    expect(TOKEN_WORK_ACTIONS.length).toBeGreaterThan(80);
    expect(new Set(TOKEN_ANIMATIONS.map(c => c.name)).size).toBe(TOKEN_ANIMATIONS.length);
    for (const a of TOKEN_WORK_ACTIONS) {
      expect(TOKEN_ANIMATIONS.some(c => c.name === a.name)).toBe(true);
      for (const id of [...a.props, ...(a.station ? [a.station] : [])]) expect(TOKEN_MODULES.some(m => m.id === id), `${a.name}: ${id}`).toBe(true);
      expect(tokenTaskMatches(a.name, a.task)).toBe(true);
    }
    for (const task of TOKEN_TASKS) expect(TOKEN_ANIMATIONS.some(c => tokenTaskMatches(c.name, task.value))).toBe(true);
  });
  it('uses age proportions in the shared renderer and never equips props for any action', () => {
    const t = tokenTemplate(), clips = tokenClips(t.id), items = tokenItems();
    const sizes: number[] = [];
    for (const age of TOKEN_AGES) {
      const e = tokenEntity(age.label, 0, {}, 'idle', {}, 'male', age.value);
      for (const c of clips) {
        const scene = evaluateExportScene(e, t, clips, items, [], { key: 'age', clip: c, frame: 12, timeMs: c.durationMs / 2 });
        expect(scene.visuals.some(v => v.itemId), `${age.value}/${c.name}`).toBe(false);
        expect(scene.visuals.length).toBe(2);
        expect([...scene.skeleton.bones.values()].every(b => Number.isFinite(b.x + b.y + b.rotation))).toBe(true);
      }
      const still = evaluateExportScene(e, t, clips, items, [], { key: 'still', clip: null, frame: 0, timeMs: 0 });
      const body = still.visuals.find(v => v.boneId === 'chest')!.worldBounds;
      sizes.push(body.maxY - body.minY);
      const mirrored = evaluateExportScene({ ...e, appearance: { ...e.appearance!, view: 'left' } }, t, clips, items, [], { key: 'left', clip: null, frame: 0, timeMs: 0 });
      expect(mirrored.skeleton.bones.get('token_weapon')!.x).toBe(-still.skeleton.bones.get('token_weapon')!.x);
    }
    expect(sizes[0]).toBeLessThan(sizes[1]); expect(sizes[1]).toBeLessThan(sizes[2]);
  });
  it('persists all ages, upgrades old rigs and removes beards from children and teens', () => {
    const p = structuredClone(useStore.getState().project);
    p.templates.push({ ...tokenTemplate(), bones: tokenTemplate().bones.filter(b => !['token_support', 'token_station'].includes(b.id)) });
    for (const age of TOKEN_AGES) for (const sex of ['male', 'female'] as const) {
      const r = randomTokenAppearance(() => .01, sex, age.value);
      if (sex === 'female' || ['child', 'teen'].includes(age.value)) expect(r.selected.token_beard).toBeUndefined();
      const e = tokenEntity(`${age.value}/${sex}`, 0, r.selected, 'teen_apprentice', {}, sex, age.value);
      addTokenToProject(p, e, {});
    }
    const saved = ProjectSchema.parse(JSON.parse(JSON.stringify(p)));
    expect(saved.templates.find(t => t.id === tokenTemplate().id)!.bones.some(b => b.id === 'token_station')).toBe(true);
    expect(saved.entities.slice(-8).map(e => e.appearance?.tokenAge)).toEqual(['child','child','teen','teen','adult','adult','elder','elder']);
    expect(saved.animationClips.some(c => c.name === 'rock_baby')).toBe(true);
  });
});
