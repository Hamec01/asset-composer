import type {
  Item,
  ItemCategory,
  ItemPart,
  Pivot,
  SkeletonFamilyId,
  SpriteEditorDocument,
  SpriteEditorLayer,
  SpriteEditorShape,
  DualGripConfig,
} from "@/domain/types";
import { createEmptySpriteLayer } from "./spriteEditor";
import { parseMetrics } from "./svgMetrics";

export type AssetTemplateType =
  | "weapon_1h"
  | "weapon_2h"
  | "shield"
  | "head_cover"
  | "torso"
  | "legs"
  | "feet"
  | "world_flora"
  | "world_building"
  | "world_prop";

export interface CreateAssetOptions {
  id?: string;
  name: string;
  type: AssetTemplateType;
  width?: number;
  height?: number;
  entityId?: string;
  initialTracingAssetUri?: string;
  initialTracingName?: string;
}

export const CANVAS_PRESETS: Array<{ key: string; label: string; width: number; height: number; description: string }> = [
  { key: "32", label: "32 × 32 px", width: 32, height: 32, description: "Иконки, пули, мелкие зелья" },
  { key: "48", label: "48 × 48 px", width: 48, height: 48, description: "Инвентарь, метательное оружие" },
  { key: "64", label: "64 × 64 px", width: 64, height: 64, description: "Кинжалы, шлемы, кольца" },
  { key: "128", label: "128 × 128 px", width: 128, height: 128, description: "Мечи, щиты, броня, сундуки (Стандарт)" },
  { key: "256", label: "256 × 256 px", width: 256, height: 256, description: "Двуручные мечи, копья, деревья, повозки" },
  { key: "512", label: "512 × 512 px", width: 512, height: 512, description: "Здания, башни, горы, большие фоны" },
  { key: "1024", label: "1024 × 1024 px", width: 1024, height: 1024, description: "Высокодетализированный арт локаций" },
];

const DEFAULT_FAMILIES: SkeletonFamilyId[] = [
  "humanoid_topdown_v1",
  "humanoid_side_v1",
  "humanoid_monster_v1",
];

function getCategoryFromType(type: AssetTemplateType): ItemCategory {
  switch (type) {
    case "weapon_1h":
      return "weapon_main";
    case "weapon_2h":
      return "weapon_main";
    case "shield":
      return "shield";
    case "head_cover":
      return "head_cover";
    case "torso":
      return "torso";
    case "legs":
      return "legs";
    case "feet":
      return "feet";
    case "world_flora":
    case "world_building":
    case "world_prop":
    default:
      return "static_part";
  }
}

function getDefaultSlotsFromCategory(category: ItemCategory): string[] {
  switch (category) {
    case "weapon_main":
      return ["slot_weapon_main", "side_slot_weapon_main", "monster_slot_weapon_main"];
    case "weapon_off":
    case "shield":
      return ["slot_weapon_off", "side_slot_weapon_off", "monster_slot_weapon_off"];
    case "head_cover":
      return ["slot_head_cover", "side_slot_head_cover", "monster_slot_head_cover"];
    case "torso":
      return ["slot_torso", "side_slot_torso", "monster_slot_torso"];
    case "legs":
      return ["slot_legs", "side_slot_legs", "monster_slot_legs"];
    case "feet":
      return ["slot_foot_l", "slot_foot_r", "side_slot_foot_l", "side_slot_foot_r", "slot_feet"];
    default:
      return [];
  }
}

