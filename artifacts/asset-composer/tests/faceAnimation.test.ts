// @vitest-environment jsdom
import { expect, it } from "vitest";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { eyeOpennessAt, mouthOpennessAt, DEFAULT_BLINK } from "../src/lib/faceAnimation";
import { chibiFeatureSvg, DEFAULT_APPEARANCE } from "../src/data/characterAppearance";
import { CHIBI_BROWS } from "../src/data/chibiFaceArt";
import { faceArtworkVisuals, mouthArtworkVisuals } from "../src/lib/faceArtwork";
import { PAINTED_APPEARANCE } from "../src/data/paintedAppearance";
import { useStore } from "../src/store";
import { resolveTemplate } from "../src/data/templates";
import {
  evaluateExportScene,
  composeFrameSvg,
  exportCamera,
} from "../src/lib/exportFrames";
import { ProjectSchema } from "../src/domain/schema";
import { compactProjectAssets } from "../src/lib/projectAssets";
import { visualSvg } from "../src/lib/visualRenderer";
import type {
  AnimationClip,
  FaceFeatureConfig,
  VisualAsset,
} from "../src/domain/types";

const clip: AnimationClip = {
  id: "face_review",
  name: "face_review",
  label: "Face review",
  skeletonFamily: "humanoid_side_v1",
  durationMs: 2600,
  fps: 30,
  loops: true,
  layers: [],
};
const config: FaceFeatureConfig = {
  presetId: "painted_eye",
  visible: true,
  color: "#493735",
  transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
  eyeOpenness: 1,
  blink: DEFAULT_BLINK,
};
const resources = {
  assets: Object.fromEntries(
    Object.keys(PAINTED_APPEARANCE).map((id) => [
      id,
      {
        id,
        name: id,
        mimeType: "image/png",
        width: 1254,
        height: 1254,
        dataUri: `data:image/png;base64,${readFileSync(`src/assets/appearance/${id}.png`).toString("base64")}`,
      } as VisualAsset,
    ]),
  ),
  documents: [],
};

it("blinks deterministically at clip time, respecting manual closure and old projects", () => {
  const at = (timeMs: number, c = config) => eyeOpennessAt(c, { clip, timeMs });
  expect(at(0)).toBe(1);
  expect(at(1100)).toBe(0);
  expect(at(2600)).toBe(1);
  expect(at(1050)).toBeGreaterThan(0);
  expect(at(1050)).toBeLessThan(1);
  expect(at(1150)).toBeGreaterThan(0);
  expect(at(1150)).toBeLessThan(1);
  expect(at(1050)).toBe(at(1050));
  expect(at(0, { ...config, eyeOpenness: 0 })).toBe(0);
  expect(
    at(1100, {
      ...config,
      eyeOpenness: 0.45,
      blink: { ...DEFAULT_BLINK, enabled: false },
    }),
  ).toBe(0.45);
  expect(
    at(1100, { ...config, eyeOpenness: undefined, blink: undefined }),
  ).toBe(1);
});

it("opens and closes flat mouths deterministically and retains old authored expressions",()=>{
  const c={...config,mouthOpenness:1,mouthMotion:{enabled:true,periodMs:650}};
  expect(mouthOpennessAt(c,{clip,timeMs:0})).toBe(0);
  expect(mouthOpennessAt(c,{clip,timeMs:325})).toBeCloseTo(1);
  expect(mouthOpennessAt(c,{clip,timeMs:650})).toBeCloseTo(0);
  expect(mouthOpennessAt({...c,mouthOpenness:.4,mouthMotion:{...c.mouthMotion,enabled:false}},{clip,timeMs:325})).toBe(.4);
  expect(mouthOpennessAt(config,{clip,timeMs:325})).toBeUndefined();
  const render=(o:number)=>chibiFeatureSvg("mouth","chibi_smile","#9b5e50",DEFAULT_APPEARANCE,false,1,o)!;
  expect(render(1)).toContain('fill="#593a38"');expect(render(0)).not.toContain('fill="#593a38"');
  expect(new Resvg(render(0),{fitTo:{mode:"width",value:256}}).render().asPng()).not.toEqual(new Resvg(render(1),{fitTo:{mode:"width",value:256}}).render().asPng());
});

