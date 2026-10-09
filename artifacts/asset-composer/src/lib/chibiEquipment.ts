import type { Entity, SlotAssignment } from "@/domain/types";
import { tokenModuleAllowed } from "./chibiGender";
import { tokenAgeAllowsBeard } from "./chibiAge";

const twoHanded = new Set(["token_item_weapons_0", "token_item_weapons_1", "token_item_weapons_3", "token_item_props_3", ...[0, 1, 6, 8, 16, 17, 19, 23].map(i => `token_item_work_tools_${i}`)]);
export function isTokenTwoHanded(id?: string | null) { return !!id && twoHanded.has(id); }

/** The last explicit equipment choice wins. A clip never chooses equipment. */
export function enforceTokenEquipment(slots: SlotAssignment[], changedSlot: string): SlotAssignment[] {
  const main = slots.find(s => s.slotId === "token_main");
  const off = slots.find(s => s.slotId === "token_off");
  if (!isTokenTwoHanded(main?.itemId) || !off?.itemId) return slots;
  return slots.map(s => s.slotId === (changedSlot === "token_off" ? "token_main" : "token_off") ? { ...s, itemId: null } : s);
}

/** Preserve hidden selections so removing a hat restores the hairstyle. */
export function tokenSlotVisible(entity: Entity, slot: string): boolean {
  if (!entity.templateId.startsWith("chibi_token_skin_")) return true;
  const equipped = (id: string) => entity.slots.find(s => s.slotId === id)?.itemId;
  const hat = equipped("token_headgear");
  if (slot === "token_beard" && !tokenAgeAllowsBeard(entity.appearance?.tokenAge)) return false;
  if (!tokenModuleAllowed(slot, equipped(slot)?.replace("token_item_", "") ?? "", entity.appearance?.sex ?? "male")) return false;
  if (slot === "token_hair" && hat) return false;
  if (slot === "token_brows" && ["token_item_face_5", "token_item_face_7", "token_item_face_plus_12"].includes(equipped("token_eyes") ?? "")) return false;
  if (slot === "token_off" && isTokenTwoHanded(equipped("token_main"))) return false;
  if (slot === "token_projectile" && equipped("token_main") !== "token_item_weapons_0") return false;
  if (["token_item_helmets_1", "token_item_helmets_5"].includes(hat ?? "")) {
    return !["token_eyes", "token_nose", "token_mouth", "token_scar", "token_freckles", "token_mole", "token_brows", "token_beard", "token_patch", "token_circlet", "token_headshape"].includes(slot);
  }
  return true;
}
