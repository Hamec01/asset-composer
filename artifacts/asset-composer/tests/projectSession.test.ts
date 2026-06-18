// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import { ITEMS } from "../src/data/items";
import { PRESET_ANIMATIONS } from "../src/data/presetAnimations";
import { PRESET_STATE_MACHINES } from "../src/data/presetStateMachines";
import { DEFAULT_EXPORT_PROFILES } from "../src/data/exportProfiles";
import { STYLE_SETS } from "../src/data/styleSets";
import { TEMPLATES } from "../src/data/templates";
import type { Project } from "../src/domain/types";
import { restoreLastProjectSnapshot, saveLastProjectSnapshot } from "../src/lib/projectSession";

function makeProject(): Project {
  return {
    id: "project-session-test",
    version: "2.0",
    name: "Session Test",
    description: "",
    entities: [],
    templates: TEMPLATES,
    items: ITEMS,
    animationClips: PRESET_ANIMATIONS,
    stateMachines: PRESET_STATE_MACHINES,
    styleSets: STYLE_SETS,
    exportProfiles: DEFAULT_EXPORT_PROFILES,
    activeEntityId: null,
    createdAt: 1,
    updatedAt: 2,
  };
}

describe("project session persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("saves and restores the last valid project snapshot", () => {
    const project = makeProject();
    expect(saveLastProjectSnapshot(project)).toBe(true);

    const restored = restoreLastProjectSnapshot() as Project | null;
    expect(restored).not.toBeNull();
    expect(restored?.id).toBe(project.id);
    expect(restored?.name).toBe(project.name);
  });

  it("returns null when local snapshot is invalid", () => {
    window.localStorage.setItem("asset-composer:last-project:v1", "{not valid json");
    expect(restoreLastProjectSnapshot()).toBeNull();
  });
});
