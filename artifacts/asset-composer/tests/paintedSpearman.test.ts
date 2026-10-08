// @vitest-environment jsdom
import { expect, it } from "vitest";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { createPaintedSpearman, appendPaintedSpearman, SPEARMAN_ATLAS_ID, SPEARMAN_SPEAR_ID } from "../src/data/paintedSpearman";
import { useStore } from "../src/store";
import { resolveTemplate } from "../src/data/templates";
import { ProjectSchema } from "../src/domain/schema";
import { setVisualResources } from "../src/lib/visualContent";
import { compactProjectAssets } from "../src/lib/projectAssets";
import { evaluateExportScene, exportCamera, composeFrameSvg } from "../src/lib/exportFrames";
import { buildAnimationReview, animationReviewArchive } from "../src/lib/animationReview";
import { evaluateSkeleton } from "../src/lib/evaluationPipeline";
import { armDiagnostics } from "../src/lib/armDiagnostics";
import { transformPoint } from "../src/lib/matrixUtils";
import { createSvgAssetRegistry } from "../src/lib/visualRenderer";
import { SPEARMAN_TEMPLATE_ID } from "../src/data/spearmanAnimation";
import type { Project, VisualAsset } from "../src/domain/types";

const assets: VisualAsset[] = [
  { id: SPEARMAN_ATLAS_ID, name: "spearman-atlas.png", mimeType: "image/png", width: 1242, height: 1266,
    dataUri: "data:image/png;base64," + readFileSync("src/assets/spearman/spearman-atlas.png").toString("base64") },
  { id: SPEARMAN_SPEAR_ID, name: "spearman-spear.png", mimeType: "image/png", width: 1024, height: 1536,
    dataUri: "data:image/png;base64," + readFileSync("src/assets/spearman/spearman-spear.png").toString("base64") },
];
function project(): Project {
  useStore.getState().newProject();
  const p = structuredClone(useStore.getState().project);
  appendPaintedSpearman(p, createPaintedSpearman(resolveTemplate(p, "biped_profile_base_v1")!, assets, "painted_spearman_test", 1));
  setVisualResources({ assets: p.assets!, documents: p.editorMeta.spriteEditorDocuments });
  return p;
}

it("persists a new segmented painted character, original face/weapon and two editable clips without losing existing entities", () => {
  const p = project();
  const e = p.entities.at(-1)!, t = resolveTemplate(p, e.templateId)!;
  expect(t.boneParts).toHaveLength(17);
  expect(t.boneParts!.filter(part => part.content?.kind === "composite")).toHaveLength(10);
  expect(e.faceCustomization?.beard?.content?.kind).toBe("composite");
  expect(p.animationClips.find(c => c.id === e.activeAnimationClipId)?.reviewMarkers?.at(-1)?.timeMs).toBe(1200);
  const portable = JSON.parse(JSON.stringify(compactProjectAssets(p)));
  const roundtrip = ProjectSchema.parse(portable);
  expect(roundtrip.entities).toEqual(portable.entities);
  expect(roundtrip.templates).toEqual(portable.templates);
  expect(roundtrip.assets).toEqual(portable.assets);
  expect(roundtrip.animationClips).toEqual(portable.animationClips);
});

it("keeps both palms on one rigid shaft and arm lengths fixed throughout the thrust in RIGHT and LEFT", () => {
  const p = project(), e = p.entities.at(-1)!, t = resolveTemplate(p, e.templateId)!;
  const clip = p.animationClips.find(c => c.id === "spearman__thrust")!;
  for (const view of ["right", "left"] as const) {
    const subject = { ...e, appearance: { ...e.appearance!, view } };
    const rest = evaluateSkeleton(t.bones, new Map(), subject.bodyMorphs, subject.appearance);
    for (let timeMs = 0; timeMs <= clip.durationMs; timeMs += 20) {
      const scene = evaluateExportScene(subject, t, p.animationClips, p.items, [], { key: "test", clip, frame: 0, timeMs });
      const arms = armDiagnostics(clip, timeMs, scene.skeleton, rest, undefined, view === "left").filter(a => a.id.startsWith("shoulder"));
      for (const arm of arms) {
        expect(arm.lengthError, `${view} ${timeMs} ${arm.id} length`).toBeLessThan(.001);
        expect(arm.gripError, `${view} ${timeMs} ${arm.id} grip`).toBeLessThan(.01);
      }
      const rear = arms.find(a => a.id === "shoulder_l")!;
      const forward = arms.find(a => a.id === "shoulder_r")!;
      expect(Math.hypot(forward.grip.x - rear.grip.x, forward.grip.y - rear.grip.y)).toBeCloseTo(46, 4);
      const facingSign = view === "right" ? 1 : -1;
      const leftElbow = scene.skeleton.bones.get("elbow_l")!;
      const rightElbow = scene.skeleton.bones.get("elbow_r")!;
      const leftShoulder = scene.skeleton.bones.get("shoulder_l")!;
      const rightShoulder = scene.skeleton.bones.get("shoulder_r")!;
      // Rear elbow stays beside its own shoulder; the guide arm reaches forward.
      // A zero grip error alone also passes the old crossed-arm assembly.
      expect((leftElbow.x - leftShoulder.x) * facingSign).toBeLessThan(0);
      expect((rightElbow.x - rightShoulder.x) * facingSign).toBeGreaterThan(0);
      expect((rightElbow.x - leftElbow.x) * facingSign).toBeGreaterThan(30);
      const spear = scene.visuals.find(v => v.itemId === "spearman_ash_spear")!;
      const hand = arms.find(a => a.id === "shoulder_r")!;
      const pivot = transformPoint(spear.worldMatrix, 0, 0);
      expect(Math.hypot(pivot.x - hand.grip.x, pivot.y - hand.grip.y)).toBeLessThan(.001);
      expect(spear.occlusionMasks).toHaveLength(2);
    }
  }
});

