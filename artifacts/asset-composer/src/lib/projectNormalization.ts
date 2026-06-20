import type { Entity, EntityVisual, Item, SlotAssignment, Template } from "@/domain/types";

const BODY_CLONE_BONE_IDS = new Set([
  "pelvis",
  "spine",
  "chest",
  "neck",
  "head",
  "shoulder_l",
  "shoulder_r",
  "elbow_l",
  "elbow_r",
  "hand_l",
  "hand_r",
  "hip_l",
  "hip_r",
  "knee_l",
  "knee_r",
  "foot_l",
  "foot_r",
]);

const LEGACY_SHARED_SLOT_PAIRS: Record<string, { leftSlotId: string; rightSlotId: string }> = {
  slot_feet: { leftSlotId: "slot_foot_l", rightSlotId: "slot_foot_r" },
  side_slot_feet: { leftSlotId: "side_slot_foot_l", rightSlotId: "side_slot_foot_r" },
  slot_hands: { leftSlotId: "slot_hand_l", rightSlotId: "slot_hand_r" },
  side_slot_hands: { leftSlotId: "side_slot_hand_l", rightSlotId: "side_slot_hand_r" },
};

const LEGACY_SYMMETRIC_ITEM_SPLITS: Record<string, { leftItemId: string; rightItemId: string }> = {
  boots_leather: { leftItemId: "boot_leather_l", rightItemId: "boot_leather_r" },
  boots_chain: { leftItemId: "boot_chain_l", rightItemId: "boot_chain_r" },
  boots_plate: { leftItemId: "boot_plate_l", rightItemId: "boot_plate_r" },
  boots_farm: { leftItemId: "boot_farm_l", rightItemId: "boot_farm_r" },
  boots_ranger: { leftItemId: "boot_ranger_l", rightItemId: "boot_ranger_r" },
  gloves_leather: { leftItemId: "glove_leather_l", rightItemId: "glove_leather_r" },
  gloves_chain: { leftItemId: "glove_chain_l", rightItemId: "glove_chain_r" },
  gloves_plate: { leftItemId: "glove_plate_l", rightItemId: "glove_plate_r" },
  gloves_farm: { leftItemId: "glove_farm_l", rightItemId: "glove_farm_r" },
  gaunt_iron: { leftItemId: "gaunt_iron_l", rightItemId: "gaunt_iron_r" },
  gaunt_plate2: { leftItemId: "gaunt_plate2_l", rightItemId: "gaunt_plate2_r" },
  gaunt_leather2: { leftItemId: "gaunt_leather2_l", rightItemId: "gaunt_leather2_r" },
};

