import { describe, expect, it } from "vitest";

import { ITEMS } from "../src/data/items";
import { PRESET_ANIMATIONS } from "../src/data/presetAnimations";
import { TEMPLATES } from "../src/data/templates";
import { ProjectSchema } from "../src/domain/schema";
import type { Entity, Item, LocalTransform, Project, Template } from "../src/domain/types";
import { buildMultiClipPose, evaluateScene, evaluateSkeleton, evaluateRestSkeleton } from "../src/lib/evaluationPipeline";

const template = TEMPLATES.find(t => t.id === "humanoid_topdown_v1")!;
const boots = ITEMS.find(i => i.id === "boots_leather")!;
const pants = ITEMS.find(i => i.id === "pants_leather")!;

const palette = template.paletteTokens;
const license = {
  source: "test",
  author: "test",
  licenseType: "cc0" as const,
  aiGenerated: false,
  commercialUseAllowed: true,
  purchaseRef: null,
  derivativePolicy: "unrestricted",
};

function makeEntity(slotId: string, itemId: string): Entity {
  return {
    id: `entity_${slotId}`,
    name: "Test Entity",
    entityType: "character",
    templateId: template.id,
    styleSetId: "style_default",
    species: "",
    palette,
    slots: [{
      slotId,
      itemId,
      paletteOverride: {},
      attachmentOverride: {},
    }],
    visuals: [],
    rootTransform: null,
    activeAnimationClipId: null,
    activeStateMachineId: null,
    licenseMeta: license,
    createdAt: 0,
    updatedAt: 0,
  };
}

function withSlotTransform(baseTemplate: Template, slotId: string, transform: LocalTransform | undefined): Template {
  return {
    ...baseTemplate,
    slots: baseTemplate.slots.map(slot => (
      slot.id === slotId
        ? { ...slot, defaultTransform: transform }
        : { ...slot }
    )),
  };
}

function sceneFor(item: Item, slotId: string, tpl: Template, pose = new Map()) {
  const entity = makeEntity(slotId, item.id);
  const skeleton = evaluateSkeleton(tpl.bones, pose);
  return evaluateScene(entity, tpl, skeleton, ITEMS);
}

function itemVisuals(scene: ReturnType<typeof evaluateScene>, itemId: string) {
  return scene.visuals.filter(visual => visual.itemId === itemId);
}

