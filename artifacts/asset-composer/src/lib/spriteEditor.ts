import type {
  EntityVisual,
  FaceOverlay,
  ImportedAssetSource,
  Item,
  ItemPart,
  SpriteEditorDocument,
  SpriteEditorLayer,
  SpriteEditorShape,
} from "@/domain/types";

export interface SpriteBounds2D {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

export interface SpriteShapeHit {
  layerId: string;
  shapeId: string;
}

function svgDataToDataUri(svgData: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`;
}

function parseNumericAttribute(value: string | null | undefined, fallback = 0): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseStrokeWidth(value: string | null | undefined, fallback = 1.5): number {
  if (!value) return fallback;
  const match = value.match(/-?\d*\.?\d+/);
  return match ? parseNumericAttribute(match[0], fallback) : fallback;
}

function parseRotation(transform: string | null | undefined): number {
  if (!transform) return 0;
  const match = transform.match(/rotate\(([-\d.]+)/i);
  return match ? parseNumericAttribute(match[1], 0) : 0;
}

function parseShapeColors(element: Element) {
  const fill = element.getAttribute("fill") || "#746A5E";
  const stroke = element.getAttribute("stroke") || "#1A1208";
  const strokeWidth = parseStrokeWidth(element.getAttribute("stroke-width"));
  return { fill, stroke, strokeWidth };
}

export function createReferenceSourceFromSvg(
  name: string,
  originalFileName: string,
  svgData: string,
): ImportedAssetSource {
  return {
    format: "svg",
    name,
    originalFileName,
    mimeType: "image/svg+xml",
    dataUri: svgDataToDataUri(svgData),
  };
}

export function createEmptySpriteLayer(name = "Layer 1"): SpriteEditorLayer {
  return {
    id: crypto.randomUUID(),
    name,
    visible: true,
    zIndex: 0,
    shapes: [],
  };
}

export function createDefaultShape(type: SpriteEditorShape["type"]): SpriteEditorShape {
  if (type === "ellipse") {
    return {
      id: crypto.randomUUID(),
      type,
      x: 18,
      y: 18,
      width: 28,
      height: 20,
      rotation: 0,
      fill: "#C89A7B",
      stroke: "#1A1208",
      strokeWidth: 1.5,
    };
  }

  if (type === "path") {
    return {
      id: crypto.randomUUID(),
      type,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      rotation: 0,
      fill: "#B87333",
      stroke: "#1A1208",
      strokeWidth: 1.5,
      pathData: "M 12 42 C 18 16, 46 16, 52 42 Z",
    };
  }

  return {
    id: crypto.randomUUID(),
    type: "rect",
    x: 16,
    y: 16,
    width: 30,
    height: 24,
    rotation: 0,
    fill: "#746A5E",
    stroke: "#1A1208",
    strokeWidth: 1.5,
  };
}

export function buildPathDataFromPoints(
  points: Array<{ x: number; y: number }>,
  options?: { closed?: boolean; smooth?: boolean },
): string {
  if (points.length === 0) return "";
  const closed = options?.closed ?? false;
  const smooth = options?.smooth ?? true;

  if (points.length === 1) {
    const point = points[0];
    return `M ${point.x} ${point.y} L ${point.x + 0.01} ${point.y + 0.01}${closed ? " Z" : ""}`;
  }

  if (!smooth || points.length === 2) {
    const linear = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${Number(point.x.toFixed(2))} ${Number(point.y.toFixed(2))}`)
      .join(" ");
    return closed ? `${linear} Z` : linear;
  }

  const first = points[0];
  let path = `M ${Number(first.x.toFixed(2))} ${Number(first.y.toFixed(2))}`;

  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const midX = Number((((current.x + next.x) / 2)).toFixed(2));
    const midY = Number((((current.y + next.y) / 2)).toFixed(2));
    path += ` Q ${Number(current.x.toFixed(2))} ${Number(current.y.toFixed(2))} ${midX} ${midY}`;
  }

  const penultimate = points[points.length - 2];
  const last = points[points.length - 1];
  path += ` Q ${Number(penultimate.x.toFixed(2))} ${Number(penultimate.y.toFixed(2))} ${Number(last.x.toFixed(2))} ${Number(last.y.toFixed(2))}`;

  return closed ? `${path} Z` : path;
}

export function createFreehandPathShape(
  points: Array<{ x: number; y: number }>,
  options?: Partial<Pick<SpriteEditorShape, "stroke" | "strokeWidth" | "fill">> & {
    closed?: boolean;
    smooth?: boolean;
  },
): SpriteEditorShape {
  return {
    id: crypto.randomUUID(),
    type: "path",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotation: 0,
    fill: options?.fill ?? "none",
    stroke: options?.stroke ?? "#1A1208",
    strokeWidth: options?.strokeWidth ?? 1.5,
    pathData: buildPathDataFromPoints(points, {
      closed: options?.closed,
      smooth: options?.smooth,
    }),
  };
}

