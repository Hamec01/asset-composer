// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import type { Project } from "../src/domain/types";
import { useStore } from "../src/store";
import { ITEMS } from "../src/data/items";
import { TEMPLATES } from "../src/data/templates";
import { ITEM_FIT_PROFILES } from "../src/data/itemFitProfiles";
import { PRESET_ANIMATIONS } from "../src/data/presetAnimations";
import { PRESET_STATE_MACHINES } from "../src/data/presetStateMachines";
import { STYLE_SETS } from "../src/data/styleSets";
import { DEFAULT_EXPORT_PROFILES } from "../src/data/exportProfiles";

const sessionMocks = vi.hoisted(() => ({
  saveLastProjectSnapshot: vi.fn(),
}));

vi.mock("../src/lib/projectSession", () => ({
  saveLastProjectSnapshot: sessionMocks.saveLastProjectSnapshot,
}));

vi.mock("../src/pages/IDE", () => ({
  IDE: () => <div>IDE Screen</div>,
}));

vi.mock("../src/pages/Dashboard", () => ({
  Dashboard: () => <div>Dashboard Screen</div>,
}));

import App from "../src/App";

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "app-autosave-test",
    version: "2.0",
    name: "Autosave Project",
    description: "",
    entities: [],
    templates: TEMPLATES,
    items: ITEMS,
    itemFitProfiles: ITEM_FIT_PROFILES,
    animationClips: PRESET_ANIMATIONS,
    stateMachines: PRESET_STATE_MACHINES,
    styleSets: STYLE_SETS,
    exportProfiles: DEFAULT_EXPORT_PROFILES,
    activeEntityId: null,
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  };
}

function renderApp() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(<App />);
  });
}

function cleanupApp() {
  act(() => {
    root?.unmount();
  });
  root = null;
  container?.remove();
  container = null;
}

describe("App autosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    cleanupApp();
    window.localStorage.clear();
    useStore.setState(state => {
      state.project = makeProject();
      state.editor.appState = "dashboard";
      state.editor.selectedSlotId = null;
      state.editor.selection = { kind: "none" };
      state.history.past = [];
      state.history.future = [];
      state.animPlayback.activeClipId = null;
      state.animPlayback.upperClipId = null;
      state.animPlayback.lowerClipId = null;
      state.animPlayback.upperBlendWeight = 1;
      state.animPlayback.timeMs = 0;
      state.animPlayback.playing = false;
      state.animPlayback.looping = true;
      state.animPlayback.activeStateMachineId = null;
      state.animPlayback.selectedStateId = null;
      state.animPlayback.activeTab = "timeline";
      state.animPlayback.zoomPx = 120;
    });
  });

  it("stays on the dashboard until the user chooses a project", () => {
    renderApp();

    expect(document.body.textContent).toContain("Dashboard Screen");
    expect(useStore.getState().editor.appState).toBe("dashboard");
  });

  it("does not reset autosave debounce for playback-only updates", () => {
    useStore.setState(state => {
      state.editor.appState = "ide";
    });

    renderApp();

    act(() => {
      useStore.getState().setProjectName("Autosave Updated");
    });

    act(() => {
      vi.advanceTimersByTime(200);
      useStore.getState().setPlaybackTime(120);
      useStore.getState().setPlaybackPlaying(true);
      vi.advanceTimersByTime(250);
    });

    expect(sessionMocks.saveLastProjectSnapshot).toHaveBeenCalledTimes(1);
    expect(sessionMocks.saveLastProjectSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Autosave Updated",
      }),
    );
  });
});
