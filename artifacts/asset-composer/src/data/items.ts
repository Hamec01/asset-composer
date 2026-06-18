import type { Item, ItemCategory, SkeletonFamilyId, PaletteTokens, LicenseMeta, ViewProfile } from "@/domain/types";

// ─── Palette reference (dark_fantasy defaults) ─────────────────────────────
// Item SVG data embeds these hex values; applyPaletteToSvg swaps them at
// render time so the same art drives every palette/StyleSet combination.
const C = {
  skin:   "#C89A7B",
  hair:   "#2B1D18",
  cloth:  "#3C3A46",
  cloth2: "#746A5E",
  metal:  "#8E8A80",
  accent: "#B87333",
  out:    "#1A1208",
  shad:   "#00000055",
};

// ─── Shared license ───────────────────────────────────────────────────────
const CC0: LicenseMeta = {
  source: "Asset Composer Built-in",
  author: "Asset Composer",
  licenseType: "cc0",
  aiGenerated: false,
  commercialUseAllowed: true,
  purchaseRef: null,
  derivativePolicy: "unrestricted",
};

// ─── Skeleton family groups ───────────────────────────────────────────────
const HUMAN: SkeletonFamilyId[] = ["humanoid_topdown_v1", "humanoid_side_v1", "humanoid_monster_v1"];
const QUAD:  SkeletonFamilyId[] = ["quadruped_side_v1"];
const BIRD:  SkeletonFamilyId[] = ["bird_side_v1"];
const SIEGE: SkeletonFamilyId[] = ["siege_static_v1"];

// ─── ViewProfile derivation ───────────────────────────────────────────────
// Derives the list of view profiles an item supports from its skeleton families.
// Items with no families listed are considered universal (empty means all).
function deriveViewProfiles(families: SkeletonFamilyId[]): ViewProfile[] {
  const views = new Set<ViewProfile>();
  for (const f of families) {
    if (f.includes("topdown"))      views.add("topdown_45");
    if (f.includes("side"))         views.add("side_view");
    if (f === "siege_static_v1")    views.add("static");
  }
  return Array.from(views);
}

// ─── SVG helpers ─────────────────────────────────────────────────────────
function svg(body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`;
}

interface ItemOpts {
  /** Species this item is restricted to, e.g. ["horse","pony"]. Empty = universal. */
  species?: string[];
  /** Override auto-derived fit profile: "slim" | "standard" | "heavy" */
  fitProfile?: string;
  /** Anchor rules keyed by slot anchor point id */
  anchorRules?: Record<string, { anchorId: string; bindMode: string }>;
  /** If true this item drives its own additive animation layer */
  hasOwnAnimation?: boolean;
  /** ID of the AnimationClip that drives this item's own animation */
  animationClipId?: string;
}

function item(
  id: string,
  name: string,
  description: string,
  category: ItemCategory,
  allowedSlots: string[],
  families: SkeletonFamilyId[],
  channels: (keyof PaletteTokens)[],
  svgData: string,
  tags: string[] = [],
  opts: ItemOpts = {},
): Item {
  return {
    id,
    name,
    description,
    category,
    compatibility: {
      skeletonFamilies: families,
      species: opts.species ?? [],
      viewProfiles: deriveViewProfiles(families),
    },
    allowedSlots,
    fitProfile: opts.fitProfile ?? "standard",
    paletteChannels: channels,
    hasOwnAnimation: opts.hasOwnAnimation ?? false,
    animationClipId: opts.animationClipId ?? null,
    anchorRules: opts.anchorRules ?? {},
    svgLayers: [{ id: "layer_0", styleSetId: null, svgData, paletteChannels: channels, zOffset: 0 }],
    licenseMeta: CC0,
    tags,
  };
}

function v2HairItem(
  id: string,
  name: string,
  description: string,
  svgData: string,
  metrics: { visualMinX: number; visualMinY: number; visualWidth: number; visualHeight: number },
  pivot: { x: number; y: number },
  tags: string[],
): Item {
  return {
    id,
    name,
    description,
    category: "hair",
    compatibility: {
      skeletonFamilies: HUMAN,
      species: [],
      viewProfiles: deriveViewProfiles(HUMAN),
    },
    allowedSlots: ["slot_hair", "side_slot_hair"],
    fitProfile: "standard",
    paletteChannels: ["hair", "outline"],
    hasOwnAnimation: false,
    animationClipId: null,
    anchorRules: {
      slot_hair: { anchorId: "hair_top", bindMode: "anchor_lock" },
      side_slot_hair: { anchorId: "hair_top", bindMode: "anchor_lock" },
    },
    svgLayers: [{
      id: "thumb",
      styleSetId: null,
      svgData,
      paletteChannels: ["hair", "outline"],
      zOffset: 0,
    }],
    parts: [{
      id: "main",
      boneId: "head",
      svgData,
      metrics: {
        viewBoxX: 0,
        viewBoxY: 0,
        viewBoxWidth: 64,
        viewBoxHeight: 64,
        visualMinX: metrics.visualMinX,
        visualMinY: metrics.visualMinY,
        visualWidth: metrics.visualWidth,
        visualHeight: metrics.visualHeight,
      },
      pivot: { x: pivot.x, y: pivot.y, preset: "custom" },
      localTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      coordinateMode: "bone_local",
      zOffset: 0,
    }],
    coordinateMode: "bone_local",
    licenseMeta: CC0,
    tags,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// HUMANOID CLOTHING
// ════════════════════════════════════════════════════════════════════════════

// ── BOOTS (feet) ─────────────────────────────────────────────────────────
const bootSlots = ["slot_feet", "side_slot_feet"];
const bootSVG = (col: string, col2: string) => svg(
  `<rect x="12" y="30" width="16" height="20" rx="2" fill="${col}"/>` +
  `<rect x="12" y="46" width="20" height="6" rx="2" fill="${col2}"/>` +
  `<rect x="36" y="30" width="16" height="20" rx="2" fill="${col}"/>` +
  `<rect x="32" y="46" width="20" height="6" rx="2" fill="${col2}"/>` +
  `<rect x="12" y="30" width="16" height="20" rx="2" fill="none" stroke="${C.out}" stroke-width="1.5"/>` +
  `<rect x="36" y="30" width="16" height="20" rx="2" fill="none" stroke="${C.out}" stroke-width="1.5"/>`,
);

function v2LeatherBootsItem(): Item {
  const leftBootSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 20">
    <path d="M7 4 L15 4 Q17 4 17 6 L17 12 L20 14 L20 17 Q20 18 18.5 18 L6 18 Q4 18 4 16.5 L4 13.5 Q4 12.5 5 12 L7 11 Z" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M6 14.5 Q11 12 17 14.5" fill="none" stroke="${C.hair}" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M8.5 6 L8.5 11" stroke="${C.out}" stroke-width="1"/>
  </svg>`;
  const rightBootSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 20">
    <path d="M17 4 L9 4 Q7 4 7 6 L7 12 L4 14 L4 17 Q4 18 5.5 18 L18 18 Q20 18 20 16.5 L20 13.5 Q20 12.5 19 12 L17 11 Z" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M18 14.5 Q13 12 7 14.5" fill="none" stroke="${C.hair}" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M15.5 6 L15.5 11" stroke="${C.out}" stroke-width="1"/>
  </svg>`;

  return {
    id: "boots_leather",
    name: "Leather Boots",
    description: "Simple hardened leather boots",
    category: "feet",
    compatibility: {
      skeletonFamilies: HUMAN,
      species: [],
      viewProfiles: deriveViewProfiles(HUMAN),
    },
    allowedSlots: bootSlots,
    fitProfile: "standard",
    paletteChannels: ["secondaryCloth", "outline"],
    hasOwnAnimation: false,
    animationClipId: null,
    anchorRules: {},
    svgLayers: [{
      id: "thumb",
      styleSetId: null,
      svgData: bootSVG(C.cloth2, C.hair),
      paletteChannels: ["secondaryCloth", "outline"],
      zOffset: 0,
    }],
    parts: [
      {
        id: "boot_l",
        boneId: "foot_l",
        svgData: leftBootSvg,
        metrics: {
          viewBoxX: 0,
          viewBoxY: 0,
          viewBoxWidth: 24,
          viewBoxHeight: 20,
          visualMinX: 4,
          visualMinY: 4,
          visualWidth: 16,
          visualHeight: 14,
        },
        pivot: { x: 12, y: 5, preset: "custom" },
        localTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        coordinateMode: "bone_local",
        zOffset: 0,
      },
      {
        id: "boot_r",
        boneId: "foot_r",
        svgData: rightBootSvg,
        metrics: {
          viewBoxX: 0,
          viewBoxY: 0,
          viewBoxWidth: 24,
          viewBoxHeight: 20,
          visualMinX: 4,
          visualMinY: 4,
          visualWidth: 16,
          visualHeight: 14,
        },
        pivot: { x: 12, y: 5, preset: "custom" },
        localTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        coordinateMode: "bone_local",
        zOffset: 0.05,
      },
    ],
    coordinateMode: "bone_local",
    licenseMeta: CC0,
    tags: ["clothing", "boots"],
  };
}

const legsSlots = ["slot_legs", "side_slot_legs"];

function v2LeatherPantsItem(): Item {
  const waistSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 16">
    <rect x="2" y="3" width="24" height="10" rx="3" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/>
    <path d="M4 8 H24" stroke="${C.out}" stroke-width="1" stroke-dasharray="2 1.5"/>
  </svg>`;
  const thighLeftSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 24">
    <path d="M4 2 H14 Q16 2 16 4 V21 Q16 23 14 23 H7 Q5 23 4 21 Z" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M5 8 H15" stroke="${C.out}" stroke-width="1" opacity="0.6"/>
  </svg>`;
  const thighRightSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 24">
    <path d="M4 2 H14 Q16 2 16 4 V21 Q16 23 14 23 H7 Q5 23 4 21 Z" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M3 8 H13" stroke="${C.out}" stroke-width="1" opacity="0.6"/>
  </svg>`;
  const shinLeftSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 24">
    <path d="M4 1 H12 Q13.5 1 13.5 2.5 V20 Q13.5 22 12 23 H5 Q3.5 22 3.5 20 V2.5 Q3.5 1 4 1 Z" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M4.5 12 H12.5" stroke="${C.out}" stroke-width="1" opacity="0.55"/>
  </svg>`;
  const shinRightSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 24">
    <path d="M4 1 H12 Q13.5 1 13.5 2.5 V20 Q13.5 22 12 23 H5 Q3.5 22 3.5 20 V2.5 Q3.5 1 4 1 Z" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M3.5 12 H11.5" stroke="${C.out}" stroke-width="1" opacity="0.55"/>
  </svg>`;

  return {
    id: "pants_leather",
    name: "Leather Pants",
    description: "Fitted leather pants",
    category: "legs",
    compatibility: {
      skeletonFamilies: HUMAN,
      species: [],
      viewProfiles: deriveViewProfiles(HUMAN),
    },
    allowedSlots: legsSlots,
    fitProfile: "standard",
    paletteChannels: ["secondaryCloth", "outline"],
    hasOwnAnimation: false,
    animationClipId: null,
    anchorRules: {},
    svgLayers: [{
      id: "thumb",
      styleSetId: null,
      svgData: svg(`<rect x="14" y="20" width="36" height="10" rx="2" fill="${C.cloth2}"/><rect x="14" y="28" width="16" height="22" rx="2" fill="${C.cloth2}"/><rect x="34" y="28" width="16" height="22" rx="2" fill="${C.cloth2}"/><rect x="14" y="20" width="36" height="32" rx="2" fill="none" stroke="${C.out}" stroke-width="1.5"/>`),
      paletteChannels: ["secondaryCloth", "outline"],
      zOffset: 0,
    }],
    parts: [
      {
        id: "waist",
        boneId: "pelvis",
        svgData: waistSvg,
        metrics: {
          viewBoxX: 0,
          viewBoxY: 0,
          viewBoxWidth: 28,
          viewBoxHeight: 16,
          visualMinX: 2,
          visualMinY: 3,
          visualWidth: 24,
          visualHeight: 10,
        },
        pivot: { x: 14, y: 8, preset: "custom" },
        localTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        coordinateMode: "bone_local",
        zOffset: 0.2,
      },
      {
        id: "thigh_l",
        boneId: "hip_l",
        svgData: thighLeftSvg,
        metrics: {
          viewBoxX: 0,
          viewBoxY: 0,
          viewBoxWidth: 18,
          viewBoxHeight: 24,
          visualMinX: 4,
          visualMinY: 2,
          visualWidth: 12,
          visualHeight: 21,
        },
        pivot: { x: 9, y: 3, preset: "custom" },
        localTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        coordinateMode: "bone_local",
        zOffset: -0.08,
      },
      {
        id: "shin_l",
        boneId: "knee_l",
        svgData: shinLeftSvg,
        metrics: {
          viewBoxX: 0,
          viewBoxY: 0,
          viewBoxWidth: 16,
          viewBoxHeight: 24,
          visualMinX: 3.5,
          visualMinY: 1,
          visualWidth: 10,
          visualHeight: 22,
        },
        pivot: { x: 8, y: 2, preset: "custom" },
        localTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        coordinateMode: "bone_local",
        zOffset: -0.04,
      },
      {
        id: "thigh_r",
        boneId: "hip_r",
        svgData: thighRightSvg,
        metrics: {
          viewBoxX: 0,
          viewBoxY: 0,
          viewBoxWidth: 18,
          viewBoxHeight: 24,
          visualMinX: 4,
          visualMinY: 2,
          visualWidth: 12,
          visualHeight: 21,
        },
        pivot: { x: 9, y: 3, preset: "custom" },
        localTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        coordinateMode: "bone_local",
        zOffset: 0.04,
      },
      {
        id: "shin_r",
        boneId: "knee_r",
        svgData: shinRightSvg,
        metrics: {
          viewBoxX: 0,
          viewBoxY: 0,
          viewBoxWidth: 16,
          viewBoxHeight: 24,
          visualMinX: 3.5,
          visualMinY: 1,
          visualWidth: 10,
          visualHeight: 22,
        },
        pivot: { x: 8, y: 2, preset: "custom" },
        localTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        coordinateMode: "bone_local",
        zOffset: 0.08,
      },
    ],
    coordinateMode: "bone_local",
    licenseMeta: CC0,
    tags: ["clothing", "legs"],
  };
}