export function extractSpriteShapesFromSvg(svgData: string): SpriteEditorShape[] {
  if (typeof DOMParser === "undefined") return [];

  const parsed = new DOMParser().parseFromString(svgData, "image/svg+xml");
  const elements = Array.from(parsed.querySelectorAll("rect, ellipse, path"));

  return elements.map(element => {
    const rotation = parseRotation(element.getAttribute("transform"));
    const { fill, stroke, strokeWidth } = parseShapeColors(element);

    if (element.tagName === "ellipse") {
      const cx = parseNumericAttribute(element.getAttribute("cx"));
      const cy = parseNumericAttribute(element.getAttribute("cy"));
      const rx = parseNumericAttribute(element.getAttribute("rx"));
      const ry = parseNumericAttribute(element.getAttribute("ry"));
      return {
        id: crypto.randomUUID(),
        type: "ellipse",
        x: cx - rx,
        y: cy - ry,
        width: rx * 2,
        height: ry * 2,
        rotation,
        fill,
        stroke,
        strokeWidth,
      } satisfies SpriteEditorShape;
    }

    if (element.tagName === "path") {
      return {
        id: crypto.randomUUID(),
        type: "path",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation,
        fill,
        stroke,
        strokeWidth,
        pathData: element.getAttribute("d") ?? "",
      } satisfies SpriteEditorShape;
    }

    return {
      id: crypto.randomUUID(),
      type: "rect",
      x: parseNumericAttribute(element.getAttribute("x")),
      y: parseNumericAttribute(element.getAttribute("y")),
      width: parseNumericAttribute(element.getAttribute("width")),
      height: parseNumericAttribute(element.getAttribute("height")),
      rotation,
      fill,
      stroke,
      strokeWidth,
    } satisfies SpriteEditorShape;
  });
}

function createDocumentLayersFromSvg(svgData: string): SpriteEditorLayer[] {
  const shapes = extractSpriteShapesFromSvg(svgData);
  const layer = createEmptySpriteLayer();
  layer.shapes = shapes;
  return [layer];
}

function renderShape(shape: SpriteEditorShape): string {
  const transform = shape.rotation
    ? ` transform="rotate(${shape.rotation} ${shape.x + shape.width / 2} ${shape.y + shape.height / 2})"`
    : "";
  const common = `fill="${shape.fill}" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}"`;

  switch (shape.type) {
    case "ellipse":
      return `<ellipse cx="${shape.x + shape.width / 2}" cy="${shape.y + shape.height / 2}" rx="${shape.width / 2}" ry="${shape.height / 2}" ${common}${transform} />`;
    case "path":
      return `<path d="${shape.pathData ?? ""}" ${common}${transform} />`;
    case "rect":
    default:
      return `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" rx="2" ${common}${transform} />`;
  }
}

