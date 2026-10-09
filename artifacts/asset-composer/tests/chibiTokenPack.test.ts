// @vitest-environment jsdom
import { afterAll, describe, expect, it } from "vitest";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { zipSync, strToU8 } from "fflate";
import atlasData from "../public/asset-packs/chibi-tokens-v1/atlases.json";
import { addTokenToProject, DEFAULT_TOKEN_FIT, TOKEN_MODULES, TOKEN_SKINS, tokenClips, tokenEntity, tokenItems, tokenTemplate, tokenPreviewAssets, tokenFitFromOverride } from "../src/data/chibiTokenPack";
import { TOKEN_ANIMATIONS, tokenRecommendedItem } from "../src/data/chibiTokenAnimations";
import { isTokenCombat, tokenAction } from "../src/data/chibiWorkAnimations";
import { ProjectSchema } from "../src/domain/schema";
import { useStore } from "../src/store";
import { setVisualResources } from "../src/lib/visualContent";
import { evaluateExportScene, composeFrameSvg, exportCamera, exportFramePlan } from "../src/lib/exportFrames";
import { buildAnimationReview } from "../src/lib/animationReview";
import { supportsAnimationXRay } from "../src/lib/animationXRay";
import { resolveClipPose } from "../src/lib/animationRuntime";
import { contentSvg, createSvgAssetRegistry } from "../src/lib/visualRenderer";
import { tokenRegion } from "../src/data/chibiTokenPack";
import { createEditableBodyPart } from "../src/lib/bodyPartAuthoring";
import { createDocumentFromEntityVisual } from "../src/lib/spriteEditor";

const folder = resolve("public/asset-packs/chibi-tokens-v1");
const assets = tokenPreviewAssets();
for (const [id, a] of Object.entries(assets)) a.dataUri = "data:image/png;base64," + readFileSync(resolve(folder, id.replace("token_atlas_", "") + ".png")).toString("base64");
const items = tokenItems();
const resources = { assets, documents: [] };
const archive: Record<string, Uint8Array> = {};
setVisualResources(resources);

