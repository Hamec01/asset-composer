/**
 * Dev-only visual review: renders body variants or animation frames through the
 * export pipeline into a full-screen overlay. Load it in the running editor:
 *   const { reviewGrid } = await import("/tests/visual/reviewGrid.ts");
 *   await reviewGrid({ clip: "chibi_front__bow_shoot", t: [.3, .6] });
 */
import { useStore } from "../../src/store";
import { resolveTemplate } from "../../src/data/templates";
import { refreshCanonicalBuiltInTypedItems } from "../../src/lib/canonicalItems";
import { composeFrameSvg, evaluateExportScene, exportCamera, type ExportCamera } from "../../src/lib/exportFrames";
import type { CharacterAppearance } from "../../src/domain/types";

type Variant = Partial<CharacterAppearance>;
export const BODY_VARIANTS: Variant[] = [
  { sex: "male" }, { sex: "male", slimness: 1 }, { sex: "male", muscle: 1 }, { sex: "male", fat: 1 },
  { sex: "female" }, { sex: "female", slimness: 1 }, { sex: "female", muscle: 1 }, { sex: "female", fat: 1 },
];

export async function reviewGrid(opts: { variants?: Variant[]; clip?: string; t?: number[]; view?: "left" | "right"; items?: boolean; size?: number; camera?: ExportCamera } = {}) {
  document.getElementById("__review")?.remove();
  const project = useStore.getState().project;
  const base = project.entities[0];
  const template = resolveTemplate(project, base.templateId)!;
  const items = refreshCanonicalBuiltInTypedItems(project.items);
  const clip = opts.clip ? project.animationClips.find(c => c.id === opts.clip) ?? null : null;
  const variants = opts.variants ?? (clip ? [{}] : BODY_VARIANTS);
  const times = opts.t ?? [0];
  const scenes = variants.flatMap(variant => times.map(t => {
    const entity = { ...structuredClone(base), slots: base.slots.map(s => ({ ...s, itemId: opts.items ? s.itemId : null })),
      appearance: { ...base.appearance!, view: opts.view ?? base.appearance?.view ?? "right", slimness: 0, muscle: 0, fat: 0, ...variant } };
    return evaluateExportScene(entity, template, project.animationClips, items, project.itemFitProfiles,
      { key: "review", clip, frame: 0, timeMs: (clip?.durationMs ?? 0) * t });
  }));
  const camera = opts.camera ?? exportCamera(scenes);
  const size = opts.size ?? 220;
  const overlay = document.createElement("div");
  overlay.id = "__review";
  overlay.style.cssText = "position:fixed;inset:0;z-index:99999;background:#e8e4dc;display:flex;flex-wrap:wrap;gap:2px;align-content:flex-start";
  overlay.onclick = () => overlay.remove();
  for (const scene of scenes) {
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(composeFrameSvg(scene, camera, size));
    img.style.cssText = `width:${size}px;height:${size}px;background:#f4f1ea`;
    overlay.appendChild(img);
  }
  document.body.appendChild(overlay);
  return scenes.length;
}
