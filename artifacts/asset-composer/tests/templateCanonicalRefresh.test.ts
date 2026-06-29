import { describe, expect, it } from "vitest";

import { cloneTemplates, refreshCanonicalBuiltInTemplate } from "../src/data/templates";

describe("canonical built-in template refresh", () => {
  it("restores explicit rig/view metadata while preserving user slot transforms", () => {
    const template = cloneTemplates().find(candidate => candidate.id === "humanoid_topdown_v1");
    expect(template).toBeTruthy();

    const customized = {
      ...template!,
      rigFamilyId: undefined,
      defaultFacing: undefined,
      views: undefined,
      slots: template!.slots.map(slot =>
        slot.id === "slot_hair"
          ? {
              ...slot,
              defaultTransform: { x: 12, y: -8, rotation: 15, scaleX: 1.2, scaleY: 0.85 },
            }
          : slot,
      ),
    };

    const refreshed = refreshCanonicalBuiltInTemplate(customized);

    expect(refreshed.rigFamilyId).toBe("biped_directional_v1");
    expect(refreshed.defaultFacing).toBe("south_east");
    expect(refreshed.views?.south_east?.viewProfile).toBe("topdown_45");
    expect(refreshed.slots.find(slot => slot.id === "slot_hair")?.defaultTransform).toEqual({
      x: 12,
      y: -8,
      rotation: 15,
      scaleX: 1.2,
      scaleY: 0.85,
    });
  });

  it("includes the clean top-down mannequin template as a canonical built-in", () => {
    const template = cloneTemplates().find(candidate => candidate.id === "humanoid_topdown_clean_body_v1");
    expect(template).toBeTruthy();
    expect(template?.skeletonFamily).toBe("humanoid_topdown_v1");
    expect(template?.rigFamilyId).toBe("biped_directional_v1");
    expect(template?.views?.south_east?.viewProfile).toBe("topdown_45");
  });
});
