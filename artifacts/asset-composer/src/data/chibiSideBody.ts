import type { BonePart, CharacterAppearance, PaletteTokens } from "@/domain/types";
import { archeryHandSvg } from "./archeryArt";

/**
 * Side-view chibi body, drawn in each bone's own coordinates (+y along the bone,
 * +x towards the facing direction). Every part's SVG viewBox is its exact bounding
 * box, so the renderer places it 1:1 and body morphs change the actual silhouette.
 *
 * Joints are ball joints: a limb's proximal cap is centred on its pivot and is a
 * little smaller than the parent's distal cap. The child (drawn above) leaves its
 * proximal cap unstroked, so the parent's outline flows around the outside of the
 * bend and no seam or gap appears at any angle.
 */

type P = [number, number];
/** `runs`: smooth open curves joined by straight cuts, so sliced shapes never overshoot their corners. */
type Shape = { fill: P[]; open?: "start" | "none"; runs?: P[][] };

const f2 = (n: number) => +n.toFixed(2);
const bump = (t: number, center: number, width: number, amp: number) => amp * Math.exp(-(((t - center) / width) ** 2));

function mix(a: string, b: string, t: number) {
  const rgb = (hex: string) => {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? [...h].map(c => c + c).join("") : h.slice(0, 6);
    return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) || 0);
  };
  const [x, y] = [rgb(a), rgb(b)];
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

/** Closed Catmull-Rom spline through the points. */
function smooth(points: P[], closed = true): string {
  const n = points.length;
  const at = (i: number) => closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))];
  let d = `M${f2(points[0][0])} ${f2(points[0][1])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1: P = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: P = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f2(c1[0])} ${f2(c1[1])} ${f2(c2[0])} ${f2(c2[1])} ${f2(p2[0])} ${f2(p2[1])}`;
  }
  return closed ? d + "Z" : d;
}

/**
 * Limb segment from the pivot (y = 0) to the next joint (y = length).
 * Profiles add muscle or fat on the front (+x) and back (-x) sides.
 */
function limb(length: number, r0: number, r1: number, front: (t: number) => number, back: (t: number) => number): Shape {
  const pts: P[] = [];
  const radius = (t: number) => r0 + (r1 - r0) * t;
  for (let k = 0; k <= 6; k++) { const a = Math.PI * (1 - k / 6); pts.push([r0 * Math.cos(a), -r0 * Math.sin(a)]); }
  for (let k = 1; k < 8; k++) { const t = k / 8; pts.push([radius(t) + front(t), length * t]); }
  for (let k = 0; k <= 6; k++) { const a = -Math.PI * k / 6; pts.push([r1 * Math.cos(a), length - r1 * Math.sin(a)]); }
  for (let k = 7; k >= 1; k--) { const t = k / 8; pts.push([-(radius(t) + back(t)), length * t]); }
  return { fill: pts, open: "start" };
}

interface Style { skin: string; outline: string; shade: string; width: number; far: boolean }

/**
 * `stroke` lists open outline runs. Edges covered by a neighbour (a limb's proximal
 * cap under its parent, the torso's waist under the belly) are simply left out.
 */
