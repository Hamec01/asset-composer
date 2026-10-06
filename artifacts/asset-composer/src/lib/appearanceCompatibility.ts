import type { CharacterAppearance, Item } from "@/domain/types";

const masculineHair = new Set(["messy_short", "fringe_short", "tuft", "side_part", "swept_back", "undercut", "bowl", "buzz"]);
const feminineHair = new Set(["bob", "long", "ponytail", "pixie", "twin_tails", "buns", "braid", "wavy_long"]);
export function appearancePresetAllowed(feature: string, id: string, sex: CharacterAppearance["sex"] = "male") {
  if (id === "none") return true;
  if (feature === "beard") return sex === "male";
  if (feature !== "hair") return true;
  return !(sex === "female" ? masculineHair : feminineHair).has(id);
}
export function appearanceItemAllowed(item: Item, sex: CharacterAppearance["sex"] = "male") {
  if (item.category === "beard" && sex === "female") return false;
  return !item.tags.includes(sex === "female" ? "male" : "female");
}
