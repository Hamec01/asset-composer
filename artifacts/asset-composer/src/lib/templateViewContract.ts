import type {
  FacingPolicy,
  RigFamilyId,
  Template,
  TemplateView,
  ViewKey,
  ViewProfile,
} from "@/domain/types";

function legacyDefaultFacing(viewProfile: ViewProfile): ViewKey {
  switch (viewProfile) {
    case "side_view":
      return "east";
    case "front_view":
      return "south";
    case "topdown_45":
    case "isometric_34":
      return "south_east";
    case "static":
    default:
      return "south";
  }
}

function legacyFacingPolicy(viewProfile: ViewProfile): FacingPolicy {
  switch (viewProfile) {
    case "side_view":
      return "profile_mirror";
    case "front_view":
      return "directional_4";
    case "topdown_45":
    case "isometric_34":
      return "directional_5";
    case "static":
    default:
      return "directional_4";
  }
}

export function resolveTemplateRigFamilyId(template: Template): RigFamilyId {
  return template.rigFamilyId ?? template.skeletonFamily;
}

export function resolveTemplateDefaultFacing(template: Template): ViewKey {
  return template.defaultFacing ?? legacyDefaultFacing(template.viewProfile);
}

export function resolveTemplateViews(template: Template): Partial<Record<ViewKey, TemplateView>> {
  if (template.views && Object.keys(template.views).length > 0) {
    return template.views;
  }

  const key = resolveTemplateDefaultFacing(template);
  return {
    [key]: {
      key,
      viewProfile: template.viewProfile,
      thumbnailSvg: template.thumbnailSvg,
    },
  };
}

export function resolveTemplateFacingPolicy(template: Template): FacingPolicy {
  const views = resolveTemplateViews(template);
  const explicitKeys = Object.keys(views) as ViewKey[];

  if (explicitKeys.length > 1) {
    return explicitKeys.length >= 8 ? "directional_8" : "directional_5";
  }

  return legacyFacingPolicy(template.viewProfile);
}
