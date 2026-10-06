import { createChibiSideBody } from "./chibiSideBody";
import type { Bone, BonePart, PaletteTokens, CharacterAppearance, Entity, Template } from "@/domain/types";

export type ChibiBuild = "classic" | "slim" | "sturdy";

/** Closed fist around a grip; selected by an animation attachment key, not by pose heuristics. */
export function chibiGripHand(skin: string, outline: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 13"><path d="M3 1 Q1 1 1 4 L2 8 Q5 10 9 8 Q11 7 10 4 L9 2 Q7 0 3 1Z" fill="${skin}" stroke="${outline}" stroke-width=".7"/><path d="M8 2 L7 5 L10 5 M3 3 V5 M5 2 V4" fill="none" stroke="#b77956" stroke-width=".5"/></svg>`;
}

// Open contours at joints keep overlapping pieces from drawing artificial seams.
export function createChibiBody(palette: PaletteTokens, build: ChibiBuild, appearance?: CharacterAppearance): BonePart[] {
  const width = build === "slim" ? 0.9 : build === "sturdy" ? 1.12 : 1;
  const { skin, outline } = palette;
  const shade = "#EBAE87";
  const parts: BonePart[] = [];
  function part(id: string, boneId: string, w: number, h: number, y: number, z: number, fillPath: string, contour: string, detail = "") {
    const a = appearance;
    const shapeWidth = !a || id === "head" || id === "neck" ? 1
      : id.startsWith("arm") ? 1 - a.slimness * .2 + a.muscle * .32 + a.fat * .16
      : id === "torso" ? (a.sex === "female" ? 1.08 : 1) * (1 - a.slimness * .24 + a.muscle * .32 + a.fat * .4)
      : id === "belly" ? (a.sex === "female" ? .9 : 1) * (1 - a.slimness * .3 + a.fat * .65)
      : id.startsWith("thigh") ? (a.sex === "female" ? 1.08 : 1) * (1 - a.slimness * .15 + a.muscle * .15 + a.fat * .2)
      : id.startsWith("calf") ? 1 - a.slimness * .12 + a.muscle * .12 + a.fat * .12 : 1;
    const top = id === "torso" && a?.sex === "female"
      ? '<path d="M5 8 L6 19 Q15 22 24 19 L25 8 L21 7 Q15 10 9 7Z" fill="#7C91A0" stroke="#586E7D" stroke-width=".7"/>' : "";
    const depthShade = a?.view && a.view !== "front" && boneId.endsWith(a.view === "left" ? "_l" : "_r")
      ? `<path d="${fillPath}" fill="${outline}" opacity=".12"/>` : "";
    parts.push({
      id: `hero_${id}`, boneId, naturalWidth: w * width * shapeWidth, naturalHeight: h,
      localX: 0, localY: y, zOffset: z,
      svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><path d="${fillPath}" fill="${skin}"/>${depthShade}<path d="${contour}" fill="none" stroke="${outline}" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"/>${detail}${top}</svg>`,
    });
  }
  for (const side of ["l", "r"] as const) {
    part(`calf_${side}`, `knee_${side}`, 12, 18, 5, -900,
      "M2 1 Q6 0 10 1 Q11 6 9.3 11 Q8.3 14 8.5 17 L3.5 17 Q3.7 14 2.7 11 Q1 6 2 1 Z",
      "M2 1 Q1 6 2.7 11 Q3.7 14 3.5 17 M10 1 Q11 6 9.3 11 Q8.3 14 8.5 17");
    part(`thigh_${side}`, `hip_${side}`, 14, 22, 6, -890,
      "M2 1 Q7 0 12 1 Q13 8 11 14 L10 21 H4 L3 14 Q1 8 2 1 Z",
      "M2 5 Q1 8 3 14 L4 21 M12 5 Q13 8 11 14 L10 21");
    part(`foot_${side}`, `foot_${side}`, 13, 13, 4, -880,
      "M4 1 L9 1 L9.3 5 Q12 7 11.7 10 Q11 12 6.5 12 Q2 12 1.3 10 Q1 7 3.7 5 Z",
      "M3.7 4 Q1 7 1.3 10 Q2 12 6.5 12 Q11 12 11.7 10 Q12 7 9.3 4",
      `<path d="M3.6 9.4 Q6.5 10.1 9.4 9.4 M5 9.8 V10.8 M7.2 9.8 V10.8" fill="none" stroke="${shade}" stroke-width="0.55" stroke-linecap="round"/>`);
    part(`arm_${side}_upper`, `shoulder_${side}`, 12, 23, 7, -870,
      "M2 7 Q1 2 6 1 Q11 2 10 7 L9.5 21 Q6 23 2.5 21 Z",
      "M2.5 21 L2 7 Q1 2 6 1 Q11 2 10 7 L9.5 21");
    part(`arm_${side}_lower`, `elbow_${side}`, 11, 22, 7, -860,
      "M2 1 Q5.5 0 9 1 Q10 8 8.7 14 L8.5 21 H2.5 L2.3 14 Q1 8 2 1 Z",
      "M2 1 Q1 8 2.3 14 L2.5 21 M9 1 Q10 8 8.7 14 L8.5 21");
    part(`hand_${side}`, `hand_${side}`, 12, 13, 4.5, -810,
      "M3 1 H8.4 L9 4 Q11 4.5 10.5 7 L9.5 10 Q8.8 12 6 12 Q2.2 12 1.5 9 L1.8 5 Q2 3 3 1 Z",
      "M3 1 L1.8 5 L1.5 9 Q2.2 12 6 12 Q8.8 12 9.5 10 L10.5 7 Q11 4.5 9 4 L8.4 1",
      `<path d="M8.5 5 L7.6 7.4" fill="none" stroke="${shade}" stroke-width="0.6" stroke-linecap="round"/>`);
  }
  part("torso", "chest", 30, 38, 13, -840,
    "M11 1 H19 L20 4 Q26 4 28 9 L25 25 Q23 31 24 37 H6 Q7 31 5 25 L2 9 Q4 4 10 4 Z",
    "M10 4 Q4 4 2 9 L5 25 Q7 31 6 36 M20 4 Q26 4 28 9 L25 25 Q23 31 24 36",
    `<path d="M10 9 Q13 10 15 9 Q17 10 20 9" fill="none" stroke="${shade}" stroke-width="0.55" stroke-linecap="round"/>`);
  if (appearance?.sex === "female") {
    const torso = parts.at(-1)!;
    torso.svgData = torso.svgData.replace("L25 25 Q23 31 24 37", "Q32 13 28 20 Q25 24 23 27 Q22 32 24 37")
      .replace("L25 25 Q23 31 24 36", "Q32 13 28 20 Q25 24 23 27 Q22 32 24 36");
  }
  part("belly", "spine", 22, 24, 9, -830,
    "M2 1 H20 Q18 8 20 16 L21 23 H1 L2 16 Q4 8 2 1 Z",
    "M2 4 Q4 8 2 16 L1 23 M20 4 Q18 8 20 16 L21 23",
    `<path d="M10 14 Q11 15 12 14" fill="none" stroke="${shade}" stroke-width="0.6" stroke-linecap="round"/>`);
  parts.push({
    id: "hero_pelvis", boneId: "pelvis", naturalWidth: 27 * width * (appearance ? (appearance.sex === "female" ? 1.06 : 1) * (1 - appearance.slimness * .12 + appearance.fat * .2) : 1), naturalHeight: 19,
    localX: 0, localY: 8, zOffset: -820,
    svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 27 19"><path d="M3 2 Q13.5 4 24 2 L26 12 Q20 13 18 18 H9 Q7 13 1 12 Z" fill="#7C91A0" stroke="${outline}" stroke-width="0.8" stroke-linejoin="round"/><path d="M3 4 Q13.5 6 24 4" fill="none" stroke="#AFBFCA" stroke-width="1.2"/><path d="M13.5 7 V15" fill="none" stroke="#586E7D" stroke-width="0.6"/></svg>`,
  });
  part("neck", "neck", 12, 14, 2, -800,
    "M3 1 H9 V8 Q10 11 11 12 Q6 14 1 12 Q2 11 3 8 Z",
    "M3 4 V8 Q2 11 1 12 M9 4 V8 Q10 11 11 12");
  part("head", "head", 46, 44, -8, -790,
    "M5 24 Q1 24 1 30 Q1 35 6 35 Q10 42 23 43 Q36 42 40 35 Q45 35 45 30 Q45 24 41 24 Q42 14 37 7 Q32 1 23 1 Q14 1 9 7 Q4 14 5 24 Z",
    "M5 24 Q1 24 1 30 Q1 35 6 35 Q10 42 23 43 Q36 42 40 35 Q45 35 45 30 Q45 24 41 24 Q42 14 37 7 Q32 1 23 1 Q14 1 9 7 Q4 14 5 24 Z",
    `<path d="M4 29 Q6 28 6.5 32 M42 29 Q40 28 39.5 32" fill="none" stroke="${shade}" stroke-width="0.7" stroke-linecap="round"/>`);
  for (const hand of parts.filter(candidate => /^hand_[lr]$/.test(candidate.boneId))) hand.attachments = { grip: chibiGripHand(skin, outline) };
  return parts.sort((a, b) => a.zOffset - b.zOffset);
}