it("provides distinct flat brows and removes gloss gradients from the new chibi art",()=>{
  const brows=CHIBI_BROWS.map(b=>chibiFeatureSvg("brows",b.id,"#754a31")!);
  expect(new Set(brows).size).toBe(CHIBI_BROWS.length);
  for(const [feature,id] of [["eyes","jewel_blue"],["mouth","rose_satin"],["hair","crown_braid"]] as const) {
    const svg=chibiFeatureSvg(feature,id,"#754a31")!;
    expect(svg).not.toMatch(/linearGradient|radialGradient/);
    expect(new DOMParser().parseFromString(svg,"image/svg+xml").querySelector("parsererror")).toBeNull();
  }
});
it("opens native lips with separate UV regions and stable topology instead of stretching the artwork",()=>{
  const make=(opening:number)=>mouthArtworkVisuals({kind:"raster",assetId:"painted_lips"},PAINTED_APPEARANCE.painted_lips.bounds,[1,0,0,1,0,0],"mouth",10,resources,opening);
  const closed=make(0),open=make(1);
  expect(open.map(v=>v.id)).toEqual(closed.map(v=>v.id));
  expect(closed[0].opacity).toBe(0);expect(open[0].opacity).toBe(1);
  for(const index of [1,2]) {
    expect(open[index].surface?.vertices.map(v=>[v.u,v.v])).toEqual(closed[index].surface?.vertices.map(v=>[v.u,v.v]));
    expect(open[index].surface?.clipToMesh).toBe(true);
  }
  expect(open[1].surface!.vertices[0].y).toBeLessThan(closed[1].surface!.vertices[0].y);
  expect(open[2].surface!.vertices[0].y).toBeGreaterThan(closed[2].surface!.vertices[0].y);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="-6 4 12 16">${open.map(v=>visualSvg(v)).join("")}</svg>`;
  expect(new Resvg(svg).render().pixels.some((n,i)=>i%4===3&&n>0)).toBe(true);
});

it("clips native eye pixels with unchanged UVs and keeps renderer IDs stable through closure", () => {
  const bounds = PAINTED_APPEARANCE.painted_eye.bounds,
    matrix = [-1, 0, 0.15, 1, 25, 40] as const;
  const make = (opening: number) =>
    faceArtworkVisuals(
      { kind: "raster", assetId: "painted_eye" },
      bounds,
      [...matrix],
      "eye",
      "eyes",
      20,
      resources,
      opening,
    );
  const open = make(1),
    partial = make(0.45),
    closed = make(0);
  expect(partial.map((v) => v.id)).toEqual(open.map((v) => v.id));
  expect(closed.map((v) => v.id)).toEqual(open.map((v) => v.id));
  expect(closed.map((v) => v.opacity ?? 1)).toEqual([0, 1]);
  expect(open[1].opacity).toBe(0);
  expect(visualSvg(partial[0])).toContain("clipPath");
  const image = (v: (typeof open)[0]) =>
    new Resvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="200" viewBox="-7 -4 14 18">${visualSvg({ ...v, worldMatrix: [1, 0, 0, 1, 0, 0] })}</svg>`,
    ).render().pixels;
  const alpha = (pixels: Uint8Array) =>
    pixels.reduce((sum, n, i) => sum + (i % 4 === 3 ? n : 0), 0);
  expect(alpha(image(make(0.2)[0]))).toBeLessThan(alpha(image(open[0])) * 0.8);
  for (const visual of [open[0], partial[0], closed[0]]) {
    expect(visual.worldMatrix).toEqual(matrix);
    expect(visual.localBounds).toEqual(bounds);
    for (const v of visual.surface!.vertices) {
      expect(v.u).toBeCloseTo(
        (v.x - bounds.minX) / (bounds.maxX - bounds.minX),
      );
      expect(v.v).toBeCloseTo(
        (v.y - bounds.minY) / (bounds.maxY - bounds.minY),
      );
    }
  }
});

