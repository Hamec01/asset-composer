import { describe, expect, it } from "vitest";
import { randomTokenAppearance } from "../src/lib/chibiAppearance";
import { TOKEN_MODULES, TOKEN_SKINS } from "../src/data/chibiTokenPack";
import { tokenModuleAllowed, tokenSelectionForSex } from "../src/lib/chibiGender";
import { tokenSlotVisible } from "../src/lib/chibiEquipment";
import { tokenEntity } from "../src/data/chibiTokenPack";
import { EntitySchema } from "../src/domain/schema";

describe("случайная внешность чиби", () => {
  it("creates varied bare appearances with matching skin and no equipment or props", () => {
    let seed = 12345;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const appearances = Array.from({ length: 100 }, () => randomTokenAppearance(random));
    const appearanceSlots = new Set(["token_headshape", "token_eyes", "token_nose", "token_mouth", "token_hair", "token_brows", "token_beard", "token_scar", "token_freckles", "token_mole"]);
    for (const { skin, selected } of appearances) {
      expect(skin).toBeGreaterThanOrEqual(0); expect(skin).toBeLessThan(TOKEN_SKINS.length);
      for (const [slot, id] of Object.entries(selected)) {
        expect(appearanceSlots.has(slot)).toBe(true);
        expect(TOKEN_MODULES.find(m => m.id === id)?.slot).toBe(slot);
      }
      for (const slot of ["token_headshape", "token_eyes", "token_nose", "token_mouth", "token_brows"]) expect(selected[slot]).toBeTruthy();
      expect(["face_5", "face_7", "face_plus_12"]).not.toContain(selected.token_eyes);
      expect(tokenModuleAllowed("token_hair", selected.token_hair, "male")).toBe(true);
      expect(Math.floor(TOKEN_MODULES.find(m => m.id === selected.token_headshape)!.index / 4)).toBe(skin);
    }
    expect(new Set(appearances.map(a => a.skin)).size).toBe(4);
    expect(new Set(appearances.map(a => JSON.stringify(a.selected))).size).toBeGreaterThan(90);
  });
  it("respects both sexes in random generation, removes incompatible selections and persists sex", () => {
    let seed = 54321;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (const sex of ["male", "female"] as const) for (let i = 0; i < 100; i++) {
      const { selected } = randomTokenAppearance(random, sex);
      expect(selected.token_brows).toBeTruthy();
      for (const [slot, id] of Object.entries(selected)) expect(tokenModuleAllowed(slot, id, sex)).toBe(true);
      if (sex === "female") expect(selected.token_beard).toBeUndefined();
    }
    const chosen = { token_hair: "hair_5", token_beard: "beards_extra_5", token_eyes: "face_0" };
    expect(tokenSelectionForSex(chosen, "female")).toEqual({ token_hair: "hair_5", token_eyes: "face_0" });
    expect(tokenSelectionForSex(chosen, "male").token_hair).toBeUndefined();
    const woman = tokenEntity("Женщина", 0, chosen, "idle", {}, "female");
    expect(tokenSlotVisible(woman, "token_beard")).toBe(false);
    expect(tokenSlotVisible(woman, "token_hair")).toBe(true);
    expect(EntitySchema.parse(JSON.parse(JSON.stringify(woman))).appearance!.sex).toBe("female");
    woman.appearance!.sex = "male";
    expect(tokenSlotVisible(woman, "token_hair")).toBe(false);
  });
});
