import { ITEMS } from "@/data/items";
import type { Item } from "@/domain/types";

const REFRESHED_BUILTIN_ITEM_IDS = new Set([
  "boots_leather",
  "pants_leather",
]);

const BUILTIN_ITEM_MAP = new Map(
  ITEMS
    .filter(item => REFRESHED_BUILTIN_ITEM_IDS.has(item.id))
    .map(item => [item.id, item]),
);

function cloneBuiltinItem<T>(value: T): T {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export function refreshCanonicalBuiltInItems<T extends { id?: unknown }>(items: T[]): T[] {
  return items.map(item => {
    const itemId = typeof item.id === "string" ? item.id : "";
    const builtin = BUILTIN_ITEM_MAP.get(itemId);
    if (!builtin) {
      return item;
    }
    return cloneBuiltinItem(builtin) as unknown as T;
  });
}

export function refreshCanonicalBuiltInTypedItems(items: Item[]): Item[] {
  return refreshCanonicalBuiltInItems(items);
}