function cloneValue<T>(value: T): T {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function templateHasSlot(template: Template, slotId: string) {
  return template.slots.some(slot => slot.id === slotId);
}

function normalizeSvgKey(svgData: string) {
  return svgData.replace(/\s+/g, " ").trim();
}

function approxEqual(a: number, b: number, epsilon = 0.001) {
  return Math.abs(a - b) <= epsilon;
}

function shouldAutoSplitSharedSlot(
  slotId: string,
  itemId: string | null,
  itemById: Map<string, Item>,
) {
  if (!itemId) return false;
  const split = LEGACY_SYMMETRIC_ITEM_SPLITS[itemId];
  if (split && itemById.has(split.leftItemId) && itemById.has(split.rightItemId)) {
    return true;
  }
  const item = itemById.get(itemId);
  return item?.category === "feet" || item?.category === "hands";
}

function makeSplitAssignments(
  slot: SlotAssignment,
  itemById: Map<string, Item>,
): SlotAssignment[] | null {
  if (!slot.itemId) return null;
  const split = LEGACY_SYMMETRIC_ITEM_SPLITS[slot.itemId];
  if (!split || !itemById.has(split.leftItemId) || !itemById.has(split.rightItemId)) {
    return null;
  }

  const pair = LEGACY_SHARED_SLOT_PAIRS[slot.slotId];
  if (!pair) {
    return null;
  }

  return [
    {
      slotId: pair.leftSlotId,
      itemId: split.leftItemId,
      paletteOverride: cloneValue(slot.paletteOverride),
      attachmentOverride: cloneValue(slot.attachmentOverride),
    },
    {
      slotId: pair.rightSlotId,
      itemId: split.rightItemId,
      paletteOverride: cloneValue(slot.paletteOverride),
      attachmentOverride: cloneValue(slot.attachmentOverride),
    },
  ];
}

export function normalizeLegacySharedLimbAssignments(
  entity: Entity,
  template: Template | undefined,
  items: Item[],
): Entity {
  if (!template || entity.slots.length === 0) {
    return entity;
  }

  const itemById = new Map(items.map(item => [item.id, item]));
  const originalSlots = entity.slots;
  const originalSlotIds = new Set(originalSlots.map(slot => slot.slotId));
  let changed = false;
  const nextSlots: SlotAssignment[] = [];

  for (const slot of originalSlots) {
    const pair = LEGACY_SHARED_SLOT_PAIRS[slot.slotId];
    if (!pair) {
      nextSlots.push(slot);
      continue;
    }

    const hasCanonicalPair =
      templateHasSlot(template, pair.leftSlotId) &&
      templateHasSlot(template, pair.rightSlotId);
    if (!hasCanonicalPair) {
      nextSlots.push(slot);
      continue;
    }

    const hasExplicitSplit =
      originalSlotIds.has(pair.leftSlotId) || originalSlotIds.has(pair.rightSlotId);

    if (hasExplicitSplit) {
      changed = true;
      continue;
    }

    if (!slot.itemId) {
      changed = true;
      continue;
    }

    if (!shouldAutoSplitSharedSlot(slot.slotId, slot.itemId, itemById)) {
      nextSlots.push(slot);
      continue;
    }

    const splitAssignments = makeSplitAssignments(slot, itemById);
    if (splitAssignments) {
      nextSlots.push(...splitAssignments);
      changed = true;
      continue;
    }

    changed = true;
  }

  if (!changed) {
    return entity;
  }

  const slotOrder = new Map(template.slots.map((slot, index) => [slot.id, index]));
  nextSlots.sort((a, b) => (slotOrder.get(a.slotId) ?? Number.MAX_SAFE_INTEGER) - (slotOrder.get(b.slotId) ?? Number.MAX_SAFE_INTEGER));

  return {
    ...entity,
    slots: nextSlots,
  };
}

function matchesTemplateBodyPartVisual(visual: EntityVisual, template: Template) {
  if (!BODY_CLONE_BONE_IDS.has(visual.boneId)) {
    return false;
  }

  const visualSvgKey = normalizeSvgKey(visual.svgData);

  return (template.boneParts ?? []).some(part => {
    if (part.boneId !== visual.boneId) {
      return false;
    }

    if (normalizeSvgKey(part.svgData) === visualSvgKey) {
      return true;
    }

    return (
      approxEqual(visual.metrics.viewBoxWidth, part.naturalWidth) &&
      approxEqual(visual.metrics.viewBoxHeight, part.naturalHeight) &&
      approxEqual(visual.localTransform.x, part.localX) &&
      approxEqual(visual.localTransform.y, part.localY) &&
      approxEqual(visual.zIndex, part.zOffset)
    );
  });
}

function livesInTemplateBodyZBand(visual: EntityVisual, template: Template) {
  return (template.boneParts ?? []).some(part => {
    if (part.boneId !== visual.boneId) {
      return false;
    }

    return approxEqual(visual.zIndex, part.zOffset, 2) || visual.zIndex <= -700;
  });
}

function matchesTemplateRootBodyCloneVisual(visual: EntityVisual, template: Template) {
  if (visual.boneId !== "root") {
    return false;
  }

  const visualSvgKey = normalizeSvgKey(visual.svgData);
  if ((template.baseBodyLayers ?? []).some(layer => normalizeSvgKey(layer.svgData) === visualSvgKey)) {
    return true;
  }

  const coversMostOfTemplate =
    visual.metrics.viewBoxWidth >= template.previewWidth * 0.72 &&
    visual.metrics.viewBoxHeight >= template.previewHeight * 0.72;
  const usesIdentityLikeTransform =
    approxEqual(visual.localTransform.x, 0, 0.5) &&
    approxEqual(visual.localTransform.y, 0, 0.5) &&
    approxEqual(visual.localTransform.rotation, 0, 0.5) &&
    approxEqual(visual.localTransform.scaleX, 1, 0.05) &&
    approxEqual(visual.localTransform.scaleY, 1, 0.05);
  const sitsInBodyLayerBand = visual.zIndex <= 150;

  return coversMostOfTemplate && usesIdentityLikeTransform && sitsInBodyLayerBand;
}

export function isLegacyBodyCloneVisual(visual: EntityVisual, template: Template | undefined) {
  if (!template?.boneParts?.length) {
    return false;
  }
  if (matchesTemplateRootBodyCloneVisual(visual, template)) {
    return true;
  }
  if (!BODY_CLONE_BONE_IDS.has(visual.boneId)) {
    return false;
  }

  // Canonical rule:
  // built-in body for bone-part templates must live only in template.boneParts.
  // Any entity.visual bound to a body bone and occupying the template body z-band
  // is treated as legacy body-clone state, even if the serialized SVG is stale.
  if (livesInTemplateBodyZBand(visual, template)) {
    return true;
  }

  return matchesTemplateBodyPartVisual(visual, template);
}

export function pruneLegacyBodyCloneVisualsFromEntity(
  entity: Entity,
  template: Template | undefined,
): Entity {
  const visuals = entity.visuals ?? [];
  if (!template?.boneParts?.length || visuals.length === 0) {
    return entity;
  }

  const nextVisuals = visuals.filter(visual => !isLegacyBodyCloneVisual(visual, template));
  if (nextVisuals.length === visuals.length) {
    return entity;
  }

  return {
    ...entity,
    visuals: nextVisuals,
  };
}