describe("M8 vertical slice items", () => {
  it("evaluates left and right boots on different foot bones", () => {
    expect(boots.coordinateMode).toBe("bone_local");
    expect(boots.parts?.map(part => [part.id, part.boneId])).toEqual([
      ["boot_l", "foot_l"],
      ["boot_r", "foot_r"],
    ]);

    const restScene = sceneFor(boots, "slot_feet", template);
    const restVisuals = itemVisuals(restScene, boots.id);
    expect(restVisuals).toHaveLength(2);
    expect(restVisuals.map(visual => visual.partId).sort()).toEqual(["boot_l", "boot_r"]);

    const walkPose = new Map([
      ["foot_l", { tx: -3, ty: 2, rotation: -18, scaleX: 1, scaleY: 1 }],
      ["foot_r", { tx: 4, ty: -1, rotation: 16, scaleX: 1, scaleY: 1 }],
    ]);
    const walkScene = sceneFor(boots, "slot_feet", template, walkPose);
    const byPart = new Map(itemVisuals(walkScene, boots.id).map(visual => [visual.partId!, visual]));
    const restByPart = new Map(restVisuals.map(visual => [visual.partId!, visual]));

    expect(byPart.get("boot_l")?.worldMatrix).not.toEqual(restByPart.get("boot_l")?.worldMatrix);
    expect(byPart.get("boot_r")?.worldMatrix).not.toEqual(restByPart.get("boot_r")?.worldMatrix);
    expect(byPart.get("boot_l")?.worldMatrix).not.toEqual(byPart.get("boot_r")?.worldMatrix);

    const shiftedTemplate = withSlotTransform(template, "slot_feet", {
      x: 5,
      y: -4,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    });
    const shiftedScene = sceneFor(boots, "slot_feet", shiftedTemplate);
    const shiftedByPart = new Map(itemVisuals(shiftedScene, boots.id).map(visual => [visual.partId!, visual]));
    expect(shiftedByPart.get("boot_l")?.worldMatrix).not.toEqual(restByPart.get("boot_l")?.worldMatrix);
    expect(shiftedByPart.get("boot_r")?.worldMatrix).not.toEqual(restByPart.get("boot_r")?.worldMatrix);
  });

  it("evaluates pants parts on pelvis, hip and knee bones", () => {
    expect(pants.coordinateMode).toBe("bone_local");
    expect(pants.parts?.map(part => [part.id, part.boneId])).toEqual([
      ["waist", "pelvis"],
      ["thigh_l", "hip_l"],
      ["shin_l", "knee_l"],
      ["thigh_r", "hip_r"],
      ["shin_r", "knee_r"],
    ]);

    const restScene = sceneFor(pants, "slot_legs", template);
    const restVisuals = itemVisuals(restScene, pants.id);
    expect(restVisuals).toHaveLength(5);

    const runPose = new Map([
      ["pelvis", { tx: 0, ty: -2, rotation: 4, scaleX: 1, scaleY: 1 }],
      ["hip_l", { tx: -3, ty: 1, rotation: -14, scaleX: 1, scaleY: 1 }],
      ["knee_l", { tx: -2, ty: 3, rotation: 18, scaleX: 1, scaleY: 1 }],
      ["hip_r", { tx: 3, ty: -1, rotation: 12, scaleX: 1, scaleY: 1 }],
      ["knee_r", { tx: 1, ty: 2, rotation: -16, scaleX: 1, scaleY: 1 }],
    ]);
    const runScene = sceneFor(pants, "slot_legs", template, runPose);
    const runByPart = new Map(itemVisuals(runScene, pants.id).map(visual => [visual.partId!, visual]));
    const restByPart = new Map(restVisuals.map(visual => [visual.partId!, visual]));

    expect(runByPart.get("waist")?.worldMatrix).not.toEqual(restByPart.get("waist")?.worldMatrix);
    expect(runByPart.get("thigh_l")?.worldMatrix).not.toEqual(restByPart.get("thigh_l")?.worldMatrix);
    expect(runByPart.get("shin_l")?.worldMatrix).not.toEqual(restByPart.get("shin_l")?.worldMatrix);
    expect(runByPart.get("thigh_r")?.worldMatrix).not.toEqual(restByPart.get("thigh_r")?.worldMatrix);
    expect(runByPart.get("shin_r")?.worldMatrix).not.toEqual(restByPart.get("shin_r")?.worldMatrix);

    const shiftedTemplate = withSlotTransform(template, "slot_legs", {
      x: -2,
      y: 3,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    });
    const shiftedScene = sceneFor(pants, "slot_legs", shiftedTemplate);
    const shiftedByPart = new Map(itemVisuals(shiftedScene, pants.id).map(visual => [visual.partId!, visual]));
    for (const partId of ["waist", "thigh_l", "shin_l", "thigh_r", "shin_r"]) {
      expect(shiftedByPart.get(partId)?.worldMatrix).not.toEqual(restByPart.get(partId)?.worldMatrix);
    }
  });

  it("moves every leather pants part with its assigned animated bone", () => {
    const entity = makeEntity("slot_legs", pants.id);
    const runClip = PRESET_ANIMATIONS.find(clip => clip.id === "humanoid_topdown_v1__run");
    expect(runClip).toBeTruthy();

    const restScene = evaluateScene(entity, template, evaluateRestSkeleton(template.bones), ITEMS);
    const runPose = buildMultiClipPose(
      PRESET_ANIMATIONS,
      runClip!.id,
      null,
      null,
      1,
      125,
      entity,
      ITEMS,
    );
    const runScene = evaluateScene(entity, template, evaluateSkeleton(template.bones, runPose), ITEMS);

    const restByPart = new Map(itemVisuals(restScene, pants.id).map(visual => [visual.partId!, visual]));
    const runByPart = new Map(itemVisuals(runScene, pants.id).map(visual => [visual.partId!, visual]));

    expect(runByPart.size).toBe(5);
    expect(runByPart.get("waist")?.worldMatrix).not.toEqual(restByPart.get("waist")?.worldMatrix);

    const movedLegPartIds = ["thigh_l", "shin_l", "thigh_r", "shin_r"].filter(partId => (
      runByPart.get(partId)?.worldMatrix !== restByPart.get(partId)?.worldMatrix &&
      JSON.stringify(runByPart.get(partId)?.worldMatrix) !== JSON.stringify(restByPart.get(partId)?.worldMatrix)
    ));
    expect(movedLegPartIds.length).toBeGreaterThanOrEqual(4);
  });

  it("hides covered skin leg body parts when leather pants are equipped", () => {
    const scene = sceneFor(pants, "slot_legs", template);
    const ids = new Set(scene.visuals.map(visual => visual.id));

    expect(ids.has("part__pelvis")).toBe(false);
    expect(ids.has("part__hip_l")).toBe(false);
    expect(ids.has("part__hip_r")).toBe(false);
    expect(ids.has("part__knee_l")).toBe(false);
    expect(ids.has("part__knee_r")).toBe(false);
    expect(itemVisuals(scene, pants.id)).toHaveLength(5);
  });

  it("does not hide skin legs for legacy-only leg overlays", () => {
    const legacyPants: Item = {
      ...pants,
      id: "custom_legacy_pants",
      coordinateMode: "legacy_full_frame",
      parts: [],
    };
    const scene = evaluateScene(
      makeEntity("slot_legs", legacyPants.id),
      template,
      evaluateRestSkeleton(template.bones),
      [legacyPants],
    );
    const ids = new Set(scene.visuals.map(visual => visual.id));

    expect(ids.has("part__pelvis")).toBe(true);
    expect(ids.has("part__hip_l")).toBe(true);
    expect(ids.has("part__hip_r")).toBe(true);
    expect(ids.has("part__knee_l")).toBe(true);
    expect(ids.has("part__knee_r")).toBe(true);
  });

  it("does not emit legacy svgLayers when V2 parts are present", () => {
    const bootsScene = sceneFor(boots, "slot_feet", template);
    const pantsScene = sceneFor(pants, "slot_legs", template);

    expect(itemVisuals(bootsScene, boots.id)).toHaveLength(boots.parts?.length ?? 0);
    expect(itemVisuals(pantsScene, pants.id)).toHaveLength(pants.parts?.length ?? 0);
  });

  it("prefers V2 parts over legacy svgLayers for leather pants", () => {
    const scene = sceneFor(pants, "slot_legs", template);
    const visuals = itemVisuals(scene, pants.id);

    expect(visuals).toHaveLength(5);
    expect(visuals.map(visual => visual.partId).sort()).toEqual([
      "waist",
      "thigh_l",
      "shin_l",
      "thigh_r",
      "shin_r",
    ].sort());
    expect(visuals.filter(visual => visual.partId === "thumb" || visual.partId === "layer_0")).toHaveLength(0);
  });

  it("heals stale built-in leather pants data at runtime", () => {
    const stalePants: Item = {
      ...pants,
      coordinateMode: "legacy_full_frame",
      parts: [],
      svgLayers: [{
        id: "legacy_layer",
        svgData: "<svg viewBox='0 0 64 64'></svg>",
        zOffset: 0,
      }],
    };

    const entity = makeEntity("slot_legs", pants.id);
    const skeleton = evaluateRestSkeleton(template.bones);
    const healedScene = evaluateScene(entity, template, skeleton, [stalePants]);

    expect(itemVisuals(healedScene, pants.id)).toHaveLength(5);
    expect(itemVisuals(healedScene, pants.id).map(visual => visual.partId).sort()).toEqual([
      "waist",
      "thigh_l",
      "shin_l",
      "thigh_r",
      "shin_r",
    ].sort());
  });

  it("round-trips V2 boots and pants through ProjectSchema", () => {
    const project: Project = {
      id: "project",
      version: "2.0.0",
      name: "Test",
      description: "V2 item roundtrip",
      entities: [makeEntity("slot_feet", boots.id), makeEntity("slot_legs", pants.id)],
      templates: [template],
      items: [boots, pants],
      animationClips: [],
      stateMachines: [],
      styleSets: [],
      exportProfiles: [],
      activeEntityId: "entity_slot_feet",
      createdAt: 0,
      updatedAt: 0,
    };

    const parsed = ProjectSchema.parse(project);
    const parsedBoots = parsed.items.find(item => item.id === boots.id)!;
    const parsedPants = parsed.items.find(item => item.id === pants.id)!;

    expect(parsedBoots.coordinateMode).toBe("bone_local");
    expect(parsedPants.coordinateMode).toBe("bone_local");
    expect(parsedBoots.parts.map(part => part.id)).toEqual(["boot_l", "boot_r"]);
    expect(parsedPants.parts.map(part => part.id)).toEqual(["waist", "thigh_l", "shin_l", "thigh_r", "shin_r"]);
    expect(parsedBoots.svgLayers).toHaveLength(1);
    expect(parsedPants.svgLayers).toHaveLength(1);
  });

  it("keeps canonical visual ordering stable for rest-pose renderers", () => {
    const bootsScene = evaluateScene(makeEntity("slot_feet", boots.id), template, evaluateRestSkeleton(template.bones), ITEMS);
    const pantsScene = evaluateScene(makeEntity("slot_legs", pants.id), template, evaluateRestSkeleton(template.bones), ITEMS);

    expect(bootsScene.visuals.every((visual, index, arr) => index === 0 || arr[index - 1].zIndex <= visual.zIndex)).toBe(true);
    expect(pantsScene.visuals.every((visual, index, arr) => index === 0 || arr[index - 1].zIndex <= visual.zIndex)).toBe(true);
    expect(bootsScene.visuals.every(visual => visual.localBounds.maxX > visual.localBounds.minX)).toBe(true);
    expect(pantsScene.visuals.every(visual => visual.localBounds.maxY > visual.localBounds.minY)).toBe(true);
  });
});
