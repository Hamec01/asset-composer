import type { StyleSet, PaletteTokens } from "@/domain/types";

const darkFantasyPalette: PaletteTokens = {
  skin: "#C89A7B",
  hair: "#2B1D18",
  primaryCloth: "#3C3A46",
  secondaryCloth: "#746A5E",
  metal: "#8E8A80",
  accent: "#B87333",
  outline: "#1A1208",
  shadow: "#00000055",
};

const cuteFarmPalette: PaletteTokens = {
  skin: "#FFD0A8",
  hair: "#C87941",
  primaryCloth: "#5BA5D4",
  secondaryCloth: "#F0C95C",
  metal: "#B8B8B8",
  accent: "#E06060",
  outline: "#4A3728",
  shadow: "#00000022",
};

export const STYLE_SETS: StyleSet[] = [
  {
    id: "dark_fantasy",
    name: "Dark Fantasy",
    label: "🗡️ Dark Fantasy",
    paletteDefaults: darkFantasyPalette,
    strokeWeight: 2,
    shadingMode: "cel",
    eyeStyle: "angular_intense",
    silhouetteBias: "sharp",
    materialPresets: {
      leather: "#5C3D1E",
      chainmail: "#6E7A8A",
      plate: "#9EA8B4",
      cloth: "#3C3A46",
      gem: "#4A2070",
    },
  },
  {
    id: "cute_farm",
    name: "Cute Farm",
    label: "🌻 Cute Farm",
    paletteDefaults: cuteFarmPalette,
    strokeWeight: 2.5,
    shadingMode: "flat",
    eyeStyle: "round_kawaii",
    silhouetteBias: "rounded",
    materialPresets: {
      leather: "#C8955A",
      wool: "#F5E6D0",
      straw: "#E8C96A",
      cloth: "#7BC0E0",
      gem: "#E06090",
    },
  },
];

export function getStyleSetById(id: string): StyleSet | undefined {
  return STYLE_SETS.find(s => s.id === id);
}

export const DEFAULT_STYLE_SET_ID = "dark_fantasy";
