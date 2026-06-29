import type { Item, Template, ViewProfile } from "@/domain/types";
import { resolveTemplateRigFamilyId, resolveTemplateViews } from "@/lib/templateViewContract";

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function getTemplateCompatibilityFamilies(template: Template): string[] {
  return unique([template.skeletonFamily, resolveTemplateRigFamilyId(template)]);
}

export function getTemplateCompatibilityViewProfiles(template: Template): ViewProfile[] {
  return unique([
    template.viewProfile,
    ...Object.values(resolveTemplateViews(template)).map(view => view.viewProfile),
  ]);
}

export function templateMatchesCompatibilityFamily(template: Template, family: string): boolean {
  return getTemplateCompatibilityFamilies(template).includes(family);
}

export function templateMatchesCompatibilityViewProfile(
  template: Template,
  viewProfile: ViewProfile,
): boolean {
  return getTemplateCompatibilityViewProfiles(template).includes(viewProfile);
}

export function itemSupportsTemplate(item: Item, template: Template): boolean {
  const familyMatch =
    item.compatibility.skeletonFamilies.length === 0 ||
    item.compatibility.skeletonFamilies.some(family => templateMatchesCompatibilityFamily(template, family));
  const viewMatch =
    item.compatibility.viewProfiles.length === 0 ||
    item.compatibility.viewProfiles.some(viewProfile => templateMatchesCompatibilityViewProfile(template, viewProfile));
  return familyMatch && viewMatch;
}
