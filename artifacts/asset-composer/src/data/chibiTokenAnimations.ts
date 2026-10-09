import type { AnimationClip, BoneTransform } from "@/domain/types";
import { createTokenWorkAnimations, tokenAction } from "./chibiWorkAnimations";

type Pose = Partial<BoneTransform>;
const neutral = { tx: 0, ty: 0, rotation: 0, scaleX: 1, scaleY: 1 };
const phases = [0, .2, .38, .52, .72, 1];
function clip(name: string, label: string, durationMs: number, loops: boolean,
  poses: Record<string, Pose[]>, fractions = phases): AnimationClip {
  return {
    id: `token__${name}`, name, label, skeletonFamily: "chibi_token_v1", durationMs, fps: 24, loops,
    layers: [{ mask: "full_body", tracks: Object.entries(poses).map(([boneId, values]) => ({
      boneId, keyframes: values.map((p, i) => ({ timeMs: Math.round(fractions[i] * durationMs),
        easing: "ease_in_out", transform: { ...neutral, ...p } })),
    })) }],
    equipmentDepth: ["token_main", "token_off", "token_projectile", "token_cover", "token_hook", "token_support"].map(slotId => ({ slotId, keyframes: [{ timeMs: 0, slot: "EQUIPMENT_FRONT" }] })),
    reviewMarkers: fractions.map((f, i) => ({ label: ["Исходная", "Замах", "Вершина", "Контакт", "Доводка", "Возврат"][i] ?? `${i}`, timeMs: Math.round(f * durationMs) })),
  };
}
const idle = clip("idle", "IDLE · Покой", 2000, true, {
  chest: [{}, { scaleY: 1.015 }, { ty: -1, scaleY: 1.025 }, { ty: -1 }, { scaleY: 1.012 }, {}],
  head: [{}, { rotation: -1 }, { ty: -1 }, { rotation: 1 }, {}, {}],
});
function gait(run: boolean) {
  const lift = run ? 9 : 4, tilt = run ? 7 : 3;
  return clip(run ? "run" : "walk", run ? "Бег" : "Ходьба", run ? 520 : 900, true, {
    root: [{}, { ty: -lift, rotation: tilt }, {}, { ty: -lift, rotation: -tilt }, {}],
    chest: [{ scaleY: .98 }, { scaleY: 1.03 }, { scaleY: .98 }, { scaleY: 1.03 }, { scaleY: .98 }],
    head: [{ rotation: 0 }, { rotation: -tilt / 2 }, {}, { rotation: tilt / 2 }, {}],
    token_weapon: [{ rotation: -4 }, { rotation: 6 }, { rotation: -4 }, { rotation: 6 }, { rotation: -4 }],
  }, [0, .25, .5, .75, 1]);
}
export const TOKEN_ANIMATIONS: AnimationClip[] = [idle, gait(false), gait(true),
  clip("fall", "Падение", 1100, false, {
    root: [{}, { rotation: -8 }, { tx: 6, rotation: 20 }, { tx: 25, ty: -5, rotation: 65 }, { tx: 55, ty: -13, rotation: 88 }, { tx: 54, ty: -13, rotation: 88 }],
    head: [{}, { rotation: -4 }, { rotation: 5 }, { rotation: 8 }, {}, {}],
  }),
  clip("death", "Смерть", 1700, false, {
    root: [{}, { rotation: 10, ty: -4 }, { tx: -20, rotation: -40 }, { tx: -60, ty: -12, rotation: -90 }, { tx: -58, ty: -15, rotation: -86 }, { tx: -60, ty: -12, rotation: -90 }],
    token_weapon: [{}, {}, { rotation: 30 }, { tx: 30, ty: 20, rotation: 80 }, { tx: 30, ty: 20, rotation: 80 }, { tx: 30, ty: 20, rotation: 80 }],
  }),
  clip("dance", "Танец", 1600, true, {
    root: [{}, { tx: -7, ty: -8, rotation: -12 }, { ty: -3, rotation: 6 }, { tx: 7, ty: -10, rotation: 12 }, { ty: -3, rotation: -6 }, {}],
    head: [{}, { rotation: 12 }, { rotation: -6 }, { rotation: -12 }, { rotation: 6 }, {}],
    token_weapon: [{}, { rotation: -30, ty: -12 }, {}, { rotation: 30, ty: -12 }, {}, {}],
  }),
  clip("indignation", "Возмущение", 1200, true, {
    root: [{}, { ty: -5 }, {}, { ty: -5 }, {}, {}],
    head: [{}, { rotation: -7 }, { rotation: 7 }, { rotation: -7 }, { rotation: 7 }, {}],
    token_offhand: [{}, { ty: -25, rotation: -20 }, { ty: -12 }, { ty: -25, rotation: -20 }, {}, {}],
  }),
  clip("jump", "Прыжок", 1000, false, {
    root: [{}, { ty: 4, scaleY: .9, scaleX: 1.05 }, { ty: -52, scaleY: 1.05 }, { ty: -58 }, { ty: 2, scaleY: .9, scaleX: 1.05 }, {}],
    head: [{}, { rotation: -3 }, { rotation: -6 }, {}, { rotation: 3 }, {}],
  }),
  clip("roll", "Перекат", 1000, false, {
    root: [{}, { ty: 4, scaleX: .92, scaleY: .92 }, { tx: 24, ty: -92, rotation: 90 }, { tx: 72, ty: -194, rotation: 180 }, { tx: 116, ty: -104, rotation: 270 }, { tx: 144, rotation: 360 }],
  }),
  clip("work", "Что-то делает", 1200, true, {
    chest: [{}, { rotation: 5, scaleY: .98 }, {}, { rotation: 5, scaleY: .98 }, {}, {}],
    token_weapon: [{}, { tx: 12, ty: 8, rotation: 35 }, {}, { tx: 12, ty: 8, rotation: 35 }, {}, {}],
    head: [{ rotation: 4 }, { rotation: 7 }, { rotation: 4 }, { rotation: 7 }, { rotation: 4 }, { rotation: 4 }],
  }),
  clip("trade", "Торгуется", 1900, true, {
    head: [{}, { rotation: -5 }, { rotation: 5 }, { rotation: -3 }, { rotation: 3 }, {}],
    token_weapon: [{}, { tx: -12, ty: -12 }, { tx: 8, ty: -20 }, { tx: -8, ty: -10 }, {}, {}],
    token_offhand: [{}, {}, { tx: 15, ty: -10 }, { tx: 8, ty: -5 }, {}, {}],
  }),
  clip("carry", "Несёт", 1000, true, {
    root: [{}, { ty: -3, rotation: 2 }, {}, { ty: -3, rotation: -2 }, {}],
    token_weapon: Array(5).fill({ tx: -45, ty: -35, rotation: 0 }),
    head: [{ rotation: -3 }, { rotation: -5 }, { rotation: -3 }, { rotation: -5 }, { rotation: -3 }],
  }, [0, .25, .5, .75, 1]),
  clip("pickup", "Подбирает", 1400, false, {
    chest: [{}, { rotation: 10, ty: 6 }, { rotation: 18, ty: 12, scaleY: .9 }, { rotation: 18, ty: 12, scaleY: .9 }, { rotation: 6 }, {}],
    token_weapon: [{ ty: 42, rotation: 20 }, { tx: 8, ty: 42, rotation: 20 }, { tx: 5, ty: 30, rotation: 10 }, { tx: -10, ty: -2 }, { tx: -20, ty: -20 }, { tx: -20, ty: -20 }],
  }),
  clip("hang", "Вешает", 1600, false, {
    head: [{}, { rotation: -6 }, { rotation: -10 }, { rotation: -8 }, {}, {}],
    token_weapon: [{}, { tx: 6, ty: -40 }, { tx: 18, ty: -75, rotation: -8 }, { tx: 18, ty: -75, rotation: -8 }, { tx: 18, ty: -75, rotation: -8 }, { tx: 18, ty: -75, rotation: -8 }],
  }),
  clip("plough", "Вспахивает поле", 1500, true, {
    root: [{}, { ty: 3, rotation: 5 }, { ty: 4, rotation: 8 }, { ty: 2, rotation: 4 }, {}, {}],
    token_weapon: [{ rotation: 40 }, { tx: 12, ty: 16, rotation: 72 }, { tx: 16, ty: 20, rotation: 85 }, { tx: -8, ty: 12, rotation: 75 }, { tx: -8, rotation: 55 }, { rotation: 40 }],
  }),
  clip("hide", "Прячется", 1600, false, {
    chest: [{}, { ty: 8, scaleY: .92 }, { ty: 30, scaleY: .8 }, { ty: 55, scaleY: .68 }, { ty: 55, scaleY: .68 }, { ty: 55, scaleY: .68 }],
    head: [{}, { ty: 8 }, { ty: 32, rotation: -4 }, { ty: 55, rotation: -4 }, { ty: 55, rotation: -4 }, { ty: 55, rotation: -4 }],
  }),
];

