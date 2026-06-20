import type { Item, ItemFitProfile, LocalTransform, Template } from "@/domain/types";

function makeProfileId(
  scope: "template" | "family",
  item: Item,
  template: Template,
  slotId: string,
) {
  return scope === "template"
    ? `${template.id}__${slotId}__${item.fitProfile}`
    : `${template.skeletonFamily}__${slotId}__${item.fitProfile}`;
}

export function upsertItemFitProfilePartTransform(
  profiles: ItemFitProfile[],
  options: {
    item: Item;
    template: Template;
    slotId: string;
    partId: string;
    transform: LocalTransform;
    scope: "template" | "family";
    anchorId?: string | null;
  },
): ItemFitProfile[] {
  const profileId = makeProfileId(options.scope, options.item, options.template, options.slotId);
  const targetIndex = profiles.findIndex(profile =>
    options.scope === "template"
      ? profile.fitProfile === options.item.fitProfile &&
        profile.templateId === options.template.id &&
        profile.slotId === options.slotId
      : profile.fitProfile === options.item.fitProfile &&
        profile.family === options.template.skeletonFamily &&
        profile.slotId === options.slotId,
  );

  const nextProfile: ItemFitProfile = targetIndex >= 0
    ? {
        ...profiles[targetIndex],
        partTransforms: {
          ...profiles[targetIndex].partTransforms,
          [options.partId]: { ...options.transform },
        },
        anchorOverrides: options.anchorId
          ? {
              ...(profiles[targetIndex].anchorOverrides ?? {}),
              [options.slotId]: options.anchorId,
            }
          : profiles[targetIndex].anchorOverrides,
      }
    : {
        id: profileId,
        fitProfile: options.item.fitProfile,
        templateId: options.scope === "template" ? options.template.id : "",
        family: options.scope === "family" ? options.template.skeletonFamily : options.template.skeletonFamily,
        slotId: options.slotId,
        partTransforms: {
          [options.partId]: { ...options.transform },
        },
        anchorOverrides: options.anchorId
          ? { [options.slotId]: options.anchorId }
          : undefined,
      };

  if (targetIndex < 0) {
    return [...profiles, nextProfile];
  }

  return profiles.map((profile, index) => index === targetIndex ? nextProfile : profile);
}

export function resetItemFitProfilePartToItemDefault(
  profiles: ItemFitProfile[],
  options: {
    item: Item;
    template: Template;
    slotId: string;
    partId: string;
    scope: "template" | "family";
  },
): ItemFitProfile[] {
  return profiles.flatMap(profile => {
    const matchesScope = options.scope === "template"
      ? profile.fitProfile === options.item.fitProfile &&
        profile.templateId === options.template.id &&
        profile.slotId === options.slotId
      : profile.fitProfile === options.item.fitProfile &&
        profile.family === options.template.skeletonFamily &&
        profile.slotId === options.slotId;

    if (!matchesScope) return [profile];

    const { [options.partId]: _removedTransform, ...remainingTransforms } = profile.partTransforms;
    const { [options.slotId]: _removedAnchor, ...remainingAnchors } = profile.anchorOverrides ?? {};

    if (Object.keys(remainingTransforms).length === 0 && Object.keys(remainingAnchors).length === 0) {
      return [];
    }

    return [{
      ...profile,
      partTransforms: remainingTransforms,
      anchorOverrides: Object.keys(remainingAnchors).length > 0 ? remainingAnchors : undefined,
    }];
  });
}
