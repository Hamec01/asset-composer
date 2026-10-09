export type TokenSex = "male" | "female";

// Pack categories: short cuts, braids/pigtails and shared long/curly styles.
const maleHair = new Set(["hair_0", "hair_1", "hair_6", "hair_plus_3", "hair_plus_4", "hair_extra_0", "hair_extra_1", "hair_extra_7"]);
const femaleHair = new Set(["hair_2", "hair_3", "hair_4", "hair_5", "hair_plus_1", "hair_plus_2", "hair_plus_5", "hair_plus_6", "hair_extra_3", "hair_extra_4", "hair_extra_5", "hair_extra_6"]);
export function tokenModuleSex(id: string): TokenSex | undefined {
  return maleHair.has(id) ? "male" : femaleHair.has(id) ? "female" : undefined;
}
export function tokenModuleAllowed(slot: string, id: string, sex: TokenSex): boolean {
  if (!id) return true;
  if (slot === "token_beard") return sex === "male";
  return slot !== "token_hair" || !tokenModuleSex(id) || tokenModuleSex(id) === sex;
}
export function tokenSelectionForSex(selected: Record<string, string>, sex: TokenSex) {
  return Object.fromEntries(Object.entries(selected).filter(([slot, id]) => tokenModuleAllowed(slot, id, sex)));
}