function parsePathBounds(pathData: string | undefined): SpriteBounds2D | null {
  if (!pathData) return null;
  const matches = pathData.match(/-?\d*\.?\d+/g);
  if (!matches || matches.length < 2) return null;
  const values = matches.map(Number).filter(Number.isFinite);
  if (values.length < 2) return null;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < values.length - 1; index += 2) {
    const x = values[index];
    const y = values[index + 1];
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }

  return {
    minX,
    minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

export function computeShapeBounds(shape: SpriteEditorShape): SpriteBounds2D {
  if (shape.type === "path") {
    return parsePathBounds(shape.pathData) ?? {
      minX: shape.x,
      minY: shape.y,
      width: 0,
      height: 0,
    };
  }

  return {
    minX: shape.x,
    minY: shape.y,
    width: shape.width,
    height: shape.height,
  };
}

export function computeDocumentContentBounds(document: SpriteEditorDocument): SpriteBounds2D | null {
  const visibleShapes = document.layers
    .filter(layer => layer.visible)
    .flatMap(layer => layer.shapes);

  if (visibleShapes.length === 0) return null;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const shape of visibleShapes) {
    const bounds = computeShapeBounds(shape);
    minX = Math.min(minX, bounds.minX);
    minY = Math.min(minY, bounds.minY);
    maxX = Math.max(maxX, bounds.minX + bounds.width);
    maxY = Math.max(maxY, bounds.minY + bounds.height);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }

  return {
    minX,
    minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

export function hitTestSpriteDocument(
  document: SpriteEditorDocument,
  x: number,
  y: number,
): SpriteShapeHit | null {
  const layers = [...document.layers]
    .filter(layer => layer.visible)
    .sort((a, b) => b.zIndex - a.zIndex);

  for (const layer of layers) {
    for (let index = layer.shapes.length - 1; index >= 0; index -= 1) {
      const shape = layer.shapes[index];
      const bounds = computeShapeBounds(shape);
      if (
        x >= bounds.minX &&
        x <= bounds.minX + Math.max(bounds.width, 1) &&
        y >= bounds.minY &&
        y <= bounds.minY + Math.max(bounds.height, 1)
      ) {
        return { layerId: layer.id, shapeId: shape.id };
      }
    }
  }

  return null;
}

export function translatePathData(pathData: string | undefined, deltaX: number, deltaY: number): string | undefined {
  if (!pathData) return pathData;

  let coordinateIndex = 0;
  return pathData.replace(/-?\d*\.?\d+/g, raw => {
    const value = Number(raw);
    if (!Number.isFinite(value)) return raw;
    const translated = coordinateIndex % 2 === 0 ? value + deltaX : value + deltaY;
    coordinateIndex += 1;
    return Number(translated.toFixed(2)).toString();
  });
}

export function translateSpriteShape(shape: SpriteEditorShape, deltaX: number, deltaY: number): SpriteEditorShape {
  if (shape.type === "path") {
    return {
      ...shape,
      x: Number((shape.x + deltaX).toFixed(2)),
      y: Number((shape.y + deltaY).toFixed(2)),
      pathData: translatePathData(shape.pathData, deltaX, deltaY),
    };
  }

  return {
    ...shape,
    x: Number((shape.x + deltaX).toFixed(2)),
    y: Number((shape.y + deltaY).toFixed(2)),
  };
}

function flipPathData(
  pathData: string | undefined,
  axis: "horizontal" | "vertical",
  centerX: number,
  centerY: number,
): string | undefined {
  if (!pathData) return pathData;

  let coordinateIndex = 0;
  return pathData.replace(/-?\d*\.?\d+/g, raw => {
    const value = Number(raw);
    if (!Number.isFinite(value)) return raw;
    const isX = coordinateIndex % 2 === 0;
    coordinateIndex += 1;
    if (axis === "horizontal" && isX) {
      return Number((centerX - (value - centerX)).toFixed(2)).toString();
    }
    if (axis === "vertical" && !isX) {
      return Number((centerY - (value - centerY)).toFixed(2)).toString();
    }
    return Number(value.toFixed(2)).toString();
  });
}

export function flipSpriteShape(
  shape: SpriteEditorShape,
  axis: "horizontal" | "vertical",
): SpriteEditorShape {
  const bounds = computeShapeBounds(shape);
  const centerX = bounds.minX + bounds.width / 2;
  const centerY = bounds.minY + bounds.height / 2;

  if (shape.type === "path") {
    return {
      ...shape,
      pathData: flipPathData(shape.pathData, axis, centerX, centerY),
    };
  }

  if (axis === "horizontal") {
    return {
      ...shape,
      x: Number((2 * centerX - (shape.x + shape.width)).toFixed(2)),
    };
  }

  return {
    ...shape,
    y: Number((2 * centerY - (shape.y + shape.height)).toFixed(2)),
  };
}

function scalePathData(
  pathData: string | undefined,
  originX: number,
  originY: number,
  scaleX: number,
  scaleY: number,
): string | undefined {
  if (!pathData) return pathData;

  let coordinateIndex = 0;
  let currentX = 0;
  let currentY = 0;

  return pathData.replace(/-?\d*\.?\d+/g, raw => {
    const value = Number(raw);
    if (!Number.isFinite(value)) return raw;

    if (coordinateIndex % 2 === 0) {
      currentX = value;
      coordinateIndex += 1;
      return Number((originX + (currentX - originX) * scaleX).toFixed(2)).toString();
    }

    currentY = value;
    coordinateIndex += 1;
    return Number((originY + (currentY - originY) * scaleY).toFixed(2)).toString();
  });
}

export function resizeSpriteShape(
  shape: SpriteEditorShape,
  nextBounds: SpriteBounds2D,
): SpriteEditorShape {
  const currentBounds = computeShapeBounds(shape);
  const safeWidth = Math.max(currentBounds.width, 1);
  const safeHeight = Math.max(currentBounds.height, 1);
  const scaleX = Math.max(nextBounds.width, 1) / safeWidth;
  const scaleY = Math.max(nextBounds.height, 1) / safeHeight;

  if (shape.type === "path") {
    return {
      ...shape,
      x: Number((shape.x + (nextBounds.minX - currentBounds.minX)).toFixed(2)),
      y: Number((shape.y + (nextBounds.minY - currentBounds.minY)).toFixed(2)),
      pathData: scalePathData(
        translatePathData(
          shape.pathData,
          nextBounds.minX - currentBounds.minX,
          nextBounds.minY - currentBounds.minY,
        ),
        nextBounds.minX,
        nextBounds.minY,
        scaleX,
        scaleY,
      ),
    };
  }

  return {
    ...shape,
    x: Number(nextBounds.minX.toFixed(2)),
    y: Number(nextBounds.minY.toFixed(2)),
    width: Number(Math.max(nextBounds.width, 1).toFixed(2)),
    height: Number(Math.max(nextBounds.height, 1).toFixed(2)),
  };
}

export function spriteEditorDocumentToSvg(document: SpriteEditorDocument): string {
  const referenceMarkup = document.referenceAsset?.dataUri
    ? `<image href="${document.referenceAsset.dataUri}" x="0" y="0" width="${document.width}" height="${document.height}" preserveAspectRatio="none" opacity="0.9" />`
    : "";

  const layersMarkup = [...document.layers]
    .sort((a, b) => a.zIndex - b.zIndex)
    .map(layer => {
      if (!layer.visible) return "";
      const shapesMarkup = layer.shapes.map(renderShape).join("");
      return `<g data-layer-id="${layer.id}" data-layer-name="${layer.name}">${shapesMarkup}</g>`;
    })
    .join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${document.width} ${document.height}">`,
    referenceMarkup,
    layersMarkup,
    `</svg>`,
  ].join("");
}

export function createDocumentFromEntityVisual(entityId: string, visual: EntityVisual): SpriteEditorDocument {
  const layers = createDocumentLayersFromSvg(visual.svgData);
  return {
    id: visual.editorDocumentId ?? crypto.randomUUID(),
    name: `${visual.boneId} visual`,
    width: visual.metrics.viewBoxWidth,
    height: visual.metrics.viewBoxHeight,
    pivot: { ...visual.pivot },
    referenceAsset: layers.some(layer => layer.shapes.length > 0)
      ? null
      : createReferenceSourceFromSvg(`${visual.boneId} visual`, `${visual.id}.svg`, visual.svgData),
    layers,
    target: {
      kind: "entity-visual",
      entityId,
      visualId: visual.id,
    },
    updatedAt: Date.now(),
  };
}

export function createDocumentFromItemPart(entityId: string, item: Item, part: ItemPart): SpriteEditorDocument {
  const layers = createDocumentLayersFromSvg(part.svgData);
  const canEditDirectly = layers.some(layer => layer.shapes.length > 0);
  return {
    id: part.editorDocumentId ?? crypto.randomUUID(),
    name: `${item.name} / ${part.id}`,
    width: part.metrics.viewBoxWidth,
    height: part.metrics.viewBoxHeight,
    pivot: { ...part.pivot },
    referenceAsset: canEditDirectly
      ? (part.source?.format === "png" ? part.source : null)
      : (part.source?.dataUri
        ? part.source
        : createReferenceSourceFromSvg(`${item.name} ${part.id}`, `${part.id}.svg`, part.svgData)),
    layers,
    target: {
      kind: "item-part",
      entityId,
      itemId: item.id,
      partId: part.id,
    },
    updatedAt: Date.now(),
  };
}

export function createDocumentFromFaceOverlay(entityId: string, overlay?: FaceOverlay): SpriteEditorDocument {
  if (overlay) {
    const layers = createDocumentLayersFromSvg(overlay.svgData);
    return {
      id: overlay.editorDocumentId ?? crypto.randomUUID(),
      name: overlay.name,
      width: overlay.metrics.viewBoxWidth,
      height: overlay.metrics.viewBoxHeight,
      pivot: { ...overlay.pivot },
      referenceAsset: layers.some(layer => layer.shapes.length > 0)
        ? null
        : (overlay.source?.dataUri
          ? overlay.source
          : createReferenceSourceFromSvg(overlay.name, `${overlay.id}.svg`, overlay.svgData)),
      layers,
        authoringHint: {
          faceFeatureKey: overlay.featureTag ?? "generic",
          faceOverlayRole: overlay.overlayRole ?? "detail",
          symmetryMode: overlay.symmetryMode ?? "none",
          paintTarget: overlay.paintTarget ?? "both",
          paintToolPreset: "vector_brush",
        },
      target: {
        kind: "face-overlay",
        entityId,
        overlayId: overlay.id,
      },
      updatedAt: Date.now(),
    };
  }

  return {
    id: crypto.randomUUID(),
    name: "Face Overlay",
    width: 64,
    height: 64,
    pivot: { x: 32, y: 32, preset: "custom" },
    referenceAsset: null,
    layers: [createEmptySpriteLayer()],
      authoringHint: {
        faceFeatureKey: "generic",
        faceOverlayRole: "detail",
        symmetryMode: "none",
        paintTarget: "both",
        paintToolPreset: "vector_brush",
      },
    target: {
      kind: "face-overlay",
      entityId,
      overlayId: crypto.randomUUID(),
    },
    updatedAt: Date.now(),
  };
}
