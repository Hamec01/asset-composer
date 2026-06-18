import { beforeEach, describe, expect, it } from "vitest";

import { useStore } from "../src/store";

describe("playback overlay selection", () => {
  beforeEach(() => {
    useStore.getState().newProject();
  });

  it("promotes upper clip selection to the base clip when no base clip is active", () => {
    const walkId = "humanoid_topdown_v1__walk";

    useStore.getState().setUpperClip(walkId);

    expect(useStore.getState().animPlayback.activeClipId).toBe(walkId);
    expect(useStore.getState().animPlayback.upperClipId).toBeNull();
  });

  it("promotes lower clip selection to the base clip when no base clip is active", () => {
    const runId = "humanoid_topdown_v1__run";

    useStore.getState().setLowerClip(runId);

    expect(useStore.getState().animPlayback.activeClipId).toBe(runId);
    expect(useStore.getState().animPlayback.lowerClipId).toBeNull();
  });
});