const weapons = [
  { key: "axe", label: "Топор", duration: 1100, wind: -55, hit: 72, reach: 16, lift: 118 },
  { key: "sword", label: "Меч", duration: 850, wind: -50, hit: 100, reach: 24, lift: 106 },
  { key: "greatsword", label: "Двуручный меч", duration: 1450, wind: -65, hit: 112, reach: 22, lift: 146 },
  { key: "spear", label: "Копьё", duration: 1000, wind: 65, hit: 90, reach: 68, lift: 15 },
  { key: "mace", label: "Булава", duration: 1250, wind: -60, hit: 80, reach: 18, lift: 118 },
];
for (const w of weapons) {
  for (const running of [false, true]) {
    TOKEN_ANIMATIONS.push(clip(`${w.key}_attack${running ? "_run" : ""}`, `${w.label} · удар${running ? " на бегу" : " стоя"}`, w.duration, false, {
      root: [{}, { rotation: -3 }, { ty: running ? -8 : -2, rotation: -5 }, { tx: running ? 10 : 3, rotation: 6 }, { ty: running ? -5 : 0 }, {}],
      head: [{}, { rotation: 3 }, { rotation: 5 }, { rotation: -6 }, {}, {}],
      token_weapon: [{ rotation: w.key === "spear" ? 65 : 0 }, { tx: 8, ty: -w.lift * .65, rotation: w.wind * .7 }, { tx: 12, ty: -w.lift, rotation: w.wind }, { tx: w.reach, ty: 0, rotation: w.hit }, { tx: w.reach * .6, ty: 8, rotation: w.hit * .8 }, { rotation: w.key === "spear" ? 65 : 0 }],
    }));
  }
  TOKEN_ANIMATIONS.push(clip(`${w.key}_block`, `${w.label} · блок`, 950, false, {
    chest: [{}, { rotation: -5 }, { tx: -4, rotation: -8 }, { tx: -7, rotation: -10 }, { rotation: -4 }, {}],
    token_weapon: [{}, { tx: -20, ty: -65, rotation: 60 }, { tx: -24, ty: -65, rotation: 60 }, { tx: -28, ty: -60, rotation: 66 }, { tx: -20, ty: -55, rotation: 60 }, {}],
  }));
}
for (const running of [false, true]) TOKEN_ANIMATIONS.push(clip(`axe_chop${running ? "_run" : ""}`, `Топор · рубит дерево${running ? " на бегу" : " стоя"}`, 1350, false, {
  root: [{}, { ty: running ? -8 : -2, rotation: -4 }, { rotation: -7 }, { rotation: 10 }, { rotation: 6 }, {}],
  token_weapon: [{}, { tx: 8, ty: -85, rotation: -40 }, { tx: 12, ty: -135, rotation: -60 }, { tx: 22, ty: 18, rotation: 100 }, { tx: 22, ty: 18, rotation: 100 }, {}],
}));
TOKEN_ANIMATIONS.push(clip("bow_attack", "Лук · выстрел", 1400, false, {
  chest: [{}, { rotation: -3 }, { rotation: -5 }, { rotation: -6 }, { rotation: 3 }, {}],
  token_weapon: [{}, { tx: 8, ty: -35, rotation: 0, scaleX: .92 }, { tx: 12, ty: -35, scaleX: .85 }, { tx: 12, ty: -35, scaleX: .82 }, { tx: 5, ty: -35, scaleX: 1.08 }, {}],
  token_arrow: [{ scaleX: 0, scaleY: 0 }, { scaleX: 1, scaleY: 1, rotation: 90, tx: 0, ty: -35 }, { scaleX: 1, scaleY: 1, rotation: 90, tx: -12, ty: -35 }, { scaleX: 1, scaleY: 1, rotation: 90, tx: -15, ty: -35 }, { scaleX: 1, scaleY: 1, rotation: 90, tx: 150, ty: -35 }, { scaleX: 0, scaleY: 0, rotation: 90, tx: 260, ty: -35 }],
}));

