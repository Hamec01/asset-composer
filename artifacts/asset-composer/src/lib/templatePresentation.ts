import type { FacingPolicy, Template, ViewKey } from "@/domain/types";
import {
  resolveTemplateDefaultFacing,
  resolveTemplateFacingPolicy,
  resolveTemplateRigFamilyId,
} from "@/lib/templateViewContract";

const LEGACY_TEMPLATE_LABELS: Record<string, string> = {
  humanoid_topdown_v1: "Humanoid (Top-down)",
  humanoid_topdown_clean_body_v1: "Humanoid (Top-down Clean Body)",
  humanoid_side_v1: "Humanoid (Side)",
  quadruped_side_v1: "Quadruped",
  bird_side_v1: "Bird",
  humanoid_monster_v1: "Monster",
  siege_static_v1: "Siege/Static",
};

const RIG_FAMILY_LABELS: Record<string, string> = {
  biped_profile_v1: "Biped Profile",
  quadruped_profile_v1: "Quadruped Profile",
  serpent_profile_v1: "Serpent Profile",
  biped_directional_v1: "Biped Directional",
  quadruped_directional_v1: "Quadruped Directional",
  serpent_directional_v1: "Serpent Directional",
  dragon_directional_v1: "Dragon Directional",
  centaur_directional_v1: "Centaur Directional",
};

const FACING_POLICY_LABELS: Record<FacingPolicy, string> = {
  profile_mirror: "Profile Mirror",
  directional_4: "Directional 4",
  directional_5: "Directional 5",
  directional_8: "Directional 8",
};

const VIEW_KEY_LABELS: Record<ViewKey, string> = {
  south: "South",
  south_east: "South-East",
  east: "East",
  north_east: "North-East",
  north: "North",
  north_west: "North-West",
  west: "West",
  south_west: "South-West",
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
