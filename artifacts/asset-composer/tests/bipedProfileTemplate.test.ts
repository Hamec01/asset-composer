import { describe, expect, it } from "vitest";

import { PRESET_ANIMATIONS } from "../src/data/presetAnimations";
import { PRESET_STATE_MACHINES } from "../src/data/presetStateMachines";
import { cloneTemplates } from "../src/data/templates";
import { getClipsForTemplate, getStateMachineForTemplate } from "../src/lib/animationCompatibility";
import { resolveRigFamilyContract } from "../src/lib/rigFamilyContract";
import { getTemplatePresentationSummary } from "../src/lib/templatePresentation";

describe("biped profile base template", () => {
  it("exists as a first-class production-safe profile entrypoint", () => {
    const template = cloneTemplates().find(candidate => candidate.id === "biped_profile_base_v1");
    expect(template).toBeTruthy();

    expect(template?.rigFamilyId).toBe("biped_profile_v1");
    expect(template?.skeletonFamily).toBe("humanoid_side_v1");
    expect(template?.entityTypes).toEqual(["character"]);
    expect(template?.views?.east?.viewProfile).toBe("side_view");
    expect(template?.name).toBe("Biped Profile - Bare Chibi");
    expect(template?.name).not.toContain("вЂ");
    expect(template?.paletteTokens.primaryCloth).toBe("#EADCC8");
    expect(template?.paletteTokens.hair).toBe("#7A4A2B");
  });

  it("ships a small set of naked chibi body starters", () => {
    const templates = cloneTemplates();
    const ids = templates.map(template => template.id);

    expect(ids).toContain("biped_profile_base_v1");
    expect(ids).toContain("biped_profile_slim_v1");
    expect(ids).toContain("biped_profile_sturdy_v1");

    for (const id of ["biped_profile_base_v1", "biped_profile_slim_v1", "biped_profile_sturdy_v1"]) {
      const template = templates.find(candidate => candidate.id === id);
      expect(template?.rigFamilyId).toBe("biped_profile_v1");
      expect(template?.boneParts?.some(part => part.id === "hero_pelvis")).toBe(true);
      expect(template?.boneParts?.some(part => part.id === "hero_foot_r")).toBe(true);
    }
  });

  it("resolves through the new rig family layer while reusing proven side runtime assets", () => {
    const template = cloneTemplates().find(candidate => candidate.id === "biped_profile_base_v1");
    expect(template).toBeTruthy();

    const contract = resolveRigFamilyContract(template!);
    const clips = getClipsForTemplate(template!, PRESET_ANIMATIONS);
    const stateMachine = getStateMachineForTemplate(template!, PRESET_STATE_MACHINES);

    expect(contract.id).toBe("biped_profile_v1");
    expect(contract.facingPolicy).toBe("profile_mirror");
    expect(clips.every(clip => clip.skeletonFamily === "humanoid_side_v1")).toBe(true);
    expect(stateMachine).toBeNull();
    expect(getTemplatePresentationSummary(template!)).toBe("Двуногий в профиль · Зеркальный профиль · Восток");
  });
});
