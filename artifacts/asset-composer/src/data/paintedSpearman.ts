import type { AABB, BonePart, Entity, FaceFeatureConfig, Item, ItemPart, Project, Template, VisualAsset, VisualContent } from "@/domain/types";
import { DEFAULT_APPEARANCE } from "./characterAppearance";
import { SPEARMAN_TEMPLATE_ID, spearmanGuard, spearmanThrust } from "./spearmanAnimation";
import { EntitySchema } from "@/domain/schema";

export const SPEARMAN_ATLAS_ID = "spearman_artwork_v1";
export const SPEARMAN_SPEAR_ID = "spearman_spear_artwork_v1";
/** Actual authored alpha regions, independent of the approximate grid produced by the artist. */
export const SPEARMAN_REGIONS = {
  head: [22, 66, 276, 292], hair: [314, 42, 351, 296], beard: [689, 164, 269, 173], eye: [1071, 128, 101, 145],
  neck: [82, 472, 155, 104], tunic: [361, 364, 274, 273], shorts: [656, 446, 282, 178], upperArm: [1032, 372, 142, 258],
  forearm: [90, 663, 146, 282], fist: [375, 738, 164, 170], thigh: [708, 669, 172, 269], shin: [1023, 671, 163, 271],
  boot: [47, 1002, 269, 218], nose: [456, 1058, 61, 90], brows: [657, 1061, 301, 57], mouth: [1055, 1108, 90, 30],
} as const;

/** Atlas windows use ordinary composite clipping; no PNG-in-SVG or copied pixel resources. */
export function spearmanAtlasRegion(name: keyof typeof SPEARMAN_REGIONS): VisualContent {
  return imageRegion(SPEARMAN_ATLAS_ID, 1242, 1266, SPEARMAN_REGIONS[name]);
}
function imageRegion(assetId: string, imageWidth: number, imageHeight: number, region: readonly number[]): VisualContent {
  const [x, y, width, height] = region;
  return { kind: "composite", width, height, children: [{ content: { kind: "raster", assetId },
    matrix: [imageWidth / width, 0, 0, imageHeight / height, -x, -y], opacity: 1 }] };
}
const license = { source: "Generated original artwork · user style reference", author: "OpenAI image generation / Asset Composer", licenseType: "proprietary" as const,
  aiGenerated: true, commercialUseAllowed: true, purchaseRef: null, derivativePolicy: "Project artwork" };
const transform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
const bounds = (w: number, h: number): AABB => ({ minX: -w / 2, minY: -h / 2, maxX: w / 2, maxY: h / 2 });
function metrics(b: AABB) {
  return { viewBoxX: b.minX, viewBoxY: b.minY, viewBoxWidth: b.maxX - b.minX, viewBoxHeight: b.maxY - b.minY,
    visualMinX: b.minX, visualMinY: b.minY, visualWidth: b.maxX - b.minX, visualHeight: b.maxY - b.minY };
}
function garmentPart(id: string, boneId: string, content: VisualContent, w: number, h: number, y: number, x = 0): ItemPart {
  return { id, boneId, content, metrics: metrics(bounds(w, h)), pivot: { x: 0, y: 0, preset: "custom" },
    localTransform: { ...transform, x, y }, coordinateMode: "bone_local", zOffset: .5 };
}
function item(id: string, name: string, category: Item["category"], slotId: string, parts: ItemPart[]): Item {
  return { id, name, description: "Новый рисованный комплект копейщика", category, allowedSlots: [slotId],
    compatibility: { skeletonFamilies: ["humanoid_side_v1"], viewProfiles: ["side_view"], species: [] },
    fitProfile: "painted_spearman", paletteChannels: [], hasOwnAnimation: false, animationClipId: null,
    anchorRules: {}, svgLayers: [], parts, coordinateMode: "bone_local", licenseMeta: { ...license }, tags: ["spearman", "original-painted"] };
}
function feature(name: keyof typeof SPEARMAN_REGIONS, presetId: string, b: AABB): FaceFeatureConfig {
  return { presetId, visible: true, color: "#61351e", transform: { ...transform }, content: spearmanAtlasRegion(name), artworkBounds: b };
}

