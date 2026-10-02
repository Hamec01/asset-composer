// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import { useStore } from "../src/store";

describe("store createEntity", () => {
  beforeEach(() => {
    useStore.getState().newProject();
  });

  it("starts a chibi with its reviewed idle rather than the legacy state machine", () => {
    useStore.getState().createEntity("character", "biped_profile_base_v1", "Walking Hero");

    const state = useStore.getState();
    const entity = state.project.entities.find(candidate => candidate.id === state.project.activeEntityId);

    expect(entity).toBeTruthy();
    expect(state.animPlayback.activeStateMachineId).toBeNull();
    expect(state.animPlayback.activeClipId).toBe("chibi_front__idle");
    expect(entity?.activeStateMachineId).toBe(state.animPlayback.activeStateMachineId);
    expect(entity?.activeAnimationClipId).toBe(state.animPlayback.activeClipId);
    expect(entity?.palette.primaryCloth).toBe("#EADCC8");
    expect(entity?.faceCustomization?.eyes.visible).toBe(false);
    expect(entity?.faceCustomization?.eyes.presetId).toBe("none");
    expect(entity?.faceCustomization?.mouth.visible).toBe(false);
    expect(entity?.faceCustomization?.mouth.presetId).toBe("none");
    expect(entity?.faceCustomization?.brows.visible).toBe(false);
    expect(entity?.faceCustomization?.brows.presetId).toBe("none");
    expect(entity?.faceCustomization?.beard.visible).toBe(false);
    expect(entity?.faceCustomization?.beard.presetId).toBe("none");
    expect(entity?.faceCustomization?.hair.visible).toBe(false);
    expect(entity?.faceCustomization?.hair.presetId).toBe("none");
  });

  it("lets explicit timeline clip selection override the default state machine", () => {
    useStore.getState().createEntity("character", "biped_profile_base_v1", "Walking Hero");
    useStore.getState().setPlaybackClip("chibi_front__walk");

    const state = useStore.getState();
    const entity = state.project.entities.find(candidate => candidate.id === state.project.activeEntityId);

    expect(state.animPlayback.activeStateMachineId).toBeNull();
    expect(state.animPlayback.selectedStateId).toBeNull();
    expect(state.animPlayback.activeClipId).toBe("chibi_front__walk");
    expect(entity?.activeStateMachineId).toBeNull();
    expect(entity?.activeAnimationClipId).toBe("chibi_front__walk");
  });
});
