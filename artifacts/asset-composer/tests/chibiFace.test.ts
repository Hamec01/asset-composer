// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { tokenEntity, tokenTemplate, tokenClips, tokenItems, tokenPreviewAssets } from "../src/data/chibiTokenPack";
import { Resvg } from "@resvg/resvg-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_TOKEN_FACE, TOKEN_BEARD_MOUTHS, tokenExpressionAt } from "../src/lib/chibiFace";
import { evaluateExportScene, composeFrameSvg } from "../src/lib/exportFrames";
import { transformPoint } from "../src/lib/matrixUtils";
import { EntitySchema } from "../src/domain/schema";
import { createSvgAssetRegistry } from "../src/lib/visualRenderer";

const template = tokenTemplate(), clips = tokenClips(template.id), items = tokenItems();
const subject = () => tokenEntity("Лицо", 0, { token_eyes: "face_0", token_mouth: "face_plus_16", token_brows: "brows_extra_0", token_beard: "beards_extra_0", token_scar: "face_12" });
function render(e = subject(), name = "idle", timeMs = 0) {
  return evaluateExportScene(e, template, clips, items, [], { key: "face", clip: clips.find(c => c.name === name)!, frame: timeMs * 24 / 1000, timeMs }, undefined, { assets: tokenPreviewAssets(), documents: [] });
}
describe("chibi facial fitting and animation", () => {
  it("keeps mask identifiers unique across frames sharing an exported sprite sheet", () => {
    const registry = createSvgAssetRegistry("face-frames");
    const frames = [render(subject(), "idle", 1060), render(subject(), "idle", 1140)];
    const body = frames.map(scene => composeFrameSvg(scene, { x: -145, y: -255, size: 290 }, 256, registry)).join("");
    const ids = [...(registry.definitions() + body).matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    expect(ids.length).toBeGreaterThan(4);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("renders visible closed eyelids and keeps a cheek scar visible while protecting the cornea", () => {
    const assets = tokenPreviewAssets();
    assets.token_atlas_face.dataUri = "data:image/png;base64," + readFileSync(resolve("public/asset-packs/chibi-tokens-v1/face.png")).toString("base64");
    const alpha = (scene: ReturnType<typeof render>, slot: string, masks = true) => {
      const visual = scene.visuals.find(v => v.slotId === slot)!;
      const frame = { ...scene, visuals: [{ ...visual, assetResources: assets, ...(masks ? {} : { occlusionMasks: [] }) }] };
      const pixels = new Resvg(composeFrameSvg(frame, { x: -145, y: -255, size: 290 }, 256)).render().pixels;
      return pixels.reduce((sum, value, i) => sum + (i % 4 === 3 ? value : 0), 0);
    };
    const rest = render();
    expect(alpha(rest, "token_scar")).toBeGreaterThan(100);
    // Applying an otherwise empty mask can change edge antialiasing by one alpha unit.
    expect(Math.abs(alpha(rest, "token_scar") - alpha(rest, "token_scar", false))).toBeLessThanOrEqual(2);
    expect(alpha(render(subject(), "idle", 1100), "token_eyes")).toBeGreaterThan(100);
    const moved = subject(); moved.slots.find(s => s.slotId === "token_scar")!.attachmentOverride = { offsetX: 15, offsetY: -33 };
    expect(alpha(render(moved), "token_scar")).toBeLessThan(alpha(render(moved), "token_scar", false));
  });
  it("positions the mouth in the actual beard opening in both directions and follows beard adjustment", () => {
    for (const view of ["left", "right"] as const) {
      const e = subject(); e.appearance!.view = view;
      e.slots.find(s => s.slotId === "token_beard")!.attachmentOverride = { offsetX: 8, offsetY: -5, scaleX: 1.12, scaleY: .9, rotation: 8 };
      const scene = render(e), beard = scene.visuals.find(v => v.slotId === "token_beard")!, mouth = scene.visuals.find(v => v.slotId === "token_mouth")!;
      const socket = TOKEN_BEARD_MOUTHS.beards_extra_0;
      const expected = transformPoint(beard.worldMatrix, 94 * socket.x, 50 * socket.y);
      const actual = transformPoint(mouth.worldMatrix, 27 / 2, 8 / 2);
      expect(actual.x).toBeCloseTo(expected.x); expect(actual.y).toBeCloseTo(expected.y);
      expect(mouth.zIndex).toBeLessThan(beard.zIndex);
      expect(mouth.worldBounds.maxY - mouth.worldBounds.minY).toBeLessThan(12);
    }
  });
  it("protects the eye socket even when a scar is moved over it, and clips head anatomy only in normal art", () => {
    const e = subject(); e.slots.find(s => s.slotId === "token_scar")!.attachmentOverride = { offsetY: -35 };
    expect(render(e).visuals.find(v => v.slotId === "token_scar")!.occlusionMasks?.[0].id).toContain("eye-protection");
    e.slots.find(s => s.slotId === "token_headgear")!.itemId = "token_item_helmets_0";
    const head = render(e).visuals.find(v => v.anatomicalBody && v.boneId === "head")!;
    expect(head.occlusionMasks?.some(m => m.id.includes("hat-aperture"))).toBe(true);
  });
  it("animates the chosen brows, mouth and eyelids deterministically and never invents missing parts", () => {
    const e = subject(); e.slots.find(s => s.slotId === "token_beard")!.itemId = null;
    const start = render(e, "dance", 0), happy = render(e, "dance", 325);
    expect(happy.visuals.find(v => v.slotId === "token_mouth")!.content).not.toEqual(start.visuals.find(v => v.slotId === "token_mouth")!.content);
    expect(happy.visuals.find(v => v.slotId === "token_brows")!.worldMatrix).not.toEqual(start.visuals.find(v => v.slotId === "token_brows")!.worldMatrix);
    expect(render(e, "idle", 1100).visuals.find(v => v.slotId === "token_eyes")!.content?.kind).toBe("vector");
    expect(render(e, "dance", 325).visuals).toEqual(happy.visuals);
    const bare = tokenEntity("Без лица", 0, {});
    expect(render(bare, "dance", 325).visuals.some(v => v.slotId)).toBe(false);
    e.appearance!.tokenFace = { emotion: "neutral", blink: false, mouthMotion: false };
    expect(render(e, "idle", 1100).visuals.find(v => v.slotId === "token_eyes")!.content?.kind).toBe("composite");
    expect(tokenExpressionAt(e, { clip: clips.find(c => c.name === "dance")!, timeMs: 325 })).toMatchObject({ emotion: "neutral", blink: 1, mouth: 0, brow: 0 });
  });
  it("retains facial settings through portable validation while legacy projects use defaults", () => {
    const e = subject(); e.appearance!.tokenFace = { ...DEFAULT_TOKEN_FACE, emotion: "happy", blink: false };
    expect(EntitySchema.parse(JSON.parse(JSON.stringify(e))).appearance!.tokenFace).toEqual(e.appearance!.tokenFace);
    delete e.appearance!.tokenFace;
    expect(EntitySchema.parse(e).appearance!.tokenFace).toBeUndefined();
    expect(tokenExpressionAt(e, { clip: clips.find(c => c.name === "indignation")!, timeMs: 300 }).emotion).toBe("angry");
  });
});
