import { describe, expect, it } from "vitest";

import { PRESET_ANIMATIONS } from "../src/data/presetAnimations";
import { PRESET_STATE_MACHINES } from "../src/data/presetStateMachines";
import { cloneTemplates } from "../src/data/templates";
import type { Template } from "../src/domain/types";
import {
  getClipsForTemplate,
  getLoopingClipForTemplate,
  getStateMachineForTemplate,
  templateSupportsAnimationFamily,
} from "../src/lib/animationCompatibility";

describe("animation compatibility", () => {
  it("matches directional rig-family templates to legacy animation families", () => {
    const template = cloneTemplates().find(candidate => candidate.id === "humanoid_topdown_v1");
    expect(template).toBeTruthy();

    expect(templateSupportsAnimationFamily(template!, "humanoid_topdown_v1")).toBe(true);
    expect(templateSupportsAnimationFamily(template!, "biped_directional_v1")).toBe(true);
  });

  it("finds clips and state machines for explicit built-in rig families", () => {
    const template = cloneTemplates().find(candidate => candidate.id === "humanoid_topdown_v1");
    expect(template).toBeTruthy();

    const clips = getClipsForTemplate(template!, PRESET_ANIMATIONS);
    const stateMachine = getStateMachineForTemplate(template!, PRESET_STATE_MACHINES);
    const loopingClip = getLoopingClipForTemplate(template!, PRESET_ANIMATIONS);

    expect(clips.some(clip => clip.skeletonFamily === "humanoid_topdown_v1")).toBe(true);
    expect(stateMachine?.skeletonFamily).toBe("humanoid_topdown_v1");
    expect(loopingClip?.loops).toBe(true);
  });

  it("falls back cleanly for legacy-only templates", () => {
    const source = cloneTemplates().find(candidate => candidate.id === "humanoid_side_v1");
    expect(source).toBeTruthy();
    const template: Template = {
      ...source!,
      rigFamilyId: undefined,
      defaultFacing: undefined,
      views: undefined,
    };

    expect(getStateMachineForTemplate(template, PRESET_STATE_MACHINES)?.skeletonFamily).toBe("humanoid_side_v1");
    expect(getClipsForTemplate(template, PRESET_ANIMATIONS).every(clip => clip.skeletonFamily === "humanoid_side_v1")).toBe(true);
  });
});