function subject(name = "idle", skin = 0) {
  const recommended = isTokenCombat(name) ? tokenRecommendedItem(name) : null;
  const a = tokenAction(name);
  return tokenEntity("Чиби · проверка", skin, { token_eyes: "face_0", token_hair: "hair_0", token_torso: "clothes_0", token_nose: "face_8", token_brows: "brows_extra_0", token_mouth: "face_plus_16",
    ...(recommended ? { token_main: recommended } : {}), ...(name === "bow_attack" || a?.props.includes("weapons_7") ? { token_projectile: "weapons_7" } : {}),
    ...(a?.props.includes("weapons_6") ? { token_off: "weapons_6" } : {}),
  }, name);
}
describe("modular chibi token pack", () => {
  it("keeps all modules, four bases and requested clips portable through project validation", () => {
    expect(TOKEN_MODULES).toHaveLength(265); expect(TOKEN_ANIMATIONS).toHaveLength(123);
    expect(new Set(TOKEN_MODULES.map(m => m.id)).size).toBe(TOKEN_MODULES.length);
    const project = structuredClone(useStore.getState().project);
    for (let skin = 0; skin < 4; skin++) addTokenToProject(project, subject("idle", skin), assets);
    const parsed = ProjectSchema.parse(JSON.parse(JSON.stringify(project)));
    expect(parsed.templates.filter(t => t.skeletonFamily === "chibi_token_v1")).toHaveLength(4);
    expect(parsed.items.filter(i => i.tags.includes("chibi-tokens-v1"))).toHaveLength(TOKEN_MODULES.length);
    expect(parsed.animationClips.filter(c => c.skeletonFamily === "chibi_token_v1")).toHaveLength(TOKEN_ANIMATIONS.length * 4);
    expect(Object.keys(parsed.assets!)).toEqual(expect.arrayContaining(Object.keys(assets)));
  });
  it("keeps artwork centered on the rig, uses only real token bones, and matches both mirrored directions", () => {
    const template = tokenTemplate(), clips = tokenClips(template.id), entity = subject();
    for (const direction of ["right", "left"] as const) {
      const scene = evaluateExportScene({ ...entity, appearance: { ...entity.appearance!, view: direction } }, template, clips, items, [], { key: "test", clip: clips[0], frame: 0, timeMs: 0 }, undefined, resources);
      const clothing = scene.visuals.find(v => v.itemId === "token_item_clothes_0")!;
      expect(Math.abs((clothing.worldBounds.minX + clothing.worldBounds.maxX) / 2)).toBeLessThan(.01);
      expect(supportsAnimationXRay(evaluateExportScene(entity, template, clips, [], [], { key: "bare", clip: clips[0], frame: 0, timeMs: 0 }, undefined, resources))).toBe(true);
      expect([...scene.skeleton.bones.keys()].some(id => /^(shoulder|hand|hip|knee|foot)_/.test(id))).toBe(false);
    }
    for (const clip of clips) {
      const bare = tokenEntity("Без предметов", 0, {}, clip.name);
      expect(evaluateExportScene(bare, template, clips, items, [], { key: "no-props", clip, frame: 0, timeMs: clip.durationMs / 2 }, undefined, resources).visuals.some(v => v.itemId)).toBe(false);
      expect(exportFramePlan(entity, template, clips, [clip.id]).length).toBe(Math.ceil(clip.durationMs * clip.fps / 1000));
      for (const track of clip.layers.flatMap(l => l.tracks)) {
        expect(template.bones.some(b => b.id === track.boneId)).toBe(true);
        expect(track.keyframes[0].timeMs).toBe(0);
        expect(track.keyframes.at(-1)!.timeMs).toBe(clip.durationMs);
      }
      for (let i = 0; i <= 12; i++) for (const transform of resolveClipPose(clip, i * clip.durationMs / 12).values()) {
        expect(Object.values(transform).every(Number.isFinite)).toBe(true);
      }
    }
  });
  it("preserves cropped raster body parts when opening an editable document and replacing the part", () => {
    const template = tokenTemplate(), entity = tokenEntity("Основа", 0, {}), clips = tokenClips(template.id);
    for (const part of template.boneParts!) {
      const replacement = createEditableBodyPart(part);
      replacement.bodyView = "side";
      expect(replacement.content).toEqual(part.content);
      const document = createDocumentFromEntityVisual(entity.id, replacement);
      expect(document.layers[0].sourceSvg).toContain("data:image/png;base64,");
      expect(document.layers[0].locked).toBe(true);
      const before = evaluateExportScene(entity, template, clips, items, [], { key: "before", clip: null, frame: 0, timeMs: 0 }, undefined, resources);
      replacement.content = { kind: "document", documentId: document.id };
      const after = evaluateExportScene({ ...entity, visuals: [replacement] }, template, clips, items, [], { key: "after", clip: null, frame: 0, timeMs: 0 }, undefined, { assets, documents: [document] });
      expect(after.visuals.find(v => v.entityVisualId === replacement.id)!.worldBounds).toEqual(before.visuals.find(v => v.id === `part__${part.id}`)!.worldBounds);
      setVisualResources({ assets, documents: [document] });
      expect(composeFrameSvg(after, { x: -140, y: -240, size: 280 }, 256)).toContain("data:image/png;base64,");
    }
    setVisualResources(resources);
  });
  it("keeps beard fitting centered, roundtrips it, hides hair under hats and draws the mouth inside the beard opening", () => {
    const template = tokenTemplate(), clips = tokenClips(template.id);
    const fit = { ...DEFAULT_TOKEN_FIT, x: -8, y: 4, scaleX: 1.2, scaleY: .7, rotation: 12 };
    const e = tokenEntity("Подгонка", 0, { token_beard: "extras_1", token_mouth: "face_plus_18", token_hair: "hair_plus_0", token_headgear: "helmets_7" }, "idle", { token_beard: fit });
    const m = TOKEN_MODULES.find(m => m.id === "extras_1")!;
    const saved = JSON.parse(JSON.stringify(e));
    const recovered = tokenFitFromOverride(m, saved.slots.find((s: {slotId: string}) => s.slotId === "token_beard").attachmentOverride);
    for (const key of ["x", "y", "scaleX", "scaleY", "rotation"] as const) expect(recovered[key]).toBeCloseTo(fit[key], 10);
    for (const direction of ["right", "left"] as const) {
      const scene = evaluateExportScene({ ...saved, appearance: { ...saved.appearance, view: direction } }, template, clips, items, [], { key: "fit", clip: null, frame: 0, timeMs: 0 }, undefined, resources);
      expect(scene.visuals.some(v => v.slotId === "token_hair")).toBe(false);
      expect(scene.visuals.find(v => v.slotId === "token_mouth")!.zIndex).toBeLessThan(scene.visuals.find(v => v.slotId === "token_beard")!.zIndex);
      const beard = scene.visuals.find(v => v.slotId === "token_beard")!;
      expect((beard.worldBounds.minX + beard.worldBounds.maxX) / 2).toBeCloseTo(direction === "right" ? m.x + fit.x : -m.x - fit.x);
    }
    saved.slots.find((s: {slotId: string}) => s.slotId === "token_headgear").itemId = null;
    expect(evaluateExportScene(saved, template, clips, items, [], { key: "hair", clip: null, frame: 0, timeMs: 0 }, undefined, resources).visuals.some(v => v.slotId === "token_hair")).toBe(true);
  });
  it("prevents shield with two-handed equipment through the store, supports undo, and retains actual head anatomy", () => {
    const p = structuredClone(useStore.getState().project), e = tokenEntity("Щит", 0, { token_off: "weapons_6", token_headshape: "heads_3" });
    addTokenToProject(p, e, assets); useStore.getState().loadProject(p);
    useStore.getState().setEntitySlot(e.id, "token_main", "token_item_weapons_3");
    const active = () => useStore.getState().project.entities.find(x => x.id === e.id)!;
    expect(active().slots.find(s => s.slotId === "token_off")!.itemId).toBeNull();
    useStore.getState().undo(); expect(active().slots.find(s => s.slotId === "token_off")!.itemId).toBe("token_item_weapons_6");
    useStore.getState().setEntitySlot(e.id, "token_main", "token_item_weapons_0");
    useStore.getState().setEntitySlot(e.id, "token_off", "token_item_weapons_6");
    expect(active().slots.find(s => s.slotId === "token_main")!.itemId).toBeNull();
    const template = tokenTemplate(), scene = evaluateExportScene(active(), template, tokenClips(template.id), items, [], { key: "head", clip: null, frame: 0, timeMs: 0 }, undefined, resources);
    expect(scene.visuals.filter(v => v.anatomicalBody && v.boneId === "head")).toHaveLength(1);
    expect(supportsAnimationXRay(scene)).toBe(true);
    expect(template.bones.find(b => b.id === "token_offhand")!.parentId).toBe("chest");
  });
  it("fits every hair and beard to all head widths in both directions without changing manual fitting", () => {
    const template = tokenTemplate(), clips = tokenClips(template.id);
    for (const m of TOKEN_MODULES.filter(m => ["token_hair", "token_beard", "token_headgear"].includes(m.slot))) {
      for (const direction of ["right", "left"] as const) {
        const e = tokenEntity("Подгонка к голове", 0, { [m.slot]: m.id }, "idle", { [m.slot]: { ...DEFAULT_TOKEN_FIT, x: 3, scaleX: 1.07, scaleY: .95 } });
        e.appearance!.view = direction;
        const measure = (subject: typeof e) => {
          const scene = evaluateExportScene(subject, template, clips, items, [], { key: "head-fit", clip: null, frame: 0, timeMs: 0 }, undefined, resources);
          const b = scene.visuals.find(v => v.slotId === m.slot)!.worldBounds;
          return b.maxX - b.minX;
        };
        const original = measure(e);
        for (let head = 0; head < 4; head++) {
          const shape = TOKEN_MODULES.find(x => x.id === `heads_${head}`)!;
          const shaped = { ...e, slots: e.slots.map(s => s.slotId === "token_headshape" ? { ...s, itemId: `token_item_${shape.id}` } : s) };
          expect(measure(shaped)).toBeCloseTo(original * shape.width / 134, 6);
        }
      }
    }
  });
  it("renders atlas crops, exports the deliverable and generates shared animation reviews on request", () => {
    if (!process.env.CHIBI_PACK_OUTPUT) return;
    const out = resolve(process.env.CHIBI_PACK_OUTPUT), reviews = resolve(out, "review"); mkdirSync(reviews, { recursive: true });
    const template = tokenTemplate(), clips = tokenClips(template.id);
    for (const a of Object.values(atlasData)) archive[a.file] = readFileSync(resolve(folder, a.file));
    for (const name of ["atlases.json", "README.ru.md", "prompts.json", "animation-acceptance.md"]) archive[name] = readFileSync(resolve(folder, name));
    archive["animations.json"] = strToU8(JSON.stringify(TOKEN_ANIMATIONS, null, 2));
    archive["modules.json"] = strToU8(JSON.stringify(TOKEN_MODULES, null, 2));
    writeFileSync(resolve(out, "modules.json"), archive["modules.json"]);
    archive["rigs.json"] = strToU8(JSON.stringify(TOKEN_SKINS.map((_, i) => tokenTemplate(i)), null, 2));
    writeFileSync(resolve(out, "rigs.json"), archive["rigs.json"]);
    const p = structuredClone(useStore.getState().project); p.id = "chibi-tokens-v1"; p.name = "Чиби-токены v1"; p.entities = []; p.items = []; p.animationClips = []; p.templates = [];
    for (let skin = 0; skin < 4; skin++) {
      const base = tokenEntity(`Чистая основа · ${TOKEN_SKINS[skin]}`, skin, {}); addTokenToProject(p, base, assets);
    }
    const samples = [
      { name: "Житель", selected: { token_eyes: "face_0", token_hair: "hair_0", token_nose: "face_8", token_torso: "clothes_0" } },
      { name: "Следопыт", selected: { token_eyes: "face_1", token_hair: "hair_1", token_nose: "face_9", token_freckles: "face_14", token_torso: "clothes_1", token_main: "weapons_0" } },
      { name: "Маг", selected: { token_eyes: "face_plus_0", token_brows: "face_plus_14", token_mouth: "face_plus_17", token_hair: "hair_plus_1", token_circlet: "extras_6", token_torso: "clothes_2" } },
      { name: "Рыцарь", selected: { token_headgear: "helmets_0", token_torso: "clothes_5", token_eyes: "face_0", token_main: "weapons_2", token_off: "weapons_6" } },
      { name: "Паладин", selected: { token_headgear: "helmets_5", token_torso: "clothes_6", token_main: "weapons_3" } },
      { name: "Викинг", selected: { token_headgear: "helmets_4", token_torso: "clothes_4", token_beard: "extras_1", token_eyes: "face_4", token_main: "weapons_4" } },
      { name: "Разведчица", selected: { token_eyes: "face_plus_4", token_mouth: "face_plus_16", token_hair: "hair_plus_5", token_torso: "clothes_3", token_scar: "face_12" } },
      { name: "Торговец", selected: { token_headshape: "heads_14", token_eyes: "face_0", token_hair: "hair_0", token_headgear: "helmets_7", token_mouth: "face_plus_17", token_beard: "extras_0", token_torso: "clothes_7", token_main: "props_2" } },
    ];
    const scenes = samples.map((s, i) => {
      const e = tokenEntity(s.name, i % 4, s.selected); addTokenToProject(p, e, assets);
      return evaluateExportScene(e, tokenTemplate(i % 4), tokenClips(e.templateId), items, [], { key: "overview", clip: null, frame: 0, timeMs: 0 }, undefined, resources);
    });
    p.activeEntityId = p.entities[4].id;
    for (const age of ["child", "teen", "adult", "elder"] as const) for (const sex of ["male", "female"] as const) {
      const e = tokenEntity(`Чистая основа · ${age} · ${sex}`, 0, {}, "idle", {}, sex, age);
      addTokenToProject(p, e, assets);
    }
    p.activeEntityId = p.entities[4].id;
    ProjectSchema.parse(p);
    archive["asset-composer-project.json"] = strToU8(JSON.stringify(p));
    writeFileSync(resolve(out, "asset-composer-project.json"), archive["asset-composer-project.json"]);
    const registry = createSvgAssetRegistry("overview");
    const cells = scenes.map((scene, i) => `<g transform="translate(${i % 4 * 320},${Math.floor(i / 4) * 360})">${composeFrameSvg(scene, { x: -140, y: -240, size: 280 }, 320, registry)}<text x="160" y="344" text-anchor="middle" fill="#e8d4ac" font-family="sans-serif" font-size="18">${samples[i].name}</text></g>`).join("");
    const preview = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">${registry.definitions()}<rect width="1280" height="720" fill="#28272a"/>${cells}</svg>`;
    writeFileSync(resolve(out, "preview.png"), new Resvg(preview).render().asPng()); archive["preview.png"] = readFileSync(resolve(out, "preview.png"));
    const expansion = TOKEN_MODULES.filter(m => ["heads", "hair_plus", "face_plus", "hair_extra", "beards_extra", "brows_extra", "face_extra", "noses_extra"].includes(m.atlas));
    const expansionRegistry = createSvgAssetRegistry("expansion");
    const expandedCells = expansion.map((m, i) => {
      const scale = Math.min(140 / m.width, 132 / m.height), w = m.width * scale, h = m.height * scale;
      return `<g transform="translate(${i % 8 * 160},${Math.floor(i / 8) * 180})">${contentSvg(tokenRegion(m.atlas, m.index, m.width, m.height, m.mirror), w, h, assets, expansionRegistry).replace('<svg ', `<svg x="${(160 - w) / 2}" y="${(140 - h) / 2}" `)}<text x="80" y="157" text-anchor="middle" fill="#e8d4ac" font-family="sans-serif" font-size="10">${m.name.split(" · ")[0]}</text></g>`;
    }).join("");
    const expansionHeight = Math.ceil(expansion.length / 8) * 180;
    const expansionSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="${expansionHeight}">${expansionRegistry.definitions()}<rect width="1280" height="${expansionHeight}" fill="#28272a"/>${expandedCells}</svg>`;
    archive["new-modules-preview.png"] = new Resvg(expansionSvg).render().asPng(); writeFileSync(resolve(out, "new-modules-preview.png"), archive["new-modules-preview.png"]);
    for (const slot of ["token_hair", "token_beard"]) {
      const modules = TOKEN_MODULES.filter(m => m.slot === slot), fittingRegistry = createSvgAssetRegistry(`fitting-${slot}`);
      const fittingCells = modules.map((m, i) => {
        const subject = tokenEntity(m.name, 0, { token_eyes: "face_0", token_nose: "face_8", token_mouth: "face_plus_16", [slot]: m.id });
        const scene = evaluateExportScene(subject, template, clips, items, [], { key: "fitting", clip: null, frame: 0, timeMs: 0 }, undefined, resources);
        return `<g transform="translate(${i % 6 * 256},${Math.floor(i / 6) * 300})">${composeFrameSvg(scene, { x: -145, y: -255, size: 290 }, 256, fittingRegistry)}<text x="128" y="284" text-anchor="middle" fill="#e8d4ac" font-family="sans-serif" font-size="12">${m.id} · ${m.name}</text></g>`;
      }).join("");
      const height = Math.ceil(modules.length / 6) * 300;
      const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="${height}">${fittingRegistry.definitions()}<rect width="1536" height="${height}" fill="#28272a"/>${fittingCells}</svg>`;
      const file = `${slot === "token_hair" ? "hair" : "beards"}-fitting.png`;
      archive[file] = new Resvg(sheet).render().asPng(); writeFileSync(resolve(out, file), archive[file]);
    }
    for (const m of TOKEN_MODULES) {
      const a = atlasData[m.atlas], r = a.rects[m.index];
      archive[`modules/${m.id}.svg`] = strToU8(`<svg xmlns="http://www.w3.org/2000/svg" width="${m.width}" height="${m.height}" viewBox="${r.join(" ")}"><g${m.mirror ? ` transform="translate(${2 * r[0] + r[2]} 0) scale(-1 1)"` : ""}><image href="../${a.file}" width="${a.width}" height="${a.height}"/></g></svg>`);
    }
  }, process.env.CHIBI_PACK_OUTPUT ? 120000 : 30000);
  for (let head = 0; head < 4; head++) it.skipIf(!process.env.CHIBI_PACK_OUTPUT)(`head fitting review ${head}`, () => {
    const out = resolve(process.env.CHIBI_PACK_OUTPUT!, "fit-review"); mkdirSync(out, { recursive: true });
    const modules = TOKEN_MODULES.filter(m => ["token_hair", "token_beard"].includes(m.slot));
    const template = tokenTemplate(), clips = tokenClips(template.id), registry = createSvgAssetRegistry(`head-fit-${head}`);
    const cells = modules.map((m, i) => {
      const e = tokenEntity(m.name, 0, { token_headshape: `heads_${head}`, token_eyes: "face_0", token_nose: "face_8", token_mouth: "face_plus_16", [m.slot]: m.id });
      const scene = evaluateExportScene(e, template, clips, items, [], { key: "head-fit", clip: null, frame: 0, timeMs: 0 }, undefined, resources);
      return `<g transform="translate(${i % 6 * 256},${Math.floor(i / 6) * 280})">${composeFrameSvg(scene, { x: -145, y: -255, size: 290 }, 256, registry)}<text x="128" y="270" text-anchor="middle" fill="#e8d4ac" font-family="sans-serif" font-size="11">${m.id}</text></g>`;
    }).join("");
    const height = Math.ceil(modules.length / 6) * 280;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="${height}">${registry.definitions()}<rect width="1536" height="${height}" fill="#28272a"/>${cells}</svg>`;
    writeFileSync(resolve(out, `head-${head}.png`), new Resvg(svg).render().asPng());
  }, 30000);
  for (const c of tokenClips(tokenTemplate().id)) it.skipIf(!process.env.CHIBI_PACK_OUTPUT)(`export and review ${c.name}`, () => {
    const out = resolve(process.env.CHIBI_PACK_OUTPUT!), reviews = resolve(out, "review"), sprites = resolve(out, "sprites");
    mkdirSync(sprites, { recursive: true }); mkdirSync(reviews, { recursive: true });
    const template = tokenTemplate(), clips = tokenClips(template.id), e = subject(c.name);
    if (isTokenCombat(c.name)) {
      const review = buildAnimationReview({ entity: e, template, clips, clip: c, items, options: { mode: "rig", showEquipment: true, markers: true, depthShading: true } });
      for (const sheet of review.sheets) {
        const bytes = new Resvg(sheet.svg, { fitTo: { mode: "width", value: 960 } }).render().asPng();
        writeFileSync(resolve(reviews, `${c.name}-${sheet.facing}.png`), bytes); archive[`review/${c.name}-${sheet.facing}.png`] = bytes;
      }
      const json = JSON.stringify(review.report, null, 2); writeFileSync(resolve(reviews, `${c.name}.json`), json); archive[`review/${c.name}.json`] = strToU8(json);
    }
    const bare = tokenEntity("Чистая анимация", 0, {}, c.name);
    const plan = exportFramePlan(bare, template, clips, [c.id]);
    const frames = plan.map(spec => evaluateExportScene(bare, template, clips, items, [], spec, undefined, resources));
    const camera = exportCamera(frames, .1), registry = createSvgAssetRegistry("sheet"), cols = 8, rows = Math.ceil(frames.length / cols);
    const cells = frames.map((scene, i) => `<g transform="translate(${i % cols * 256},${Math.floor(i / cols) * 256})">${composeFrameSvg(scene, camera, 256, registry)}</g>`).join("");
    const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * 256}" height="${rows * 256}">${registry.definitions()}${cells}</svg>`;
    const bytes = new Resvg(sheet).render().asPng();
    archive[`sprites/${c.name}.png`] = bytes; writeFileSync(resolve(sprites, `${c.name}.png`), bytes);
    const metadata = { name: c.name, label: c.label, appearance: "bare", age: "adult", fps: c.fps, loops: c.loops, durationMs: c.durationMs, cols, rows, camera, frameWidth: 256, frameHeight: 256, recommendedItem: tokenRecommendedItem(c.name), frames: plan.map((spec, i) => ({ x: i % cols * 256, y: Math.floor(i / cols) * 256, w: 256, h: 256, timeMs: spec.timeMs, rootPivot: { x: -camera.x / camera.size * 256, y: -camera.y / camera.size * 256 } })) };
    archive[`sprites/${c.name}.json`] = strToU8(JSON.stringify(metadata, null, 2)); writeFileSync(resolve(sprites, `${c.name}.json`), archive[`sprites/${c.name}.json`]);
  }, 30000);
  afterAll(() => {
    if (!process.env.CHIBI_PACK_OUTPUT) return;
    const out = resolve(process.env.CHIBI_PACK_OUTPUT);
    for (const sub of ["sprites", "review", "fit-review"].filter(sub => existsSync(resolve(out, sub)))) for (const file of readdirSync(resolve(out, sub))) {
      if (/\.(png|json)$/.test(file)) archive[`${sub}/${file}`] = readFileSync(resolve(out, sub, file));
    }
    writeFileSync(resolve(out, "chibi-tokens-v1.zip"), zipSync(archive, { level: 1 }));
  }, 30000);
});