/** A complete portable character; base supplies only the established skeleton/slot contract, never its art. */
export function createPaintedSpearman(base: Template, assets: VisualAsset[], entityId = crypto.randomUUID(), now = Date.now()) {
  const parts: BonePart[] = [];
  const raster = (id: string, boneId: string, region: keyof typeof SPEARMAN_REGIONS, w: number, h: number, y: number, z: number) => {
    parts.push({ id: `spearman_${id}`, boneId, content: spearmanAtlasRegion(region), naturalWidth: w, naturalHeight: h, localX: 0, localY: y, zOffset: z });
  };
  const skin = (id: string, boneId: string, w: number, h: number, y: number, z: number, d: string) => {
    parts.push({ id: `spearman_${id}`, boneId, naturalWidth: w, naturalHeight: h, localX: 0, localY: y, zOffset: z,
      content: { kind: "vector", svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><path d="${d}" fill="#f8bb89" stroke="#57301e" stroke-width=".8" stroke-linejoin="round"/></svg>` } });
  };
  for (const side of ["l", "r"] as const) {
    raster(`upper_${side}`, `shoulder_${side}`, "upperArm", 9.6, 20.8, 8.8, -870);
    raster(`forearm_${side}`, `elbow_${side}`, "forearm", 8.1, 18.4, 7.2, -860);
    raster(`hand_${side}`, `hand_${side}`, "fist", 9.8, 10.2, 4, -810);
    parts.at(-1)!.grip = { x: 0, y: 4 }; parts.at(-1)!.gripSocket = { x: 0, y: 4 };
    // Explicit same-frame attachment prevents fallback to a built-in hand on other combat clips.
    parts.at(-1)!.attachments = { grip: { kind: "composite", width: 10.6, height: 11,
      children: [{ content: spearmanAtlasRegion("fist"), matrix: [1, 0, 0, 1, 0, 0], opacity: 1 }] } };
    raster(`thigh_${side}`, `hip_${side}`, "thigh", 10.8, 17, 7.1, -890);
    skin(`shin_${side}`, `knee_${side}`, 8.6, 16, 6.4, -900, "M2 1Q4 0 7 1L7 14Q4 16 2 14Z");
    skin(`foot_${side}`, `foot_${side}`, 14, 10, 3.6, -880, "M3 1H8L9 4Q14 5 13 8Q8 10 1 8L2 4Z");
  }
  skin("torso", "chest", 29, 35, 12, -840, "M9 1H20L21 5Q28 5 28 12L24 33Q14 35 5 33L1 12Q1 6 8 5Z");
  skin("belly", "spine", 22, 21, 7, -830, "M3 1H19L21 20H1Z");
  skin("pelvis", "pelvis", 27, 17, 6, -820, "M3 1Q13 3 24 1L26 13L17 16H10L1 13Z");
  raster("neck", "neck", "neck", 11.5, 8, 1, -800);
  raster("head", "head", "head", 46, 48.7, -9, -790);

  const template: Template = { ...structuredClone(base), id: SPEARMAN_TEMPLATE_ID, name: "Копейщик · Рисованный чиби", description: "Original painted, segmented spearman",
    boneParts: parts, baseBodyLayers: [], bones: structuredClone(base.bones), previewWidth: 256, previewHeight: 192 };
  for (const bone of template.bones) {
    if (bone.id === "shoulder_l") bone.restPose.tx = -11;
    if (bone.id === "shoulder_r") bone.restPose.tx = 11;
    if (bone.id.startsWith("shoulder_")) bone.restPose.ty = bone.id.endsWith("l") ? 0 : -1;
    if (bone.id.startsWith("elbow_")) bone.restPose.ty = 18;
    if (bone.id.startsWith("hand_")) bone.restPose.ty = 16;
    if (bone.id.startsWith("hip_")) bone.restPose.tx = bone.id.endsWith("l") ? -5 : 5;
    if (bone.id.startsWith("knee_")) bone.restPose.ty = 15;
    if (bone.id.startsWith("foot_")) bone.restPose.ty = 13;
  }
  // Custom artwork uses its own authored pivots; legacy weapon anchor offsets do not apply.
  template.anchors = Object.fromEntries(Object.entries(template.anchors).map(([id, a]) => [id, { ...a, offsetX: 0, offsetY: 0, rotation: 0 }]));
  template.slots = template.slots.map(slot => ({ ...slot, defaultTransform: { ...transform } }));

  const tunic = item("spearman_linen_tunic", "Копейщик · Льняная безрукавка", "torso", "side_slot_torso", [
    garmentPart("tunic", "chest", spearmanAtlasRegion("tunic"), 31, 36, 13),
  ]);
  const shorts = item("spearman_linen_shorts", "Копейщик · Льняные шорты", "legs", "side_slot_legs", [
    garmentPart("shorts", "pelvis", spearmanAtlasRegion("shorts"), 29, 18.3, 7),
  ]);
  const boots = item("spearman_wraps_boots", "Копейщик · Обмотки и сапоги", "feet", "side_slot_foot_l", [
    ...["l", "r"].flatMap(side => [
      garmentPart(`wrap_${side}`, `knee_${side}`, spearmanAtlasRegion("shin"), 9.2, 15.8, 6.8),
      garmentPart(`boot_${side}`, `foot_${side}`, spearmanAtlasRegion("boot"), 15.7, 12.7, 3.8, 2.7),
    ]),
  ]);
  const spearContent = imageRegion(SPEARMAN_SPEAR_ID, 1024, 1536, [457, 17, 110, 1505]);
  const spearPart = garmentPart("shaft", "hand_r", spearContent, 11.7, 160, 0);
  spearPart.metrics = metrics({ minX: -5.85, minY: -92.8, maxX: 5.85, maxY: 67.2 });
  spearPart.depthBinding = { boneId: "hand_r", nearSlot: "HAND_FRONT", farSlot: "CROSS_BODY" };
  spearPart.occludedByBones = ["hand_l", "hand_r"];
  const spear = item("spearman_ash_spear", "Копейщик · Ясеневое копьё", "weapon_main", "side_slot_weapon_main", [spearPart]);
  const equipped: Record<string, string> = { side_slot_torso: tunic.id, side_slot_legs: shorts.id, side_slot_foot_l: boots.id, side_slot_weapon_main: spear.id };
  const entity: Entity = { id: entityId, name: "Рыжий копейщик", entityType: "character", templateId: template.id,
    styleSetId: "dark_fantasy", species: "human", palette: { ...base.paletteTokens, skin: "#f8bb89", hair: "#88451f", outline: "#57301e" },
    slots: template.slots.map(slot => ({ slotId: slot.id, itemId: equipped[slot.id] ?? null, paletteOverride: {}, attachmentOverride: {} })),
    appearance: { ...DEFAULT_APPEARANCE, projection: "authored", view: "right", nose: "painted_nose",
      noseArtwork: { content: spearmanAtlasRegion("nose"), bounds: { minX: 3.8, minY: 6, maxX: 5.8, maxY: 9.6 } } },
    faceCustomization: {
      hair: feature("hair", "messy_short", { minX: -30, minY: -32, maxX: 28, maxY: 17 }),
      eyes: { ...feature("eye", "dot_cute", { minX: -2.5, minY: .3, maxX: 2.5, maxY: 7.4 }), eyeOpenness: 1, blink: { enabled: true, intervalMs: 2600, durationMs: 160 } },
      beard: feature("beard", "full_short", { minX: -15, minY: 2, maxX: 21, maxY: 23 }),
      brows: feature("brows", "stern", { minX: -9, minY: -3.5, maxX: 16, maxY: 1.2 }),
      mouth: feature("mouth", "tiny_smile", { minX: -2.5, minY: 11.5, maxX: 2.5, maxY: 13.2 }), overlays: [],
    },
    activeAnimationClipId: spearmanThrust.id, activeStateMachineId: null, licenseMeta: { ...license }, createdAt: now, updatedAt: now };
  return { template, entity: EntitySchema.parse(entity), items: [tunic, shorts, boots, spear], clips: [structuredClone(spearmanGuard), structuredClone(spearmanThrust)],
    assets: Object.fromEntries(assets.map(asset => [asset.id, asset])) };
}

/** Append rather than replacing the user's existing sword/tree/wheel scene. */
export function appendPaintedSpearman(project: Project, bundle: ReturnType<typeof createPaintedSpearman>) {
  project.templates = [...project.templates.filter(t => t.id !== bundle.template.id), bundle.template];
  project.items = [...project.items.filter(item => !bundle.items.some(i => i.id === item.id)), ...bundle.items];
  project.animationClips = [...project.animationClips.filter(clip => !bundle.clips.some(c => c.id === clip.id)), ...bundle.clips];
  project.assets = { ...project.assets, ...bundle.assets };
  project.entities.push(bundle.entity);
  project.activeEntityId = bundle.entity.id;
}
