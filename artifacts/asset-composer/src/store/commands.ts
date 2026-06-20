import type { Entity, SlotAssignment, PaletteTokens, EntityVisual, LocalTransform, ItemFitProfile } from "@/domain/types";

export type CommandType =
  | "SET_SLOT"
  | "SET_PALETTE"
  | "RENAME_ENTITY"
  | "SET_STYLE_SET"
  | "ADD_ENTITY"
  | "REMOVE_ENTITY"
  | "SET_ACTIVE_ANIMATION"
  | "SET_ATTACHMENT_OVERRIDE"
  | "SET_TEMPLATE_SLOT_TRANSFORM"
  | "SET_ENTITY_VISUAL_TRANSFORM"
  | "ADD_ENTITY_VISUAL"
  | "REMOVE_ENTITY_VISUAL"
  | "SET_ITEM_FIT_PROFILES";

export interface Command {
  type: CommandType;
  entityId?: string;
  templateId?: string;
  slotId?: string;
  before: Partial<Entity> & { defaultTransform?: LocalTransform; itemFitProfiles?: ItemFitProfile[] };
  after: Partial<Entity> & { defaultTransform?: LocalTransform; itemFitProfiles?: ItemFitProfile[] };
  label: string;
}

export function makeSetSlotCommand(
  entityId: string,
  before: SlotAssignment[],
  after: SlotAssignment[]
): Command {
  return { type: "SET_SLOT", entityId, before: { slots: before }, after: { slots: after }, label: "Change slot" };
}

export function makeSetPaletteCommand(
  entityId: string,
  before: PaletteTokens,
  after: PaletteTokens
): Command {
  return { type: "SET_PALETTE", entityId, before: { palette: before }, after: { palette: after }, label: "Change palette" };
}

export function makeRenameCommand(
  entityId: string,
  before: string,
  after: string
): Command {
  return { type: "RENAME_ENTITY", entityId, before: { name: before }, after: { name: after }, label: `Rename to "${after}"` };
}

export function makeSetStyleSetCommand(
  entityId: string,
  before: string,
  after: string
): Command {
  return { type: "SET_STYLE_SET", entityId, before: { styleSetId: before }, after: { styleSetId: after }, label: "Change style set" };
}

export function makeSetAttachmentOverrideCommand(
  entityId: string,
  before: SlotAssignment[],
  after: SlotAssignment[],
  label = "Adjust attachment",
): Command {
  return { type: "SET_ATTACHMENT_OVERRIDE", entityId, before: { slots: before }, after: { slots: after }, label };
}

export function makeAddEntityVisualCommand(
  entityId: string,
  before: EntityVisual[],
  after: EntityVisual[],
  visualName: string,
): Command {
  return { type: "ADD_ENTITY_VISUAL", entityId, before: { visuals: before }, after: { visuals: after }, label: `Import "${visualName}"` };
}

export function makeRemoveEntityVisualCommand(
  entityId: string,
  before: EntityVisual[],
  after: EntityVisual[],
  visualName: string,
): Command {
  return { type: "REMOVE_ENTITY_VISUAL", entityId, before: { visuals: before }, after: { visuals: after }, label: `Remove visual "${visualName}"` };
}

export function makeSetEntityVisualTransformCommand(
  entityId: string,
  before: EntityVisual[],
  after: EntityVisual[],
  label = "Move visual",
): Command {
  return { type: "SET_ENTITY_VISUAL_TRANSFORM", entityId, before: { visuals: before }, after: { visuals: after }, label };
}

export function makeSetRootTransformCommand(
  entityId: string,
  before: LocalTransform | null | undefined,
  after: LocalTransform | null | undefined,
  label = "Set root transform",
): Command {
  return {
    type: "SET_ENTITY_VISUAL_TRANSFORM",
    entityId,
    before: { rootTransform: before ?? undefined },
    after:  { rootTransform: after  ?? undefined },
    label,
  };
}

export function makeSetTemplateSlotTransformCommand(
  templateId: string,
  slotId: string,
  before: LocalTransform | undefined,
  after: LocalTransform,
  label = "Move slot",
): Command {
  return {
    type: "SET_TEMPLATE_SLOT_TRANSFORM",
    templateId,
    slotId,
    before: { defaultTransform: before },
    after: { defaultTransform: after },
    label,
  };
}

export function makeSetItemFitProfilesCommand(
  before: ItemFitProfile[],
  after: ItemFitProfile[],
  label = "Update item fit profiles",
): Command {
  return {
    type: "SET_ITEM_FIT_PROFILES",
    before: { itemFitProfiles: before },
    after: { itemFitProfiles: after },
    label,
  };
}
