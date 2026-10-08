// @vitest-environment jsdom
import { it, expect, vi } from "vitest";
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { useStore } from "../src/store";
import { newStudioDocument, newStudioLayer } from "../src/lib/studioActions";
import { evaluateScene, evaluateSkeleton } from "../src/lib/evaluationPipeline";
import { documentSetupSpace } from "../src/lib/studioSpace";
import { autoMesh, autoWeights } from "../src/lib/studioMesh";
import { worldBoneToMatrix } from "../src/lib/matrixUtils";
import { makeRasterAsset, setVisualResources } from "../src/lib/visualContent";
import { composeFrameSvg, exportCamera } from "../src/lib/exportFrames";
import { parseProjectSnapshot } from "../src/lib/projectValidation";
import { resolveClipPose } from "../src/lib/animationRuntime";
import { buildSvgPartExportFiles } from "../src/lib/svgPartExport";

it("round-trips a mixed character with vector face, raster limbs and weighted hair", async () => {
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => {});
  useStore.getState().newProject();
  useStore
    .getState()
    .createEntity("character", "biped_profile_base_v1", "Mixed character");
  const project = structuredClone(useStore.getState().project);
  const entity = project.entities[0];
  entity.slots.forEach((s) => {
    s.itemId = null;
  });
  const source = project.templates.find((t) => t.id === entity.templateId)!;
  const template = structuredClone(source);
  template.id += "_studio_mixed_review";
  template.name = "Mixed character rig";
  template.bones.push(
    {
      id: "hair_a",
      name: "Hair base",
      parentId: "head",
      length: 20,
      restPose: { tx: 10, ty: 0, rotation: 90, scaleX: 1, scaleY: 1 },
    },
    {
      id: "hair_b",
      name: "Hair tip",
      parentId: "hair_a",
      length: 20,
      restPose: { tx: 20, ty: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    },
  );
  entity.templateId = template.id;
  project.templates.push(template);
  project.assets = {};
  let rasterCount = 0;
  for (const part of template.boneParts ?? [])
    if (/^(shoulder|elbow|hand|hip|knee|foot)_/.test(part.boneId)) {
      const image = new Resvg(part.svgData!, {
        fitTo: { mode: "width", value: 128 },
      }).render();
      const asset = makeRasterAsset(
        "data:image/png;base64," +
          Buffer.from(image.asPng()).toString("base64"),
        image.width,
        image.height,
        part.id,
      );
      project.assets[asset.id] = asset;
      part.content = { kind: "raster", assetId: asset.id };
      delete part.svgData;
      rasterCount++;
    }
  expect(rasterCount).toBeGreaterThan(6);
  const doc = newStudioDocument(120, 160);
  doc.name = "Weighted hair";
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160"><path d="M76 25Q104 20 102 62L95 142Q84 158 72 138L79 72Q84 44 76 25Z" fill="#70401e"/></svg>';
  const image = new Resvg(svg).render();
  const asset = makeRasterAsset(
    "data:image/png;base64," + Buffer.from(image.asPng()).toString("base64"),
    120,
    160,
    "Hair",
  );
  project.assets[asset.id] = asset;
  doc.layers = [
    {
      ...newStudioLayer("raster", "Hair"),
      assetId: asset.id,
      anatomicalOwner: "head",
    },
  ];
  entity.visuals = [
    {
      id: "mixed-hair",
      boneId: "head",
      content: { kind: "document", documentId: doc.id },
      editorDocumentId: doc.id,
      metrics: {
        viewBoxX: 0,
        viewBoxY: 0,
        viewBoxWidth: 120,
        viewBoxHeight: 160,
        visualMinX: 0,
        visualMinY: 0,
        visualWidth: 120,
        visualHeight: 160,
      },
      pivot: { x: 60, y: 50, preset: "custom" },
      localTransform: { x: 0, y: 0, rotation: 0, scaleX: 0.4, scaleY: 0.4 },
      zIndex: 8,
    },
  ];
  doc.target = {
    kind: "entity-visual",
    entityId: entity.id,
    visualId: "mixed-hair",
  };
  project.editorMeta.spriteEditorDocuments = [doc];
  project.editorMeta.activeSpriteDocumentId = doc.id;
  project.editorMeta.activeAuthoringMode = "sprite-editor";
  const rest = evaluateSkeleton(
    template.bones,
    new Map(),
    entity.bodyMorphs,
    entity.appearance,
  );
  const setup = documentSetupSpace(doc, project);
  const mesh = autoWeights(
    autoMesh(new Uint8ClampedArray(image.pixels), 120, 160, setup, "low"),
    template.bones,
    rest,
    ["hair_a", "hair_b"],
  );
  doc.layers[0].binding = {
    mode: "weighted",
    boneId: "head",
    bindMatrix: worldBoneToMatrix(rest.bones.get("head")!),
    setupMatrix: setup,
    mesh,
  };
  const clip = {
    id: "mixed-hair-sway",
    name: "mixed_hair_sway",
    label: "Mixed Hair Sway",
    skeletonFamily: template.skeletonFamily,
    templateId: template.id,
    durationMs: 2000,
    fps: 12,
    loops: true,
    layers: [
      {
        mask: "full_body" as const,
        tracks: [
          {
            boneId: "hair_b",
            keyframes: [
              {
                timeMs: 0,
                transform: { tx: 0, ty: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                easing: "linear" as const,
              },
              {
                timeMs: 1000,
                transform: { tx: 0, ty: 0, rotation: 30, scaleX: 1, scaleY: 1 },
                easing: "linear" as const,
              },
              {
                timeMs: 2000,
                transform: { tx: 0, ty: 0, rotation: 0, scaleX: 1, scaleY: 1 },
                easing: "linear" as const,
              },
            ],
          },
        ],
      },
    ],
  };
  project.animationClips.push(clip);
  entity.activeAnimationClipId = clip.id;
  project.version = "3.0";
  setVisualResources({ assets: project.assets, documents: [doc] });
  const scene = evaluateScene(entity, template, rest, project.items);
  expect(
    scene.visuals.filter((v) => v.content?.kind === "raster").length,
  ).toBeGreaterThan(6);
  expect(
    scene.visuals.some(
      (v) => v.boneId === "head" && v.content?.kind === "vector",
    ),
  ).toBe(true);
  expect(scene.visuals.find((v) => v.surface)?.boneId).toBe("head");
  const saved = parseProjectSnapshot(JSON.parse(JSON.stringify(project)));
  expect(
    saved.editorMeta.spriteEditorDocuments[0].layers[0].binding?.mode,
  ).toBe("weighted");
  expect(saved.assets).toEqual(project.assets);
  const files = await buildSvgPartExportFiles(
    [entity],
    project.items,
    [],
    { formats: ["svg_parts"] } as any,
    (id) => project.templates.find((t) => t.id === id),
  );
  const manifest = JSON.parse(
    new TextDecoder().decode(
      Object.entries(files).find(([name]) =>
        name.endsWith("manifest.json"),
      )![1],
    ),
  );
  expect(manifest.version).toBe("3.0");
  expect(
    manifest.template.bones.some((b: { id: string }) => b.id === "hair_b"),
  ).toBe(true);
  expect(
    manifest.documents[0].layers[0].binding.mesh.vertices.length,
  ).toBeGreaterThan(3);
  const posed = evaluateScene(entity, template, evaluateSkeleton(template.bones, resolveClipPose(clip, 1000), entity.bodyMorphs, entity.appearance), project.items);
  const restVertices = scene.visuals.find(v => v.surface)!.surface!.vertices;
  expect(posed.visuals.find(v => v.surface)!.surface!.vertices.some((v,i) => Math.hypot(v.x-restVertices[i].x,v.y-restVertices[i].y)>1)).toBe(true);
  useStore.getState().loadProject(saved);
  expect(useStore.getState().project.editorMeta.activeSpriteDocumentId).toBe(doc.id);
  expect(useStore.getState().animPlayback.activeTab).toBe("authoring");
  expect(useStore.getState().animPlayback.activeClipId).toBe(clip.id);
  if (process.env.STUDIO_REVIEW) {
    mkdirSync(process.env.STUDIO_REVIEW, { recursive: true });
    writeFileSync(
      process.env.STUDIO_REVIEW + "/mixed.json",
      JSON.stringify(project),
    );
    const svg = composeFrameSvg(scene, exportCamera([scene,posed]), 512);
    writeFileSync(process.env.STUDIO_REVIEW + "/mixed-posed.svg", composeFrameSvg(posed, exportCamera([scene,posed]), 512));
    writeFileSync(process.env.STUDIO_REVIEW + "/mixed.svg", svg);
    writeFileSync(
      process.env.STUDIO_REVIEW + "/mixed.png",
      new Resvg(svg).render().asPng(),
    );
  }
});
