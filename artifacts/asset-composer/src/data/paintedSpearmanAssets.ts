import atlasUrl from "@/assets/spearman/spearman-atlas.png";
import spearUrl from "@/assets/spearman/spearman-spear.png";
import type { VisualAsset } from "@/domain/types";
import { SPEARMAN_ATLAS_ID, SPEARMAN_SPEAR_ID } from "./paintedSpearman";

let pending: Promise<VisualAsset[]> | undefined;
export function loadPaintedSpearmanAssets() {
  return pending ??= Promise.all([
    [SPEARMAN_ATLAS_ID, atlasUrl, 1242, 1266], [SPEARMAN_SPEAR_ID, spearUrl, 1024, 1536],
  ].map(async ([id, url, width, height]) => {
    const response = await fetch(String(url));
    if (!response.ok) throw new Error("Не удалось загрузить рисунок копейщика");
    const blob = await response.blob();
    const dataUri = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Не удалось прочитать рисунок копейщика"));
      reader.readAsDataURL(blob);
    });
    return { id: String(id), name: String(id), mimeType: "image/png" as const, width: Number(width), height: Number(height), dataUri };
  })).catch(error => { pending = undefined; throw error; });
}
