import { editStudioDocument, newStudioDocument, newStudioLayer, studioCommit } from "./studioActions";
import { useStore } from "@/store";
import { sanitizeSvg } from "./sanitize";
import { makeRasterAsset } from "./visualContent";
import { openAsset } from "./assetNavigation";
import type { AssetSourceFormat } from "@/domain/types";

export async function importArtwork(file: File, documentId?: string, guide = false) {
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  const format = ({ svg: "svg", png: "png", jpg: "jpeg", jpeg: "jpeg", webp: "webp" } as Record<string, AssetSourceFormat>)[extension ?? ""];
  if (!format) throw new Error("Выберите SVG, PNG, WebP или JPEG.");
  let dataUri = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Не удалось прочитать файл. Выберите его заново.")); reader.readAsDataURL(file);
  });
  let svg: string | undefined;
  if (format === "svg") {
    svg = sanitizeSvg(await file.text());
    if (!svg.includes("<svg")) throw new Error("В файле нет SVG-рисунка.");
    dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
  const image = new Image();
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Не удалось открыть изображение. Проверьте файл или сохраните его как PNG.")); image.src = dataUri; });
  let doc = useStore.getState().project.editorMeta.spriteEditorDocuments.find(d => d.id === documentId);
  const created = !doc;
  doc ??= newStudioDocument(image.naturalWidth || 512, image.naturalHeight || 512);
  if (created) { doc.name = file.name.replace(/\.[^.]+$/, ""); studioCommit("Импортировать рисунок", p => { p.editorMeta.spriteEditorDocuments.push(doc!); }); }
  const id = doc.id;
  const layer = newStudioLayer(format === "svg" ? "vector" : "raster", file.name);
  const asset = format === "svg" ? undefined : makeRasterAsset(dataUri, image.naturalWidth, image.naturalHeight, file.name);
  editStudioDocument(id, guide ? "Добавить подложку" : "Импортировать слой", (d, p) => {
    if (guide) { d.tracingAsset = { format, name: file.name, originalFileName: file.name, mimeType: file.type, dataUri }; d.tracingVisible = true; return; }
    layer.zIndex = Math.max(0, ...d.layers.map(l => l.zIndex)) + 1;
    if (svg) layer.sourceSvg = svg;
    if (asset) { p.assets ??= {}; p.assets[asset.id] = asset; layer.assetId = asset.id; layer.transform = { x: 0, y: 0, rotation: 0, scaleX: image.naturalWidth / d.width, scaleY: image.naturalHeight / d.height }; }
    d.layers.push(layer);
  });
  if (created) openAsset({ kind: "artwork", id });
  return layer.id;
}
