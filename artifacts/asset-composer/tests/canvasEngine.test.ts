import { beforeEach, describe, expect, it, vi } from "vitest";

import { CanvasEngine } from "../src/engine/canvasEngine";
import type { EvaluatedScene } from "../src/lib/evaluationPipeline";

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
  const fakeCanvas = {
    add: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
    requestRenderAll: vi.fn(),
    discardActiveObject: vi.fn(() => { activeObject = null; }),
    setActiveObject: vi.fn((object: any) => { activeObject = object; }),
    getActiveObject: vi.fn(() => activeObject),
    getObjects: vi.fn(() => []),
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
    expect(fakeCanvas.getActiveObject()).toBe(nextObject);
  });

  it("does not reload SVG during transform-only updates", async () => {
    const { engine, loadVisual } = makeEngineHarness();
    await engine.reconcileSceneStructure(makeScene("<svg id='stable'/>", 0), engine.currentTemplate, null, [], [], null);
    await engine.reconcileSceneStructure(makeScene("<svg id='stable'/>", -18), engine.currentTemplate, null, [], [], null);

    expect(loadVisual).toHaveBeenCalledTimes(1);
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
});