// Repeated spring steps continue underneath each running weapon action.
for (const c of TOKEN_ANIMATIONS.filter(c => c.name.endsWith("_run"))) {
  const track = c.layers[0].tracks.find(t => t.boneId === "root")!;
  track.keyframes = Array.from({ length: 25 }, (_, i) => {
    const f = i / 24, timeMs = Math.round(c.durationMs * f), gate = Math.sin(Math.PI * f);
    return { timeMs, easing: "ease_in_out", transform: { ...neutral, tx: 5 * gate,
      ty: -Math.abs(Math.sin(timeMs / 520 * Math.PI * 2)) * 8 * gate,
      rotation: 6 * gate + Math.sin(timeMs / 520 * Math.PI * 2) * 2 * gate } };
  });
}

TOKEN_ANIMATIONS.push(...createTokenWorkAnimations(clip, TOKEN_ANIMATIONS));

export function tokenRecommendedItem(name: string): string | null {
  const action = tokenAction(name);
  if (action) return action.props[0] ?? null;
  if (name.startsWith("axe")) return "weapons_4";
  if (name.startsWith("greatsword")) return "weapons_3";
  if (name.startsWith("sword")) return "weapons_2";
  if (name.startsWith("spear")) return "weapons_1";
  if (name.startsWith("mace")) return "weapons_5";
  if (name === "bow_attack") return "weapons_0";
  return ({ work: "props_4", trade: "props_2", carry: "props_1", pickup: "props_0", hang: "props_0", plough: "props_3" } as Record<string, string>)[name] ?? null;
}
