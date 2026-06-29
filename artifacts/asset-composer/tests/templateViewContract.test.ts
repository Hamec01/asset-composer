import { describe, expect, it } from "vitest";

import { cloneTemplates } from "../src/data/templates";
import { ProjectSchema } from "../src/domain/schema";
import type { Project, Template } from "../src/domain/types";
import {
  resolveTemplateDefaultFacing,
  resolveTemplateFacingPolicy,
  resolveTemplateRigFamilyId,
  resolveTemplateViews,
} from "../src/lib/templateViewContract";

function makeProject(): Project {
  return {
    id: "project",
    version: "2.0",
    name: "Template View Contract",
    description: "",
    entities: [],
    templates: cloneTemplates(),
    items: [],
    itemFitProfiles: [],
    animationClips: [],
    stateMachines: [],
    styleSets: [],
    exportProfiles: [],
    editorMeta: { slotEditorByTemplateId: {} },
    activeEntityId: null,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe("template view contract", () => {
  it("provides a legacy fallback for side-view templates", () => {
    const sourceTemplate = cloneTemplates().find(candidate => candidate.id === "humanoid_side_v1");
    expect(sourceTemplate).toBeTruthy();
    const template: Template = {
      ...sourceTemplate!,
      rigFamilyId: undefined,
      defaultFacing: undefined,
      views: undefined,
    };

    expect(resolveTemplateRigFamilyId(template)).toBe("humanoid_side_v1");
    expect(resolveTemplateDefaultFacing(template)).toBe("east");
    expect(resolveTemplateFacingPolicy(template)).toBe("profile_mirror");
    expect(resolveTemplateViews(template)).toEqual({
      east: {
        key: "east",
        viewProfile: "side_view",
        thumbnailSvg: template.thumbnailSvg,
      },
    });
  });

  it("prefers explicit built-in rig family data when present", () => {
    const project = makeProject();
    const template = project.templates.find(candidate => candidate.id === "humanoid_side_v1");
    expect(template).toBeTruthy();

    expect(resolveTemplateRigFamilyId(template!)).toBe("biped_profile_v1");
    expect(resolveTemplateDefaultFacing(template!)).toBe("east");
    expect(resolveTemplateFacingPolicy(template!)).toBe("profile_mirror");
    expect(resolveTemplateViews(template!)).toEqual({
      east: {
        key: "east",
        viewProfile: "side_view",
        thumbnailSvg: template!.thumbnailSvg,
      },
    });
  });

  it("preserves explicit rig family and multi-view data through project schema parsing", () => {
    const project = makeProject();
    const sourceTemplate = project.templates.find(candidate => candidate.id === "humanoid_topdown_v1");
    expect(sourceTemplate).toBeTruthy();

    const upgradedTemplate: Template = {
      ...sourceTemplate!,
      rigFamilyId: "biped_directional_v1",
      defaultFacing: "south",
      views: {
        south: {
          key: "south",
          viewProfile: "front_view",
          thumbnailSvg: sourceTemplate!.thumbnailSvg,
        },
        east: {
          key: "east",
          viewProfile: "side_view",
        },
      },
    };

    const snapshot: Project = {
      ...project,
      templates: project.templates.map(template =>
        template.id === upgradedTemplate.id ? upgradedTemplate : template,
      ),
    };

    const parsed = ProjectSchema.parse(snapshot);
    const restored = parsed.templates.find(template => template.id === upgradedTemplate.id);

    expect(restored?.rigFamilyId).toBe("biped_directional_v1");
    expect(restored?.defaultFacing).toBe("south");
    expect(restored?.views?.south?.viewProfile).toBe("front_view");
    expect(restored?.views?.east?.viewProfile).toBe("side_view");
  });
});
