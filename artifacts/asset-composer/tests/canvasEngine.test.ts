import { beforeEach, describe, expect, it, vi } from "vitest";

import { ITEMS } from "../src/data/items";
import { CanvasEngine } from "../src/engine/canvasEngine";
import type { EvaluatedScene } from "../src/lib/evaluationPipeline";
import { localTransformToMatrix, multiply } from "../src/lib/matrixUtils";

function makeScene(svgData = "<svg/>", tx = 0): EvaluatedScene {
  return {
    entityId: "entity",
    templateId: "template",
    skeletonFamily: "humanoid_topdown_v1",
    visuals: [{
      id: "visual-1",
      svgData,
      zIndex: 10,
      worldMatrix: [1, 0, 0, 1, tx, 0],
      localBounds: { minX: -5, minY: -5, maxX: 5, maxY: 5 },
      worldBounds: { minX: tx - 5, minY: -5, maxX: tx + 5, maxY: 5 },
      sourceKind: "item-part",
      slotId: "slot_hair",
      itemId: "hair_test_v2",
      partId: "crown",
      svgFitMode: "v2_vector",
    }],
    layers: [],
    skeleton: { bones: new Map() },
  };
}

function makeEngineHarness() {
  let activeObject: any = null;
  const objects: any[] = [];
  const fakeCanvas = {
    add: vi.fn((object: any) => { objects.push(object); }),
    remove: vi.fn((object: any) => {
      const index = objects.indexOf(object);
      if (index >= 0) objects.splice(index, 1);
    }),
    clear: vi.fn(),
    requestRenderAll: vi.fn(),
    discardActiveObject: vi.fn(() => { activeObject = null; }),
    setActiveObject: vi.fn((object: any) => { activeObject = object; }),
    getActiveObject: vi.fn(() => activeObject),
    getObjects: vi.fn(() => objects),
    moveObjectTo: vi.fn((object: any, target: number) => {
      const index = objects.indexOf(object);
      if (index < 0) return;
      objects.splice(index, 1);
      objects.splice(target, 0, object);
    }),
    getWidth: vi.fn(() => 100),
    getHeight: vi.fn(() => 100),
    setViewportTransform: vi.fn(),
  };

  const engine = Object.create(CanvasEngine.prototype) as any;
  engine.canvas = fakeCanvas;
  engine.opts = {};
  engine.mode = "select";
  engine.fabricImages = new Map();
  engine.svgCache = new Map();
  engine.pendingAnimatedVisuals = new Set();
  engine.slotZones = new Map();
  engine.anchorGizmos = new Map();
  engine.slotLabels = new Map();
  engine.currentScene = null;
  engine.currentTemplate = { id: "template", slots: [], anchors: {}, previewWidth: 64, previewHeight: 64 };
  engine.currentItems = [];
  engine.currentFitProfiles = [];
  engine.currentEntity = null;
  engine.currentEntityId = "entity";
  engine.isTransforming = false;
  engine.pendingReconcile = null;
  engine.reconcileGeneration = 0;
  engine.pointerDownAt = null;
  engine.activeAttachmentGesture = null;
  engine.activeSlotGesture = null;
  engine._rebuildSlotZones = vi.fn();
  engine._rebuildAnchorGizmos = vi.fn();
  engine._sortCanvasObjects = vi.fn();

  const loadVisual = vi.fn(async (visual: any) => {
    const object = {
      __visualId: visual.id,
      __sourceKind: visual.sourceKind,
      __slotId: visual.slotId,
      __itemId: visual.itemId,
      __partId: visual.partId,
      set: vi.fn(),
      setCoords: vi.fn(),
    };
    engine.fabricImages.set(visual.id, object);
    engine.svgCache.set(visual.id, visual.svgData);
    fakeCanvas.add(object);
  });
  engine._loadVisual = loadVisual;

  return { engine, fakeCanvas, loadVisual };
}

