import { describe, expect, it } from "vitest";

import { cloneTemplates } from "../src/data/templates";
import { BUILT_IN_RIG_FAMILIES, getBuiltInRigFamilyById } from "../src/data/rigFamilies";
import { resolveRigFamilyContract } from "../src/lib/rigFamilyContract";

describe("rig family registry", () => {
  it("publishes canonical built-in rig families", () => {
    expect(BUILT_IN_RIG_FAMILIES.map(contract => contract.id)).toEqual([
      "biped_profile_v1",
      "biped_directional_v1",
      "quadruped_profile_v1",
    ]);
  });

  it("resolves built-in templates through the registry", () => {
    const template = cloneTemplates().find(candidate => candidate.id === "humanoid_topdown_v1");
    expect(template).toBeTruthy();

    const contract = resolveRigFamilyContract(template!);

    expect(contract.id).toBe("biped_directional_v1");
    expect(contract.facingPolicy).toBe("directional_5");
    expect(contract.logicalBoneIds).toContain("pelvis");
    expect(contract.slotIds).toContain("slot_hair");
    expect(getBuiltInRigFamilyById(contract.id)).toEqual(contract);
  });
});