it.skipIf(!process.env.SPEARMAN_OUTPUT)("exports the portable scene, both shared combat reviews, a sprite sheet and animated preview", async () => {
  let p = project();
  if (process.env.SPEARMAN_BASE_PROJECT) {
    p = ProjectSchema.parse(JSON.parse(readFileSync(process.env.SPEARMAN_BASE_PROJECT, "utf8")));
    const existing = p.entities.find(e => e.templateId === SPEARMAN_TEMPLATE_ID);
    p.entities = p.entities.filter(e => e.templateId !== SPEARMAN_TEMPLATE_ID);
    appendPaintedSpearman(p, createPaintedSpearman(resolveTemplate(p, "biped_profile_base_v1")!, assets, existing?.id ?? "original_painted_spearman", Date.now()));
    setVisualResources({ assets: p.assets!, documents: p.editorMeta.spriteEditorDocuments });
  }
  const e = p.entities.at(-1)!, t = resolveTemplate(p, e.templateId)!, clip = p.animationClips.find(c => c.id === "spearman__thrust")!;
  const out = process.env.SPEARMAN_OUTPUT!; mkdirSync(out, { recursive: true });
  p.name = "Рисованный копейщик — укол копьём";
  writeFileSync(`${out}/spearman.project.json`, JSON.stringify(compactProjectAssets(p)));
  const previewScenes = [0, 540].map(timeMs => evaluateExportScene(e, t, p.animationClips, p.items, [], { key: "preview", clip, frame: 0, timeMs }));
  const previewCamera = exportCamera(previewScenes, .08);
  writeFileSync(`${out}/arm-poses.json`, JSON.stringify(previewScenes.map(scene => [...scene.skeleton.bones].filter(([id]) => /^(shoulder|elbow|hand)_/.test(id)).map(([id, b]) => ({ id, x: b.x, y: b.y }))), null, 2));
  for (const [i, scene] of previewScenes.entries()) writeFileSync(`${out}/${i ? "contact" : "guard"}.png`, new Resvg(composeFrameSvg(scene, previewCamera, 640)).render().asPng());
  if (process.env.SPEARMAN_PREVIEW_ONLY) return;
  const review = buildAnimationReview({ entity: e, template: t, clips: p.animationClips, clip, items: p.items, fitProfiles: p.itemFitProfiles, options: { showEquipment: true } });
  for (const sheet of review.sheets) {
    writeFileSync(`${out}/review-${sheet.facing}.svg`, sheet.svg);
    writeFileSync(`${out}/review-${sheet.facing}.png`, new Resvg(sheet.svg).render().asPng());
  }
  writeFileSync(`${out}/review.json`, JSON.stringify(review.report, null, 2));
  writeFileSync(`${out}/review.zip`, await animationReviewArchive(review, svg => new Resvg(svg).render().asPng()));
  const scenes = Array.from({ length: 37 }, (_, i) => evaluateExportScene(e, t, p.animationClips, p.items, [], { key: "preview", clip, frame: i, timeMs: i * 1000 / 30 }));
  const camera = exportCamera(scenes, .08);
  writeFileSync(`${out}/guard.png`, new Resvg(composeFrameSvg(scenes[0], camera, 640)).render().asPng());
  for (const [i, scene] of scenes.entries()) writeFileSync(`${out}/frame-${String(i).padStart(3, "0")}.png`, new Resvg(composeFrameSvg(scene, camera, 384)).render().asPng());
  const sheetAssets = createSvgAssetRegistry("spritesheet");
  const cells = scenes.slice(0, 36).map((scene, i) => composeFrameSvg({ ...scene, visuals: scene.visuals.map(v => ({ ...v, id: `frame_${i}_${v.id}` })) }, camera, 384, sheetAssets).replace("<svg ", `<svg x="${i % 6 * 384}" y="${Math.floor(i / 6) * 384}" `)).join("");
  const sheetSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="2304" height="2304">${sheetAssets.definitions()}${cells}</svg>`;
  writeFileSync(`${out}/spearman-thrust-spritesheet.png`, new Resvg(sheetSvg).render().asPng());
  writeFileSync(`${out}/spearman-thrust-spritesheet.json`, JSON.stringify({ fps: 30, durationMs: 1200, columns: 6, rows: 6, frameWidth: 384, frameHeight: 384, camera, frames: 36 }, null, 2));
  console.log("Spearman reviews", review.report.samples.map(s => ({ facing: s.facing, phase: s.label, arms: s.arms.filter(a => a.id.startsWith("shoulder")).map(a => ({ id: a.id, grip: a.gripError, warnings: a.warnings })), clearance: s.headClearance })));
}, 300000);
