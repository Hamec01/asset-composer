import { describe, expect, it } from "vitest";

import { cloneTemplates } from "../src/data/templates";
import { buildRigFamilyContractFromTemplate } from "../src/lib/rigFamilyContract";

describe("rig family contract", () => {
  it("builds a profile-mirror contract from a legacy side-view template", () => {
    const sourceTemplate = cloneTemplates().find(candidate => candidate.id === "humanoid_side_v1");
    expect(sourceTemplate).toBeTruthy();
    const template = {
      ...sourceTemplate!,
      rigFamilyId: undefined,
      defaultFacing: undefined,
      views: undefined,
    };

    const contract = buildRigFamilyContractFromTemplate(template);

    expect(contract.id).toBe("humanoid_side_v1");
    expect(contract.anatomy).toBe("biped");
    expect(contract.facingPolicy).toBe("profile_mirror");
    expect(contract.logicalBoneIds).toContain("head");
    expect(contract.slotIds).toContain("side_slot_hair");
  });

  it("uses explicit built-in rig family ids when present", () => {
    const template = cloneTemplates().find(candidate => candidate.id === "humanoid_side_v1");
    expect(template).toBeTruthy();

    const contract = buildRigFamilyContractFromTemplate(template!);

    expect(contract.id).toBe("biped_profile_v1");
    expect(contract.anatomy).toBe("biped");
    expect(contract.facingPolicy).toBe("profile_mirror");
    expect(contract.logicalBoneIds).toContain("head");
    expect(contract.slotIds).toContain("side_slot_hair");
  });

  it("prefers explicit next-gen rig family ids when present", () => {
    const template = cloneTemplates().find(candidate => candidate.id === "humanoid_topdown_v1");
    expect(template).toBeTruthy();

    const contract = buildRigFamilyContractFromTemplate({
      ...template!,
      rigFamilyId: "biped_directional_v1",
      defaultFacing: "south",
      views: {
        south: { key: "south", viewProfile: "front_view" },
        east: { key: "east", viewProfile: "side_view" },
      },
    });

    expect(contract.id).toBe("biped_directional_v1");
    expect(contract.anatomy).toBe("biped");
    expect(contract.facingPolicy).toBe("directional_5");
    expect(contract.logicalBoneIds).toContain("pelvis");
    expect(contract.slotIds).toContain("slot_hair");
  });
});
