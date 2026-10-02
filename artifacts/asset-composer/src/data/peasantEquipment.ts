import type { Item, ItemCategory, ItemPart } from "@/domain/types";
import { parseMetrics } from "@/lib/svgMetrics";

const ink = "#493D35", linen = "#D7D2BA", seam = "#AAA68E", leather = "#75543B";
function art(w: number, h: number, body: string, origin = { x: w / 2, y: h / 2 }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-origin.x} ${-origin.y} ${w} ${h}"><g transform="translate(${-origin.x} ${-origin.y})" stroke="${ink}" stroke-width=".7" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;
}
function part(id: string, boneId: string, w: number, h: number, y: number, body: string, x = 0, origin?: { x: number; y: number }): ItemPart {
  const svgData = art(w, h, body, origin);
  const metrics = parseMetrics(svgData);
  // The authored frame is a bone attachment, not a content-centred thumbnail.
  Object.assign(metrics, { visualMinX: metrics.viewBoxX, visualMinY: metrics.viewBoxY,
    visualWidth: metrics.viewBoxWidth, visualHeight: metrics.viewBoxHeight });
  return { id, boneId, svgData, metrics, pivot: { x: 0, y: 0, preset: "custom" },
    coordinateMode: "bone_local", zOffset: 1,
    localTransform: { x, y, rotation: 0, scaleX: 1, scaleY: 1 } };
}
function item(id: string, name: string, category: ItemCategory, slot: string, parts: ItemPart[]): Item {
  const preview = parts.find(part => part.id === "shirt_chest") ?? parts[0];
  return { id, name, description: "Сменные части для персонажа 2.5D", category,
    compatibility: { skeletonFamilies: ["humanoid_side_v1"], species: [], viewProfiles: ["side_view"] },
    allowedSlots: [slot.replace("slot_", "side_slot_")], fitProfile: "standard", paletteChannels: [], hasOwnAnimation: false,
    animationClipId: null, anchorRules: {}, coordinateMode: "bone_local", parts,
    svgLayers: [{ id: `${id}_preview`, styleSetId: null, svgData: preview.svgData, paletteChannels: [], zOffset: 0 }],
    tags: ["peasant", "2.5d", "крестьянин", "rig-depth"],
    licenseMeta: { source: "Asset Composer Built-in", author: "Asset Composer", licenseType: "cc0",
      aiGenerated: false, commercialUseAllowed: true, purchaseRef: null, derivativePolicy: "unrestricted" } };
}
const shirt: ItemPart[] = [
  part("shirt_waist_bridge", "pelvis", 21, 20, -4,
    `<path d="M3 1 Q10 0 18 1 L20 19 H1Z" fill="${linen}" stroke="none"/>`),
  part("shirt_chest", "chest", 25, 38, 13,
    `<path d="M8 2 Q12 6 17 2 L21 5 Q25 6 24 12 L21 32 L22 37 H2 L3 32 L1 10 Q1 6 5 5Z" fill="${linen}"/><path d="M8 2 L11 12 L16 3 M11 7 L15 7 M12 10 L15 9" fill="none"/><path d="M5 17 L7 29 M20 15 L18 27" stroke="${seam}" fill="none"/>`),
  part("shirt_hem", "spine", 21, 24, 9,
    `<path d="M2 0 H19 L18 12 L20 22 Q10 24 1 22 L3 12Z" fill="${linen}" stroke="none"/><path d="M2 4 L3 12 L1 22 Q10 24 20 22 L18 12 L19 4" fill="none"/><path d="M4 20 Q10 22 17 20 M7 5 L6 14 M15 7 L16 15" fill="none" stroke="${seam}"/><path d="M2 18 L19 18 L19 20 L2 20Z" fill="${leather}"/>`),
];
shirt[0].zOffset = -15;
for (const side of ["r", "l"] as const) {
  const fill = side === "r" ? "#BAB69F" : linen;
  shirt.push(part(`sleeve_upper_${side}`, `shoulder_${side}`, 13, 23, 7,
    `<path d="M1 6 Q1 1 6.5 1 Q12 1 12 6 L10 22 H3Z" fill="${fill}"/><path d="M3 8 L4 17 M10 9 L9 16" fill="none" stroke="${seam}"/>`));
  shirt.push(part(`sleeve_lower_${side}`, `elbow_${side}`, 12, 18, 5,
    `<path d="M2 0 H10 L9 16 Q6 18 3 16Z" fill="${fill}"/><path d="M3 12 H9 L9 16 H3Z" fill="#C6BFA3"/><path d="M4 13 H8" stroke="${seam}"/>`));
}
const trousers: ItemPart[] = [part("trouser_seat", "pelvis", 23, 19, 8,
  `<path d="M2 1 Q12 3 21 1 L22 12 L17 18 H7 Q4 13 1 12Z" fill="#697361"/><path d="M17 4 Q14 7 15 16 M2 4 Q12 6 21 4" fill="none" stroke="#49523F"/>`)];
