import { describe, expect, it } from "vitest";

import { getTemplatesForEntityType } from "../src/data/templates";

describe("template ordering", () => {
  it("surfaces the biped profile base template first for character authoring", () => {
    const templates = getTemplatesForEntityType("character");
    expect(templates[0]?.id).toBe("biped_profile_base_v1");
  });
});