function v2LeatherGreavesItem(): Item {
  const thighSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 18">
    <path d="M3 2 H13 Q15 2 15 4 V18 H1 V4 Q1 2 3 2 Z" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M1 4 Q1 2 3 2 H13 Q15 2 15 4 V10 H1 Z" fill="${C.accent}" opacity="0.5"/>
    <path d="M1 10 H15" stroke="${C.out}" stroke-width="1.5" opacity="0.5"/>
  </svg>`;
  const shinSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 18">
    <path d="M1 0 H15 V14 Q15 16 13 16 H3 Q1 16 1 14 Z" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5" stroke-linejoin="round"/>
  </svg>`;

  return {
    id: "greave_leather",
    name: "Leather Greaves",
    description: "Leather shin protectors",
    category: "legs",
    compatibility: {
      skeletonFamilies: HUMAN,
      species: [],
      viewProfiles: deriveViewProfiles(HUMAN),
    },
    allowedSlots: ["slot_legs", "side_slot_legs"],
    fitProfile: "standard",
    paletteChannels: ["secondaryCloth", "accent"],
    hasOwnAnimation: false,
    animationClipId: null,
    anchorRules: {},
    svgLayers: [{
      id: "thumb",
      styleSetId: null,
      svgData: svg(`<rect x="16" y="20" width="14" height="30" rx="3" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><rect x="34" y="20" width="14" height="30" rx="3" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><rect x="16" y="20" width="14" height="8" fill="${C.accent}" opacity="0.5"/><rect x="34" y="20" width="14" height="8" fill="${C.accent}" opacity="0.5"/>`),
      paletteChannels: ["secondaryCloth", "accent"],
      zOffset: 0,
    }],
    parts: [
      {
        id: "greave_thigh_l",
        boneId: "hip_l",
        svgData: thighSvg,
        metrics: {
          viewBoxX: 0, viewBoxY: 0, viewBoxWidth: 16, viewBoxHeight: 18,
          visualMinX: 1, visualMinY: 2, visualWidth: 14, visualHeight: 16,
        },
        pivot: { x: 8, y: 3, preset: "custom" },
        localTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        coordinateMode: "bone_local",
        zOffset: 0.1,
      },
      {
        id: "greave_shin_l",
        boneId: "knee_l",
        svgData: shinSvg,
        metrics: {
          viewBoxX: 0, viewBoxY: 0, viewBoxWidth: 16, viewBoxHeight: 18,
          visualMinX: 1, visualMinY: 0, visualWidth: 14, visualHeight: 16,
        },
        pivot: { x: 8, y: 2, preset: "custom" },
        localTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        coordinateMode: "bone_local",
        zOffset: 0.1,
      },
      {
        id: "greave_thigh_r",
        boneId: "hip_r",
        svgData: thighSvg,
        metrics: {
          viewBoxX: 0, viewBoxY: 0, viewBoxWidth: 16, viewBoxHeight: 18,
          visualMinX: 1, visualMinY: 2, visualWidth: 14, visualHeight: 16,
        },
        pivot: { x: 8, y: 3, preset: "custom" },
        localTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        coordinateMode: "bone_local",
        zOffset: 0.15,
      },
      {
        id: "greave_shin_r",
        boneId: "knee_r",
        svgData: shinSvg,
        metrics: {
          viewBoxX: 0, viewBoxY: 0, viewBoxWidth: 16, viewBoxHeight: 18,
          visualMinX: 1, visualMinY: 0, visualWidth: 14, visualHeight: 16,
        },
        pivot: { x: 8, y: 2, preset: "custom" },
        localTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        coordinateMode: "bone_local",
        zOffset: 0.15,
      },
    ],
    coordinateMode: "bone_local",
    licenseMeta: CC0,
    tags: ["armor", "legs"],
  };
}

