// @vitest-environment jsdom
import { describe, it } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { TOKEN_MODULES, tokenEntity, tokenTemplate, tokenClips, tokenItems, tokenPreviewAssets } from "../src/data/chibiTokenPack";
import { DEFAULT_TOKEN_FACE, TOKEN_EMOTIONS } from "../src/lib/chibiFace";
import { evaluateExportScene, composeFrameSvg } from "../src/lib/exportFrames";
import { createSvgAssetRegistry } from "../src/lib/visualRenderer";
import type { Entity } from "../src/domain/types";

const enabled = !!process.env.CHIBI_PACK_OUTPUT;
const folder = resolve("public/asset-packs/chibi-tokens-v1"), assets = tokenPreviewAssets();
if (enabled) for (const [id, a] of Object.entries(assets)) a.dataUri = "data:image/png;base64," + readFileSync(resolve(folder, id.replace("token_atlas_", "") + ".png")).toString("base64");
const items = tokenItems(), resources = { assets, documents: [] };
type Sample = { entity: Entity; label: string; clip?: string; time?: number };
function sheet(file: string, samples: Sample[], cols = 4) {
  const registry = createSvgAssetRegistry(file), out = resolve(process.env.CHIBI_PACK_OUTPUT!, "fit-review"); mkdirSync(out, { recursive: true });
  const cells = samples.map(({ entity, label, clip, time = 0 }, i) => {
    const skin = Number(entity.templateId.split("_").at(-1)), template = tokenTemplate(skin), clips = tokenClips(template.id);
    const scene = evaluateExportScene(entity, template, clips, items, [], { key: file, clip: clips.find(c => c.name === clip) ?? null, frame: time * 24 / 1000, timeMs: time }, undefined, resources);
    return `<g transform="translate(${i % cols * 256},${Math.floor(i / cols) * 280})">${composeFrameSvg(scene, file.startsWith("scars") ? { x: -85, y: -180, size: 170 } : { x: -145, y: -255, size: 290 }, 256, registry)}<text x="128" y="270" text-anchor="middle" fill="#e8d4ac" font-family="sans-serif" font-size="12">${label}</text></g>`;
  }).join("");
  const width = cols * 256, height = Math.ceil(samples.length / cols) * 280;
  writeFileSync(resolve(out, `${file}.png`), new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${registry.definitions()}<rect width="${width}" height="${height}" fill="#26282b"/>${cells}</svg>`).render().asPng());
}
const face = { token_eyes: "face_extra_0", token_brows: "brows_extra_0", token_nose: "noses_extra_0", token_mouth: "face_plus_16" };
describe("native face acceptance sheets", () => {
  for (let head = 0; head < 4; head++) it.skipIf(!enabled)(`headgear review ${head}`, () => {
    sheet(`headgear-${head}`, TOKEN_MODULES.filter(m => m.slot === "token_headgear").map(m => ({ entity: tokenEntity(m.name, head, { ...face, token_headshape: `heads_${head * 4 + head}`, token_headgear: m.id }), label: m.name })));
  }, 30000);
  for (const mouth of ["face_plus_16", "face_plus_18", "face_extra_21"]) it.skipIf(!enabled)(`beard mouth review ${mouth}`, () => {
    sheet(`mouth-${mouth}`, TOKEN_MODULES.filter(m => m.slot === "token_beard").map(m => ({ entity: tokenEntity(m.name, 0, { ...face, token_beard: m.id, token_mouth: mouth }), label: m.name })), 4);
  }, 30000);
  for (const skin of [0, 2]) it.skipIf(!enabled)(`scar protection review ${skin}`, () => {
    const samples = TOKEN_MODULES.filter(m => m.slot === "token_scar").flatMap(m => [false, true].map(moved => ({ entity: tokenEntity(m.name, skin, { ...face, token_scar: m.id }, "idle", moved ? { token_scar: { x: 15, y: -35, scaleX: 1, scaleY: 1, rotation: 0 } } : {}), label: `${m.name}${moved ? " · над глазом" : " · щека"}` })));
    sheet(`scars-${skin}`, samples, 4);
  }, 30000);
  for (let group = 0; group < 2; group++) it.skipIf(!enabled)(`emotion review ${group}`, () => {
    const samples = TOKEN_EMOTIONS.slice(group * 3, group * 3 + 3).flatMap(emotion => [0, 325, 950, 1100].map(time => {
      const entity = tokenEntity(emotion.label, 0, face);
      entity.appearance!.tokenFace = { ...DEFAULT_TOKEN_FACE, emotion: emotion.value };
      return { entity, label: `${emotion.label} · ${time} мс`, clip: emotion.value === "auto" ? "trade" : "dance", time };
    }));
    sheet(`emotions-${group}`, samples, 4);
  }, 30000);
});
