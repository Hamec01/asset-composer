import { describe, expect, it } from "vitest";

import { ITEMS } from "../src/data/items";
import { TEMPLATES } from "../src/data/templates";
import type { Entity } from "../src/domain/types";
import { evaluateScene, evaluateSkeleton } from "../src/lib/evaluationPipeline";
import { localTransformToMatrix, transformAABB, transformPoint } from "../src/lib/matrixUtils";
import { scaleSvgToFit } from "../src/lib/svgUtils";

const template = TEMPLATES.find(t => t.id === "humanoid_topdown_v1")!;

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
});