const boots: ItemPart[] = [];
for (const side of ["r", "l"] as const) {
  const cloth = side === "r" ? "#58624E" : "#697361";
  trousers.push(part(`trouser_thigh_${side}`, `hip_${side}`, 14, 22, 6,
    `<path d="M1 0 H13 L11 21 H3Z" fill="${cloth}"/><path d="M3 4 L4 14 M11 7 L10 17" fill="none" stroke="#858D77"/>`));
  trousers.push(part(`trouser_calf_${side}`, `knee_${side}`, 12, 17, 4.5,
    `<path d="M2 0 H10 L9 16 H3Z" fill="${cloth}"/><path d="M3 13 H9" stroke="#858D77"/>`));
  boots.push(part(`boot_shaft_${side}`, `knee_${side}`, 12, 12, 9,
    `<path d="M2 1 H10 L9 11 H3Z" fill="${leather}"/><path d="M2 2 H10 M4 5 L8 6 M4 8 L8 9" fill="none" stroke="#AE9471"/>`));
  boots.push(part(`boot_foot_${side}`, `foot_${side}`, 17, 13, 4,
    `<path d="M3 0 H9 L9 5 Q16 6 16 10 Q16 12 12 12 H2 Q0 10 2 5Z" fill="${side === "r" ? "#604632" : leather}"/><path d="M1 10 Q8 12 16 10" fill="none" stroke="#352B24" stroke-width="1.1"/><path d="M10 7 L13 8" stroke="#AE9471"/>`, 2));
}
const axe = part("axe", "hand_l", 22, 48, 0,
  `<path d="M9 44 L11 7 Q12 5 13 7 L12 44Z" fill="#A98453"/><path d="M11 7 L12 7" stroke="#E4CDA6"/><path d="M10 8 L18 4 Q21 7 21 14 Q18 18 11 16Z" fill="#7E8A8B"/><path d="M18 4 Q23 10 21 14 L18 15 Q20 9 17 5Z" fill="#CCD5D1"/><path d="M9 8 H14 V15 H9Z" fill="#626C6C"/><path d="M10 24 L12 25 M10 28 L12 29 M10 32 L12 33" stroke="#634C35"/>`, 0, { x: 10.5, y: 34 });
axe.zOffset = -.5;
axe.localTransform.rotation = 180;
const sword = part("sword", "hand_l", 16, 46, 0,
  `<path d="M5 30 V9 L8 1 L11 9 V30Z" fill="#C7D4D8"/><path d="M8 1 L11 9 V30 H8Z" fill="#87999F" stroke="none"/><path d="M8 7 V28" stroke="#EBF3F2" stroke-width=".6"/><path d="M6 32 H10 V41 H6Z" fill="#75543B"/><path d="M6 34 L10 35 M6 37 L10 38" stroke="#B49670"/><path d="M1 29 Q8 31 15 29 L14 32 Q8 34 2 32Z" fill="#A99566"/><path d="M6 41 H10 L11 44 L8 45 L5 44Z" fill="#A99566"/>`,
  0, { x: 8, y: 36 });
sword.zOffset = -.5;
sword.localTransform.rotation = 180;
export const PEASANT_EQUIPMENT = [
  item("peasant_shirt_25d", "Льняная рубаха", "torso", "slot_torso", shirt),
  item("peasant_trousers_25d", "Крестьянские штаны", "legs", "slot_legs", trousers),
  item("peasant_boots_25d", "Кожаные сапоги", "feet", "slot_foot_l", boots),
  item("peasant_axe_25d", "Рабочий топор", "weapon_main", "slot_weapon_main", [axe]),
  item("iron_sword_25d", "Железный меч", "weapon_main", "slot_weapon_main", [sword]),
];
