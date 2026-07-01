import { beforeEach, describe, expect, it } from "vitest";

import { useStore } from "../src/store";
import type { Project } from "../src/domain/types";

describe("playback overlay selection", () => {
  beforeEach(() => {
    globalThis.requestAnimationFrame ??= ((cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number);
    globalThis.cancelAnimationFrame ??= ((id: number) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>));
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

  it("rehydrates playback when loading a saved project with an active entity", () => {
    const store = useStore.getState();
    store.createEntity("character", "humanoid_topdown_v1", "Hydrate Hero");

    const savedProject = structuredClone(useStore.getState().project) as Project;

    useStore.getState().loadProject(savedProject);

    const nextState = useStore.getState();
    expect(nextState.editor.appState).toBe("ide");
    expect(nextState.project.activeEntityId).toBeTruthy();
    expect(nextState.animPlayback.activeClipId).toBeTruthy();
    expect(nextState.animPlayback.activeStateMachineId).toBeTruthy();
    expect(nextState.animPlayback.playing).toBe(true);
    expect(nextState.animPlayback.timeMs).toBe(0);
  });

  it("resets volatile authoring ui state when loading a saved project", () => {
    const store = useStore.getState();
    store.createEntity("character", "humanoid_topdown_v1", "Author Hero");

    const savedProject = structuredClone(useStore.getState().project) as Project;
    savedProject.editorMeta.activeAuthoringMode = "sprite-editor";
    savedProject.editorMeta.activeFaceCanvasOverlayId = "overlay-1";
    savedProject.editorMeta.activeFaceCanvasTool = "pencil";
    savedProject.editorMeta.activeFaceCanvasFocusMode = "head";
    savedProject.editorMeta.activeSpriteDocumentId = "doc-1";

    useStore.getState().loadProject(savedProject);

    const nextProject = useStore.getState().project;
    expect(nextProject.editorMeta.activeAuthoringMode).toBeNull();
    expect(nextProject.editorMeta.activeFaceCanvasOverlayId).toBeNull();
    expect(nextProject.editorMeta.activeFaceCanvasTool).toBeNull();
    expect(nextProject.editorMeta.activeFaceCanvasFocusMode).toBeNull();
    expect(nextProject.editorMeta.activeSpriteDocumentId).toBeNull();
  });
});
