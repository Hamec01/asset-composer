// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { drawVisual, visualCanvas, visualSvg, contentSvg, createSvgAssetRegistry } from "../src/lib/visualRenderer";
import { Resvg } from "@resvg/resvg-js";
import type { EvaluatedVisual } from "../src/domain/types";

afterEach(() => vi.restoreAllMocks());

it("clips atlas windows identically in standalone and shared-resource SVG exports", () => {
  const png = new Resvg('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><path d="M0 0H10V10H0Z" fill="red"/><path d="M10 0H20V10H10Z" fill="blue"/></svg>').render().asPng();
  const assets = { atlas: { id: "atlas", name: "atlas", width: 20, height: 10, mimeType: "image/png" as const, dataUri: "data:image/png;base64," + png.toString("base64") } };
  const content = { kind: "composite" as const, width: 10, height: 10, children: [{ content: { kind: "raster" as const, assetId: "atlas" }, matrix: [2, 0, 0, 1, -10, 0] as EvaluatedVisual["worldMatrix"], opacity: 1 }] };
  const registry = createSvgAssetRegistry("test_atlas");
  const art = contentSvg(content, 10, 10, assets, registry);
  contentSvg(content, 10, 10, assets, registry);
  expect(registry.definitions().match(/data:image\/png;base64/g)).toHaveLength(1);
  const render = (body: string) => new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10">${body}</svg>`).render().pixels;
  const plain = render(contentSvg(content, 10, 10, assets));
  const shared = render(registry.definitions() + art);
  expect(shared).toEqual(plain);
  expect(Array.from(shared.slice((5*20+5)*4,(5*20+5)*4+4))).toEqual([0,0,255,255]);
  expect(shared[(5*20+15)*4+3]).toBe(0); // pixels outside the window never leak
});

function meshVisual(): EvaluatedVisual {
  return {
    id: "transformed-mesh",
    sourceKind: "entity-visual",
    content: { kind: "vector", svgData: '<svg xmlns="http://www.w3.org/2000/svg"><rect width="40" height="40"/></svg>' },
    worldMatrix: [0, 3, -2, 0, 100, 200],
    localBounds: { minX: 10, minY: 20, maxX: 30, maxY: 50 },
    worldBounds: { minX: 0, minY: 230, maxX: 60, maxY: 290 },
    zIndex: 0,
    opacity: .4,
    surface: {
      sourceWidth: 40, sourceHeight: 40,
      vertices: [
        { x: 10, y: 20, u: 0, v: 0, weights: [] },
        { x: 30, y: 20, u: 1, v: 0, weights: [] },
        { x: 30, y: 50, u: 1, v: 1, weights: [] },
        { x: 10, y: 50, u: 0, v: 1, weights: [] },
      ],
      triangles: [0, 1, 2, 0, 2, 3],
    },
  };
}

function canvasHarness(operations?: string[]) {
  const contexts: any[] = [];
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    const context = {
      globalAlpha: 1, imageSmoothingEnabled: true,
      scale: vi.fn(), translate: vi.fn(), transform: vi.fn(),
      drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(),
    };
    context.drawImage.mockImplementation(() => operations?.push((context as any).globalCompositeOperation ?? "source-over"));
    contexts.push(context);
    return context as any;
  });
  vi.stubGlobal("Image", class {
    onload?: () => void;
    set src(_: string) { queueMicrotask(() => this.onload?.()); }
  });
  return contexts;
}

it("builds a local mesh texture without baking the outer transform or opacity", async () => {
  const contexts = canvasHarness();
  try {
    const canvas = await visualCanvas(meshVisual());
    expect(canvas.width).toBe(27);
    expect(canvas.height).toBe(40);
    expect(contexts[0].translate).toHaveBeenCalledWith(-10, -20);
    expect(contexts[0].transform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0);
    expect(contexts[0].globalAlpha).toBe(1);
  } finally { vi.unstubAllGlobals(); }
});

it("applies mesh opacity once when compositing into an export canvas", async () => {
  const contexts = canvasHarness();
  const target = { globalAlpha: .5, save: vi.fn(), restore: vi.fn(), transform: vi.fn(), drawImage: vi.fn() };
  try {
    const visual = meshVisual();
    await drawVisual(target as any, visual);
    expect(target.globalAlpha).toBeCloseTo(.2);
    expect(target.transform).toHaveBeenCalledWith(...visual.worldMatrix);
    expect(target.drawImage).toHaveBeenCalledTimes(1);
    expect(target.drawImage.mock.calls[0].slice(1)).toEqual([10, 20, 20, 30]);
    expect(contexts[0].globalAlpha).toBe(1);
  } finally { vi.unstubAllGlobals(); }
});

it("preserves an affine setup mesh as one SVG image without triangle seams", () => {
  const svg = visualSvg(meshVisual());
  expect(svg.match(/<image /g)).toHaveLength(1);
  expect(svg).not.toContain("clipPath");
  expect(svg).toContain('opacity="0.4"');
  expect(svg).toContain('matrix(0 3 -2 0 100 200)');
});

it("cuts body alpha from the local equipment texture before applying outer opacity", async () => {
  const operations:string[]=[];
  const contexts = canvasHarness(operations);
  try {
    const equipment = {...meshVisual(), surface: undefined};
    const hand = {...equipment, id:"palm", opacity:1, worldMatrix:[0,3,-2,0,94,206] as EvaluatedVisual["worldMatrix"]};
    equipment.occlusionMasks=[hand];
    const canvas=await visualCanvas(equipment);
    expect(canvas.width).toBe(80);
    expect(operations).toContain("destination-out");
    expect(contexts[0].transform).toHaveBeenLastCalledWith(1,0,0,1,2,3);
    expect(contexts[0].globalAlpha).toBe(1);
    expect(contexts[0].globalCompositeOperation).toBe("source-over");
  } finally {vi.unstubAllGlobals();}
});
