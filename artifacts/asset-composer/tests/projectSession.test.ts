// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import { ITEMS } from "../src/data/items";
import { PRESET_ANIMATIONS } from "../src/data/presetAnimations";
import { PRESET_STATE_MACHINES } from "../src/data/presetStateMachines";
import { DEFAULT_EXPORT_PROFILES } from "../src/data/exportProfiles";
import { ITEM_FIT_PROFILES } from "../src/data/itemFitProfiles";
import { STYLE_SETS } from "../src/data/styleSets";
import { TEMPLATES } from "../src/data/templates";
import type { Project } from "../src/domain/types";
import {
  getRecentProjectSessions,
  getRecentProjectFolderPath,
  loadProjectSession,
  restoreLastProjectSnapshot,
  saveLastProjectSnapshot,
} from "../src/lib/projectSession";

function makeProject(): Project {
  return {
    id: "project-session-test",
    version: "2.0",
    name: "Session Test",
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

  it("keeps a recent projects list and opens a stored project by id", () => {
    const first = makeProject();
    const second = { ...makeProject(), id: "project-session-test-2", name: "Second Session", updatedAt: 22 };

    expect(saveLastProjectSnapshot(first, "D:/projects/first")).toBe(true);
    expect(saveLastProjectSnapshot(second)).toBe(true);

    const recent = getRecentProjectSessions();
    expect(recent).toHaveLength(2);
    expect(recent[0].id).toBe(second.id);
    expect(recent[1].id).toBe(first.id);
    expect(getRecentProjectFolderPath(first.id)).toBe("D:/projects/first");
    expect(getRecentProjectFolderPath(second.id)).toBeNull();

    const restored = loadProjectSession(first.id) as Project | null;
    expect(restored?.id).toBe(first.id);
    expect(restored?.name).toBe(first.name);
  });

  it("sanitizes stale body-clone visuals from the restored last session", () => {
    const template = TEMPLATES.find(candidate => candidate.id === "humanoid_topdown_v1")!;
    const cloneVisuals = template.boneParts.slice(0, 4).map(part => ({
      id: `legacy_clone_${part.id}`,
      boneId: part.boneId,
      svgData: part.svgData,
      metrics: {
        viewBoxX: 0,
        viewBoxY: 0,
        viewBoxWidth: part.naturalWidth,
        viewBoxHeight: part.naturalHeight,
        visualMinX: 0,
        visualMinY: 0,
        visualWidth: part.naturalWidth,
        visualHeight: part.naturalHeight,
      },
      pivot: {
        x: part.naturalWidth / 2,
        y: part.naturalHeight / 2,
        preset: "custom" as const,
      },
      localTransform: {
        x: part.localX,
        y: part.localY,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
      },
      zIndex: part.zOffset,
    }));

    const project: Project = {
      ...makeProject(),
      entities: [{
        id: "entity-1",
        name: "Entity",
        entityType: "character",
        templateId: template.id,
        styleSetId: "style_default",
        species: "",
        palette: template.paletteTokens,
        slots: [],
        visuals: cloneVisuals,
        rootTransform: null,
        activeAnimationClipId: null,
        activeStateMachineId: null,
        licenseMeta: {
          source: "test",
          author: "test",
          licenseType: "cc0",
          aiGenerated: false,
          commercialUseAllowed: true,
          purchaseRef: null,
          derivativePolicy: "unrestricted",
        },
        createdAt: 1,
        updatedAt: 2,
      }],
      activeEntityId: "entity-1",
    };

    expect(saveLastProjectSnapshot(project)).toBe(true);

    const restored = restoreLastProjectSnapshot() as Project | null;
    expect(restored).not.toBeNull();
    expect(restored?.entities[0]?.visuals).toHaveLength(0);
  });

  it("resets suspicious multi-part attachment overrides during restore", () => {
    const template = TEMPLATES.find(candidate => candidate.id === "humanoid_topdown_v1")!;
    const project: Project = {
      ...makeProject(),
      entities: [{
        id: "entity-1",
        name: "Entity",
        entityType: "character",
        templateId: template.id,
        styleSetId: "style_default",
        species: "",
        palette: template.paletteTokens,
        slots: [{
          slotId: "slot_feet",
          itemId: "boots_leather",
          paletteOverride: {},
          attachmentOverride: {
            anchorId: "",
            bindMode: "",
            offsetX: 0,
            offsetY: -5.36,
            rotation: 0,
            scaleX: 1,
            scaleY: 0.106,
          },
        }],
        visuals: [],
        rootTransform: null,
        activeAnimationClipId: null,
        activeStateMachineId: null,
        licenseMeta: {
          source: "test",
          author: "test",
          licenseType: "cc0",
          aiGenerated: false,
          commercialUseAllowed: true,
          purchaseRef: null,
          derivativePolicy: "unrestricted",
        },
        createdAt: 1,
        updatedAt: 2,
      }],
      activeEntityId: "entity-1",
    };

    expect(saveLastProjectSnapshot(project)).toBe(true);
    const restored = restoreLastProjectSnapshot() as Project | null;
    const override = restored?.entities[0]?.slots[0]?.attachmentOverride;

    expect(restored).not.toBeNull();
    expect(override?.offsetX).toBe(0);
    expect(override?.offsetY).toBe(0);
    expect(override?.rotation).toBe(0);
    expect(override?.scaleX).toBe(1);
    expect(override?.scaleY).toBe(1);
  });

  it("persists normalized split limb slots into restored session snapshots", () => {
    const template = TEMPLATES.find(candidate => candidate.id === "humanoid_topdown_v1")!;
    const project: Project = {
      ...makeProject(),
      entities: [{
        id: "entity-1",
        name: "Entity",
        entityType: "character",
        templateId: template.id,
        styleSetId: "style_default",
        species: "",
        palette: template.paletteTokens,
        slots: [{
          slotId: "slot_hands",
          itemId: "gloves_leather",
          paletteOverride: {},
          attachmentOverride: {},
        }],
        visuals: [],
        rootTransform: null,
        activeAnimationClipId: null,
        activeStateMachineId: null,
        licenseMeta: {
          source: "test",
          author: "test",
          licenseType: "cc0",
          aiGenerated: false,
          commercialUseAllowed: true,
          purchaseRef: null,
          derivativePolicy: "unrestricted",
        },
        createdAt: 1,
        updatedAt: 2,
      }],
      activeEntityId: "entity-1",
    };

    expect(saveLastProjectSnapshot(project)).toBe(true);
    const restored = restoreLastProjectSnapshot() as Project | null;
    expect(restored?.entities[0]?.slots.map(slot => slot.slotId)).toEqual(["slot_hand_l", "slot_hand_r"]);
    expect(restored?.entities[0]?.slots.map(slot => slot.itemId)).toEqual(["glove_leather_l", "glove_leather_r"]);
  });

  it("strips partial limb-only body clone visuals on restore", () => {
    const template = TEMPLATES.find(candidate => candidate.id === "humanoid_topdown_v1")!;
    const handPart = template.boneParts!.find(part => part.boneId === "hand_l")!;
    const footPart = template.boneParts!.find(part => part.boneId === "foot_l")!;

    const project: Project = {
      ...makeProject(),
      entities: [{
        id: "entity-1",
        name: "Entity",
        entityType: "character",
        templateId: template.id,
        styleSetId: "style_default",
        species: "",
        palette: template.paletteTokens,
        slots: [],
        visuals: [
          {
            id: "ghost-hand",
            boneId: handPart.boneId,
            svgData: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'><circle cx='0.5' cy='0.5' r='0.5' fill='#111'/></svg>",
            metrics: {
              viewBoxX: 0,
              viewBoxY: 0,
              viewBoxWidth: 1,
              viewBoxHeight: 1,
              visualMinX: 0,
              visualMinY: 0,
              visualWidth: 1,
              visualHeight: 1,
            },
            pivot: { x: 0.5, y: 0.5, preset: "custom" },
            localTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            zIndex: handPart.zOffset,
          },
          {
            id: "ghost-foot",
            boneId: footPart.boneId,
            svgData: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'><rect x='0' y='0' width='1' height='1' fill='#111'/></svg>",
            metrics: {
              viewBoxX: 0,
              viewBoxY: 0,
              viewBoxWidth: 1,
              viewBoxHeight: 1,
              visualMinX: 0,
              visualMinY: 0,
              visualWidth: 1,
              visualHeight: 1,
            },
            pivot: { x: 0.5, y: 0.5, preset: "custom" },
            localTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            zIndex: footPart.zOffset,
          },
        ],
        rootTransform: null,
        activeAnimationClipId: null,
        activeStateMachineId: null,
        licenseMeta: {
          source: "test",
          author: "test",
          licenseType: "cc0",
          aiGenerated: false,
          commercialUseAllowed: true,
          purchaseRef: null,
          derivativePolicy: "unrestricted",
        },
        createdAt: 1,
        updatedAt: 2,
      }],
      activeEntityId: "entity-1",
    };

    expect(saveLastProjectSnapshot(project)).toBe(true);
    const restored = restoreLastProjectSnapshot() as Project | null;
    expect(restored?.entities[0]?.visuals).toEqual([]);
  });

  it("strips root-level full body clone visuals on restore", () => {
    const template = TEMPLATES.find(candidate => candidate.id === "humanoid_topdown_v1")!;
    const baseLayer = template.baseBodyLayers[0]!;

    const project: Project = {
      ...makeProject(),
      entities: [{
        id: "entity-1",
        name: "Entity",
        entityType: "character",
        templateId: template.id,
        styleSetId: "style_default",
        species: "",
        palette: template.paletteTokens,
        slots: [],
        visuals: [{
          id: "ghost-full-body",
          boneId: "root",
          svgData: baseLayer.svgData,
          metrics: {
            viewBoxX: 0,
            viewBoxY: 0,
            viewBoxWidth: template.previewWidth,
            viewBoxHeight: template.previewHeight,
            visualMinX: 0,
            visualMinY: 0,
            visualWidth: template.previewWidth,
            visualHeight: template.previewHeight,
          },
          pivot: { x: template.previewWidth / 2, y: template.previewHeight / 2, preset: "custom" },
          localTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
          zIndex: 0,
        }],
        rootTransform: null,
        activeAnimationClipId: null,
        activeStateMachineId: null,
        licenseMeta: {
          source: "test",
          author: "test",
          licenseType: "cc0",
          aiGenerated: false,
          commercialUseAllowed: true,
          purchaseRef: null,
          derivativePolicy: "unrestricted",
        },
        createdAt: 1,
        updatedAt: 2,
      }],
      activeEntityId: "entity-1",
    };

    expect(saveLastProjectSnapshot(project)).toBe(true);
    const restored = restoreLastProjectSnapshot() as Project | null;
    expect(restored?.entities[0]?.visuals).toEqual([]);
  });
});