describe("CanvasEngine persistent reconcile", () => {
  it("shows and hides animated parts even when playback starts without them", async () => {
    const { engine, fakeCanvas } = makeEngineHarness();
    const absent = { ...makeScene(), visuals: [] };
    await engine.reconcileSceneStructure(absent, engine.currentTemplate, null, []);
    engine.updateSceneTransforms(makeScene());
    await new Promise(resolve => setTimeout(resolve, 0));
    const image = engine.fabricImages.get("visual-1");
    expect(image.set).toHaveBeenLastCalledWith(expect.objectContaining({ visible: true }));
    engine.updateSceneTransforms(absent);
    expect(image.set).toHaveBeenLastCalledWith({ visible: false });
    engine.updateSceneTransforms(makeScene());
    expect(image.set).toHaveBeenLastCalledWith(expect.objectContaining({ visible: true }));
    expect(fakeCanvas.getObjects()).toHaveLength(1);
  });
  it("does not resurrect a projectile decoded after its release frame", async () => {
    const { engine, loadVisual } = makeEngineHarness();
    const absent = { ...makeScene(), visuals: [] };
    await engine.reconcileSceneStructure(absent, engine.currentTemplate, null, []);
    let finish!: () => void;
    engine._loadVisual = async (visual: any) => {
      await new Promise<void>(resolve => { finish = resolve; });
      await loadVisual(visual);
    };
    engine.updateSceneTransforms(makeScene());
    engine.updateSceneTransforms(absent);
    finish();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(engine.fabricImages.get("visual-1").set).toHaveBeenLastCalledWith({ visible: false });
    expect(engine.pendingAnimatedVisuals.size).toBe(0);
  });
  it("drains the final paused frame after an earlier dynamic SVG finishes decoding", async () => {
    const { engine, loadVisual, fakeCanvas } = makeEngineHarness();
    await engine.reconcileSceneStructure(makeScene(), engine.currentTemplate, null, []);
    let finish!: () => void;
    engine._loadVisual = async (visual: any) => {
      if (visual.svgData === "<svg id='drawing'/>") {
        await new Promise<void>(resolve => { finish = resolve; });
      }
      await loadVisual(visual);
    };
    engine.updateSceneTransforms(makeScene("<svg id='drawing'/>", 10));
    engine.updateSceneTransforms(makeScene("<svg id='released'/>", 30));
    finish();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(engine.svgCache.get("visual-1")).toBe("<svg id='released'/>");
    expect(fakeCanvas.getObjects()).toHaveLength(1);
    expect(engine.fabricImages.get("visual-1").set).toHaveBeenLastCalledWith(expect.objectContaining({left: 30}));
    expect(engine.pendingAnimatedVisuals.size).toBe(0);
  });
  it("keeps the latest pose when artwork finishes loading after a seek", async () => {
    const { engine, loadVisual } = makeEngineHarness();
    let finish!: () => void;
    engine._loadVisual = async (visual: any) => {
      await new Promise<void>(resolve => { finish = resolve; });
      await loadVisual(visual);
    };
    const pending = engine.reconcileSceneStructure(makeScene(), engine.currentTemplate, null, []);
    engine.updateSceneTransforms(makeScene("<svg/>", 42));
    finish();
    await pending;
    const image = engine.fabricImages.get("visual-1");
    expect(image.set).toHaveBeenLastCalledWith(expect.objectContaining({left: 42}));
  });
  it("refreshes deformed artwork on playback ticks without leaving duplicate images", async () => {
    const {engine,fakeCanvas,loadVisual}=makeEngineHarness();
    await engine.reconcileSceneStructure(makeScene(),engine.currentTemplate,null,[]);
    engine.updateSceneTransforms(makeScene('<svg><path d="M0 0 L5 2 L0 9"/></svg>'));
    await new Promise(resolve=>setTimeout(resolve,0));
    expect(loadVisual).toHaveBeenCalledTimes(2);
    expect(fakeCanvas.getObjects()).toHaveLength(1);
    expect(engine.svgCache.get("visual-1")).toContain("L5 2");
  });
  it("sorts asynchronous artwork and updates cached depth when changing view", async () => {
    const { engine, fakeCanvas, loadVisual } = makeEngineHarness();
    engine._sortCanvasObjects = (CanvasEngine.prototype as any)._sortCanvasObjects;
    const first = makeScene();
    first.visuals = [
      { ...first.visuals[0], id: "far-arm", zIndex: -920 },
      { ...first.visuals[0], id: "torso", zIndex: -840 },
      { ...first.visuals[0], id: "near-arm", zIndex: -813 },
    ];
    const originalLoad = engine._loadVisual;
    engine._loadVisual = async (visual: any, generation: number) => {
      if (visual.id === "far-arm") await new Promise(resolve => setTimeout(resolve, 10));
      await originalLoad(visual, generation);
    };
    await engine.reconcileSceneStructure(first, engine.currentTemplate, null, []);
    expect(fakeCanvas.getObjects().map((object: any) => object.__visualId)).toEqual(["far-arm", "torso", "near-arm"]);
    const second = { ...first, visuals: first.visuals.map(visual => ({ ...visual, zIndex: visual.id === "far-arm" ? -800 : visual.zIndex })) };
    await engine.reconcileSceneStructure(second, engine.currentTemplate, null, []);
    expect(loadVisual).toHaveBeenCalledTimes(3);
    expect(fakeCanvas.getObjects().map((object: any) => object.__visualId)).toEqual(["torso", "near-arm", "far-arm"]);
    engine.updateSceneTransforms(first);
    expect(fakeCanvas.getObjects().map((object: any) => object.__visualId)).toEqual(["far-arm", "torso", "near-arm"]);
  });
  it("applies reflection explicitly without repeated negative-scale flip toggles", async () => {
    const { engine } = makeEngineHarness();
    const scene = makeScene();
    scene.visuals[0].worldMatrix = [-1, 0, 0, 1, 0, 0];
    await engine.reconcileSceneStructure(scene, engine.currentTemplate, null, []);
    const image = engine.fabricImages.get("visual-1");
    engine.updateSceneTransforms(scene);
    engine.updateSceneTransforms(scene);
    const updates = image.set.mock.calls
      .map((call: any[]) => call[0])
      .filter((update: any) => typeof update.scaleX === "number");
    expect(updates.length).toBeGreaterThanOrEqual(2);
    for (const update of updates) {
      expect(update.scaleX).toBeGreaterThan(0);
      expect(update.scaleY).toBeGreaterThan(0);
      expect(update.flipY).toBe(true);
    }
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reuses Fabric object identity between animation ticks", async () => {
    const { engine, loadVisual } = makeEngineHarness();
    const firstScene = makeScene("<svg id='a'/>", 0);
    await engine.reconcileSceneStructure(firstScene, engine.currentTemplate, null, [], [], null);
    const firstObject = engine.fabricImages.get("visual-1");

    await engine.reconcileSceneStructure(makeScene("<svg id='a'/>", 24), engine.currentTemplate, null, [], [], null);

    expect(loadVisual).toHaveBeenCalledTimes(1);
    expect(engine.fabricImages.get("visual-1")).toBe(firstObject);
  });

  it("removes stale Fabric objects", async () => {
    const { engine, fakeCanvas } = makeEngineHarness();
    const staleObject = { __visualId: "stale", set: vi.fn(), setCoords: vi.fn() };
    engine.fabricImages.set("stale", staleObject);
    engine.svgCache.set("stale", "<svg id='stale'/>");

    await engine.reconcileSceneStructure({ ...makeScene(), visuals: [] }, engine.currentTemplate, null, [], [], null);

    expect(fakeCanvas.remove).toHaveBeenCalledWith(staleObject);
    expect(engine.fabricImages.has("stale")).toBe(false);
    expect(engine.svgCache.has("stale")).toBe(false);
  });

  it("keeps selection when visual ID remains but SVG source changes", async () => {
    const { engine, fakeCanvas } = makeEngineHarness();
    await engine.reconcileSceneStructure(makeScene("<svg id='a'/>", 0), engine.currentTemplate, null, [], [], null);
    const firstObject = engine.fabricImages.get("visual-1");
    fakeCanvas.setActiveObject(firstObject);

    await engine.reconcileSceneStructure(makeScene("<svg id='b'/>", 0), engine.currentTemplate, null, [], [], null);

    const nextObject = engine.fabricImages.get("visual-1");
    expect(nextObject).not.toBe(firstObject);
    expect(engine.fabricImages.get("visual-1")).toBeDefined();
  });

  it("does not reload SVG during transform-only updates", async () => {
    const { engine, loadVisual } = makeEngineHarness();
    await engine.reconcileSceneStructure(makeScene("<svg id='stable'/>", 0), engine.currentTemplate, null, [], [], null);
    await engine.reconcileSceneStructure(makeScene("<svg id='stable'/>", -18), engine.currentTemplate, null, [], [], null);

    expect(loadVisual).toHaveBeenCalledTimes(1);
  });

  it("prunes stale async-loaded Fabric objects from superseded reconciles", async () => {
    const { engine, fakeCanvas } = makeEngineHarness();
    let resolveFirst: (() => void) | null = null;
    let resolveSecond: (() => void) | null = null;
    let callIndex = 0;

    engine._loadVisual = vi.fn((visual: any) => new Promise<void>(resolve => {
      callIndex += 1;
      const object = {
        __visualId: visual.id,
        __sourceKind: visual.sourceKind,
        __slotId: visual.slotId,
        __itemId: visual.itemId,
        __partId: visual.partId,
        set: vi.fn(),
        setCoords: vi.fn(),
      };
      const finish = () => {
        engine.fabricImages.set(visual.id, object);
        engine.svgCache.set(visual.id, visual.svgData);
        fakeCanvas.add(object);
        resolve();
      };

      if (callIndex === 1) {
        resolveFirst = finish;
      } else {
        resolveSecond = finish;
      }
    }));

    const first = engine.reconcileSceneStructure(makeScene("<svg id='first'/>", 0), engine.currentTemplate, null, [], [], null);
    const second = engine.reconcileSceneStructure(makeScene("<svg id='second'/>", 24), engine.currentTemplate, null, [], [], null);

    resolveFirst?.();
    await Promise.resolve();
    resolveSecond?.();

    await first;
    await second;

    expect(fakeCanvas.getObjects()).toHaveLength(1);
    expect(engine.fabricImages.get("visual-1")).toBe(fakeCanvas.getObjects()[0]);
    expect(engine.svgCache.get("visual-1")).toBe("<svg id='second'/>");
  });

  it("does not allow slot gizmo to steal selected item control in attachment mode", () => {
    const { engine } = makeEngineHarness();
    engine.mode = "edit-attachment";

    const itemPart = { __sourceKind: "item-part", set: vi.fn() };
    const slotZone = { set: vi.fn() };
    engine.fabricImages.set("visual-1", itemPart);
    engine.slotZones.set("slot_hair", slotZone);

    engine._applyModeSelectability();

    expect(itemPart.set).toHaveBeenCalledWith(expect.objectContaining({
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: true,
    }));
    expect(slotZone.set).toHaveBeenCalledWith(expect.objectContaining({
      selectable: false,
      evented: false,
      hasControls: false,
    }));
  });

  it("locked slot gizmo cannot be transformed", () => {
    const { engine } = makeEngineHarness();
    engine.mode = "edit-template-slots";

    const lockedZone = { __slotId: "slot_hair", __locked: true, set: vi.fn() };
    engine.slotZones.set("slot_hair", lockedZone);

    engine._applyModeSelectability();

    expect(lockedZone.set).toHaveBeenCalledWith(expect.objectContaining({
      selectable: true,
      evented: true,
      lockMovementX: true,
      lockMovementY: true,
    }));
  });

  it("keeps legacy item drag relative to the slot bone instead of snapping to scene origin", () => {
    const { engine } = makeEngineHarness();
    engine.currentScene = {
      ...makeScene(),
      skeleton: {
        bones: new Map([
          ["chest", { x: 0, y: -39, rotation: 0, scaleX: 1, scaleY: 1 }],
        ]),
      },
    };
    engine.currentTemplate = {
      id: "template",
      previewWidth: 128,
      previewHeight: 128,
      anchors: {},
      slots: [{
        id: "slot_torso",
        name: "Torso",
        boneId: "chest",
        zIndex: 3,
        allowedCategories: ["torso"],
        required: false,
        defaultItemId: null,
        defaultTransform: { x: 2, y: 3, rotation: 0, scaleX: 1, scaleY: 1 },
      }],
    };
    engine.currentEntity = {
      id: "entity",
      name: "Entity",
      entityType: "character",
      templateId: "template",
      styleSetId: "style_default",
      species: "",
      palette: {
        skin: "#000000",
        hair: "#000000",
        primaryCloth: "#000000",
        secondaryCloth: "#000000",
        metal: "#000000",
        accent: "#000000",
        outline: "#000000",
        shadow: "#000000",
      },
      slots: [{
        slotId: "slot_torso",
        itemId: "tunic_linen",
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
      createdAt: 0,
      updatedAt: 0,
    };
    engine.currentItems = [{
      id: "tunic_linen",
      name: "Linen Tunic",
      description: "test",
      category: "torso",
      compatibility: {
        skeletonFamilies: ["humanoid_topdown_v1"],
        species: [],
        viewProfiles: [],
      },
      allowedSlots: ["slot_torso"],
      fitProfile: "standard",
      paletteChannels: ["primaryCloth", "outline"],
      hasOwnAnimation: false,
      animationClipId: null,
      svgLayers: [{ id: "layer", styleSetId: null, svgData: "<svg/>", paletteChannels: [], zOffset: 0 }],
      parts: [],
      coordinateMode: "legacy_full_frame",
      licenseMeta: {
        source: "test",
        author: "test",
        licenseType: "cc0",
        aiGenerated: false,
        commercialUseAllowed: true,
        purchaseRef: null,
        derivativePolicy: "unrestricted",
      },
      tags: [],
    }];

    const img = {
      __slotId: "slot_torso",
      __itemId: "tunic_linen",
      __partId: "layer",
      left: 15,
      top: -10,
      angle: 0,
      scaleX: 1,
      scaleY: 1,
      __centerX: 0,
      __centerY: 0,
    } as any;

    const override = engine._computeOverrideFromFabricImage(img);
    const expected = multiply(
      localTransformToMatrix(0, 39, 0, 1, 1),
      localTransformToMatrix(-2, -3, 0, 1, 1),
    );

    expect(override).toBeTruthy();
    expect(override.offsetX).toBe(expected[4] + 15);
    expect(override.offsetY).toBe(expected[5] - 10);
  });

  it("computes attachment overrides relative to the resolved fit transform", () => {
    const { engine } = makeEngineHarness();
    engine.currentScene = {
      ...makeScene(),
      skeleton: {
        bones: new Map([
          ["head", { x: 0, y: -30, rotation: 0, scaleX: 1, scaleY: 1 }],
        ]),
      },
    };
    engine.currentTemplate = {
      id: "humanoid_topdown_v1",
      skeletonFamily: "humanoid_topdown_v1",
      previewWidth: 128,
      previewHeight: 128,
      anchors: {
        hair_top: { id: "hair_top", boneId: "head", offsetX: 0, offsetY: -8, rotation: 0 },
      },
      slots: [{
        id: "slot_hair",
        name: "Hair",
        boneId: "head",
        zIndex: 10,
        allowedCategories: ["hair"],
        required: false,
        defaultItemId: null,
        defaultAnchorId: "hair_top",
        defaultTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      }],
    };
    engine.currentEntity = {
      id: "entity",
      name: "Entity",
      entityType: "character",
      templateId: "humanoid_topdown_v1",
      styleSetId: "style_default",
      species: "",
      palette: {
        skin: "#000000",
        hair: "#000000",
        primaryCloth: "#000000",
        secondaryCloth: "#000000",
        metal: "#000000",
        accent: "#000000",
        outline: "#000000",
        shadow: "#000000",
      },
      slots: [{
        slotId: "slot_hair",
        itemId: "hair_test_v2",
        paletteOverride: {},
        attachmentOverride: { offsetX: 4, offsetY: -3, rotation: 0, scaleX: 1, scaleY: 1, anchorId: "hair_top" },
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
      createdAt: 0,
      updatedAt: 0,
    };
    engine.currentItems = [{
      id: "hair_test_v2",
      name: "Hair",
      description: "test",
      category: "hair",
      compatibility: {
        skeletonFamilies: ["humanoid_topdown_v1"],
        species: [],
        viewProfiles: [],
      },
      allowedSlots: ["slot_hair"],
      fitProfile: "hair_topdown",
      paletteChannels: ["hair", "outline"],
      hasOwnAnimation: false,
      animationClipId: null,
      anchorRules: {
        slot_hair: { anchorId: "hair_top", bindMode: "anchor" },
      },
      svgLayers: [],
      parts: [{
        id: "crown",
        boneId: "head",
        svgData: "<svg/>",
        metrics: {
          viewBoxX: 0,
          viewBoxY: 0,
          viewBoxWidth: 32,
          viewBoxHeight: 16,
          visualMinX: 0,
          visualMinY: 0,
          visualWidth: 32,
          visualHeight: 16,
        },
        pivot: { x: 16, y: 8, preset: "center" },
        localTransform: { x: 16, y: 8, rotation: 0, scaleX: 1, scaleY: 1 },
        coordinateMode: "bone_local",
        zOffset: 0,
      }],
      coordinateMode: "bone_local",
      licenseMeta: {
        source: "test",
        author: "test",
        licenseType: "cc0",
        aiGenerated: false,
        commercialUseAllowed: true,
        purchaseRef: null,
        derivativePolicy: "unrestricted",
      },
      tags: [],
    }];
    engine.currentFitProfiles = [{
      id: "humanoid_topdown_v1__slot_hair__hair_topdown",
      fitProfile: "hair_topdown",
      templateId: "humanoid_topdown_v1",
      family: "humanoid_topdown_v1",
      slotId: "slot_hair",
      partTransforms: {
        crown: { x: 22, y: 6, rotation: 0, scaleX: 1, scaleY: 1 },
      },
      anchorOverrides: {
        slot_hair: "hair_top",
      },
    }];

    const img = {
      __slotId: "slot_hair",
      __itemId: "hair_test_v2",
      __partId: "crown",
      left: 26,
      top: -35,
      angle: 0,
      scaleX: 1,
      scaleY: 1,
      __centerX: 0,
      __centerY: 0,
    } as any;

    const override = engine._computeOverrideFromFabricImage(img);
    const previewOverrideMatrix = engine._computeAttachmentOverrideMatrix(
      engine.currentTemplate.slots[0],
      engine.currentItems[0],
      engine.currentEntity.slots[0],
      engine.currentItems[0].parts[0],
      img,
    );

    expect(override).toBeTruthy();
    expect(override!.offsetX).toBeCloseTo(previewOverrideMatrix[4], 6);
    expect(override!.offsetY).toBeCloseTo(previewOverrideMatrix[5], 6);
  });

  it("uses the same override math for multi-part pants preview and commit", () => {
    const { engine } = makeEngineHarness();
    const pants = ITEMS.find(item => item.id === "pants_leather")!;
    const thighLeft = pants.parts!.find(part => part.id === "thigh_l")!;

    engine.currentScene = {
      ...makeScene(),
      visuals: [{
        id: "slot__slot_legs__pants_leather__thigh_l",
        svgData: "<svg/>",
        zIndex: 10,
        worldMatrix: [1, 0, 0, 1, -10, 10],
        localBounds: { minX: -5, minY: -8, maxX: 5, maxY: 8 },
        worldBounds: { minX: -15, minY: 2, maxX: -5, maxY: 18 },
        sourceKind: "item-part",
        slotId: "slot_legs",
        itemId: "pants_leather",
        partId: "thigh_l",
        svgFitMode: "v2_vector",
      }],
      skeleton: {
        bones: new Map([
          ["pelvis", { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }],
          ["hip_l", { x: -8, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }],
          ["knee_l", { x: -10, y: 16, rotation: 0, scaleX: 1, scaleY: 1 }],
          ["hip_r", { x: 8, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }],
          ["knee_r", { x: 10, y: 16, rotation: 0, scaleX: 1, scaleY: 1 }],
        ]),
      },
    };
    engine.currentTemplate = {
      id: "humanoid_topdown_v1",
      skeletonFamily: "humanoid_topdown_v1",
      previewWidth: 128,
      previewHeight: 128,
      anchors: {},
      slots: [{
        id: "slot_legs",
        name: "Legs",
        boneId: "pelvis",
        zIndex: 1,
        allowedCategories: ["legs"],
        required: false,
        defaultItemId: null,
        defaultTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      }],
    };
    engine.currentEntity = {
      id: "entity",
      name: "Entity",
      entityType: "character",
      templateId: "humanoid_topdown_v1",
      styleSetId: "style_default",
      species: "",
      palette: {
        skin: "#000000",
        hair: "#000000",
        primaryCloth: "#000000",
        secondaryCloth: "#000000",
        metal: "#000000",
        accent: "#000000",
        outline: "#000000",
        shadow: "#000000",
      },
      slots: [{
        slotId: "slot_legs",
        itemId: "pants_leather",
        paletteOverride: {},
        attachmentOverride: { offsetX: 0, offsetY: 0, rotation: 0, scaleX: 1, scaleY: 1 },
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
      createdAt: 0,
      updatedAt: 0,
    };
    engine.currentItems = [pants];

    const img = {
      __slotId: "slot_legs",
      __itemId: "pants_leather",
      __partId: "thigh_l",
      left: 3,
      top: 12,
      angle: 0,
      scaleX: 1,
      scaleY: 1,
      skewX: 0,
      skewY: 0,
      __centerX: 0,
      __centerY: 0,
    } as any;

    const previewOverrideMatrix = engine._computeAttachmentOverrideMatrix(
      engine.currentTemplate.slots[0],
      pants,
      engine.currentEntity.slots[0],
      thighLeft,
      img,
    );
    const committedOverride = engine._computeOverrideFromFabricImage(img);

    expect(committedOverride).toBeTruthy();
    expect(committedOverride!.offsetX).toBeCloseTo(previewOverrideMatrix[4], 6);
    expect(committedOverride!.offsetY).toBeCloseTo(previewOverrideMatrix[5], 6);
  });
});