export const ITEMS: Item[] = [

  // BOOTS (5)
  v2LeatherBootsItem(),
  item("boots_chain",     "Chain Boots",     "Boots with chain mail protection",     "feet", bootSlots, HUMAN, ["metal","outline"],          bootSVG(C.metal,  C.hair), ["armor","boots"]),
  item("boots_plate",     "Plate Boots",     "Heavy plated steel boots",             "feet", bootSlots, HUMAN, ["metal","accent"],            bootSVG(C.metal,  C.accent), ["armor","boots"]),
  item("boots_farm",      "Farm Boots",      "Worn muddy farm boots",                "feet", bootSlots, HUMAN, ["primaryCloth","outline"],    bootSVG(C.cloth,  C.cloth2), ["clothing","boots","farm"]),
  item("boots_ranger",    "Ranger Boots",    "Light soft boots for silent movement", "feet", bootSlots, HUMAN, ["secondaryCloth","accent"],   bootSVG(C.cloth2, C.accent), ["clothing","boots","ranger"]),

  // PANTS (4) — legs slot
  v2LeatherPantsItem(),
  item("pants_cloth",     "Cloth Breeches",  "Loose cloth breeches",     "legs", ["slot_legs","side_slot_legs"], HUMAN, ["primaryCloth","outline"],
    svg(`<rect x="14" y="20" width="36" height="10" rx="3" fill="${C.cloth}"/><rect x="14" y="28" width="16" height="22" rx="3" fill="${C.cloth}"/><rect x="34" y="28" width="16" height="22" rx="3" fill="${C.cloth}"/><line x1="32" y1="28" x2="32" y2="50" stroke="${C.out}" stroke-width="1"/>`), ["clothing","legs"]),
  item("pants_chainlegs", "Chain Leggings",  "Protective chain leggings","legs", ["slot_legs","side_slot_legs"], HUMAN, ["metal","outline"],
    svg(`<rect x="14" y="20" width="36" height="32" rx="2" fill="${C.metal}"/><line x1="14" y1="26" x2="50" y2="26" stroke="${C.out}" stroke-width="0.8"/><line x1="14" y1="32" x2="50" y2="32" stroke="${C.out}" stroke-width="0.8"/><line x1="14" y1="38" x2="50" y2="38" stroke="${C.out}" stroke-width="0.8"/><rect x="14" y="20" width="36" height="32" rx="2" fill="none" stroke="${C.out}" stroke-width="1.5"/>`), ["armor","legs"]),
  item("pants_farm",      "Farm Overalls",   "Patched farm overalls",    "legs", ["slot_legs","side_slot_legs"], HUMAN, ["primaryCloth","secondaryCloth"],
    svg(`<rect x="16" y="16" width="32" height="36" rx="2" fill="${C.cloth}"/><rect x="22" y="16" width="20" height="12" rx="1" fill="${C.cloth2}"/><rect x="16" y="16" width="32" height="36" rx="2" fill="none" stroke="${C.out}" stroke-width="1.5"/>`), ["clothing","legs","farm"]),

  // TUNICS — torso
  item("tunic_linen",     "Linen Tunic",     "Simple linen tunic",        "torso", ["slot_torso","side_slot_torso"], HUMAN, ["primaryCloth","outline"],
    svg(`<path d="M14 20 L18 14 L32 16 L46 14 L50 20 L50 46 L14 46Z" fill="${C.cloth}" stroke="${C.out}" stroke-width="1.5"/><line x1="32" y1="14" x2="32" y2="46" stroke="${C.out}" stroke-width="0.8" stroke-dasharray="2,2"/>`), ["clothing","torso"]),
  item("tunic_chain",     "Chain Shirt",     "Chain mail shirt",          "torso", ["slot_torso","side_slot_torso"], HUMAN, ["metal","outline"],
    svg(`<path d="M14 20 L18 14 L32 16 L46 14 L50 20 L50 46 L14 46Z" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><line x1="14" y1="28" x2="50" y2="28" stroke="${C.out}" stroke-width="0.7"/><line x1="14" y1="36" x2="50" y2="36" stroke="${C.out}" stroke-width="0.7"/>`), ["armor","torso"]),
  item("tunic_plate",     "Plate Cuirass",   "Heavy plate chest armor",   "torso", ["slot_torso","side_slot_torso"], HUMAN, ["metal","accent"],
    svg(`<path d="M14 20 L18 12 L32 14 L46 12 L50 20 L50 48 L14 48Z" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><path d="M28 20 Q32 26 36 20" fill="none" stroke="${C.accent}" stroke-width="1.5"/><path d="M22 14 L24 24 L32 28 L40 24 L42 14" fill="${C.metal}" stroke="${C.accent}" stroke-width="1"/>`), ["armor","torso"]),
  item("tunic_farm",      "Farm Shirt",      "Loose farm working shirt",  "torso", ["slot_torso","side_slot_torso"], HUMAN, ["primaryCloth","secondaryCloth"],
    svg(`<path d="M14 22 L18 14 L32 16 L46 14 L50 22 L52 46 L12 46Z" fill="${C.cloth}" stroke="${C.out}" stroke-width="1.5"/><path d="M18 14 L22 26" stroke="${C.cloth2}" stroke-width="1"/><path d="M46 14 L42 26" stroke="${C.cloth2}" stroke-width="1"/>`), ["clothing","torso","farm"]),
  item("tunic_noble",     "Noble Doublet",   "Embroidered noble doublet", "torso", ["slot_torso","side_slot_torso"], HUMAN, ["primaryCloth","accent"],
    svg(`<path d="M14 20 L18 12 L32 14 L46 12 L50 20 L50 48 L14 48Z" fill="${C.cloth}" stroke="${C.out}" stroke-width="1.5"/><rect x="28" y="14" width="8" height="34" fill="${C.accent}" opacity="0.5"/><circle cx="32" cy="22" r="2" fill="${C.accent}"/><circle cx="32" cy="30" r="2" fill="${C.accent}"/><circle cx="32" cy="38" r="2" fill="${C.accent}"/>`), ["clothing","torso","noble"]),

  // CLOAKS (4)
  item("cloak_wool",      "Wool Cloak",      "Warm simple wool cloak",        "cloak", ["slot_cloak","side_slot_cloak"], HUMAN, ["primaryCloth","outline"],
    svg(`<path d="M10 10 L32 8 L54 10 L56 54 L32 58 L8 54Z" fill="${C.cloth}" stroke="${C.out}" stroke-width="1.5"/><path d="M10 10 L32 8 L54 10" fill="none" stroke="${C.cloth2}" stroke-width="2"/>`), ["clothing","cloak"],
    { hasOwnAnimation: true, animationClipId: "item_cloak_flap" }),
  item("cloak_ranger",    "Ranger Cloak",    "Mottled forest ranger cloak",   "cloak", ["slot_cloak","side_slot_cloak"], HUMAN, ["secondaryCloth","primaryCloth"],
    svg(`<path d="M10 10 L32 8 L54 10 L58 56 L32 60 L6 56Z" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><path d="M16 16 L26 52" stroke="${C.cloth}" stroke-width="1" stroke-dasharray="3,2"/><path d="M38 16 L48 52" stroke="${C.cloth}" stroke-width="1" stroke-dasharray="3,2"/>`), ["clothing","cloak","ranger"]),
  item("cloak_dark",      "Shadow Cloak",    "Dark concealing shadow cloak",  "cloak", ["slot_cloak","side_slot_cloak"], HUMAN, ["primaryCloth","accent"],
    svg(`<path d="M8 10 L32 6 L56 10 L60 58 L32 62 L4 58Z" fill="${C.hair}" stroke="${C.out}" stroke-width="1.5"/><path d="M8 10 L32 6 L56 10 L56 18 L32 16 L8 18Z" fill="${C.accent}" opacity="0.6"/>`), ["clothing","cloak"]),
  item("cloak_farm",      "Straw Cape",      "Light straw farm cape",         "cloak", ["slot_cloak","side_slot_cloak"], HUMAN, ["secondaryCloth","outline"],
    svg(`<path d="M14 12 L32 10 L50 12 L52 50 L32 54 L12 50Z" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5" stroke-dasharray="3,1"/>`), ["clothing","cloak","farm"]),

  // BELTS (3)
  item("belt_leather",    "Leather Belt",    "Plain leather belt",        "waist", ["slot_waist","side_slot_waist"], HUMAN, ["secondaryCloth","accent"],
    svg(`<rect x="8" y="28" width="48" height="8" rx="2" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><rect x="28" y="26" width="8" height="12" rx="1" fill="${C.accent}" stroke="${C.out}" stroke-width="1"/>`), ["clothing","waist"]),
  item("belt_chain",      "Chain Belt",      "Chain-link belt",           "waist", ["slot_waist","side_slot_waist"], HUMAN, ["metal","outline"],
    svg(`<rect x="8" y="28" width="48" height="8" rx="1" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><line x1="14" y1="28" x2="14" y2="36" stroke="${C.out}" stroke-width="1"/><line x1="22" y1="28" x2="22" y2="36" stroke="${C.out}" stroke-width="1"/><line x1="30" y1="28" x2="30" y2="36" stroke="${C.out}" stroke-width="1"/><line x1="38" y1="28" x2="38" y2="36" stroke="${C.out}" stroke-width="1"/><line x1="46" y1="28" x2="46" y2="36" stroke="${C.out}" stroke-width="1"/>`), ["armor","waist"]),
  item("belt_metal",      "Metal Girdle",    "Wide metal waist girdle",   "waist", ["slot_waist","side_slot_waist"], HUMAN, ["metal","accent"],
    svg(`<rect x="8" y="26" width="48" height="12" rx="2" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><rect x="26" y="24" width="12" height="16" rx="2" fill="${C.accent}" stroke="${C.out}" stroke-width="1"/><circle cx="32" cy="32" r="3" fill="${C.out}"/>`), ["armor","waist"]),

  // GLOVES (4)
  item("gloves_leather",  "Leather Gloves",  "Light leather gloves",      "hands", ["slot_hands","side_slot_hands"], HUMAN, ["secondaryCloth","outline"],
    svg(`<rect x="10" y="20" width="18" height="28" rx="4" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><rect x="36" y="20" width="18" height="28" rx="4" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/>`), ["clothing","hands"]),
  item("gloves_chain",    "Chain Gauntlets", "Chain mail gauntlets",      "hands", ["slot_hands","side_slot_hands"], HUMAN, ["metal","outline"],
    svg(`<rect x="10" y="20" width="18" height="28" rx="3" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><rect x="36" y="20" width="18" height="28" rx="3" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><line x1="10" y1="30" x2="28" y2="30" stroke="${C.out}" stroke-width="0.8"/><line x1="36" y1="30" x2="54" y2="30" stroke="${C.out}" stroke-width="0.8"/>`), ["armor","hands"]),
  item("gloves_plate",    "Plate Gauntlets", "Heavy plate gauntlets",     "hands", ["slot_hands","side_slot_hands"], HUMAN, ["metal","accent"],
    svg(`<rect x="10" y="18" width="18" height="30" rx="2" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><rect x="36" y="18" width="18" height="30" rx="2" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><rect x="10" y="18" width="18" height="8" fill="${C.accent}" stroke="${C.out}" stroke-width="1"/><rect x="36" y="18" width="18" height="8" fill="${C.accent}" stroke="${C.out}" stroke-width="1"/>`), ["armor","hands"]),
  item("gloves_farm",     "Working Gloves",  "Thick farm working gloves", "hands", ["slot_hands","side_slot_hands"], HUMAN, ["primaryCloth","outline"],
    svg(`<rect x="10" y="22" width="18" height="24" rx="5" fill="${C.cloth}" stroke="${C.out}" stroke-width="1.5"/><rect x="36" y="22" width="18" height="24" rx="5" fill="${C.cloth}" stroke="${C.out}" stroke-width="1.5"/>`), ["clothing","hands","farm"]),

  // ═══════════════════════════════════════════════════════════════════════
  // ARMOR
  // ═══════════════════════════════════════════════════════════════════════

  // HELMETS (5)
  item("helm_iron",       "Iron Helmet",     "Basic iron cap helmet",      "head_cover", ["slot_head_cover","side_slot_head_cover"], HUMAN, ["metal","outline"],
    svg(`<ellipse cx="32" cy="28" rx="18" ry="16" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><rect x="22" y="36" width="20" height="6" rx="1" fill="${C.metal}" stroke="${C.out}" stroke-width="1"/>`), ["armor","helmet"]),
  item("helm_full",       "Full Helm",       "Enclosed full plate helmet",  "head_cover", ["slot_head_cover","side_slot_head_cover"], HUMAN, ["metal","accent"],
    svg(`<ellipse cx="32" cy="26" rx="20" ry="18" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><rect x="20" y="36" width="24" height="8" rx="1" fill="${C.metal}" stroke="${C.out}" stroke-width="1"/><rect x="26" y="30" width="12" height="5" rx="1" fill="${C.out}"/><rect x="28" y="30" width="8" height="2" fill="${C.accent}"/>`), ["armor","helmet"]),
  item("helm_barbarian",  "Horned Helm",     "Barbarian helmet with horns", "head_cover", ["slot_head_cover","side_slot_head_cover"], HUMAN, ["metal","secondaryCloth"],
    svg(`<ellipse cx="32" cy="30" rx="18" ry="14" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><path d="M16 24 L8 10 L18 20" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><path d="M48 24 L56 10 L46 20" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/>`), ["armor","helmet"]),
  item("helm_farm_hat",   "Straw Hat",       "Wide-brimmed farm hat",       "head_cover", ["slot_head_cover","side_slot_head_cover"], HUMAN, ["secondaryCloth","outline"],
    svg(`<ellipse cx="32" cy="28" rx="20" ry="10" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><ellipse cx="32" cy="30" rx="28" ry="6" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1"/>`), ["clothing","helmet","farm"]),
  item("helm_ranger_hood","Ranger Hood",     "Dark concealing ranger hood", "head_cover", ["slot_head_cover","side_slot_head_cover"], HUMAN, ["primaryCloth","secondaryCloth"],
    svg(`<ellipse cx="32" cy="24" rx="20" ry="18" fill="${C.cloth}" stroke="${C.out}" stroke-width="1.5"/><path d="M12 30 Q14 50 32 52 Q50 50 52 30" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1"/>`), ["clothing","helmet","ranger"]),

  // CHEST ARMOR (5)
  item("chest_chainmail", "Chain Mail",      "Full chain mail hauberk",    "torso", ["slot_torso","side_slot_torso"], HUMAN, ["metal","outline"],
    svg(`<path d="M12 22 L20 14 L32 16 L44 14 L52 22 L52 50 L12 50Z" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><line x1="12" y1="28" x2="52" y2="28" stroke="${C.out}" stroke-width="0.7"/><line x1="12" y1="34" x2="52" y2="34" stroke="${C.out}" stroke-width="0.7"/><line x1="12" y1="40" x2="52" y2="40" stroke="${C.out}" stroke-width="0.7"/>`), ["armor","torso"]),
  item("chest_plate",     "Plate Armor",     "Heavy articulated plate",    "torso", ["slot_torso","side_slot_torso"], HUMAN, ["metal","accent"],
    svg(`<path d="M12 22 L20 12 L32 14 L44 12 L52 22 L52 50 L12 50Z" fill="${C.metal}" stroke="${C.out}" stroke-width="2"/><path d="M20 12 L20 26 Q32 32 44 26 L44 12" fill="${C.accent}" opacity="0.4" stroke="${C.accent}" stroke-width="1"/><path d="M28 24 Q32 30 36 24" fill="none" stroke="${C.accent}" stroke-width="2"/>`), ["armor","torso"]),
  item("chest_leather",   "Leather Armor",   "Hardened leather cuirass",   "torso", ["slot_torso","side_slot_torso"], HUMAN, ["secondaryCloth","outline"],
    svg(`<path d="M14 22 L20 14 L32 16 L44 14 L50 22 L50 50 L14 50Z" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><path d="M20 14 L20 28 Q32 34 44 28 L44 14" fill="none" stroke="${C.out}" stroke-width="1" stroke-dasharray="2,2"/>`), ["armor","torso"]),
  item("chest_farm_vest", "Farm Vest",       "Simple sleeveless vest",     "torso", ["slot_torso","side_slot_torso"], HUMAN, ["primaryCloth","secondaryCloth"],
    svg(`<path d="M16 20 L22 14 L32 16 L42 14 L48 20 L48 50 L16 50Z" fill="${C.cloth}" stroke="${C.out}" stroke-width="1.5"/><path d="M22 14 L24 30" stroke="${C.cloth2}" stroke-width="2"/><path d="M42 14 L40 30" stroke="${C.cloth2}" stroke-width="2"/>`), ["clothing","torso","farm"]),
  item("chest_noble",     "Noble Armor",     "Ornate noblemans armor",     "torso", ["slot_torso","side_slot_torso"], HUMAN, ["metal","accent"],
    svg(`<path d="M12 22 L20 12 L32 14 L44 12 L52 22 L52 50 L12 50Z" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><rect x="28" y="14" width="8" height="36" fill="${C.accent}" opacity="0.3"/><circle cx="32" cy="22" r="3" fill="${C.accent}" stroke="${C.out}" stroke-width="1"/><circle cx="32" cy="32" r="3" fill="${C.accent}" stroke="${C.out}" stroke-width="1"/><circle cx="32" cy="42" r="3" fill="${C.accent}" stroke="${C.out}" stroke-width="1"/>`), ["armor","torso","noble"]),

  // PAULDRONS (3)
  item("pauldron_iron",   "Iron Pauldrons",  "Iron shoulder guards",       "arms", ["slot_arms","side_slot_arms"], HUMAN, ["metal","outline"],
    svg(`<ellipse cx="16" cy="24" rx="12" ry="8" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><ellipse cx="48" cy="24" rx="12" ry="8" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/>`), ["armor","arms"]),
  item("pauldron_plate",  "Plate Pauldrons", "Heavy plate shoulder guards", "arms", ["slot_arms","side_slot_arms"], HUMAN, ["metal","accent"],
    svg(`<path d="M4 20 L16 14 L28 20 L28 32 L4 32Z" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><path d="M36 20 L48 14 L60 20 L60 32 L36 32Z" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><line x1="4" y1="26" x2="28" y2="26" stroke="${C.accent}" stroke-width="1"/><line x1="36" y1="26" x2="60" y2="26" stroke="${C.accent}" stroke-width="1"/>`), ["armor","arms"]),
  item("pauldron_leather","Leather Guards",  "Light leather shoulder pads","arms", ["slot_arms","side_slot_arms"], HUMAN, ["secondaryCloth","outline"],
    svg(`<path d="M6 22 L16 16 L26 22 L26 32 L6 32Z" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><path d="M38 22 L48 16 L58 22 L58 32 L38 32Z" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/>`), ["armor","arms"]),

  // GAUNTLETS (3)
  item("gaunt_iron",      "Iron Gauntlets",  "Heavy iron fist gauntlets",  "hands", ["slot_hands","side_slot_hands"], HUMAN, ["metal","outline"],
    svg(`<rect x="10" y="16" width="18" height="32" rx="3" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><rect x="36" y="16" width="18" height="32" rx="3" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><rect x="10" y="16" width="18" height="10" fill="${C.metal}" stroke="${C.out}" stroke-width="1"/><rect x="36" y="16" width="18" height="10" fill="${C.metal}" stroke="${C.out}" stroke-width="1"/>`), ["armor","hands"]),
  item("gaunt_plate2",    "Plate Fists",     "Articulated plate fists",    "hands", ["slot_hands","side_slot_hands"], HUMAN, ["metal","accent"],
    svg(`<rect x="10" y="14" width="18" height="34" rx="2" fill="${C.metal}" stroke="${C.out}" stroke-width="2"/><rect x="36" y="14" width="18" height="34" rx="2" fill="${C.metal}" stroke="${C.out}" stroke-width="2"/><rect x="10" y="14" width="18" height="8" fill="${C.accent}"/><rect x="36" y="14" width="18" height="8" fill="${C.accent}"/>`), ["armor","hands"]),
  item("gaunt_leather2",  "Leather Fists",   "Padded leather fist guards", "hands", ["slot_hands","side_slot_hands"], HUMAN, ["secondaryCloth","outline"],
    svg(`<rect x="10" y="18" width="18" height="28" rx="4" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><rect x="36" y="18" width="18" height="28" rx="4" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><line x1="10" y1="28" x2="28" y2="28" stroke="${C.out}" stroke-width="1"/><line x1="36" y1="28" x2="54" y2="28" stroke="${C.out}" stroke-width="1"/>`), ["armor","hands"]),

  // GREAVES (3)
  item("greave_iron",     "Iron Greaves",    "Heavy iron leg guards",      "legs", ["slot_legs","side_slot_legs"], HUMAN, ["metal","outline"],
    svg(`<rect x="14" y="18" width="16" height="34" rx="2" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><rect x="34" y="18" width="16" height="34" rx="2" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><line x1="14" y1="30" x2="30" y2="30" stroke="${C.out}" stroke-width="1"/><line x1="34" y1="30" x2="50" y2="30" stroke="${C.out}" stroke-width="1"/>`), ["armor","legs"]),
  item("greave_plate",    "Plate Greaves",   "Full plate leg protection",  "legs", ["slot_legs","side_slot_legs"], HUMAN, ["metal","accent"],
    svg(`<rect x="14" y="16" width="16" height="36" rx="2" fill="${C.metal}" stroke="${C.out}" stroke-width="2"/><rect x="34" y="16" width="16" height="36" rx="2" fill="${C.metal}" stroke="${C.out}" stroke-width="2"/><rect x="14" y="16" width="16" height="10" fill="${C.accent}"/><rect x="34" y="16" width="16" height="10" fill="${C.accent}"/>`), ["armor","legs"]),
  v2LeatherGreavesItem(),

  // ═══════════════════════════════════════════════════════════════════════
  // ACCESSORIES
  // ═══════════════════════════════════════════════════════════════════════

  // RINGS (4)
  item("ring_iron",       "Iron Ring",       "Simple iron ring",           "ring", ["slot_ring_l","slot_ring_r","side_slot_ring_l","side_slot_ring_r"], HUMAN, ["metal","outline"],
    svg(`<circle cx="32" cy="32" r="14" fill="none" stroke="${C.metal}" stroke-width="6"/><circle cx="32" cy="32" r="14" fill="none" stroke="${C.out}" stroke-width="7" opacity="0.3"/>`), ["accessory","ring"]),
  item("ring_gold",       "Gold Ring",       "Polished gold ring",         "ring", ["slot_ring_l","slot_ring_r","side_slot_ring_l","side_slot_ring_r"], HUMAN, ["accent","outline"],
    svg(`<circle cx="32" cy="32" r="14" fill="none" stroke="${C.accent}" stroke-width="6"/><circle cx="32" cy="18" r="4" fill="${C.accent}" stroke="${C.out}" stroke-width="1"/>`), ["accessory","ring"]),
  item("ring_gem",        "Gem Ring",        "Gold ring with gem stone",   "ring", ["slot_ring_l","slot_ring_r","side_slot_ring_l","side_slot_ring_r"], HUMAN, ["accent","metal"],
    svg(`<circle cx="32" cy="32" r="14" fill="none" stroke="${C.metal}" stroke-width="5"/><rect x="26" y="14" width="12" height="12" rx="2" fill="${C.accent}" stroke="${C.out}" stroke-width="1"/>`), ["accessory","ring"]),
  item("ring_bone",       "Bone Ring",       "Carved bone ring",           "ring", ["slot_ring_l","slot_ring_r","side_slot_ring_l","side_slot_ring_r"], HUMAN, ["skin","outline"],
    svg(`<circle cx="32" cy="32" r="14" fill="none" stroke="${C.skin}" stroke-width="5"/>`), ["accessory","ring"]),

  // AMULETS (4)
  item("amulet_iron",     "Iron Pendant",    "Iron chain pendant",         "amulet", ["slot_neck","side_slot_neck"], HUMAN, ["metal","outline"],
    svg(`<line x1="20" y1="10" x2="32" y2="40" stroke="${C.metal}" stroke-width="2"/><line x1="44" y1="10" x2="32" y2="40" stroke="${C.metal}" stroke-width="2"/><polygon points="26,44 32,56 38,44" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/>`), ["accessory","amulet"]),
  item("amulet_gold",     "Gold Amulet",     "Gold crescent amulet",       "amulet", ["slot_neck","side_slot_neck"], HUMAN, ["accent","outline"],
    svg(`<line x1="20" y1="10" x2="32" y2="38" stroke="${C.metal}" stroke-width="2"/><line x1="44" y1="10" x2="32" y2="38" stroke="${C.metal}" stroke-width="2"/><circle cx="32" cy="44" r="10" fill="${C.accent}" stroke="${C.out}" stroke-width="1.5"/>`), ["accessory","amulet"]),
  item("amulet_gem",      "Crystal Amulet",  "Silver amulet with crystal", "amulet", ["slot_neck","side_slot_neck"], HUMAN, ["metal","accent"],
    svg(`<line x1="20" y1="10" x2="32" y2="36" stroke="${C.metal}" stroke-width="2"/><line x1="44" y1="10" x2="32" y2="36" stroke="${C.metal}" stroke-width="2"/><polygon points="32,30 22,48 42,48" fill="${C.accent}" stroke="${C.out}" stroke-width="1.5" opacity="0.9"/>`), ["accessory","amulet"]),
  item("amulet_crystal",  "Eye Pendant",     "Mystic eye pendant",         "amulet", ["slot_neck","side_slot_neck"], HUMAN, ["accent","skin"],
    svg(`<line x1="20" y1="10" x2="32" y2="34" stroke="${C.metal}" stroke-width="2"/><line x1="44" y1="10" x2="32" y2="34" stroke="${C.metal}" stroke-width="2"/><ellipse cx="32" cy="44" rx="10" ry="7" fill="${C.skin}" stroke="${C.out}" stroke-width="1.5"/><ellipse cx="32" cy="44" rx="5" ry="5" fill="${C.accent}"/><circle cx="32" cy="44" r="2" fill="${C.hair}"/>`), ["accessory","amulet"]),

  // BAGS (3)
  item("bag_pouch",       "Coin Pouch",      "Small leather coin pouch",   "waist", ["slot_waist","side_slot_waist"], HUMAN, ["secondaryCloth","accent"],
    svg(`<ellipse cx="32" cy="40" rx="14" ry="16" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><ellipse cx="32" cy="24" rx="6" ry="4" fill="${C.cloth}" stroke="${C.out}" stroke-width="1"/><line x1="26" y1="28" x2="38" y2="28" stroke="${C.out}" stroke-width="1"/>`), ["accessory","waist"]),
  item("bag_satchel",     "Satchel",         "Leather messenger satchel",  "waist", ["slot_waist","side_slot_waist"], HUMAN, ["secondaryCloth","outline"],
    svg(`<rect x="14" y="22" width="36" height="30" rx="3" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><rect x="14" y="22" width="36" height="10" rx="3" fill="${C.cloth}" stroke="${C.out}" stroke-width="1"/><line x1="14" y1="18" x2="14" y2="22" stroke="${C.cloth2}" stroke-width="3"/><line x1="50" y1="18" x2="50" y2="22" stroke="${C.cloth2}" stroke-width="3"/>`), ["accessory","waist"]),
  item("bag_backpack",    "Backpack",        "Adventurer's backpack",      "cloak", ["slot_cloak","side_slot_cloak"], HUMAN, ["secondaryCloth","primaryCloth"],
    svg(`<rect x="16" y="14" width="32" height="40" rx="4" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><rect x="20" y="18" width="24" height="16" rx="2" fill="${C.cloth}" stroke="${C.out}" stroke-width="1"/><line x1="24" y1="54" x2="24" y2="60" stroke="${C.cloth2}" stroke-width="3"/><line x1="40" y1="54" x2="40" y2="60" stroke="${C.cloth2}" stroke-width="3"/>`), ["accessory","bag"]),

  // ═══════════════════════════════════════════════════════════════════════
  // WEAPONS
  // ═══════════════════════════════════════════════════════════════════════

  // SWORDS (5)
  item("sword_short",     "Short Sword",     "Compact thrusting blade",    "weapon_main", ["slot_weapon_main","side_slot_weapon_main"], HUMAN, ["metal","secondaryCloth"],
    svg(`<rect x="30" y="8" width="4" height="36" rx="1" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><rect x="22" y="28" width="20" height="4" rx="1" fill="${C.metal}" stroke="${C.out}" stroke-width="1"/><rect x="29" y="44" width="6" height="12" rx="2" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1"/><polygon points="30,8 34,8 32,4" fill="${C.metal}"/>`), ["weapon","sword"]),
  item("sword_long",      "Long Sword",      "Balanced knightly sword",    "weapon_main", ["slot_weapon_main","side_slot_weapon_main"], HUMAN, ["metal","accent"],
    svg(`<rect x="30" y="6" width="4" height="40" rx="1" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><rect x="20" y="30" width="24" height="4" rx="1" fill="${C.accent}" stroke="${C.out}" stroke-width="1"/><rect x="29" y="46" width="6" height="14" rx="2" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1"/><polygon points="30,6 34,6 32,2" fill="${C.metal}"/>`), ["weapon","sword"]),
  item("sword_twohander", "Greatsword",      "Massive two-handed sword",   "weapon_main", ["slot_weapon_main","side_slot_weapon_main"], HUMAN, ["metal","accent"],
    svg(`<rect x="29" y="4" width="6" height="44" rx="1" fill="${C.metal}" stroke="${C.out}" stroke-width="2"/><rect x="16" y="32" width="32" height="5" rx="1" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><rect x="28" y="48" width="8" height="14" rx="2" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1"/><polygon points="29,4 35,4 32,0" fill="${C.accent}"/>`), ["weapon","sword"]),
  item("sword_curved",    "Scimitar",        "Curved eastern blade",       "weapon_main", ["slot_weapon_main","side_slot_weapon_main"], HUMAN, ["metal","accent"],
    svg(`<path d="M32 8 Q42 20 38 48" fill="none" stroke="${C.metal}" stroke-width="5" stroke-linecap="round"/><path d="M32 8 Q42 20 38 48" fill="none" stroke="${C.out}" stroke-width="6" opacity="0.3"/><rect x="22" y="34" width="20" height="4" rx="1" fill="${C.metal}" stroke="${C.out}" stroke-width="1"/><rect x="29" y="48" width="6" height="12" rx="2" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1"/>`), ["weapon","sword"]),
  item("sword_rapier",    "Rapier",          "Elegant thrusting rapier",   "weapon_main", ["slot_weapon_main","side_slot_weapon_main"], HUMAN, ["metal","accent"],
    svg(`<line x1="32" y1="4" x2="32" y2="52" stroke="${C.metal}" stroke-width="2.5" stroke-linecap="round"/><path d="M20 36 Q32 30 44 36" fill="none" stroke="${C.metal}" stroke-width="2.5"/><circle cx="32" cy="44" r="4" fill="${C.accent}" stroke="${C.out}" stroke-width="1"/><rect x="29" y="48" width="6" height="14" rx="2" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1"/>`), ["weapon","sword"]),

  // AXES (3)
  item("axe_hatchet",     "Hatchet",         "Small one-handed axe",       "weapon_main", ["slot_weapon_main","side_slot_weapon_main"], HUMAN, ["metal","secondaryCloth"],
    svg(`<path d="M28 8 L38 8 L40 26 L28 26Z" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><rect x="30" y="24" width="4" height="34" rx="2" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/>`), ["weapon","axe"]),
  item("axe_battle",      "Battle Axe",      "Heavy single-blade axe",     "weapon_main", ["slot_weapon_main","side_slot_weapon_main"], HUMAN, ["metal","accent"],
    svg(`<path d="M24 6 L44 12 L42 30 L24 24Z" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><rect x="30" y="22" width="4" height="38" rx="2" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><path d="M42 12 L50 18 L46 28 L42 24" fill="${C.accent}" stroke="${C.out}" stroke-width="1"/>`), ["weapon","axe"]),
  item("axe_war",         "War Axe",         "Double-headed war axe",      "weapon_main", ["slot_weapon_main","side_slot_weapon_main"], HUMAN, ["metal","accent"],
    svg(`<path d="M20 12 L32 8 L44 12 L44 26 L32 28 L20 26Z" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><rect x="30" y="26" width="4" height="32" rx="2" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/>`), ["weapon","axe"]),

  // BOWS (3)
  item("bow_short",       "Short Bow",       "Compact short bow",          "weapon_main", ["slot_weapon_main","side_slot_weapon_main"], HUMAN, ["secondaryCloth","hair"],
    svg(`<path d="M24 6 Q16 32 24 58" fill="none" stroke="${C.cloth2}" stroke-width="4" stroke-linecap="round"/><line x1="24" y1="8" x2="24" y2="56" stroke="${C.hair}" stroke-width="1"/>`), ["weapon","bow","ranged"]),
  item("bow_long",        "Long Bow",        "Tall powerful longbow",      "weapon_main", ["slot_weapon_main","side_slot_weapon_main"], HUMAN, ["secondaryCloth","hair"],
    svg(`<path d="M28 4 Q18 32 28 60" fill="none" stroke="${C.cloth2}" stroke-width="5" stroke-linecap="round"/><line x1="28" y1="5" x2="28" y2="59" stroke="${C.hair}" stroke-width="1.5"/><line x1="28" y1="32" x2="40" y2="32" stroke="${C.hair}" stroke-width="1" stroke-dasharray="2,2"/>`), ["weapon","bow","ranged"]),
  item("bow_compound",    "Compound Bow",    "Modern compound bow style",  "weapon_main", ["slot_weapon_main","side_slot_weapon_main"], HUMAN, ["metal","secondaryCloth"],
    svg(`<path d="M24 8 Q14 32 24 56" fill="none" stroke="${C.cloth2}" stroke-width="4"/><circle cx="24" cy="12" r="4" fill="${C.metal}" stroke="${C.out}" stroke-width="1"/><circle cx="24" cy="52" r="4" fill="${C.metal}" stroke="${C.out}" stroke-width="1"/><line x1="24" y1="8" x2="24" y2="56" stroke="${C.hair}" stroke-width="1"/>`), ["weapon","bow","ranged"]),

  // CROSSBOWS (2)
  item("xbow_light",      "Crossbow",        "Standard repeating crossbow","weapon_main", ["slot_weapon_main","side_slot_weapon_main"], HUMAN, ["secondaryCloth","metal"],
    svg(`<rect x="10" y="28" width="44" height="8" rx="2" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><rect x="28" y="10" width="8" height="26" rx="2" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><line x1="10" y1="28" x2="54" y2="28" stroke="${C.hair}" stroke-width="1"/>`), ["weapon","crossbow","ranged"]),
  item("xbow_heavy",      "Heavy Crossbow",  "Powerful heavy crossbow",    "weapon_main", ["slot_weapon_main","side_slot_weapon_main"], HUMAN, ["metal","secondaryCloth"],
    svg(`<rect x="8" y="26" width="48" height="12" rx="2" fill="${C.metal}" stroke="${C.out}" stroke-width="2"/><rect x="26" y="8" width="12" height="26" rx="2" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><rect x="12" y="38" width="8" height="4" rx="1" fill="${C.cloth2}"/><line x1="8" y1="26" x2="56" y2="26" stroke="${C.hair}" stroke-width="1.5"/>`), ["weapon","crossbow","ranged"]),

  // SPEARS (3)
  item("spear_short",     "Spear",           "Balanced throwing spear",    "weapon_main", ["slot_weapon_main","side_slot_weapon_main"], HUMAN, ["metal","secondaryCloth"],
    svg(`<line x1="32" y1="4" x2="32" y2="60" stroke="${C.cloth2}" stroke-width="3"/><polygon points="26,4 38,4 32,14" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/>`), ["weapon","spear"]),
  item("spear_pike",      "Pike",            "Long infantry pike",         "weapon_main", ["slot_weapon_main","side_slot_weapon_main"], HUMAN, ["metal","secondaryCloth"],
    svg(`<line x1="32" y1="2" x2="32" y2="62" stroke="${C.cloth2}" stroke-width="3"/><polygon points="28,2 36,2 32,16" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><rect x="28" y="52" width="8" height="6" rx="1" fill="${C.metal}" stroke="${C.out}" stroke-width="1"/>`), ["weapon","spear"]),
  item("spear_trident",   "Trident",         "Three-pronged trident",      "weapon_main", ["slot_weapon_main","side_slot_weapon_main"], HUMAN, ["metal","accent"],
    svg(`<line x1="32" y1="8" x2="32" y2="60" stroke="${C.cloth2}" stroke-width="3"/><polygon points="26,8 38,8 32,18" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><polygon points="18,8 24,8 22,22" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><polygon points="42,8 46,8 40,22" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/>`), ["weapon","spear"]),

  // STAVES (3)
  item("staff_wood",      "Wooden Staff",    "Simple carved walking staff", "weapon_main", ["slot_weapon_main","side_slot_weapon_main"], HUMAN, ["secondaryCloth","outline"],
    svg(`<rect x="29" y="6" width="6" height="52" rx="3" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><circle cx="32" cy="8" r="5" fill="${C.cloth}" stroke="${C.out}" stroke-width="1.5"/>`), ["weapon","staff","magic"]),
  item("staff_metal",     "Iron Staff",      "Heavy iron-reinforced staff", "weapon_main", ["slot_weapon_main","side_slot_weapon_main"], HUMAN, ["metal","accent"],
    svg(`<rect x="29" y="6" width="6" height="52" rx="2" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><polygon points="24,4 40,4 36,14 28,14" fill="${C.accent}" stroke="${C.out}" stroke-width="1.5"/>`), ["weapon","staff"]),
  item("staff_magic",     "Magic Staff",     "Glowing enchanted staff",    "weapon_main", ["slot_weapon_main","side_slot_weapon_main"], HUMAN, ["accent","metal"],
    svg(`<rect x="29" y="10" width="6" height="52" rx="3" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><circle cx="32" cy="8" r="9" fill="${C.accent}" stroke="${C.out}" stroke-width="1.5"/><circle cx="32" cy="8" r="5" fill="${C.accent}" opacity="0.6"/>`), ["weapon","staff","magic"]),

  // DAGGERS (3)
  item("dagger_basic",    "Dagger",          "Standard fighting dagger",   "weapon_main", ["slot_weapon_main","slot_weapon_off","side_slot_weapon_main","side_slot_weapon_off"], HUMAN, ["metal","secondaryCloth"],
    svg(`<polygon points="30,10 34,10 33,38 31,38" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><rect x="24" y="34" width="16" height="4" rx="1" fill="${C.metal}" stroke="${C.out}" stroke-width="1"/><rect x="29" y="38" width="6" height="14" rx="2" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1"/>`), ["weapon","dagger"]),
  item("dagger_dirk",     "Dirk",            "Long Scottish dirk",         "weapon_main", ["slot_weapon_main","slot_weapon_off","side_slot_weapon_main","side_slot_weapon_off"], HUMAN, ["metal","accent"],
    svg(`<polygon points="30,8 34,8 33,42 31,42" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><rect x="25" y="40" width="14" height="4" rx="1" fill="${C.accent}" stroke="${C.out}" stroke-width="1"/><rect x="29" y="44" width="6" height="14" rx="2" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1"/>`), ["weapon","dagger"]),
  item("dagger_throwing", "Throwing Knife",  "Balanced throwing blade",    "weapon_off",  ["slot_weapon_off","side_slot_weapon_off"], HUMAN, ["metal","outline"],
    svg(`<polygon points="30,6 34,6 36,50 28,50" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><line x1="30" y1="44" x2="34" y2="44" stroke="${C.out}" stroke-width="1"/>`), ["weapon","dagger","ranged"]),

  // FARMING TOOLS (4)
  item("tool_pitchfork",  "Pitchfork",       "Three-tined pitchfork",      "weapon_main", ["slot_weapon_main","side_slot_weapon_main"], HUMAN, ["metal","secondaryCloth"],
    svg(`<line x1="32" y1="10" x2="32" y2="60" stroke="${C.cloth2}" stroke-width="3"/><line x1="26" y1="10" x2="26" y2="24" stroke="${C.metal}" stroke-width="3"/><line x1="32" y1="10" x2="32" y2="24" stroke="${C.metal}" stroke-width="3"/><line x1="38" y1="10" x2="38" y2="24" stroke="${C.metal}" stroke-width="3"/><line x1="24" y1="22" x2="40" y2="22" stroke="${C.metal}" stroke-width="2"/>`), ["tool","farm","weapon"]),
  item("tool_hoe",        "Garden Hoe",      "Long-handled garden hoe",    "weapon_main", ["slot_weapon_main","side_slot_weapon_main"], HUMAN, ["metal","secondaryCloth"],
    svg(`<line x1="32" y1="6" x2="32" y2="60" stroke="${C.cloth2}" stroke-width="3"/><rect x="16" y="6" width="32" height="6" rx="2" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><line x1="32" y1="6" x2="32" y2="14" stroke="${C.metal}" stroke-width="2"/>`), ["tool","farm"]),
  item("tool_shovel",     "Shovel",          "Round-headed digging shovel","weapon_main", ["slot_weapon_main","side_slot_weapon_main"], HUMAN, ["metal","secondaryCloth"],
    svg(`<line x1="32" y1="26" x2="32" y2="60" stroke="${C.cloth2}" stroke-width="3"/><ellipse cx="32" cy="18" rx="12" ry="14" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/>`), ["tool","farm"]),
  item("tool_sickle",     "Sickle",          "Curved harvesting sickle",   "weapon_main", ["slot_weapon_main","side_slot_weapon_main"], HUMAN, ["metal","secondaryCloth"],
    svg(`<path d="M32 54 L32 22 Q32 6 46 12" fill="none" stroke="${C.cloth2}" stroke-width="3"/><path d="M32 22 Q32 6 48 12 Q58 18 52 28" fill="none" stroke="${C.metal}" stroke-width="4" stroke-linecap="round"/>`), ["tool","farm","weapon"]),

  // ═══════════════════════════════════════════════════════════════════════
  // SHIELDS (4)
  // ═══════════════════════════════════════════════════════════════════════

  item("shield_round",    "Round Shield",    "Classic round shield",       "shield", ["slot_weapon_off","side_slot_weapon_off"], HUMAN, ["metal","accent"],
    svg(`<circle cx="32" cy="32" r="24" fill="${C.metal}" stroke="${C.out}" stroke-width="2"/><circle cx="32" cy="32" r="16" fill="none" stroke="${C.accent}" stroke-width="1.5"/><circle cx="32" cy="32" r="5" fill="${C.accent}" stroke="${C.out}" stroke-width="1"/>`), ["shield","defense"]),
  item("shield_kite",     "Kite Shield",     "Elongated kite shield",      "shield", ["slot_weapon_off","side_slot_weapon_off"], HUMAN, ["metal","accent"],
    svg(`<path d="M32 6 L52 20 L52 42 L32 58 L12 42 L12 20Z" fill="${C.metal}" stroke="${C.out}" stroke-width="2"/><path d="M32 6 L32 58" stroke="${C.accent}" stroke-width="1.5"/><path d="M12 32 L52 32" stroke="${C.accent}" stroke-width="1.5"/>`), ["shield","defense"]),
  item("shield_tower",    "Tower Shield",    "Massive tower shield",       "shield", ["slot_weapon_off","side_slot_weapon_off"], HUMAN, ["metal","primaryCloth"],
    svg(`<rect x="12" y="8" width="40" height="48" rx="4" fill="${C.metal}" stroke="${C.out}" stroke-width="2"/><rect x="20" y="14" width="24" height="16" rx="2" fill="${C.cloth}" opacity="0.5"/><line x1="32" y1="8" x2="32" y2="56" stroke="${C.out}" stroke-width="1"/>`), ["shield","defense"]),
  item("shield_buckler",  "Buckler",         "Small fist-held buckler",    "shield", ["slot_weapon_off","side_slot_weapon_off"], HUMAN, ["metal","accent"],
    svg(`<circle cx="32" cy="32" r="16" fill="${C.metal}" stroke="${C.out}" stroke-width="2"/><circle cx="32" cy="32" r="5" fill="${C.accent}" stroke="${C.out}" stroke-width="1.5"/>`), ["shield","defense"]),

  // ═══════════════════════════════════════════════════════════════════════
  // CREATURE PARTS
  // ═══════════════════════════════════════════════════════════════════════

  // SADDLES (3) — restricted to quadruped species; bird_back allows flying mounts
  item("saddle_leather",  "Leather Saddle",  "Standard leather saddle",    "creature_saddle", ["quad_saddle","bird_back"], QUAD, ["secondaryCloth","outline"],
    svg(`<ellipse cx="32" cy="30" rx="22" ry="14" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><ellipse cx="32" cy="22" rx="10" ry="8" fill="${C.cloth}" stroke="${C.out}" stroke-width="1.5"/>`), ["creature","saddle"],
    { species: ["horse","pony","ox","mule","bear","wolf"] }),
  item("saddle_plate",    "Plate Saddle",    "Armored war saddle",         "creature_saddle", ["quad_saddle"], QUAD, ["metal","accent"],
    svg(`<ellipse cx="32" cy="30" rx="22" ry="14" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><ellipse cx="32" cy="22" rx="10" ry="8" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><line x1="10" y1="30" x2="54" y2="30" stroke="${C.accent}" stroke-width="1"/>`), ["creature","saddle","armor"],
    { species: ["horse","warhorse","ox"], fitProfile: "heavy" }),
  item("saddle_farm",     "Farm Saddle",     "Plain working farm saddle",  "creature_saddle", ["quad_saddle"], QUAD, ["primaryCloth","secondaryCloth"],
    svg(`<ellipse cx="32" cy="32" rx="20" ry="12" fill="${C.cloth}" stroke="${C.out}" stroke-width="1.5"/><ellipse cx="32" cy="24" rx="8" ry="6" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1"/>`), ["creature","saddle","farm"],
    { species: ["horse","pony","donkey","ox","mule"] }),

  // HORNS (4) — species left open so they work on any creature type with horn slots;
  //             specific species can be declared per-species creature entity
  item("horn_small",      "Small Horns",     "Short curved horns",         "creature_horn", ["quad_horn_l","quad_horn_r","bird_crest","monster_slot_head_cover"], [...QUAD,...BIRD,...HUMAN], ["secondaryCloth","outline"],
    svg(`<path d="M16 40 Q10 20 22 12" fill="none" stroke="${C.cloth2}" stroke-width="6" stroke-linecap="round"/><path d="M48 40 Q54 20 42 12" fill="none" stroke="${C.cloth2}" stroke-width="6" stroke-linecap="round"/>`), ["creature","horn"],
    { species: ["bull","cow","deer","goat","ram","demon"] }),
  item("horn_large",      "Curved Horns",    "Long dramatic curved horns", "creature_horn", ["quad_horn_l","quad_horn_r","monster_slot_head_cover"], [...QUAD,...HUMAN], ["secondaryCloth","outline"],
    svg(`<path d="M16 46 Q4 20 20 8" fill="none" stroke="${C.cloth2}" stroke-width="7" stroke-linecap="round"/><path d="M48 46 Q60 20 44 8" fill="none" stroke="${C.cloth2}" stroke-width="7" stroke-linecap="round"/>`), ["creature","horn"],
    { species: ["bull","buffalo","dragon","demon","orc"] }),
  item("horn_spiral",     "Spiral Horns",    "Unicorn-style spiral horn",  "creature_horn", ["quad_horn_l","quad_horn_r","bird_crest"], [...QUAD,...BIRD], ["accent","outline"],
    svg(`<path d="M32 50 Q26 40 30 30 Q34 20 28 10" fill="none" stroke="${C.accent}" stroke-width="5" stroke-linecap="round"/><path d="M32 50 Q38 40 34 30 Q30 20 36 10" fill="none" stroke="${C.accent}" stroke-width="3" stroke-linecap="round" opacity="0.6"/>`), ["creature","horn"],
    { species: ["unicorn","narwhal","alicorn"] }),
  item("horn_crown",      "Crown Horns",     "Multiple crown-like spikes", "creature_horn", ["quad_horn_l","quad_horn_r","monster_slot_head_cover"], [...QUAD,...HUMAN], ["metal","accent"],
    svg(`<polygon points="32,6 28,22 32,18 36,22" fill="${C.metal}" stroke="${C.out}" stroke-width="1"/><polygon points="20,10 16,26 22,22 24,28" fill="${C.metal}" stroke="${C.out}" stroke-width="1"/><polygon points="44,10 48,26 42,22 40,28" fill="${C.metal}" stroke="${C.out}" stroke-width="1"/>`), ["creature","horn","armor"],
    { species: ["dragon","demon","devil","undead"] }),

  // WINGS (3) — species constrains which creature body types use them naturally
  item("wing_bat",        "Bat Wings",       "Leathery dark bat wings",    "creature_wing", ["bird_wing_l","bird_wing_r"], BIRD, ["primaryCloth","outline"],
    svg(`<path d="M32 32 Q10 16 6 6 Q18 8 22 18 Q14 10 12 4 Q28 12 32 22" fill="${C.cloth}" stroke="${C.out}" stroke-width="1.5"/><path d="M32 32 Q54 16 58 6 Q46 8 42 18 Q50 10 52 4 Q36 12 32 22" fill="${C.cloth}" stroke="${C.out}" stroke-width="1.5"/>`), ["creature","wing"],
    { species: ["bat","demon","vampire","devil","wyvern"] }),
  item("wing_feather",    "Feathered Wings", "Large white feathered wings","creature_wing", ["bird_wing_l","bird_wing_r"], BIRD, ["skin","outline"],
    svg(`<path d="M32 34 Q8 22 4 8 Q16 12 20 22" fill="${C.skin}" stroke="${C.out}" stroke-width="1.5"/><path d="M32 34 Q56 22 60 8 Q48 12 44 22" fill="${C.skin}" stroke="${C.out}" stroke-width="1.5"/><line x1="32" y1="34" x2="4" y2="8" stroke="${C.out}" stroke-width="0.8" stroke-dasharray="3,2"/><line x1="32" y1="34" x2="60" y2="8" stroke="${C.out}" stroke-width="0.8" stroke-dasharray="3,2"/>`), ["creature","wing"],
    { species: ["pegasus","alicorn","angel","bird","phoenix","griffin"] }),
  item("wing_dragon",     "Dragon Wings",    "Massive armored dragon wings","creature_wing", ["bird_wing_l","bird_wing_r"], BIRD, ["secondaryCloth","metal"],
    svg(`<path d="M32 36 Q4 22 2 6 Q16 12 22 24 Q12 14 10 6 Q28 16 32 28" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><path d="M32 36 Q60 22 62 6 Q48 12 42 24 Q52 14 54 6 Q36 16 32 28" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/>`), ["creature","wing"],
    { species: ["dragon","wyvern","drake","lizard"] }),

  // TAILS (3) — species restricts to animals with tails
  item("tail_short",      "Short Tail",      "Stubby animal tail",         "creature_tail", ["bird_tail","quad_pack_l"], [...QUAD,...BIRD], ["secondaryCloth","outline"],
    svg(`<path d="M32 18 Q44 32 40 50" fill="none" stroke="${C.cloth2}" stroke-width="8" stroke-linecap="round"/>`), ["creature","tail"],
    { species: ["dog","wolf","bear","cat","fox","rabbit","horse","pig"] }),
  item("tail_long",       "Long Tail",       "Long sweeping tail",         "creature_tail", ["bird_tail","quad_pack_l"], [...QUAD,...BIRD], ["secondaryCloth","outline"],
    svg(`<path d="M32 10 Q50 20 54 36 Q58 52 44 58" fill="none" stroke="${C.cloth2}" stroke-width="7" stroke-linecap="round"/>`), ["creature","tail"],
    { species: ["cat","lion","tiger","dragon","lizard","snake","rat"] }),
  item("tail_barbed",     "Barbed Tail",     "Spiked demon tail",          "creature_tail", ["bird_tail"], [...BIRD,...HUMAN], ["accent","outline"],
    svg(`<path d="M32 10 Q48 22 52 38 Q56 52 42 60" fill="none" stroke="${C.cloth2}" stroke-width="6" stroke-linecap="round"/><polygon points="40,56 50,60 44,50" fill="${C.accent}" stroke="${C.out}" stroke-width="1.5"/>`), ["creature","tail"],
    { species: ["demon","devil","scorpion","manticore","devil"] }),

  // BACK SHELLS (2) — tightly species-restricted to shelled creatures
  item("shell_turtle",    "Turtle Shell",    "Round protective shell",     "creature_shell", ["bird_back","quad_pack_l"], [...QUAD,...BIRD], ["secondaryCloth","primaryCloth"],
    svg(`<ellipse cx="32" cy="34" rx="26" ry="22" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><ellipse cx="32" cy="34" rx="18" ry="16" fill="${C.cloth}" stroke="${C.out}" stroke-width="1"/><line x1="32" y1="18" x2="32" y2="50" stroke="${C.out}" stroke-width="1"/><line x1="14" y1="34" x2="50" y2="34" stroke="${C.out}" stroke-width="1"/>`), ["creature","shell"],
    { species: ["turtle","tortoise","snail"] }),
  item("shell_spike",     "Spiked Shell",    "Shell with defensive spikes","creature_shell", ["bird_back","quad_pack_l"], [...QUAD,...BIRD], ["metal","accent"],
    svg(`<ellipse cx="32" cy="36" rx="22" ry="20" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><polygon points="32,6 28,20 36,20" fill="${C.accent}" stroke="${C.out}" stroke-width="1"/><polygon points="18,14 14,26 22,24" fill="${C.accent}" stroke="${C.out}" stroke-width="1"/><polygon points="46,14 50,26 42,24" fill="${C.accent}" stroke="${C.out}" stroke-width="1"/>`), ["creature","shell","armor"],
    { species: ["turtle","tortoise","hermit_crab","ankylosaurus"], fitProfile: "heavy" }),

  // PACKS (3) — restricted to pack-animal species
  item("pack_light",      "Saddlebag",       "Light leather saddlebag",    "creature_pack", ["quad_pack_l","quad_pack_r"], QUAD, ["secondaryCloth","outline"],
    svg(`<rect x="8" y="16" width="48" height="36" rx="4" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><rect x="14" y="20" width="36" height="20" rx="2" fill="${C.cloth}" stroke="${C.out}" stroke-width="1"/>`), ["creature","pack","bag"],
    { species: ["horse","pony","donkey","mule","ox","bear","wolf"] }),
  item("pack_heavy",      "Heavy Pack",      "Large padded merchant pack", "creature_pack", ["quad_pack_l","quad_pack_r"], QUAD, ["primaryCloth","secondaryCloth"],
    svg(`<rect x="6" y="12" width="52" height="44" rx="4" fill="${C.cloth}" stroke="${C.out}" stroke-width="1.5"/><rect x="12" y="16" width="40" height="24" rx="2" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1"/><rect x="12" y="42" width="40" height="10" rx="2" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1"/>`), ["creature","pack","bag"],
    { species: ["ox","horse","mule","donkey","camel"], fitProfile: "heavy" }),
  item("pack_merchant",   "Merchant Pack",   "Bulging merchant goods pack","creature_pack", ["quad_pack_l","quad_pack_r"], QUAD, ["secondaryCloth","accent"],
    svg(`<rect x="6" y="10" width="52" height="48" rx="5" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><rect x="10" y="14" width="44" height="28" rx="3" fill="${C.cloth}" stroke="${C.out}" stroke-width="1"/><circle cx="32" cy="52" r="5" fill="${C.accent}" stroke="${C.out}" stroke-width="1.5"/>`), ["creature","pack","bag","merchant"],
    { species: ["horse","donkey","mule","camel","ox"] }),

  // ═══════════════════════════════════════════════════════════════════════
  // SIEGE / STATIC OBJECTS
  // ═══════════════════════════════════════════════════════════════════════

  item("siege_catapult",  "Catapult Arm",    "Siege catapult throwing arm","static_part", ["siege_ammo"], SIEGE, ["secondaryCloth","metal"],
    svg(`<rect x="28" y="6" width="8" height="52" rx="4" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><rect x="14" y="42" width="36" height="8" rx="2" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><ellipse cx="32" cy="10" rx="8" ry="6" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/>`), ["siege","weapon"]),
  item("siege_barrel_oak","Oak Barrel",      "Sturdy oak storage barrel",  "static_part", ["siege_armor"], SIEGE, ["secondaryCloth","metal"],
    svg(`<ellipse cx="32" cy="14" rx="18" ry="8" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><rect x="14" y="14" width="36" height="36" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><ellipse cx="32" cy="50" rx="18" ry="8" fill="${C.cloth}" stroke="${C.out}" stroke-width="1.5"/><rect x="14" y="22" width="36" height="2" fill="${C.metal}"/><rect x="14" y="38" width="36" height="2" fill="${C.metal}"/>`), ["siege","object"]),
  item("siege_barrel_ale","Ale Barrel",      "Round ale keg",              "static_part", ["siege_armor"], SIEGE, ["secondaryCloth","accent"],
    svg(`<ellipse cx="32" cy="14" rx="16" ry="8" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><rect x="16" y="14" width="32" height="36" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><ellipse cx="32" cy="50" rx="16" ry="8" fill="${C.cloth}" stroke="${C.out}" stroke-width="1.5"/><rect x="16" y="22" width="32" height="2" fill="${C.accent}"/><rect x="16" y="38" width="32" height="2" fill="${C.accent}"/>`), ["siege","object"]),
  item("siege_chest_wood","Wooden Chest",    "Simple wooden storage chest","static_part", ["siege_armor"], SIEGE, ["secondaryCloth","metal"],
    svg(`<rect x="8" y="28" width="48" height="28" rx="2" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><rect x="8" y="16" width="48" height="18" rx="2" fill="${C.cloth}" stroke="${C.out}" stroke-width="1.5"/><rect x="26" y="36" width="12" height="10" rx="1" fill="${C.metal}" stroke="${C.out}" stroke-width="1.5"/><rect x="28" y="38" width="8" height="6" rx="1" fill="${C.metal}" stroke="${C.out}" stroke-width="1"/>`), ["siege","object"]),
  item("siege_chest_gold","Treasure Chest",  "Iron-bound treasure chest",  "static_part", ["siege_armor"], SIEGE, ["secondaryCloth","accent"],
    svg(`<rect x="8" y="28" width="48" height="28" rx="2" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><rect x="8" y="16" width="48" height="18" rx="2" fill="${C.cloth}" stroke="${C.out}" stroke-width="1.5"/><line x1="8" y1="32" x2="56" y2="32" stroke="${C.accent}" stroke-width="2"/><rect x="26" y="36" width="12" height="10" rx="1" fill="${C.accent}" stroke="${C.out}" stroke-width="1.5"/>`), ["siege","object"]),
  item("siege_tree_oak",  "Oak Tree",        "Sturdy deciduous oak tree",  "static_part", ["siege_ammo","siege_armor"], SIEGE, ["primaryCloth","secondaryCloth"],
    svg(`<rect x="28" y="38" width="8" height="24" rx="2" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><ellipse cx="32" cy="28" rx="22" ry="20" fill="${C.cloth}" stroke="${C.out}" stroke-width="1.5"/><ellipse cx="20" cy="34" rx="12" ry="10" fill="${C.cloth}" stroke="${C.out}" stroke-width="1"/><ellipse cx="44" cy="34" rx="10" ry="9" fill="${C.cloth}" stroke="${C.out}" stroke-width="1"/>`), ["siege","nature"]),
  item("siege_tree_pine", "Pine Tree",       "Tall coniferous pine tree",  "static_part", ["siege_ammo","siege_armor"], SIEGE, ["primaryCloth","secondaryCloth"],
    svg(`<rect x="28" y="44" width="8" height="20" rx="2" fill="${C.cloth2}" stroke="${C.out}" stroke-width="1.5"/><polygon points="32,4 16,32 48,32" fill="${C.cloth}" stroke="${C.out}" stroke-width="1.5"/><polygon points="32,16 14,42 50,42" fill="${C.cloth}" stroke="${C.out}" stroke-width="1.5"/>`), ["siege","nature"]),

  // ═══════════════════════════════════════════════════════════════════════
  // HAIR (4 styles)
  // ═══════════════════════════════════════════════════════════════════════

  v2HairItem(
    "hair_short_dark",
    "Short Dark Hair",
    "Close-cropped dark hair",
    svg(`<ellipse cx="32" cy="20" rx="18" ry="16" fill="${C.hair}" stroke="${C.out}" stroke-width="1.5"/><rect x="14" y="20" width="36" height="8" rx="1" fill="${C.hair}" stroke="${C.out}" stroke-width="1"/>`),
    { visualMinX: 14, visualMinY: 4, visualWidth: 36, visualHeight: 24 },
    { x: 32, y: 20 },
    ["hair", "short"],
  ),
  v2HairItem(
    "hair_long_wave",
    "Long Wavy Hair",
    "Long flowing wavy hair",
    svg(`<path d="M14 18 Q14 50 18 58" fill="none" stroke="${C.hair}" stroke-width="6" stroke-linecap="round"/><path d="M50 18 Q50 50 46 58" fill="none" stroke="${C.hair}" stroke-width="6" stroke-linecap="round"/><ellipse cx="32" cy="18" rx="18" ry="14" fill="${C.hair}" stroke="${C.out}" stroke-width="1.5"/>`),
    { visualMinX: 11, visualMinY: 4, visualWidth: 42, visualHeight: 57 },
    { x: 32, y: 18 },
    ["hair", "long"],
  ),
  v2HairItem(
    "hair_braids",
    "Braided Hair",
    "Tightly braided hair",
    svg(`<ellipse cx="32" cy="18" rx="18" ry="14" fill="${C.hair}" stroke="${C.out}" stroke-width="1.5"/><path d="M28 32 Q24 40 26 52 Q30 56 32 52 Q34 56 38 52 Q40 40 36 32" fill="${C.hair}" stroke="${C.out}" stroke-width="1.5"/>`),
    { visualMinX: 14, visualMinY: 4, visualWidth: 24, visualHeight: 50 },
    { x: 32, y: 18 },
    ["hair", "braid"],
  ),
  v2HairItem(
    "hair_wild",
    "Wild Mane",
    "Unkempt wild mane of hair",
    svg(`<path d="M14 16 Q8 8 14 4 Q20 12 20 18" fill="${C.hair}" stroke="${C.out}" stroke-width="1"/><path d="M50 16 Q56 8 50 4 Q44 12 44 18" fill="${C.hair}" stroke="${C.out}" stroke-width="1"/><ellipse cx="32" cy="20" rx="20" ry="16" fill="${C.hair}" stroke="${C.out}" stroke-width="1.5"/>`),
    { visualMinX: 8, visualMinY: 4, visualWidth: 48, visualHeight: 32 },
    { x: 32, y: 20 },
    ["hair", "wild"],
  ),

  // ═══════════════════════════════════════════════════════════════════════
  // FACE (3 styles)
  // ═══════════════════════════════════════════════════════════════════════

  {
    id: "hair_test_v2",
    name: "Hair Test V2",
    description: "Canonical v2 hair for attachment editing, animation follow, and export parity.",
    category: "hair",
    compatibility: {
      skeletonFamilies: HUMAN,
      species: [],
      viewProfiles: deriveViewProfiles(HUMAN),
    },
    allowedSlots: ["slot_hair", "side_slot_hair"],
    fitProfile: "standard",
    paletteChannels: ["hair", "outline"],
    hasOwnAnimation: false,
    animationClipId: null,
    anchorRules: {
      slot_hair: { anchorId: "hair_top", bindMode: "anchor_lock" },
    },
    svgLayers: [{
      id: "thumb",
      styleSetId: null,
      svgData: svg(`<path d="M12 18 Q14 8 24 6 Q30 2 40 5 Q50 8 52 18 Q48 20 46 26 Q44 34 40 40 Q34 38 32 36 Q30 38 24 40 Q18 34 18 28 Q18 22 12 18Z" fill="${C.hair}" stroke="${C.out}" stroke-width="1.5"/><path d="M20 22 Q18 30 22 38" fill="none" stroke="${C.out}" stroke-width="1.2" stroke-linecap="round"/><path d="M44 22 Q46 30 42 38" fill="none" stroke="${C.out}" stroke-width="1.2" stroke-linecap="round"/>`),
      paletteChannels: ["hair", "outline"],
      zOffset: 0,
    }],
    parts: [{
      id: "crown",
      boneId: "head",
      svgData: svg(`<path d="M12 18 Q14 8 24 6 Q30 2 40 5 Q50 8 52 18 Q48 20 46 26 Q44 34 40 40 Q34 38 32 36 Q30 38 24 40 Q18 34 18 28 Q18 22 12 18Z" fill="${C.hair}" stroke="${C.out}" stroke-width="1.5"/><path d="M20 22 Q18 30 22 38" fill="none" stroke="${C.out}" stroke-width="1.2" stroke-linecap="round"/><path d="M44 22 Q46 30 42 38" fill="none" stroke="${C.out}" stroke-width="1.2" stroke-linecap="round"/>`),
      metrics: {
        viewBoxX: 0,
        viewBoxY: 0,
        viewBoxWidth: 64,
        viewBoxHeight: 64,
        visualMinX: 12,
        visualMinY: 5,
        visualWidth: 40,
        visualHeight: 35,
      },
      pivot: { x: 32, y: 14, preset: "custom" },
      localTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      coordinateMode: "bone_local",
      zOffset: 0,
    }],
    coordinateMode: "bone_local",
    licenseMeta: CC0,
    tags: ["hair", "v2", "anchor", "test"],
  },

  item("face_scar",        "Battle Scar",      "Diagonal facial scar mark", "face", ["slot_face","side_slot_face"], HUMAN, ["skin","accent"],
    svg(`<ellipse cx="32" cy="32" rx="16" ry="18" fill="${C.skin}" stroke="${C.out}" stroke-width="1.5"/><line x1="26" y1="18" x2="38" y2="46" stroke="${C.accent}" stroke-width="2.5" stroke-linecap="round"/>`), ["face","scar"]),
  item("face_mask",        "Half Mask",        "Mysterious half face mask", "face", ["slot_face","side_slot_face"], HUMAN, ["primaryCloth","outline"],
    svg(`<ellipse cx="32" cy="32" rx="20" ry="22" fill="${C.cloth}" stroke="${C.out}" stroke-width="1.5"/><rect x="12" y="32" width="40" height="4" rx="1" fill="${C.out}"/><ellipse cx="24" cy="26" rx="4" ry="3" fill="${C.out}"/><ellipse cx="40" cy="26" rx="4" ry="3" fill="${C.out}"/>`), ["face","mask"]),
  item("face_paint",       "War Paint",        "Bold tribal war paint",     "face", ["slot_face","side_slot_face"], HUMAN, ["accent","skin"],
    svg(`<ellipse cx="32" cy="32" rx="16" ry="18" fill="${C.skin}" stroke="${C.out}" stroke-width="1.5"/><path d="M18 26 L30 30 L18 34" fill="${C.accent}" opacity="0.7"/><path d="M46 26 L34 30 L46 34" fill="${C.accent}" opacity="0.7"/>`), ["face","paint"]),

  // ═══════════════════════════════════════════════════════════════════════
  // EYES (5 styles) — positioned in upper quarter of 64×64 frame
  // Head in topdown SVG: cx=64 cy=28 in 128×128 → cx=32 cy=14 in 64×64
  // Left eye 128×128: cx=57 cy=24 → 64×64: cx=28.5 cy=12
  // Right eye 128×128: cx=71 cy=24 → 64×64: cx=35.5 cy=12
  // ═══════════════════════════════════════════════════════════════════════

  item("eyes_normal",      "Normal Eyes",      "Dark eyes with white highlights",   "eyes", ["slot_eyes","side_slot_eyes"], HUMAN, ["outline","skin"],
    svg(`<ellipse cx="28.5" cy="12" rx="2.5" ry="3" fill="${C.out}"/><ellipse cx="35.5" cy="12" rx="2.5" ry="3" fill="${C.out}"/><circle cx="29.2" cy="11" r="1" fill="white"/><circle cx="36.2" cy="11" r="1" fill="white"/>`), ["face","eyes","normal"]),

  item("eyes_angry",       "Angry Eyes",       "Furrowed brows, fierce expression", "eyes", ["slot_eyes","side_slot_eyes"], HUMAN, ["outline","skin"],
    svg(`<ellipse cx="28.5" cy="12.5" rx="2.5" ry="2" fill="${C.out}"/><ellipse cx="35.5" cy="12.5" rx="2.5" ry="2" fill="${C.out}"/><line x1="25.5" y1="9.5" x2="31.5" y2="11" stroke="${C.out}" stroke-width="1.8" stroke-linecap="round"/><line x1="38.5" y1="11" x2="32.5" y2="9.5" stroke="${C.out}" stroke-width="1.8" stroke-linecap="round"/><circle cx="29.2" cy="12" r="0.8" fill="white"/><circle cx="36.2" cy="12" r="0.8" fill="white"/>`), ["face","eyes","angry"]),

  item("eyes_glow_blue",   "Glowing Eyes",     "Ethereal blue magical eyes",        "eyes", ["slot_eyes","side_slot_eyes"], HUMAN, ["accent","skin"],
    svg(`<ellipse cx="28.5" cy="12" rx="3" ry="3.5" fill="#1A60FF"/><ellipse cx="35.5" cy="12" rx="3" ry="3.5" fill="#1A60FF"/><ellipse cx="28.5" cy="12" rx="1.5" ry="2" fill="#90C8FF"/><ellipse cx="35.5" cy="12" rx="1.5" ry="2" fill="#90C8FF"/><ellipse cx="28.5" cy="12" rx="5" ry="5.5" fill="#3070FF" opacity="0.18"/><ellipse cx="35.5" cy="12" rx="5" ry="5.5" fill="#3070FF" opacity="0.18"/>`), ["face","eyes","magic"]),

  item("eyes_sleepy",      "Sleepy Eyes",      "Half-closed tired eyes",            "eyes", ["slot_eyes","side_slot_eyes"], HUMAN, ["outline","skin"],
    svg(`<ellipse cx="28.5" cy="13" rx="2.5" ry="1.8" fill="${C.out}"/><ellipse cx="35.5" cy="13" rx="2.5" ry="1.8" fill="${C.out}"/><path d="M26 10.5 Q28.5 11.5 31 10.5" stroke="${C.out}" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M33 10.5 Q35.5 11.5 38 10.5" stroke="${C.out}" stroke-width="1.5" fill="none" stroke-linecap="round"/><circle cx="29" cy="13" r="0.9" fill="white"/><circle cx="36" cy="13" r="0.9" fill="white"/>`), ["face","eyes","tired"]),

  item("eyes_sad",         "Sad Eyes",         "Downturned sorrowful eyes",         "eyes", ["slot_eyes","side_slot_eyes"], HUMAN, ["outline","skin"],
    svg(`<ellipse cx="28.5" cy="12" rx="2.5" ry="3" fill="${C.out}"/><ellipse cx="35.5" cy="12" rx="2.5" ry="3" fill="${C.out}"/><path d="M25.5" y1="9.5" Q28.5 10.8 31.5 9.5" stroke="${C.out}" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M32.5 9.5 Q35.5 10.8 38.5 9.5" stroke="${C.out}" stroke-width="1.5" fill="none" stroke-linecap="round"/><circle cx="29" cy="11.2" r="1" fill="white"/><circle cx="36" cy="11.2" r="1" fill="white"/>`), ["face","eyes","sad"]),

  // ═══════════════════════════════════════════════════════════════════════
  // BEARD (3 styles) — in chin area of 64×64 frame
  // Mouth 128×128: y≈35-38 → 64×64: y≈17-19
  // Chin bottom 128×128: cy=28+20=48 → 64×64: cy≈24
  // ═══════════════════════════════════════════════════════════════════════

  item("beard_stubble",    "Stubble",          "Short rough stubble",               "beard", ["slot_beard","side_slot_beard"], HUMAN, ["hair","outline"],
    svg(`<ellipse cx="32" cy="20" rx="7.5" ry="3.5" fill="${C.hair}" opacity="0.5"/><circle cx="29" cy="20" r="0.8" fill="${C.hair}"/><circle cx="32" cy="21" r="0.8" fill="${C.hair}"/><circle cx="35" cy="20" r="0.8" fill="${C.hair}"/><circle cx="30.5" cy="18.5" r="0.7" fill="${C.hair}"/><circle cx="33.5" cy="18.5" r="0.7" fill="${C.hair}"/>`), ["face","beard","short"]),

  item("beard_short",      "Short Beard",      "Neat short rounded beard",          "beard", ["slot_beard","side_slot_beard"], HUMAN, ["hair","outline"],
    svg(`<path d="M24 17 Q32 27 40 17 Q39 26 32 28.5 Q25 26 24 17Z" fill="${C.hair}" stroke="${C.out}" stroke-width="1" stroke-linejoin="round"/>`), ["face","beard","medium"]),

  item("beard_long",       "Long Beard",       "Flowing heroic long beard",         "beard", ["slot_beard","side_slot_beard"], HUMAN, ["hair","outline"],
    svg(`<path d="M24 17 Q32 26 40 17 Q41 30 38 40 Q35 48 32 50 Q29 48 26 40 Q23 30 24 17Z" fill="${C.hair}" stroke="${C.out}" stroke-width="1" stroke-linejoin="round"/><path d="M29 34 Q32 40 35 34" fill="none" stroke="${C.out}" stroke-width="0.8" opacity="0.4"/>`), ["face","beard","long"]),
];

// Export as a map for O(1) lookup
export const ITEMS_MAP = new Map(ITEMS.map(i => [i.id, i]));

export function getItemById(id: string): Item | undefined {
  return ITEMS_MAP.get(id);
}
