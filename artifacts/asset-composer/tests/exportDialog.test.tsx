// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ raster: vi.fn(), download: vi.fn(), workers: [] as any[] }));
vi.mock("../src/lib/frameRenderer", () => ({ renderFrameToCanvas: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../src/lib/download", () => ({ triggerDownload: mocks.download }));
vi.mock("../src/lib/svgPartExport", () => ({ buildSvgPartExportFiles: vi.fn().mockResolvedValue({}) }));
vi.mock("../src/lib/exportFrames", () => ({
  composeFrameSvg: vi.fn(), exportFramePlan: () => [{ key: "frame", frame: 0 }],
  evaluateExportScene: () => ({}), exportCamera: () => ({}), rasterizeScene: mocks.raster,
}));
vi.mock("../src/workers/export.worker?worker", () => ({ default: class {
  postMessage = vi.fn(); terminate = vi.fn(); onmessage: any; onerror: any;
  constructor() { mocks.workers.push(this); }
} }));
import { ExportDialog } from "../src/components/export/ExportDialog";
import { useStore } from "../src/store";
import { animController } from "../src/core-v2/AnimationController";
let root: ReturnType<typeof createRoot>, container: HTMLDivElement;
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.raster.mockReset(); mocks.download.mockReset(); mocks.workers.length = 0;
  useStore.getState().newProject();
  useStore.getState().createEntity("character", "biped_profile_base_v1", "Проверка экспорта");
  animController.pause(); useStore.getState().openExport();
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<ExportDialog />));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); animController.pause(); });
const click = async (testId: string) => act(async () => { (document.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement).click(); });
const button = (text: string) => Array.from(document.querySelectorAll("button")).find(b => b.textContent?.includes(text))!;
it("ignores a cancelled render even when a new export starts before it finishes", async () => {
  let first!: (bitmap: any) => void, second!: (bitmap: any) => void;
  mocks.raster.mockImplementationOnce(() => new Promise(resolve => { first = resolve; }))
    .mockImplementationOnce(() => new Promise(resolve => { second = resolve; }));
  await click("export-download-btn");
  await act(async () => button("Отменить экспорт").click());
  await click("export-download-btn");
  const oldBitmap = { close: vi.fn() };
  await act(async () => first(oldBitmap));
  expect(oldBitmap.close).toHaveBeenCalledOnce();
  expect(mocks.workers).toHaveLength(0);
  await act(async () => second({ close: vi.fn() }));
  expect(mocks.workers).toHaveLength(1);
  await act(async () => mocks.workers[0].onmessage({ data: { type: "done", zipBuffer: new ArrayBuffer(1), fileCount: 1 } }));
  expect(mocks.download).toHaveBeenCalledOnce();
  expect(document.body.textContent).toContain("Экспорт готов");
});
it("shows an export error and allows a successful retry", async () => {
  mocks.raster.mockRejectedValueOnce(new Error("Не удалось подготовить кадр")).mockResolvedValue({ close: vi.fn() });
  await click("export-download-btn");
  expect(document.body.textContent).toContain("Не удалось подготовить кадр");
  await click("export-download-btn");
  expect(mocks.workers).toHaveLength(1);
  await act(async () => mocks.workers[0].onmessage({ data: { type: "done", zipBuffer: new ArrayBuffer(1), fileCount: 1 } }));
  expect(mocks.download).toHaveBeenCalledOnce();
});
