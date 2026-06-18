import type { ItemFitProfile } from "@/domain/types";

export const ITEM_FIT_PROFILES: ItemFitProfile[] = [
  {
    id: "humanoid_topdown_v1__slot_hair__standard",
    fitProfile: "standard",
    templateId: "humanoid_topdown_v1",
    family: "humanoid_topdown_v1",
    slotId: "slot_hair",
    partTransforms: {
      crown: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      main: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    },
    anchorOverrides: {
      slot_hair: "hair_top",
    },
  },
];

