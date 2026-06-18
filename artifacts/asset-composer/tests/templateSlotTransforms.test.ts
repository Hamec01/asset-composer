import { describe, expect, it } from "vitest";

import { evaluateScene, evaluateSkeleton } from "../src/lib/evaluationPipeline";
import { getTemplateSlotTransformFromWorldCenter, getTemplateSlotWorldCenter } from "../src/lib/templateSlotTransforms";
import { transformPoint } from "../src/lib/matrixUtils";
import type { Entity, Item, PaletteTokens, Template } from "../src/domain/types";

const palette: PaletteTokens = {
  skin: "#c89a7b",
  hair: "#3b2314",
  primaryCloth: "#3c3a46",
  secondaryCloth: "#746a5e",
  metal: "#8e8a80",
  accent: "#b87333",
  outline: "#1a1a1a",
  shadow: "#00000033",
};

const license = {
  source: "test",
  author: "test",
  licenseType: "cc0" as const,
  aiGenerated: false,
  commercialUseAllowed: true,
  purchaseRef: null,
  derivativePolicy: "unrestricted",
};

function approx(actual: number, expected: number, msg: string): void {
  expect(Math.abs(actual - expected), `${msg}: expected ${expected}, got ${actual}`).toBeLessThan(1e-6);
}

describe("template slot transforms", () => {
it("slot world center matches evaluated item origin for rotated and scaled bones", () => {
  const template: Template = {
    id: "tmpl",
    name: "Template",
    description: "test",
    skeletonFamily: "humanoid_topdown_v1",
    viewProfile: "topdown_45",
    entityTypes: ["character"],
    bones: [
      {
        id: "root",
        name: "Root",
        parentId: null,
        restPose: { tx: 30, ty: 40, rotation: 45, scaleX: 2, scaleY: 1.5 },
        length: 10,
      },
    ],
    slots: [
      {
        id: "slot",
        name: "Slot",
        boneId: "root",
        zIndex: 10,
        allowedCategories: ["torso"],
        required: false,
        defaultItemId: null,
        defaultTransform: { x: 12, y: -6, rotation: 30, scaleX: 1.25, scaleY: 0.8 },
      },
    ],
    anchors: {},
    paletteTokens: palette,
    baseBodyLayers: [],
    boneParts: [],
    previewWidth: 128,
    previewHeight: 128,
    thumbnailSvg: "<svg xmlns=\"http://www.w3.org/2000/svg\"/>",
  };

  const entity: Entity = {
    id: "entity",
    name: "Entity",
    entityType: "character",
    templateId: template.id,
    styleSetId: "style",
    species: "",
    palette,
    slots: [
      {
        slotId: "slot",
        itemId: "item",
        paletteOverride: {},
        attachmentOverride: {},
      },
    ],
    visuals: [],
    rootTransform: null,
    activeAnimationClipId: null,
    activeStateMachineId: null,
    licenseMeta: license,
    createdAt: 0,
    updatedAt: 0,
  };

  const item: Item = {
    id: "item",
    name: "Item",
    description: "test",
    category: "torso",
    compatibility: {
      skeletonFamilies: [template.skeletonFamily],
      species: [],
      viewProfiles: [template.viewProfile],
    },
    allowedSlots: ["slot"],
    fitProfile: "standard",
    paletteChannels: [],
    hasOwnAnimation: false,
    animationClipId: null,
    anchorRules: {},
    svgLayers: [],
    parts: [
      {
        id: "part",
        boneId: "root",
        svgData: "<svg xmlns=\"http://www.w3.org/2000/svg\"/>",
        metrics: {
          viewBoxX: 0,
          viewBoxY: 0,
          viewBoxWidth: 32,
          viewBoxHeight: 32,
          visualMinX: 0,
          visualMinY: 0,
          visualWidth: 16,
          visualHeight: 16,
        },
        pivot: { x: 0, y: 0, preset: "custom" },
        localTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        coordinateMode: "bone_local",
        zOffset: 0,
      },
    ],
    coordinateMode: "bone_local",
    licenseMeta: license,
    tags: [],
  };

  const skeleton = evaluateSkeleton(template.bones, new Map());
  const scene = evaluateScene(entity, template, skeleton, [item]);
  const visual = scene.visuals.find(v => v.sourceKind === "item-part");
  expect(visual).toBeTruthy();

  const slotDef = template.slots[0];
  const bone = skeleton.bones.get(slotDef.boneId);
  const center = getTemplateSlotWorldCenter(slotDef, bone);
  const visualOrigin = transformPoint(visual!.worldMatrix, 0, 0);

  approx(center.x, visualOrigin.x, "slot x should match evaluated item origin");
  approx(center.y, visualOrigin.y, "slot y should match evaluated item origin");

  const naiveX = (bone?.x ?? 0) + (slotDef.defaultTransform?.x ?? 0);
  const naiveY = (bone?.y ?? 0) + (slotDef.defaultTransform?.y ?? 0);
  expect(naiveX).not.toBe(center.x);
  expect(naiveY).not.toBe(center.y);
});

it("world-center roundtrip preserves slot rotation and scale", () => {
  const slotDef = {
    id: "slot",
    name: "Slot",
    boneId: "root",
    zIndex: 1,
    allowedCategories: ["torso"],
    required: false,
    defaultItemId: null,
    defaultTransform: { x: 8, y: 3, rotation: 25, scaleX: 1.5, scaleY: 0.75 },
  } as Template["slots"][number];

  const bone = { x: 50, y: 80, rotation: -30, scaleX: 2, scaleY: 0.5 };
  const movedWorldCenter = { x: 91, y: 77 };
  const nextTransform = getTemplateSlotTransformFromWorldCenter(slotDef, bone, movedWorldCenter);

  expect(nextTransform.rotation).toBe(slotDef.defaultTransform?.rotation);
  expect(nextTransform.scaleX).toBe(slotDef.defaultTransform?.scaleX);
  expect(nextTransform.scaleY).toBe(slotDef.defaultTransform?.scaleY);

  const updatedSlotDef = { ...slotDef, defaultTransform: nextTransform };
  const nextCenter = getTemplateSlotWorldCenter(updatedSlotDef, bone);
  approx(nextCenter.x, movedWorldCenter.x, "roundtrip x should land on dragged world point");
  approx(nextCenter.y, movedWorldCenter.y, "roundtrip y should land on dragged world point");
});
});