it("round-trips real PNG face resources, exports blinking pixels and preserves the rig in both facings", () => {
  useStore.getState().newProject();
  useStore
    .getState()
    .createEntity("character", "biped_profile_base_v1", "Painted portrait");
  const p = structuredClone(useStore.getState().project),
    e = p.entities[0];
  p.assets = resources.assets;
  p.animationClips.push(clip);
  e.activeAnimationClipId = clip.id;
  e.slots.forEach((s) => (s.itemId = null));
  e.faceCustomization!.eyes = {
    ...config,
    content: { kind: "raster", assetId: "painted_eye" },
    artworkBounds: PAINTED_APPEARANCE.painted_eye.bounds,
  };
  e.faceCustomization!.hair = {
    ...config,
    blink: undefined,
    presetId: "painted_bob",
    content: { kind: "raster", assetId: "painted_bob" },
    artworkBounds: PAINTED_APPEARANCE.painted_bob.bounds,
  };
  e.faceCustomization!.mouth = {
    ...config,
    blink: undefined,
    presetId: "painted_lips",
    content: { kind: "raster", assetId: "painted_lips" },
    artworkBounds: PAINTED_APPEARANCE.painted_lips.bounds,
  };
  e.appearance = {
    ...e.appearance!,
    nose: "painted_nose",
    noseArtwork: {
      content: { kind: "raster", assetId: "painted_nose" },
      bounds: PAINTED_APPEARANCE.painted_nose.bounds,
    },
  };
  const saved = ProjectSchema.parse(
    JSON.parse(JSON.stringify(compactProjectAssets(p))),
  );
  expect(Object.keys(saved.assets!)).toHaveLength(4);
  expect(saved.entities[0].faceCustomization!.eyes.blink).toEqual(
    DEFAULT_BLINK,
  );
  useStore.getState().loadProject(saved);
  const template = resolveTemplate(saved, e.templateId)!;
  const scenes = [];
  for (const view of ["right", "left"] as const) {
    e.appearance.view = view;
    const scene = (timeMs: number) =>
      evaluateExportScene(e, template, [clip], p.items, p.itemFitProfiles, {
        key: "face",
        clip,
        frame: timeMs * 0.03,
        timeMs,
      });
    const open = scene(0),
      closed = scene(1100);
    expect(open.skeleton.bones).toEqual(closed.skeleton.bones);
    const eyes = (s: typeof open) =>
      s.visuals.filter((v) => v.entityVisualId === "face__eyes");
    expect(eyes(open).map((v) => v.id)).toEqual(eyes(closed).map((v) => v.id));
    expect(
      eyes(closed)
        .filter((v) => v.content?.kind === "raster")
        .every((v) => v.opacity === 0),
    ).toBe(true);
    scenes.push(open, scene(1070), closed);
  }
  const camera = exportCamera(scenes);
  const frames = scenes.map((s) => composeFrameSvg(s, camera, 384));
  expect(frames[0]).toContain("data:image/png;base64,");
  const pixels = frames.map((svg) => new Resvg(svg).render().pixels);
  expect(Buffer.from(pixels[0]).equals(Buffer.from(pixels[2]))).toBe(false);
  if (process.env.APPEARANCE_REVIEW_OUTPUT) {
    const out = process.env.APPEARANCE_REVIEW_OUTPUT;
    mkdirSync(out, { recursive: true });
    writeFileSync(`${out}/painted-portrait.json`, JSON.stringify(saved));
    const body = frames
      .map(
        (svg, i) =>
          `<g transform="translate(${(i % 3) * 384} ${Math.floor(i / 3) * 424 + 40})">${svg}</g><text x="${(i % 3) * 384 + 18}" y="${Math.floor(i / 3) * 424 + 28}" fill="#e6ddd4" font-family="sans-serif" font-size="18">${i < 3 ? "RIGHT" : "LEFT"} · ${["OPEN", "PARTIAL", "CLOSED"][i % 3]}</text>`,
      )
      .join("");
    const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="1152" height="848"><rect width="1152" height="848" fill="#292c30"/>${body}</svg>`;
    writeFileSync(`${out}/blink-review.svg`, sheet);
    writeFileSync(`${out}/blink-review.png`, new Resvg(sheet).render().asPng());
  }
}, 30000);
