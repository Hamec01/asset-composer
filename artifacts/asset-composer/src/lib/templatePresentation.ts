import type { FacingPolicy, Template, ViewKey } from "@/domain/types";
import {
  resolveTemplateDefaultFacing,
  resolveTemplateFacingPolicy,
  resolveTemplateRigFamilyId,
} from "@/lib/templateViewContract";

const LEGACY_TEMPLATE_LABELS: Record<string, string> = {
  humanoid_topdown_v1: "Человекоподобный (сверху)",
  humanoid_topdown_clean_body_v1: "Человекоподобный (чистая основа сверху)",
  humanoid_side_v1: "Человекоподобный (сбоку)",
  quadruped_side_v1: "Четвероногий",
  bird_side_v1: "Птица",
  humanoid_monster_v1: "Существо",
  siege_static_v1: "Осадный / неподвижный",
};

const RIG_FAMILY_LABELS: Record<string, string> = {
  biped_profile_v1: "Двуногий в профиль",
  quadruped_profile_v1: "Четвероногий в профиль",
  serpent_profile_v1: "Змеевидный в профиль",
  biped_directional_v1: "Двуногий по направлениям",
  quadruped_directional_v1: "Четвероногий по направлениям",
  serpent_directional_v1: "Змеевидный по направлениям",
  dragon_directional_v1: "Дракон по направлениям",
  centaur_directional_v1: "Кентавр по направлениям",
};

const FACING_POLICY_LABELS: Record<FacingPolicy, string> = {
  profile_mirror: "Зеркальный профиль",
  directional_4: "4 направления",
  directional_5: "5 направлений",
  directional_8: "8 направлений",
};

const VIEW_KEY_LABELS: Record<ViewKey, string> = {
  south: "Юг",
  south_east: "Юго-восток",
  east: "Восток",
  north_east: "Северо-восток",
  north: "Север",
  north_west: "Северо-запад",
  west: "Запад",
  south_west: "Юго-запад",
};

function titleCaseToken(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map(token => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

export function getFamilyLabelById(familyId: string): string {
  return (
    RIG_FAMILY_LABELS[familyId] ??
    LEGACY_TEMPLATE_LABELS[familyId] ??
    titleCaseToken(familyId)
  );
}

export function getTemplateFamilyLabel(template: Template): string {
  return getFamilyLabelById(resolveTemplateRigFamilyId(template));
}

export function getTemplateFacingPolicyLabel(template: Template): string {
  return FACING_POLICY_LABELS[resolveTemplateFacingPolicy(template)];
}

export function getTemplateDefaultFacingLabel(template: Template): string {
  return VIEW_KEY_LABELS[resolveTemplateDefaultFacing(template)];
}

export function getTemplatePresentationSummary(template: Template): string {
  return [
    getTemplateFamilyLabel(template),
    getTemplateFacingPolicyLabel(template),
    getTemplateDefaultFacingLabel(template),
  ].join(" · ");
}
