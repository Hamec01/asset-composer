import type { Item, SlotDef, Template, ItemFitProfile, LocalTransform } from "@/domain/types";
import { ITEM_FIT_PROFILES } from "@/data/itemFitProfiles";

export function resolveItemFitProfile(
  item: Item,
  template: Template,
  slotDef: SlotDef,
  profiles: ItemFitProfile[] = ITEM_FIT_PROFILES,
): ItemFitProfile | null {
  const exact = profiles.find(profile =>
    profile.fitProfile === item.fitProfile &&
    profile.templateId === template.id &&
    profile.slotId === slotDef.id
  );
  if (exact) return exact;

  const family = profiles.find(profile =>
    profile.fitProfile === item.fitProfile &&
    profile.family === template.skeletonFamily &&
    profile.slotId === slotDef.id
  );
  if (family) return family;

  return null;
}

export function resolveItemFitPartTransform(
  item: Item,
  template: Template,
  slotDef: SlotDef,
  partId: string,
  profiles: ItemFitProfile[] = ITEM_FIT_PROFILES,
): LocalTransform | null {
  const profile = resolveItemFitProfile(item, template, slotDef, profiles);
  return profile?.partTransforms?.[partId] ?? null;
}

export function resolveItemFitAnchorOverride(
  item: Item,
  template: Template,
  slotDef: SlotDef,
  profiles: ItemFitProfile[] = ITEM_FIT_PROFILES,
): string | null {
  const profile = resolveItemFitProfile(item, template, slotDef, profiles);
  return profile?.anchorOverrides?.[slotDef.id] ?? null;
}
