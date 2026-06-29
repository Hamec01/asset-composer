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

    expect(getTemplateFamilyLabel(template!)).toBe("Biped Directional");
    expect(getTemplateFacingPolicyLabel(template!)).toBe("Directional 5");
    expect(getTemplateDefaultFacingLabel(template!)).toBe("South-East");
    expect(getTemplatePresentationSummary(template!)).toBe(
      "Biped Directional · Directional 5 · South-East",
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

    expect(getTemplateFamilyLabel(template)).toBe("Humanoid (Side)");
    expect(getTemplateFacingPolicyLabel(template)).toBe("Profile Mirror");
    expect(getTemplateDefaultFacingLabel(template)).toBe("East");
    expect(getTemplatePresentationSummary(template)).toBe(
      "Humanoid (Side) · Profile Mirror · East",
    );
  });
});
