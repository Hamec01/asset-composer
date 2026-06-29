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
    expect(stateMachine?.skeletonFamily).toBe("humanoid_side_v1");
    expect(getTemplatePresentationSummary(template!)).toBe("Biped Profile · Profile Mirror · East");
  });
});
