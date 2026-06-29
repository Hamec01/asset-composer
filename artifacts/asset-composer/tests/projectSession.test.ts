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

  it("restores explicit rig/view template metadata from the last snapshot", () => {
    const project = makeProject();
    expect(saveLastProjectSnapshot(project)).toBe(true);

    const restored = restoreLastProjectSnapshot() as Project | null;
    const template = restored?.templates.find(candidate => candidate.id === "humanoid_topdown_v1");

    expect(template?.rigFamilyId).toBe("biped_directional_v1");
    expect(template?.defaultFacing).toBe("south_east");
    expect(template?.views?.south_east?.viewProfile).toBe("topdown_45");
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

  it("roundtrips body morphs and face customization through last-session storage", () => {
    const template = TEMPLATES.find(candidate => candidate.id === "humanoid_topdown_v1")!;
    const project: Project = {
      ...makeProject(),
      entities: [{
        id: "entity-face-morph",
        name: "Morph Hero",
        entityType: "character",
        templateId: template.id,
        styleSetId: "style_default",
        species: "",
        palette: template.paletteTokens,
        slots: [],
        visuals: [],
        bodyMorphs: {
          headSize: 1.2,
          neckLength: 1.1,
          torsoHeight: 0.92,
          torsoWidth: 1.08,
          armLength: 1.14,
          forearmLength: 0.96,
          handSize: 1.05,
          legLength: 1.18,
          shinLength: 0.9,
          footSize: 1.12,
          pelvisWidth: 1.04,
          overallHeightScale: 1.06,
        },
        bodyMorphPresetId: "heroic",
        bodyAuthoring: {
          focusRegion: "legs",
          activeBoneId: "hip_l",
          activeSlotId: "slot_foot_l",
          intent: "preview",
          viewportMode: "full_body",
          regionPresetIds: {
            legs: "legs_long_legs",
            torso: "torso_broad_torso",
          },
        },
        faceCustomization: {
          eyes: {
            presetId: "sleepy",
            color: "#332211",
            visible: true,
            transform: { x: 2, y: -1, rotation: 4, scaleX: 1.1, scaleY: 0.95 },
          },
          mouth: {
            presetId: "soft_smile",
            color: "#120F0C",
            visible: true,
            transform: { x: 0, y: 1.4, rotation: 0, scaleX: 1, scaleY: 1 },
          },
          brows: {
            presetId: "stern",
            color: "#2B1D18",
            visible: true,
            transform: { x: 0, y: -3, rotation: 0, scaleX: 1, scaleY: 1 },
          },
          beard: {
            presetId: "short_goatee",
            color: "#2B1D18",
            visible: true,
            transform: { x: 0, y: 4, rotation: 0, scaleX: 1, scaleY: 1 },
          },
          hair: {
            presetId: "fringe_short",
            color: "#1A1208",
            visible: true,
            transform: { x: 0, y: -8, rotation: 0, scaleX: 1, scaleY: 1 },
          },
          overlays: [{
            id: "overlay-1",
            name: "Scar",
            overlayRole: "line",
            symmetryMode: "none",
            paintTarget: "stroke",
            svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M4 4 L16 16" stroke="#ff0000" stroke-width="2"/></svg>`,
            zOffset: 90,
            pivot: { x: 10, y: 10, preset: "custom" },
            metrics: {
              viewBoxX: 0,
              viewBoxY: 0,
              viewBoxWidth: 20,
              viewBoxHeight: 20,
              visualMinX: 4,
              visualMinY: 4,
              visualWidth: 12,
              visualHeight: 12,
            },
            localTransform: { x: 1, y: -2, rotation: 8, scaleX: 1, scaleY: 1 },
            source: {
              format: "svg",
              name: "Scar",
              originalFileName: "scar.svg",
              mimeType: "image/svg+xml",
            },
            editorDocumentId: "overlay-doc-1",
            featureTag: "beard",
          }],
        },
        faceAuthoring: {
          activeFeatureKey: "beard",
          overlayFilter: "beard",
          selectedOverlayId: "overlay-face-1",
          activeBoneId: "head",
          activeSlotId: "slot_beard",
          workflowMode: "overlay",
          draftOverlayRole: "shadow",
          draftPaintTarget: "fill",
          draftSymmetryMode: "mirror_x",
          overlayRoleFilter: "line",
          paintTargetFilter: "stroke",
          overlayGrouping: "feature_role_paint",
          drawMode: "fill",
          focusMode: "head",
        },
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
      activeEntityId: "entity-face-morph",
    };

    expect(saveLastProjectSnapshot(project)).toBe(true);
    const restored = restoreLastProjectSnapshot() as Project | null;
    const entity = restored?.entities[0];

    expect(entity?.bodyMorphs?.headSize).toBe(1.2);
    expect(entity?.bodyMorphs?.legLength).toBe(1.18);
    expect(entity?.bodyMorphPresetId).toBe("heroic");
    expect(entity?.bodyAuthoring?.focusRegion).toBe("legs");
    expect(entity?.bodyAuthoring?.activeBoneId).toBe("hip_l");
    expect(entity?.bodyAuthoring?.activeSlotId).toBe("slot_foot_l");
    expect(entity?.bodyAuthoring?.intent).toBe("preview");
    expect(entity?.bodyAuthoring?.viewportMode).toBe("full_body");
    expect(entity?.bodyAuthoring?.regionPresetIds?.legs).toBe("legs_long_legs");
    expect(entity?.faceCustomization?.eyes.presetId).toBe("sleepy");
    expect(entity?.faceCustomization?.eyes.transform.x).toBe(2);
    expect(entity?.faceCustomization?.beard.visible).toBe(true);
    expect(entity?.faceCustomization?.hair.presetId).toBe("fringe_short");
    expect(entity?.faceCustomization?.overlays).toHaveLength(1);
    expect(entity?.faceCustomization?.overlays[0]?.name).toBe("Scar");
    expect(entity?.faceCustomization?.overlays[0]?.editorDocumentId).toBe("overlay-doc-1");
    expect(entity?.faceCustomization?.overlays[0]?.featureTag).toBe("beard");
    expect(entity?.faceCustomization?.overlays[0]?.overlayRole).toBe("line");
    expect(entity?.faceCustomization?.overlays[0]?.paintTarget).toBe("stroke");
    expect(entity?.faceAuthoring?.activeFeatureKey).toBe("beard");
    expect(entity?.faceAuthoring?.overlayFilter).toBe("beard");
    expect(entity?.faceAuthoring?.selectedOverlayId).toBe("overlay-face-1");
    expect(entity?.faceAuthoring?.activeBoneId).toBe("head");
    expect(entity?.faceAuthoring?.activeSlotId).toBe("slot_beard");
    expect(entity?.faceAuthoring?.workflowMode).toBe("overlay");
    expect(entity?.faceAuthoring?.draftOverlayRole).toBe("shadow");
    expect(entity?.faceAuthoring?.draftPaintTarget).toBe("fill");
    expect(entity?.faceAuthoring?.draftSymmetryMode).toBe("mirror_x");
    expect(entity?.faceAuthoring?.overlayRoleFilter).toBe("line");
    expect(entity?.faceAuthoring?.paintTargetFilter).toBe("stroke");
    expect(entity?.faceAuthoring?.overlayGrouping).toBe("feature_role_paint");
    expect(entity?.faceAuthoring?.drawMode).toBe("fill");
    expect(entity?.faceAuthoring?.focusMode).toBe("head");
  });

  it("roundtrips sprite editor documents and active authoring mode through last-session storage", () => {
    const project: Project = {
      ...makeProject(),
      editorMeta: {
        spriteEditorDocuments: [{
          id: "doc-1",
          name: "Armor Plate",
          width: 64,
          height: 64,
          pivot: { x: 32, y: 56, preset: "feet" },
          referenceAsset: {
            format: "png",
            name: "armor_ref",
            originalFileName: "armor_ref.png",
            mimeType: "image/png",
            dataUri: "data:image/png;base64,AAAA",
          },
          layers: [{
            id: "layer-1",
            name: "Layer 1",
            visible: true,
            zIndex: 0,
            shapes: [{
              id: "shape-1",
              type: "rect",
              x: 12,
              y: 8,
              width: 30,
              height: 40,
              rotation: 6,
              fill: "#746A5E",
              stroke: "#1A1208",
              strokeWidth: 1.5,
            }],
          }],
          authoringHint: {
            faceFeatureKey: "generic",
            faceOverlayRole: "detail",
            symmetryMode: "mirror_x",
            paintTarget: "both",
            bodyMorphPresetId: "heroic",
          },
          target: {
            kind: "item-part",
            entityId: "entity-1",
            itemId: "item-1",
            partId: "part-1",
          },
          updatedAt: 123,
        }],
        activeSpriteDocumentId: "doc-1",
        activeAuthoringMode: "sprite-editor",
        activeFaceCanvasOverlayId: "overlay-1",
        activeFaceCanvasTool: "pencil",
        activeFaceCanvasFocusMode: "head",
      },
    };

    expect(saveLastProjectSnapshot(project)).toBe(true);
    const restored = restoreLastProjectSnapshot() as Project | null;
    const doc = restored?.editorMeta?.spriteEditorDocuments?.[0];

    expect(doc?.id).toBe("doc-1");
    expect(doc?.layers[0]?.shapes[0]?.width).toBe(30);
    expect(doc?.referenceAsset?.format).toBe("png");
    expect(doc?.authoringHint?.bodyMorphPresetId).toBe("heroic");
    expect(doc?.authoringHint?.symmetryMode).toBe("mirror_x");
    expect(doc?.authoringHint?.paintTarget).toBe("both");
    expect(restored?.editorMeta?.activeSpriteDocumentId).toBe("doc-1");
    expect(restored?.editorMeta?.activeAuthoringMode).toBe("sprite-editor");
    expect(restored?.editorMeta?.activeFaceCanvasOverlayId).toBe("overlay-1");
    expect(restored?.editorMeta?.activeFaceCanvasTool).toBe("pencil");
    expect(restored?.editorMeta?.activeFaceCanvasFocusMode).toBe("head");
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