export function getDefaultShapesForType(type: AssetTemplateType, width: number, height: number): SpriteEditorShape[] {
  const cx = width / 2;
  const cy = height / 2;

  switch (type) {
    case "weapon_1h":
      return [
        // Blade
        {
          id: crypto.randomUUID(),
          type: "path",
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          rotation: 0,
          fill: "#D4D4D8",
          stroke: "#27272A",
          strokeWidth: 1.5,
          pathData: `M ${cx - 4} ${cy + 10} L ${cx - 3} ${cy - 35} L ${cx} ${cy - 48} L ${cx + 3} ${cy - 35} L ${cx + 4} ${cy + 10} Z`,
        },
        // Crossguard
        {
          id: crypto.randomUUID(),
          type: "rect",
          x: cx - 14,
          y: cy + 10,
          width: 28,
          height: 6,
          rotation: 0,
          fill: "#D97706",
          stroke: "#78350F",
          strokeWidth: 1.5,
        },
        // Handle / Hilt
        {
          id: crypto.randomUUID(),
          type: "rect",
          x: cx - 3,
          y: cy + 16,
          width: 6,
          height: 20,
          rotation: 0,
          fill: "#78350F",
          stroke: "#451A03",
          strokeWidth: 1.5,
        },
        // Pommel
        {
          id: crypto.randomUUID(),
          type: "ellipse",
          x: cx,
          y: cy + 38,
          width: 8,
          height: 8,
          rotation: 0,
          fill: "#D97706",
          stroke: "#78350F",
          strokeWidth: 1.5,
        },
      ];

    case "weapon_2h":
      return [
        // Long Spear / Greatsword shaft
        {
          id: crypto.randomUUID(),
          type: "rect",
          x: cx - 2.5,
          y: cy - 70,
          width: 5,
          height: 150,
          rotation: 0,
          fill: "#92400E",
          stroke: "#451A03",
          strokeWidth: 1.5,
        },
        // Spearhead / Blade Tip
        {
          id: crypto.randomUUID(),
          type: "path",
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          rotation: 0,
          fill: "#E4E4E7",
          stroke: "#18181B",
          strokeWidth: 1.5,
          pathData: `M ${cx - 7} ${cy - 70} L ${cx} ${cy - 110} L ${cx + 7} ${cy - 70} L ${cx + 4} ${cy - 65} L ${cx - 4} ${cy - 65} Z`,
        },
      ];

    case "shield":
      return [
        {
          id: crypto.randomUUID(),
          type: "path",
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          rotation: 0,
          fill: "#3B82F6",
          stroke: "#1E3A8A",
          strokeWidth: 2,
          pathData: `M ${cx - 24} ${cy - 30} Q ${cx} ${cy - 36} ${cx + 24} ${cy - 30} L ${cx + 22} ${cy + 10} Q ${cx} ${cy + 42} ${cx} ${cy + 42} Q ${cx} ${cy + 42} ${cx - 22} ${cy + 10} Z`,
        },
        {
          id: crypto.randomUUID(),
          type: "ellipse",
          x: cx,
          y: cy - 2,
          width: 14,
          height: 14,
          rotation: 0,
          fill: "#F59E0B",
          stroke: "#B45309",
          strokeWidth: 1.5,
        },
      ];

    case "head_cover":
      return [
        {
          id: crypto.randomUUID(),
          type: "path",
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          rotation: 0,
          fill: "#52525B",
          stroke: "#18181B",
          strokeWidth: 1.5,
          pathData: `M ${cx - 20} ${cy + 6} C ${cx - 22} ${cy - 24}, ${cx + 22} ${cy - 24}, ${cx + 20} ${cy + 6} L ${cx + 12} ${cy + 14} L ${cx - 12} ${cy + 14} Z`,
        },
      ];

    case "world_flora":
      return [
        // Trunk
        {
          id: crypto.randomUUID(),
          type: "path",
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          rotation: 0,
          fill: "#78350F",
          stroke: "#451A03",
          strokeWidth: 2,
          pathData: `M ${cx - 12} ${cy + 80} Q ${cx - 6} ${cy} ${cx - 8} ${cy - 30} L ${cx + 8} ${cy - 30} Q ${cx + 6} ${cy} ${cx + 12} ${cy + 80} Z`,
        },
        // Foliage Crown
        {
          id: crypto.randomUUID(),
          type: "ellipse",
          x: cx,
          y: cy - 45,
          width: 90,
          height: 80,
          rotation: 0,
          fill: "#15803D",
          stroke: "#14532D",
          strokeWidth: 2,
        },
      ];

    case "world_building":
      return [
        // House Base
        {
          id: crypto.randomUUID(),
          type: "rect",
          x: cx - 70,
          y: cy - 10,
          width: 140,
          height: 90,
          rotation: 0,
          fill: "#D4D4D8",
          stroke: "#27272A",
          strokeWidth: 2,
        },
        // Roof
        {
          id: crypto.randomUUID(),
          type: "path",
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          rotation: 0,
          fill: "#991B1B",
          stroke: "#450A0A",
          strokeWidth: 2,
          pathData: `M ${cx - 85} ${cy - 10} L ${cx} ${cy - 85} L ${cx + 85} ${cy - 10} Z`,
        },
        // Door
        {
          id: crypto.randomUUID(),
          type: "rect",
          x: cx - 16,
          y: cy + 32,
          width: 32,
          height: 48,
          rotation: 0,
          fill: "#78350F",
          stroke: "#451A03",
          strokeWidth: 1.5,
        },
      ];

    case "world_prop":
      return [
        // Chest body
        {
          id: crypto.randomUUID(),
          type: "rect",
          x: cx - 26,
          y: cy - 10,
          width: 52,
          height: 36,
          rotation: 0,
          fill: "#92400E",
          stroke: "#451A03",
          strokeWidth: 2,
        },
        // Chest lid
        {
          id: crypto.randomUUID(),
          type: "ellipse",
          x: cx,
          y: cy - 12,
          width: 52,
          height: 18,
          rotation: 0,
          fill: "#B45309",
          stroke: "#451A03",
          strokeWidth: 2,
        },
        // Lock
        {
          id: crypto.randomUUID(),
          type: "rect",
          x: cx - 4,
          y: cy - 6,
          width: 8,
          height: 10,
          rotation: 0,
          fill: "#F59E0B",
          stroke: "#78350F",
          strokeWidth: 1,
        },
      ];

    default:
      return [];
  }
}

