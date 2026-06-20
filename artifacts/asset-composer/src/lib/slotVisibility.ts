import type { Template } from "@/domain/types";

const DEPRECATED_SHARED_LIMB_SLOTS = new Set([
  "slot_feet",
  "slot_hands",
  "side_slot_feet",
  "side_slot_hands",
]);

function hasSplitFootSlots(template: Template) {
  const ids = new Set(template.slots.map(slot => slot.id));
  return (
    (ids.has("slot_foot_l") && ids.has("slot_foot_r")) ||
    (ids.has("side_slot_foot_l") && ids.has("side_slot_foot_r"))
  );
}

function hasSplitHandSlots(template: Template) {
  const ids = new Set(template.slots.map(slot => slot.id));
  return (
    (ids.has("slot_hand_l") && ids.has("slot_hand_r")) ||
    (ids.has("side_slot_hand_l") && ids.has("side_slot_hand_r"))
  );
}

export function isDeprecatedSharedLimbSlot(slotId: string, template?: Template | null) {
  if (!DEPRECATED_SHARED_LIMB_SLOTS.has(slotId)) return false;
  if (!template) return true;
  if (slotId.includes("feet")) return hasSplitFootSlots(template);
  if (slotId.includes("hands")) return hasSplitHandSlots(template);
  return true;
}

export function getVisibleTemplateSlots(template: Template) {
  return template.slots.filter(slot => !isDeprecatedSharedLimbSlot(slot.id, template));
}