export function getCharacterBodyParts(template: Template, entity: Entity): BonePart[] {
  if (!template.id.startsWith("biped_profile_") || !entity.appearance) return template.boneParts ?? [];
  const build = template.id.includes("slim") ? "slim" : template.id.includes("sturdy") ? "sturdy" : "classic";
  const authored = template.id.startsWith("biped_profile_reference_");
  const side = !!entity.appearance.view && entity.appearance.view !== "front";
  // Generated side views use the bone-local profile body; its morphs live in the geometry.
  const profile = !authored && side;
  const parts = authored ? (template.boneParts ?? []).map(part => ({ ...part }))
    : profile ? createChibiSideBody(entity.palette, build === "slim" ? .9 : build === "sturdy" ? 1.12 : 1, entity.appearance, entity.appearance.view === "left" ? "l" : "r")
    : createChibiBody(entity.palette, build, entity.appearance);
  // Authored hands without their own grip drawing use the built-in fist.
  for (const hand of parts.filter(part => /^hand_[lr]$/.test(part.boneId) && !part.attachments?.grip)) {
    hand.attachments = { ...hand.attachments, grip: chibiGripHand(entity.palette.skin, entity.palette.outline) };
  }
  if (entity.appearance.view && entity.appearance.view !== "front") {
    const near = entity.appearance.view === "left" ? "r" : "l";
    const far = near === "l" ? "r" : "l";
    for (const part of parts) {
      if (!authored && !profile && ["chest", "spine", "pelvis"].includes(part.boneId)) part.naturalWidth *= .8;
      if (!authored && !profile && part.boneId === "pelvis") {
        part.svgData = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 27 19"><path d="M3 2 Q14 4 24 2 L25 11 Q22 13 21 17 H11 Q7 14 2 13Z" fill="#7C91A0" stroke="${entity.palette.outline}" stroke-width=".8"/><path d="M3 4 Q14 6 24 4" fill="none" stroke="#AFBFCA" stroke-width="1.1"/><path d="M20 6 Q17 9 18 15" fill="none" stroke="#586E7D" stroke-width=".6"/></svg>`;
      }
      if (!authored && !profile && part.boneId === "head") {
        const outline = entity.palette.outline;
        const path = "M7 24 Q1 24 1 30 Q1 35 7 35 Q14 42 26 42 Q36 40 39 34 L40 31 Q46 29 41 26 Q44 14 37 7 Q32 1 22 1 Q12 1 7 9 Q3 17 7 24Z";
        part.svgData = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 46 44"><path d="${path}" fill="${entity.palette.skin}" stroke="${outline}" stroke-width=".8" stroke-linejoin="round"/><path d="M4 29 Q6 28 6.5 32" fill="none" stroke="#EBAE87" stroke-width=".7"/></svg>`;
      }
      if (part.boneId.endsWith(`_${far}`)) {
        if (!authored && !profile) part.naturalWidth *= .9;
        part.zOffset = part.boneId.startsWith("hip") || part.boneId.startsWith("knee") || part.boneId.startsWith("foot") ? -930 : -920;
      }
      if (part.boneId === `shoulder_${near}`) part.zOffset = -813;
      if (part.boneId === `elbow_${near}`) part.zOffset = -812;
      if (part.boneId === `hand_${near}`) part.zOffset = -811;
      if (!authored && !profile && part.boneId.startsWith("foot")) {
        part.naturalWidth *= 1.15;
        part.localX = 2;
        const shape = "M3 1 H8 L8.5 5 Q14 5 15 9 Q15 11 12 12 H3 Q1 11 1 9 L2 5Z";
        const depthShade = part.boneId === `foot_${far}` ? `<path d="${shape}" fill="${entity.palette.outline}" opacity=".12"/>` : "";
        part.svgData = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 13"><path d="${shape}" fill="${entity.palette.skin}"/>${depthShade}<path d="M3 1 L2 5 L1 9 Q1 11 3 12 H12 Q15 11 15 9 Q14 5 8.5 5 L8 1" fill="none" stroke="${entity.palette.outline}" stroke-width=".8" stroke-linejoin="round"/></svg>`;
      }
    }
  }
  return parts;
}

export function createChibiThumbnail(parts: BonePart[], bones: Bone[]): string {
  const world = new Map<string, { x: number; y: number }>();
  for (const bone of bones) {
    const parent = bone.parentId ? world.get(bone.parentId) : undefined;
    world.set(bone.id, { x: (parent?.x ?? 0) + bone.restPose.tx, y: (parent?.y ?? 0) + bone.restPose.ty });
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-32 -88 64 140">${parts.map(part => {
    const bone = world.get(part.boneId)!;
    return `<g transform="translate(${bone.x + part.localX - part.naturalWidth / 2} ${bone.y + part.localY - part.naturalHeight / 2})"><svg width="${part.naturalWidth}" height="${part.naturalHeight}">${part.svgData}</svg></g>`;
  }).join("")}</svg>`;
}
