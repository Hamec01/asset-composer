// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
  buildPathDataFromPoints,
  createFreehandPathShape,
  computeDocumentContentBounds,
  createDefaultShape,
  createDocumentFromItemPart,
  createDocumentFromFaceOverlay,
  extractSpriteShapesFromSvg,
  flipSpriteShape,
  hitTestSpriteDocument,
  resizeSpriteShape,
  spriteEditorDocumentToSvg,
  translateSpriteShape,
} from "../src/lib/spriteEditor";

describe("sprite editor helpers", () => {
  it("serializes vector layers and optional reference into svg", () => {
    const doc = createDocumentFromFaceOverlay("entity-1");
    doc.referenceAsset = {
      format: "png",
      name: "ref",
      originalFileName: "ref.png",
      mimeType: "image/png",
      dataUri: "data:image/png;base64,AAAA",
    };
    doc.layers[0].shapes.push(createDefaultShape("rect"));
    doc.layers[0].shapes.push(createDefaultShape("ellipse"));

    const svg = spriteEditorDocumentToSvg(doc);

    expect(svg).toContain("<svg");
    expect(svg).toContain("<image");
    expect(svg).toContain("<rect");
    expect(svg).toContain("<ellipse");
    expect(svg).toContain('viewBox="0 0 64 64"');
  });

  it("builds freehand pencil paths as svg path data", () => {
    const pathData = buildPathDataFromPoints([
      { x: 10, y: 12 },
      { x: 14.2, y: 16.7 },
      { x: 20, y: 18 },
    ]);

    const shape = createFreehandPathShape([
      { x: 10, y: 12 },
      { x: 14.2, y: 16.7 },
      { x: 20, y: 18 },
    ]);

    expect(pathData).toContain("M 10 12");
    expect(pathData).toContain("Q 14.2 16.7");
    expect(shape.type).toBe("path");
    expect(shape.fill).toBe("none");
    expect(shape.pathData).toContain("Q");
    expect(shape.pathData).toContain("20 18");
  });

  it("builds closed freehand paths for filled pencil shapes", () => {
    const pathData = buildPathDataFromPoints(
      [
        { x: 6, y: 8 },
        { x: 18, y: 6 },
        { x: 22, y: 18 },
        { x: 10, y: 24 },
      ],
      { closed: true, smooth: true },
    );

    const shape = createFreehandPathShape(
      [
        { x: 6, y: 8 },
        { x: 18, y: 6 },
        { x: 22, y: 18 },
        { x: 10, y: 24 },
      ],
      { closed: true, fill: "#ff0000", stroke: "#000000", strokeWidth: 2 },
    );

    expect(pathData.endsWith(" Z")).toBe(true);
    expect(pathData).toContain("Q");
    expect(shape.fill).toBe("#ff0000");
    expect(shape.pathData?.endsWith(" Z")).toBe(true);
  });

  it("opens an existing face overlay as a sprite document", () => {
    const doc = createDocumentFromFaceOverlay("entity-1", {
      id: "overlay-1",
      name: "Scar",
      svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M4 4 L16 16" stroke="#f00"/></svg>`,
      zOffset: 12,
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
      localTransform: { x: 1, y: 2, rotation: 0, scaleX: 1, scaleY: 1 },
      source: {
        format: "svg",
        name: "Scar",
        originalFileName: "scar.svg",
        mimeType: "image/svg+xml",
      },
      editorDocumentId: "doc-overlay-1",
    });

    expect(doc.id).toBe("doc-overlay-1");
    expect(doc.target.kind).toBe("face-overlay");
    expect(doc.target.overlayId).toBe("overlay-1");
    expect(doc.width).toBe(20);
    expect(doc.height).toBe(20);
    expect(doc.authoringHint?.faceFeatureKey).toBe("generic");
  });

  it("preserves face feature tag in overlay editor documents", () => {
    const doc = createDocumentFromFaceOverlay("entity-1", {
      id: "overlay-hair-1",
      name: "Hair Fringe",
      featureTag: "hair",
      overlayRole: "line",
      symmetryMode: "mirror_x",
      paintTarget: "stroke",
      svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 18"><path d="M2 6 C8 0 22 0 28 6" stroke="#000"/></svg>`,
      zOffset: 10,
      pivot: { x: 15, y: 9, preset: "custom" },
      metrics: {
        viewBoxX: 0,
        viewBoxY: 0,
        viewBoxWidth: 30,
        viewBoxHeight: 18,
        visualMinX: 2,
        visualMinY: 0,
        visualWidth: 26,
        visualHeight: 6,
      },
      localTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    });

    expect(doc.authoringHint?.faceFeatureKey).toBe("hair");
    expect(doc.authoringHint?.faceOverlayRole).toBe("line");
    expect(doc.authoringHint?.symmetryMode).toBe("mirror_x");
    expect(doc.authoringHint?.paintTarget).toBe("stroke");
  });

  it("extracts editable vector shapes from svg markup", () => {
    const shapes = extractSpriteShapesFromSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
        <rect x="2" y="4" width="10" height="12" fill="#111111" stroke="#222222" stroke-width="2"/>
        <ellipse cx="24" cy="14" rx="6" ry="4" fill="#333333" stroke="#444444"/>
        <path d="M 8 24 L 20 30 L 16 36 Z" fill="#555555" stroke="#666666"/>
      </svg>`,
    );

    expect(shapes).toHaveLength(3);
    expect(shapes[0].type).toBe("rect");
    expect(shapes[1].type).toBe("ellipse");
    expect(shapes[2].type).toBe("path");
    expect(shapes[0].x).toBe(2);
    expect(shapes[1].width).toBe(12);
    expect(shapes[2].pathData).toContain("20 30");
  });

  it("computes bounds from visible editor shapes", () => {
    const doc = createDocumentFromFaceOverlay("entity-1");
    doc.layers[0].shapes.push({
      ...createDefaultShape("rect"),
      x: 10,
      y: 12,
      width: 20,
      height: 18,
    });
    doc.layers.push({
      id: "layer-2",
      name: "Layer 2",
      visible: true,
      zIndex: 1,
      shapes: [{
        ...createDefaultShape("ellipse"),
        id: "ellipse-1",
        x: 34,
        y: 8,
        width: 14,
        height: 12,
      }],
    });

    const bounds = computeDocumentContentBounds(doc);

    expect(bounds).not.toBeNull();
    expect(bounds?.minX).toBe(10);
    expect(bounds?.minY).toBe(8);
    expect(bounds?.width).toBe(38);
    expect(bounds?.height).toBe(22);
  });

  it("hit-tests the topmost visible shape", () => {
    const doc = createDocumentFromFaceOverlay("entity-1");
    doc.layers[0].shapes.push({
      ...createDefaultShape("rect"),
      id: "rect-base",
      x: 10,
      y: 10,
      width: 20,
      height: 20,
    });
    doc.layers.push({
      id: "layer-top",
      name: "Top",
      visible: true,
      zIndex: 1,
      shapes: [{
        ...createDefaultShape("ellipse"),
        id: "ellipse-top",
        x: 14,
        y: 14,
        width: 18,
        height: 18,
      }],
    });

    const hit = hitTestSpriteDocument(doc, 18, 18);

    expect(hit).toEqual({ layerId: "layer-top", shapeId: "ellipse-top" });
  });

  it("translates path shapes without losing the path data", () => {
    const shape = {
      ...createDefaultShape("path"),
      id: "path-1",
      pathData: "M 10 12 L 20 24 L 32 18 Z",
    };

    const translated = translateSpriteShape(shape, 5, -2);

    expect(translated.x).toBe(5);
    expect(translated.y).toBe(-2);
    expect(translated.pathData).toContain("15");
    expect(translated.pathData).toContain("10");
    expect(translated.pathData).toContain("25");
    expect(translated.pathData).toContain("22");
  });

  it("resizes rectangle shapes by updating their bounds", () => {
    const shape = {
      ...createDefaultShape("rect"),
      x: 10,
      y: 12,
      width: 20,
      height: 16,
    };

    const resized = resizeSpriteShape(shape, {
      minX: 10,
      minY: 12,
      width: 30,
      height: 24,
    });

    expect(resized.x).toBe(10);
    expect(resized.y).toBe(12);
    expect(resized.width).toBe(30);
    expect(resized.height).toBe(24);
  });

  it("flips rectangle shapes horizontally around their own center", () => {
    const shape = {
      ...createDefaultShape("rect"),
      x: 10,
      y: 12,
      width: 20,
      height: 16,
    };

    const flipped = flipSpriteShape(shape, "horizontal");

    expect(flipped.x).toBe(10);
    expect(flipped.y).toBe(12);
    expect(flipped.width).toBe(20);
  });

  it("flips path shapes and preserves their svg path", () => {
    const shape = {
      ...createDefaultShape("path"),
      id: "path-flip",
      pathData: "M 10 10 L 20 10 L 20 20 L 10 20 Z",
    };

    const flipped = flipSpriteShape(shape, "horizontal");

    expect(flipped.pathData).not.toBe(shape.pathData);
    expect(flipped.pathData).toContain("20");
    expect(flipped.pathData).toContain("10");
  });

  it("resizes path shapes by scaling their coordinate data", () => {
    const shape = {
      ...createDefaultShape("path"),
      id: "path-resize",
      pathData: "M 10 10 L 20 10 L 20 20 L 10 20 Z",
    };

    const resized = resizeSpriteShape(shape, {
      minX: 10,
      minY: 10,
      width: 20,
      height: 30,
    });

    expect(resized.pathData).toContain("30");
    expect(resized.pathData).toContain("40");
  });

  it("opens svg item parts as editable layers instead of only underlay", () => {
    const doc = createDocumentFromItemPart(
      "entity-1",
      {
        id: "item-1",
        name: "Test Armor",
        category: "torso",
        allowedSlots: ["slot_torso"],
        tags: [],
        parts: [{
          id: "part-1",
          boneId: "torso",
          svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="6" y="8" width="20" height="18" fill="#777"/></svg>`,
          metrics: {
            viewBoxX: 0,
            viewBoxY: 0,
            viewBoxWidth: 32,
            viewBoxHeight: 32,
            visualMinX: 6,
            visualMinY: 8,
            visualWidth: 20,
            visualHeight: 18,
          },
          pivot: { x: 16, y: 16, preset: "center" },
          zOffset: 0,
          fitProfileId: null,
          localTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        }],
      },
      {
        id: "part-1",
        boneId: "torso",
        svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="6" y="8" width="20" height="18" fill="#777"/></svg>`,
        metrics: {
          viewBoxX: 0,
          viewBoxY: 0,
          viewBoxWidth: 32,
          viewBoxHeight: 32,
          visualMinX: 6,
          visualMinY: 8,
          visualWidth: 20,
          visualHeight: 18,
        },
        pivot: { x: 16, y: 16, preset: "center" },
        zOffset: 0,
        fitProfileId: null,
        localTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      },
    );

    expect(doc.layers[0].shapes).toHaveLength(1);
    expect(doc.referenceAsset).toBeNull();
  });
});
