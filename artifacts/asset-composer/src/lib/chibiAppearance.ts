import { TOKEN_MODULES, TOKEN_SKINS } from "@/data/chibiTokenPack";
import { tokenModuleAllowed, type TokenSex } from "./chibiGender";
import { tokenAgeAllowsBeard, type TokenAge } from "./chibiAge";

/** Returns a new bare character selection. Equipment and props are never sampled. */
export function randomTokenAppearance(random: () => number = Math.random, sex: TokenSex = "male", age: TokenAge = "adult") {
  const skin = Math.floor(random() * TOKEN_SKINS.length);
  const selected: Record<string, string> = {};
  const slots = [
    ["token_headshape", 1], ["token_eyes", 1], ["token_nose", 1], ["token_mouth", 1],
    ["token_hair", .9], ["token_brows", 1], ["token_beard", .3],
    ["token_scar", .15], ["token_freckles", .25], ["token_mole", .15],
  ] as const;
  for (const [slot, chance] of slots) {
    if (slot === "token_beard" && !tokenAgeAllowsBeard(age)) continue;
    const options = TOKEN_MODULES.filter(m => m.slot === slot && tokenModuleAllowed(slot, m.id, sex) && !["face_5", "face_7", "face_plus_12"].includes(m.id) && (slot !== "token_headshape" || Math.floor(m.index / 4) === skin));
    if (options.length && random() < chance) selected[slot] = options[Math.floor(random() * options.length)].id;
  }
  return { skin, selected };
}
