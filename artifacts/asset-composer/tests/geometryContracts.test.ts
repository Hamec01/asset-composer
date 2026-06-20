// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { ITEMS } from "../src/data/items";
import { TEMPLATES } from "../src/data/templates";
import type { Entity } from "../src/domain/types";
import { buildImportedEntityVisual, getDefaultImportPivot } from "../src/lib/entityVisualImport";
import { evaluateScene, evaluateSkeleton } from "../src/lib/evaluationPipeline";
import { localTransformToMatrix, transformAABB, transformPoint } from "../src/lib/matrixUtils";
import { computeSceneBounds, fitSceneToViewport } from "../src/lib/sceneUtils";
import { parseMetrics } from "../src/lib/svgMetrics";
import { scaleSvgToFit } from "../src/lib/svgUtils";

const template = TEMPLATES.find(t => t.id === "humanoid_topdown_v1")!;

afterEach(() => {
  vi.restoreAllMocks();
});

function mockSvgBBox(x: number, y: number, width: number, height: number) {
  const previous = Object.getOwnPropertyDescriptor(SVGElement.prototype, "getBBox");
  Object.defineProperty(SVGElement.prototype, "getBBox", {
    configurable: true,
    value: () => ({
      x,
      y,
      width,
      height,
      top: y,
      right: x + width,
      bottom: y + height,
      left: x,
      toJSON: () => "",
    } as DOMRect),
  });
  return () => {
    if (previous) {
      Object.defineProperty(SVGElement.prototype, "getBBox", previous);
      return;
    }
    delete (SVGElement.prototype as SVGElement & { getBBox?: () => DOMRect }).getBBox;
  };
}

function makeEntity(itemId: string): Entity {
  return {
    id: "entity",
    name: "Geometry Test",
    entityType: "character",
    templateId: template.id,
    styleSetId: "style_default",
    species: "",
    palette: template.paletteTokens,
    slots: [{
      slotId: "slot_hair",
      itemId,
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
}

describe("geometry contracts", () => {
  it("maps the local pivot to x/y", () => {
    const m = localTransformToMatrix(100, 200, 30, 2, 3, 10, 20);
    expect(transformPoint(m, 10, 20)).toEqual({ x: 100, y: 200 });
  });

  it("supports rotation, non-uniform scale and negative scale", () => {
    const m = localTransformToMatrix(0, 0, 90, -2, 3, 0, 0);
    const rotated = transformPoint(m, 1, 0);
    expect(rotated.x).toBeCloseTo(0);
    expect(rotated.y).toBeCloseTo(-2);
  });

  it("transforms all four AABB corners", () => {
    const box = transformAABB(localTransformToMatrix(10, 20, 45, 1, 1, 0, 0), {
      minX: 0,
      minY: 0,
      maxX: 10,
      maxY: 10,
    });
    expect(box.maxX).toBeGreaterThan(box.minX);
    expect(box.maxY).toBeGreaterThan(box.minY);
  });

  it("switches SVG fit mode between legacy and v2 visuals", () => {
    const item = ITEMS.find(i => i.id === "hair_test_v2")!;
    const entity = makeEntity(item.id);
    const scene = evaluateScene(entity, template, evaluateSkeleton(template.bones, new Map()), [item]);
    const visual = scene.visuals.find(v => v.itemId === item.id);
    expect(visual?.svgFitMode).toBe("v2_vector");

    const legacySvg = scaleSvgToFit("<svg viewBox=\"0 0 10 20\"></svg>", 64, 64);
    const v2Svg = scaleSvgToFit("<svg viewBox=\"0 0 10 20\"></svg>", 64, 64, "v2_vector");
    expect(legacySvg).toContain('preserveAspectRatio="none"');
    expect(v2Svg).toContain('preserveAspectRatio="xMidYMid meet"');
  });

  it("preserves non-zero viewBox origins in imported metrics", () => {
    const metrics = parseMetrics("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"-12 -7 24 14\"><rect x=\"-10\" y=\"-5\" width=\"8\" height=\"6\"/></svg>");
    expect(metrics.viewBoxX).toBe(-12);
    expect(metrics.viewBoxY).toBe(-7);
    expect(metrics.viewBoxWidth).toBe(24);
    expect(metrics.viewBoxHeight).toBe(14);
  });

  it("builds imported entity visuals from parsed metrics instead of zero-based fallbacks", () => {
    const svg = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"-12 -7 24 14\"><rect x=\"-10\" y=\"-5\" width=\"8\" height=\"6\"/></svg>";
    const restore = mockSvgBBox(-10, -5, 8, 6);
    const visual = buildImportedEntityVisual({
      id: "imported",
      svgData: svg,
      boneId: "root",
      zIndex: 5,
      pivotPreset: "custom",
      pivotX: -6,
      pivotY: -2,
    });
    restore();

    expect(visual.metrics.viewBoxX).toBe(-12);
    expect(visual.metrics.viewBoxY).toBe(-7);
    expect(visual.metrics.visualMinX).toBe(-10);
    expect(visual.metrics.visualMinY).toBe(-5);
    expect(visual.metrics.visualWidth).toBe(8);
    expect(visual.metrics.visualHeight).toBe(6);
    expect(visual.pivot).toEqual({ x: -6, y: -2, preset: "custom" });
  });

  it("computes default import pivot from content bounds instead of scene origin", () => {
    const svg = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"-12 -7 24 14\"><rect x=\"-10\" y=\"-5\" width=\"8\" height=\"6\"/></svg>";
    const restore = mockSvgBBox(-10, -5, 8, 6);
    expect(getDefaultImportPivot(svg, "center")).toEqual({ x: -6, y: -2 });
    restore();
  });

  it("keeps legacy full-frame rendering isolated from v2 vector fitting", () => {
    const legacySvg = scaleSvgToFit("<svg viewBox=\"-5 -10 10 20\"></svg>", 64, 64, "legacy_full_frame");
    const v2Svg = scaleSvgToFit("<svg viewBox=\"-5 -10 10 20\"></svg>", 64, 64, "v2_vector");
    expect(legacySvg).toContain('width="64"');
    expect(legacySvg).toContain('height="64"');
    expect(legacySvg).toContain('preserveAspectRatio="none"');
    expect(v2Svg).toContain('width="64"');
    expect(v2Svg).toContain('height="64"');
    expect(v2Svg).toContain('preserveAspectRatio="xMidYMid meet"');
  });

  it("fits the scene using evaluated world bounds rather than full-frame extents", () => {
    const bounds = computeSceneBounds([
      {
        id: "narrow",
        svgData: "<svg />",
        zIndex: 1,
        worldMatrix: [1, 0, 0, 1, 0, 0],
        localBounds: { minX: -2, minY: -1, maxX: 2, maxY: 1 },
        worldBounds: { minX: 48, minY: 20, maxX: 52, maxY: 22 },
      },
    ]);
    const camera = fitSceneToViewport(bounds, 800, 600);

    expect(bounds).toEqual({ minX: 48, minY: 20, maxX: 52, maxY: 22 });
    expect(camera.zoom).toBeGreaterThan(100);
    expect(camera.panX).toBeCloseTo(-camera.zoom * 50);
    expect(camera.panY).toBeCloseTo(-camera.zoom * 21);
  });
});