function render(id: string, boneId: string, z: number, shape: Shape, style: Style, extra: (s: Style) => string = () => "", stroke?: P[][]): BonePart {
  const pts = shape.fill;
  const pad = style.width + 0.6;
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const box = { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 };
  const fill = shape.runs ? shape.runs.map((run, i) => smooth(run, false).replace(/^M/, i ? "L" : "M")).join("") + "Z" : smooth(pts);
  const runs = stroke ?? (shape.open === "start" ? [pts.slice(6).concat([pts[0]])] : null);
  const outline = runs ? runs.map(run => smooth(run, false)).join(" ") : fill;
  const clip = `c_${id}`;
  // Depth: limbs on the far side read slightly darker.
  const depth = style.far ? `<path d="${fill}" fill="${style.outline}" opacity=".12"/>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f2(box.x)} ${f2(box.y)} ${f2(box.w)} ${f2(box.h)}">`
    + `<defs><clipPath id="${clip}"><path d="${fill}"/></clipPath></defs>`
    + `<path d="${fill}" fill="${style.skin}"/>`
    + `<g clip-path="url(#${clip})">${extra(style)}${depth}</g>`
    + `<path d="${outline}" fill="none" stroke="${style.outline}" stroke-width="${style.width}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return { id, boneId, svgData: svg, naturalWidth: f2(box.w), naturalHeight: f2(box.h),
    localX: f2(box.x + box.w / 2), localY: f2(box.y + box.h / 2), zOffset: z };
}

const line = (d: string, color: string, width: number, opacity = 1) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" opacity="${opacity}"/>`;
/** Soft shadow band along the back edge of a limb. */
const backShade = (length: number, offset: number, color: string) =>
  line(`M${-offset} ${-2} L${-offset} ${length + 1}`, color, 3.2, .45);

export function fistPath(scale: number): Shape {
  const s = (x: number, y: number): P => [x * scale, y * scale];
  return { fill: [s(-3.6, -.8), s(0, -1.6), s(3.4, -1), s(5.6, 1.2), s(6.4, 4.4), s(6.2, 7.4), s(4.6, 9.4), s(1.2, 10), s(-2.4, 9.4), s(-4.6, 7.2), s(-5, 3.6), s(-4.6, .8)] };
}

export function createChibiSideBody(palette: PaletteTokens, build: number, a: CharacterAppearance, farSide: "l" | "r"): BonePart[] {
  const female = a.sex === "female";
  const m = a.muscle, fat = a.fat, slim = a.slimness;
  // Overall limb thickness: build, sex and the three morph sliders.
  const k = build * (female ? .9 : 1) * (1 - slim * .24 + fat * .1 + m * .06);
  const shade = mix(palette.skin, "#9B4E2C", .3);
  const parts: BonePart[] = [];

  for (const side of ["l", "r"] as const) {
    const far = side === farSide;
    const style: Style = { skin: palette.skin, outline: palette.outline, shade, width: 1.05, far };
    const sk = k * (far ? .95 : 1);

    // Upper arm: deltoid cap, biceps in front, triceps behind.
    const upper = limb(15, 5.3 * sk + m * 1.2, 4 * sk,
      t => bump(t, .5, .28, (.4 + 1.5 * m) * sk) + bump(t, .45, .4, fat * .9),
      t => bump(t, .38, .3, (.3 + .9 * m) * sk) + bump(t, .5, .45, fat * 1.2));
    const upperPart = render(`hero_arm_${side}_upper`, `shoulder_${side}`, -870, upper, style,
      s => backShade(15, 4.3 * sk, s.shade) + (m > .3 ? line(`M${f2(1.2 * sk)} ${f2(9.5)} Q${f2(3.4 * sk + m)} ${f2(10.5)} ${f2(3.9 * sk + m)} 8`, s.shade, .6, m) : ""));
    const shootingUpper = render(upperPart.id, upperPart.boneId, upperPart.zOffset,
      limb(15, 4.2*sk, 3.4*sk, t => bump(t,.45,.3,.5*sk), () => 0), style);
    upperPart.attachments = { archery_arm: shootingUpper.svgData.replace(/viewBox="[^"]+"/, upperPart.svgData.match(/viewBox="[^"]+"/)![0]) };
    parts.push(upperPart);

    // Forearm: proximal cap smaller than the elbow cap; muscle mass near the elbow.
    const fore = limb(13, 3.5 * sk, 2.95 * sk,
      t => bump(t, .25, .25, (.8 + 1.2 * m) * sk) + bump(t, .3, .4, fat * .6),
      t => bump(t, .3, .35, (.3 + .6 * m) * sk) + bump(t, .3, .4, fat * .8));
    const forePart = render(`hero_arm_${side}_lower`, `elbow_${side}`, -860, fore, style, s => backShade(13, 3.6 * sk, s.shade));
    const shootingFore = render(forePart.id, forePart.boneId, forePart.zOffset,
      limb(13, 3.1*sk, 2.7*sk, t => bump(t,.25,.3,.3*sk), () => 0), style);
    forePart.attachments = { archery_forearm: shootingFore.svgData.replace(/viewBox="[^"]+"/, forePart.svgData.match(/viewBox="[^"]+"/)![0]) };
    parts.push(forePart);

    // Fist: knuckles forward, thumb over the top, finger creases on the front.
    const hs = 1.2 * (female ? .88 : 1) * (1 + m * .14 + fat * .08 - slim * .08) * build;
    const fist = fistPath(hs);
    const fingers = (s: Style) => line([3.2, 5.2, 7.2].map(y => `M${f2(3.8 * hs)} ${f2(y * hs)} Q${f2(5.4 * hs)} ${f2((y + .4) * hs)} ${f2(6.1 * hs)} ${f2((y + .2) * hs)}`).join(" "), s.outline, .55)
      + line(`M${f2(-.6 * hs)} ${f2(1.6 * hs)} Q${f2(2.6 * hs)} ${f2(1 * hs)} ${f2(4.6 * hs)} ${f2(3 * hs)}`, s.outline, .6)
      + line(`M${f2(-3.6 * hs)} ${f2(2 * hs)} L${f2(-3.6 * hs)} ${f2(8 * hs)}`, s.shade, 2.2, .45);
    const hand = render(`hero_hand_${side}`, `hand_${side}`, -810, fist, style, fingers);
    // Holding a handle: fingers wrap across the front, same frame so nothing jumps.
    const grip = render(`hero_hand_${side}`, `hand_${side}`, -810, fist, style, s =>
      line([3, 5, 7].map(y => `M${f2(1.2 * hs)} ${f2(y * hs)} L${f2(6.1 * hs)} ${f2((y + .3) * hs)}`).join(" "), s.outline, .55)
      + line(`M${f2(-1.2 * hs)} ${f2(1.4 * hs)} Q${f2(2.8 * hs)} ${f2(.4 * hs)} ${f2(5.2 * hs)} ${f2(2.2 * hs)}`, s.outline, .6)
      + line(`M${f2(-3.6 * hs)} ${f2(2 * hs)} L${f2(-3.6 * hs)} ${f2(8 * hs)}`, s.shade, 2.2, .45));
    hand.attachments = { grip: grip.svgData };
    hand.attachmentGrips={};
    for (const pose of ["bow_grip", "string_hook", "string_release"] as const) {
      hand.attachments[pose] = archeryHandSvg(pose, palette.skin, palette.outline, hs);
      hand.attachmentGrips[pose]={x:f2(5*hs),y:0};
    }
    // Held items sit in the palm, not at the wrist pivot (Spine PointAttachment).
    hand.grip = { x: f2(.8 * hs), y: f2(4.4 * hs) };
    parts.push(hand);

    // Thigh: quadriceps in front, hamstrings and (for women) hip curve behind.
    const lk = k * (far ? .95 : 1) * (female ? 1.06 : 1);
    const thigh = limb(13, 6.2 * lk + fat * .6, 4.9 * lk,
      t => bump(t, .4, .3, (.4 + 1.2 * m) * lk) + bump(t, .35, .45, fat * 1.4),
      t => bump(t, .25, .3, (.3 + .6 * m + (female ? 1 : 0)) * lk) + bump(t, .3, .45, fat * 1.4));
    parts.push(render(`hero_thigh_${side}`, `hip_${side}`, -890, { fill: thigh.fill }, style, s => backShade(13, 5.3 * lk, s.shade)));

    // Calf: shin straight in front, calf muscle behind.
    const calf = limb(10, 4.4 * lk, 3.3 * lk,
      t => bump(t, .3, .3, .25 * lk) + bump(t, .3, .4, fat * .5),
      t => bump(t, .32, .28, (1 + 1.1 * m) * lk) + bump(t, .3, .4, fat * .8));
    parts.push(render(`hero_calf_${side}`, `knee_${side}`, -900, calf, style, s => backShade(10, 4 * lk, s.shade)));

    // Foot: heel under the ankle, toes forward, sole on the ground line.
    const fk = 1.08 * build * (female ? .92 : 1) * (1 + fat * .06);
    const foot: Shape = { fill: ([[-2.9, 0], [-3.6, 2.6], [-4.2, 6.4], [-3.4, 9.3], [1, 9.9], [6.6, 9.9], [10.4, 9.2], [11.4, 7.2], [10.4, 5.2], [7.4, 4.2], [3.6, 2], [2.9, 0]] as P[]).map(([x, y]) => [x * fk, y] as P), open: "none" };
    parts.push(render(`hero_foot_${side}`, `foot_${side}`, -880, foot, style,
      s => line(`M${f2(8.4 * fk)} ${f2(6)} Q${f2(9.4 * fk)} 8 ${f2(9 * fk)} 9.4 M${f2(6.6 * fk)} 6.4 Q${f2(7.4 * fk)} 8.2 ${f2(7 * fk)} 9.5`, s.shade, .55)
        + line(`M${f2(-3.4 * fk)} 9.2 L${f2(10.4 * fk)} 9.2`, s.shade, 1.4, .5),
      [([[3.6, 2], [7.4, 4.2], [10.4, 5.2], [11.4, 7.2], [10.4, 9.2], [6.6, 9.9], [1, 9.9], [-3.4, 9.3], [-4.2, 6.4], [-3.6, 2.6], [-2.9, 0]] as P[]).map(([x, y]) => [x * fk, y] as P)]));
  }

  const style: Style = { skin: palette.skin, outline: palette.outline, shade, width: 1.05, far: false };
  // One trunk profile in rest skeleton space (y = 0 at the root, neck base at -44).
  // Chest, belly and briefs are all cut from it, so their outlines coincide where
  // they overlap at the waist and no step or tick appears.
  const lerp = (table: P[], y: number) => {
    const i = table.findIndex(([ty]) => ty >= y);
    if (i <= 0) return table[i < 0 ? table.length - 1 : 0][1];
    const [y0, x0] = table[i - 1], [y1, x1] = table[i];
    return x0 + (x1 - x0) * (y - y0) / (y1 - y0);
  };
  const tk = 1.16 * build * (1 - slim * .2 + m * .08) * (female ? .95 : 1);
  const frontBase: P[] = [[-45, 4.6], [-38, 8], [-32, 9.6], [-26, 9.4], [-17, 8.6], [-10, 8.8], [-4, 8.6], [4, 8.8]];
  const backBase: P[] = [[-45, -4.4], [-40, -7], [-35, -9.6], [-28, -10.2], [-20, -9.4], [-14, -8.8], [-6, -9.4], [0, -10.2], [4, -10]];
  const front = (y: number) => lerp(frontBase, y) * tk + bump(y, -31, 5, m * 2.4) + bump(y, -30, 6, fat * 1.6) + bump(y, -9, 8, fat * 6)
    + (female ? bump(y, -29, 3.4, 3.4) - bump(y, -18, 4, .7) : 0);
  const back = (y: number) => lerp(backBase, y) * tk - bump(y, -40, 3, m * 1.4) - bump(y, -20, 10, fat * 1.4)
    - (female ? bump(y, -1, 4, 1.8) - bump(y, -16, 4, .6) : 0);
  /** Trunk slice between two rest heights, in the coordinates of a bone resting at `origin`. */
  const slice = (from: number, to: number, origin: number) => {
    const ys = Array.from({ length: Math.ceil((to - from) / 1.5) + 1 }, (_, i) => Math.min(to, from + i * 1.5));
    return { front: ys.map(y => [front(y), y - origin] as P), back: ys.slice().reverse().map(y => [back(y), y - origin] as P) };
  };

  // Torso (chest bone at -34): neck base down past the waist; drawn above the belly.
  const torso = slice(-45, -9, -34);
  const top = female ? () => `<path d="M-16 -1 H18 V9 H-16Z" fill="#7C91A0"/>` + line("M-16 -1 H18 M-16 9 H18", "#586E7D", .9) : () => "";
  parts.push(render("hero_torso", "chest", -830, { fill: [...torso.front, ...torso.back], runs: [torso.front, torso.back] }, style,
    s => line(`M${f2(back(-38) + 1.4)} -4 Q${f2(back(-28) + 1.2)} 6 ${f2(back(-16) + 1.4)} 25`, s.shade, 3.4, .4)
      + (m > .3 ? line(`M${f2(front(-27) - 6)} ${f2(6.5 + m)} Q${f2(front(-27) - 2)} ${f2(8 + m)} ${f2(front(-29) - .4)} 4.5`, s.shade, .7, m) : "")
      + top(),
    [torso.front, torso.back]));

  // Belly (spine bone at -17): from under the chest into the briefs.
  const belly = slice(-24, 0, -17);
  parts.push(render("hero_belly", "spine", -840, { fill: [...belly.front, ...belly.back], runs: [belly.front, belly.back] }, style,
    s => line(`M${f2(back(-20) + 1.4)} -7 L${f2(back(-4) + 1.4)} 17`, s.shade, 3.2, .4)
      + (fat > .3 ? line(`M${f2(front(-5) - 5)} 12 Q${f2(front(-6) - 1.5)} 13.5 ${f2(front(-8) - .3)} 10`, s.shade, .7, fat) : "")
      + line(`M${f2(front(-11) - 3.2)} 5.5 q.6 .8 0 1.4`, s.shade, .6),
    [belly.front, belly.back]));

  // Briefs (pelvis bone at -2): waistband follows the trunk, then the seat and crotch.
  const seat = slice(-6.5, 4, -2);
  const crotch: P[] = [[front(4) - 1.4, 8.6], [3.2, 11], [-2.4, 11.4], [back(4) + 2.2, 9.6]];
  const briefs: P[] = [...seat.front, ...crotch, ...seat.back];
  const brief = { skin: "#7C91A0", outline: palette.outline, shade: "#586E7D", width: 1.05, far: false };
  parts.push(render("hero_pelvis", "pelvis", -820, { fill: briefs, runs: [[...seat.front, ...crotch, ...seat.back]] }, brief,
    s => `<path d="M-16 -6 H16 V-1.6 H-16Z" fill="#AFBFCA"/>` + line("M-16 -1.6 H16", s.shade, .6) + line("M-1 1 Q-2 6 -1.2 10", s.shade, .6)));

  // Neck: sides only; the head and torso cover both ends.
  const nk = 1 + m * .35 + fat * .2 - slim * .12;
  const neck: P[] = [[3.2 * nk, -9], [3.4 * nk, -3], [3.8 * nk, 3], [-3.6 * nk, 3], [-3.2 * nk, -3], [-3 * nk, -9]];
  parts.push(render("hero_neck", "neck", -800, { fill: neck }, style,
    s => line(`M${f2(-2.4 * nk)} -9 L${f2(-2.6 * nk)} 3`, s.shade, 2.4, .4) + line(`M${f2(-1 * nk)} 1.6 Q${f2(1.6 * nk)} 3 ${f2(3.6 * nk)} 1`, s.shade, .7),
    [neck.slice(0, 3), neck.slice(3)]));

  // Head: big round chibi skull, ear at the back, soft jaw towards the front.
  const head = "M7 24 Q1 24 1 30 Q1 36 7 36 Q14 42 26 42 Q36 40 39 34 L40 31 Q46 29 41 26 Q44 14 37 7 Q32 1 22 1 Q12 1 7 9 Q3 17 7 24Z";
  parts.push({
    id: "hero_head", boneId: "head", naturalWidth: 46, naturalHeight: 44, localX: 0, localY: -8, zOffset: -790,
    svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 46 44"><path d="${head}" fill="${palette.skin}" stroke="${palette.outline}" stroke-width="1.15" stroke-linejoin="round"/>`
      + `<path d="M4.2 27.4 Q7.2 26.6 7.4 30.4 Q7.2 33.6 4.6 33.4" fill="none" stroke="${shade}" stroke-width=".9" stroke-linecap="round"/>`
      + `<path d="M5.6 29.4 Q6.4 30.6 5.4 31.8" fill="none" stroke="${shade}" stroke-width=".7" stroke-linecap="round"/>`
      + `<path d="M24 41.2 Q33 40 37.6 34.6" fill="none" stroke="${shade}" stroke-width="1.6" opacity=".35" stroke-linecap="round"/></svg>`,
  });
  return parts.sort((p, q) => p.zOffset - q.zOffset);
}