export function createNewArtAsset(options: CreateAssetOptions): {
  item: Item;
  document: SpriteEditorDocument;
} {
  const id = options.id ?? `custom_${options.type}_${Date.now().toString(36)}`;
  const category = getCategoryFromType(options.type);
  const allowedSlots = getDefaultSlotsFromCategory(category);
  const width = options.width ?? (options.type === "world_building" ? 512 : options.type === "world_flora" || options.type === "weapon_2h" ? 256 : 128);
  const height = options.height ?? (options.type === "world_building" ? 512 : options.type === "world_flora" || options.type === "weapon_2h" ? 256 : 128);

  const cx = width / 2;
  const cy = height / 2;

  // Pivot defaults
  const pivot: Pivot = {
    x: cx,
    y: options.type === "world_flora" || options.type === "world_building" ? height - 10 : options.type === "weapon_1h" ? cy + 24 : cy,
    preset: "custom",
  };

  // Dual-grip defaults
  const dualGrip: DualGripConfig | undefined = options.type === "weapon_2h" ? {
    enabled: true,
    mainGrip: { x: cx, y: cy + 30 },
    offHandGrip: { x: cx, y: cy - 20 },
  } : undefined;

  const initialShapes = options.initialTracingAssetUri ? [] : getDefaultShapesForType(options.type, width, height);

  const baseLayer: SpriteEditorLayer = {
    id: crypto.randomUUID(),
    name: "Основа",
    visible: true,
    locked: false,
    opacity: 1,
    zIndex: 0,
    shapes: initialShapes,
  };

  const document: SpriteEditorDocument = {
    id: `doc_${id}`,
    name: options.name,
    width,
    height,
    pivot,
    dualGrip,
    studioArtwork: true,
    referenceAsset: null,
    tracingAsset: options.initialTracingAssetUri ? {
      format: "png",
      name: options.initialTracingName ?? "Подложка",
      originalFileName: options.initialTracingName ?? "reference.png",
      mimeType: "image/png",
      dataUri: options.initialTracingAssetUri,
    } : null,
    tracingOpacity: 0.35,
    tracingVisible: true,
    tracingTransform: { x: 0, y: 0, scale: 1 },
    layers: [baseLayer],
    authoringHint: {
      preserveFrame: true,
      assetCategory: options.type,
      mannequinOverlay: options.type === "weapon_1h" ? "hand_1h" : options.type === "weapon_2h" ? "hand_2h" : options.type === "head_cover" ? "head" : options.type === "torso" || options.type === "legs" ? "body" : options.type === "world_building" || options.type === "world_flora" ? "scale_human" : "none",
      gridMode: "none",
    },
    target: {
      kind: category === "static_part" ? "world-object" : "item-part",
      itemId: id,
      partId: `${id}_part`,
      entityId: options.entityId,
      propId: id,
    },
    updatedAt: Date.now(),
  };

  const initialSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"></svg>`;
  const metrics = parseMetrics(initialSvg);

  const defaultPart: ItemPart = {
    id: `${id}_part`,
    boneId: options.type === "weapon_1h" || options.type === "weapon_2h" ? "hand_r" : options.type === "head_cover" ? "head" : options.type === "torso" ? "chest" : options.type === "legs" ? "pelvis" : options.type === "feet" ? "foot_l" : "root",
    content: { kind: "document", documentId: document.id },
    metrics: { ...metrics, viewBoxWidth: width, viewBoxHeight: height },
    pivot,
    localTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    coordinateMode: "bone_local",
    zOffset: options.type === "shield" ? 10 : 5,
    editorDocumentId: document.id,
  };

  const item: Item = {
    id,
    name: options.name,
    description: `Пользовательский ассет: ${options.name}`,
    category,
    compatibility: {
      skeletonFamilies: DEFAULT_FAMILIES,
      species: [],
      viewProfiles: ["side_view", "topdown_45", "isometric_34", "static"],
    },
    allowedSlots,
    fitProfile: "standard",
    paletteChannels: [],
    hasOwnAnimation: false,
    animationClipId: null,
    anchorRules: {},
    svgLayers: [{
      id: `${id}_layer`,
      styleSetId: null,
      content: { kind: "document", documentId: document.id },
      paletteChannels: [],
      zOffset: 0,
    }],
    parts: [defaultPart],
    coordinateMode: "bone_local",
    licenseMeta: {
      source: "User Authored",
      author: "Artist",
      licenseType: "proprietary",
      aiGenerated: false,
      commercialUseAllowed: true,
      purchaseRef: null,
      derivativePolicy: "unrestricted",
    },
    tags: [options.type, "user_drawn", "art_studio"],
  };

  return { item, document };
}
