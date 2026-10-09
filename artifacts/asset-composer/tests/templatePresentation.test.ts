import { describe, expect, it } from "vitest";

import { cloneTemplates } from "../src/data/templates";
import type { Template } from "../src/domain/types";
import {
  getTemplateDefaultFacingLabel,
  getTemplateFamilyLabel,
  getTemplateFacingPolicyLabel,
  getTemplatePresentationSummary,
} from "../src/lib/templatePresentation";

describe("template presentation", () => {
  it("renders explicit built-in rig metadata for directional templates", () => {
    const template = cloneTemplates().find(candidate => candidate.id === "humanoid_topdown_v1");
    expect(template).toBeTruthy();

    expect(getTemplateFamilyLabel(template!)).toBe("Двуногий по направлениям");
    expect(getTemplateFacingPolicyLabel(template!)).toBe("5 направлений");
    expect(getTemplateDefaultFacingLabel(template!)).toBe("Юго-восток");
    expect(getTemplatePresentationSummary(template!)).toBe(
      "Двуногий по направлениям · 5 направлений · Юго-восток",
    );
  });

  it("falls back cleanly for legacy-only templates", () => {
    const sourceTemplate = cloneTemplates().find(candidate => candidate.id === "humanoid_side_v1");
    expect(sourceTemplate).toBeTruthy();

    const template: Template = {
      ...sourceTemplate!,
      rigFamilyId: undefined,
      defaultFacing: undefined,
      views: undefined,
    };

    expect(getTemplateFamilyLabel(template)).toBe("Человекоподобный (сбоку)");
    expect(getTemplateFacingPolicyLabel(template)).toBe("Зеркальный профиль");
    expect(getTemplateDefaultFacingLabel(template)).toBe("Восток");
    expect(getTemplatePresentationSummary(template)).toBe(
      "Человекоподобный (сбоку) · Зеркальный профиль · Восток",
    );
  });
});
