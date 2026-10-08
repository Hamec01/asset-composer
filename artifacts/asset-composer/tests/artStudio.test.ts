import { documentSetupSpace } from "../src/lib/studioSpace";
import { multiply, inverse } from "../src/lib/matrixUtils";
import {
  duplicateLayerTree,
  deleteLayerTree,
  reorderLayer,
  transformedArtwork,
} from "../src/lib/studioLayers";
import { reassignStudioBone } from "../src/lib/studioRig";
import {
  boneAttachmentAt,
  setAnimationContext,
  getAnimationContext,
} from "../src/lib/animationContext";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "../src/store";
import {
  newStudioDocument,
  newStudioLayer,
  studioCommit,
  createStudioRig,
  starterClip,
} from "../src/lib/studioActions";
import {
  autoMesh,
  autoWeights,
  paintWeights,
  addMeshVertex,
  deleteMeshVertex,
} from "../src/lib/studioMesh";
import { skinVertices } from "../src/lib/skinning";
import { evaluateScene, evaluateSkeleton } from "../src/lib/evaluationPipeline";
import {
  identity,
  transformPoint,
  worldBoneToMatrix,
} from "../src/lib/matrixUtils";
import { upgradeHybridProject } from "../src/lib/hybridMigration";
import { parseProjectSnapshot } from "../src/lib/projectValidation";
import { getClipsForTemplate } from "../src/lib/animationCompatibility";
import { makeRasterAsset, setVisualResources } from "../src/lib/visualContent";
import { compactProjectAssets } from "../src/lib/projectAssets";
import { composeFrameSvg, exportCamera } from "../src/lib/exportFrames";
import { layerSetupMatrix } from "../src/lib/artDocument";
import type { Bone } from "../src/domain/types";

const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
const bones: Bone[] = [
  {
    id: "a",
    name: "a",
    parentId: null,
    length: 16,
    restPose: { tx: 0, ty: 0, rotation: 0, scaleX: 1, scaleY: 1 },
  },
  {
    id: "b",
    name: "b",
    parentId: "a",
    length: 16,
    restPose: { tx: 16, ty: 0, rotation: 0, scaleX: 1, scaleY: 1 },
  },
];
const pixels = (width = 32, height = 16) => {
  const p = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) p[(y * width + x) * 4 + 3] = 255;
  return p;
};
function weighted() {
  const mesh = autoMesh(pixels(), 32, 16, identity());
  return autoWeights(mesh, bones, evaluateSkeleton(bones, new Map()), [
    "a",
    "b",
  ]);
}
function addDoc() {
  const doc = newStudioDocument(64, 64);
  doc.name = "Tree";
  const asset = makeRasterAsset(png, 64, 64),
    layer = { ...newStudioLayer("raster", "branch_left"), assetId: asset.id };
  doc.layers = [layer];
  studioCommit("Test artwork", (p) => {
    p.editorMeta.spriteEditorDocuments.push(doc);
    p.editorMeta.activeSpriteDocumentId = doc.id;
    p.assets = { [asset.id]: asset };
  });
  return { id: doc.id, layerId: layer.id };
}
beforeEach(() => {
  useStore.getState().newProject();
});

describe("hybrid Art Studio", () => {
  it("opens vector and native raster records without SVG wrappers in evaluated output", () => {
    const d = addDoc(),
      id = createStudioRig(d.id, "tree"),
      p = useStore.getState().project,
      e = p.entities.find((e) => e.id === id)!,
      t = p.templates.find((t) => t.id === e.templateId)!;
    const scene = evaluateScene(
      e,
      t,
      evaluateSkeleton(t.bones, new Map()),
      p.items,
    );
    expect(scene.visuals).toHaveLength(1);
    expect(scene.visuals[0].content?.kind).toBe("raster");
    expect(scene.visuals[0].svgData).toBeUndefined();
    expect(composeFrameSvg(scene, exportCamera([scene]), 64)).toContain(
      "data:image/png;base64,",
    );
  });
  it("roundtrips a custom rig, art binding and private animation through project v3", () => {
    const d = addDoc(),
      id = createStudioRig(d.id, "tree"),
      raw = useStore.getState().project,
      parsed = parseProjectSnapshot(JSON.parse(JSON.stringify(raw)));
    expect(parsed.version).toBe("3.0");
    const e = parsed.entities.find((e) => e.id === id)!;
    expect(
      parsed.templates.find((t) => t.id === e.templateId)?.skeletonFamily,
    ).toBe("custom_2d_v1");
    expect(
      parsed.editorMeta.spriteEditorDocuments.find((doc) => doc.id === d.id)
        ?.layers.length,
    ).toBeGreaterThan(0);
    expect(parseProjectSnapshot(JSON.parse(JSON.stringify(parsed)))).toEqual(
      parsed,
    );
  });
  it("retains exact raster resources on an evaluated export snapshot", () => {
    const d = addDoc(),
      id = createStudioRig(d.id, "tree"),
      p = useStore.getState().project,
      e = p.entities.find((e) => e.id === id)!,
      t = p.templates.find((t) => t.id === e.templateId)!;
    const scene = evaluateScene(
      e,
      t,
      evaluateSkeleton(t.bones, new Map()),
      p.items,
    );
    setVisualResources({ assets: {}, documents: [] });
    expect(composeFrameSvg(scene, exportCamera([scene]), 64)).toContain(png);
  });
  it("duplicates and removes nested groups in one reversible operation", () => {
    const doc = newStudioDocument(),
      g = newStudioLayer("group", "Canopy"),
      l = {
        ...newStudioLayer("raster", "Leaf"),
        parentId: g.id,
        assetId: "shared",
      };
    doc.layers = [g, l];
    const copy = duplicateLayerTree(doc, g.id);
    expect(doc.layers).toHaveLength(4);
    expect(doc.layers.find((l) => l.parentId === copy)?.assetId).toBe("shared");
    reorderLayer(doc, copy, -1);
    expect(doc.layers.find((l) => l.id === copy)!.zIndex).toBeLessThan(
      g.zIndex,
    );
    deleteLayerTree(doc, copy);
    expect(doc.layers).toHaveLength(2);
  });
  it("moves descendant weighted geometry with its graphic group during a drag", () => {
    const doc = newStudioDocument(32, 16),
      group = newStudioLayer("group"),
      layer = {
        ...newStudioLayer("raster"),
        parentId: group.id,
        binding: {
          mode: "weighted" as const,
          boneId: "a",
          bindMatrix: identity(),
          mesh: weighted(),
        },
      };
    doc.layers = [group, layer];
    const next = transformedArtwork(doc, {
        ...group,
        transform: { x: 10, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      }),
      binding = next.layers[1].binding!;
    if (binding.mode !== "weighted") throw new Error("Missing mesh");
    expect(binding.mesh.vertices[0].x).toBeCloseTo(
      layer.binding.mesh.vertices[0].x + 10,
    );
    expect(binding.mesh.vertices[0].u).toBe(layer.binding.mesh.vertices[0].u);
  });
  it("reassigns bone ownership and mesh influences without dangling links", () => {
    const d = addDoc(),
      id = createStudioRig(d.id, "tree");
    studioCommit("Delete with reassignment", (p) => {
      const e = p.entities.find((e) => e.id === id)!;
      for (const c of p.animationClips)
        if (c.templateId === e.templateId)
          for (const l of c.layers)
            l.tracks = l.tracks.filter((t) => t.boneId !== "leaves_left_tip");
      reassignStudioBone(p, e.templateId, "leaves_left_tip", "leaves_left");
    });
    expect(() =>
      parseProjectSnapshot(
        JSON.parse(JSON.stringify(useStore.getState().project)),
      ),
    ).not.toThrow();
  });
  it("keeps transformed image wrappers as vectors during migration", () => {
    for (const attributes of [
      'x="3"',
      'transform="translate(3)"',
      'opacity=".5"',
    ]) {
      const p = upgradeHybridProject({
        entities: [
          {
            visuals: [
              {
                svgData:
                  '<svg><image width="64" height="64" ' +
                  attributes +
                  ' href="' +
                  png +
                  '"/></svg>',
              },
            ],
          },
        ],
      });
      expect(p.entities[0].visuals[0].content.kind).toBe("vector");
    }
  });
  it("applies an existing character attachment placement once for rigid and weighted document parts", () => {
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    useStore
      .getState()
      .createEntity("character", "biped_profile_base_v1", "Mixed");
    const d = addDoc(),
      entityId = useStore.getState().project.entities[0].id,
      visualId = "native_head";
    studioCommit("Attach artwork", (p) => {
      const doc = p.editorMeta.spriteEditorDocuments.find(
        (x) => x.id === d.id,
      )!;
      doc.target = { kind: "entity-visual", entityId, visualId };
      p.entities.find((e) => e.id === entityId)!.visuals = [
        {
          id: visualId,
          boneId: "head",
          content: { kind: "document", documentId: d.id },
          metrics: {
            viewBoxX: -10,
            viewBoxY: -20,
            viewBoxWidth: 64,
            viewBoxHeight: 64,
            visualMinX: -10,
            visualMinY: -20,
            visualWidth: 64,
            visualHeight: 64,
          },
          pivot: { x: 10, y: 20, preset: "custom" },
          localTransform: { x: 3, y: 4, rotation: 0, scaleX: 1, scaleY: 1 },
          zIndex: 99,
        },
      ];
    });
    const p = useStore.getState().project,
      doc = p.editorMeta.spriteEditorDocuments.find((x) => x.id === d.id)!,
      entity = p.entities.find((e) => e.id === entityId)!,
      template = p.templates.find((t) => t.id === entity.templateId)!,
      rest = evaluateSkeleton(
        template.bones,
        new Map(),
        entity.bodyMorphs,
        entity.appearance,
      ),
      setup = documentSetupSpace(doc, p),
      bind = worldBoneToMatrix(rest.bones.get("head")!);
    const pose = evaluateSkeleton(
        template.bones,
        new Map([
          ["head", { tx: 0, ty: 0, rotation: 25, scaleX: 1, scaleY: 1 }],
        ]),
        entity.bodyMorphs,
        entity.appearance,
      ),
      delta = multiply(
        worldBoneToMatrix(pose.bones.get("head")!),
        inverse(bind),
      ),
      expected = multiply(delta, setup);
    studioCommit("Rigid bind", (p) => {
      p.editorMeta.spriteEditorDocuments.find(
        (x) => x.id === d.id,
      )!.layers[0].binding = {
        mode: "rigid",
        boneId: "head",
        bindMatrix: bind,
        setupMatrix: setup,
      };
    });
    const resources = () => ({
      assets: useStore.getState().project.assets ?? {},
      documents: useStore.getState().project.editorMeta.spriteEditorDocuments,
    });
    const rigid = evaluateScene(
      entity,
      template,
      pose,
      p.items,
      p.itemFitProfiles,
      { resources: resources() },
    ).visuals.find((v) => v.entityVisualId === visualId)!;
    rigid.worldMatrix.forEach((n, i) => expect(n).toBeCloseTo(expected[i]));
    const mesh = autoWeights(
      autoMesh(pixels(64, 64), 64, 64, setup),
      template.bones,
      rest,
      ["head"],
    );
    studioCommit("Weighted bind", (p) => {
      p.editorMeta.spriteEditorDocuments.find(
        (x) => x.id === d.id,
      )!.layers[0].binding = {
        mode: "weighted",
        boneId: "head",
        bindMatrix: bind,
        setupMatrix: setup,
        mesh,
      };
    });
    const weighted = evaluateScene(
      entity,
      template,
      pose,
      p.items,
      p.itemFitProfiles,
      { resources: resources() },
    ).visuals.find((v) => v.entityVisualId === visualId)!;
    expect(weighted.worldMatrix).toEqual(identity());
    const vertex = weighted.surface!.vertices[0],
      want = transformPoint(delta, mesh.vertices[0].x, mesh.vertices[0].y);
    expect(vertex.x).toBeCloseTo(want.x);
    expect(vertex.y).toBeCloseTo(want.y);
  });
  it("isolates arbitrary rig clips even when bone ids and families match", () => {
    const d = addDoc(),
      id = createStudioRig(d.id, "tree"),
      p = useStore.getState().project,
      t = p.templates.find(
        (t) => t.id === p.entities.find((e) => e.id === id)!.templateId,
      )!;
    const clip = starterClip(t, "wind");
    expect(getClipsForTemplate(t, [clip])).toHaveLength(1);
    expect(
      getClipsForTemplate({ ...t, id: "another-tree" }, [clip]),
    ).toHaveLength(0);
  });
  it("keeps rigid artwork in place at setup even though its carrying bone has an offset", () => {
    const d = addDoc(),
      id = createStudioRig(d.id, "tree"),
      p = useStore.getState().project,
      e = p.entities.find((e) => e.id === id)!,
      t = p.templates.find((t) => t.id === e.templateId)!;
    const v = evaluateScene(e, t, evaluateSkeleton(t.bones, new Map()), p.items)
      .visuals[0];
    v.worldMatrix.forEach((n, i) => expect(n).toBeCloseTo(identity()[i]));
  });
  it("uses one undo transaction for artwork, skeleton and resource changes", () => {
    const before = useStore.getState().project,
      d = addDoc();
    expect(useStore.getState().history.past).toHaveLength(1);
    useStore.getState().undo();
    expect(
      useStore.getState().project.editorMeta.spriteEditorDocuments,
    ).toEqual(before.editorMeta.spriteEditorDocuments);
    useStore.getState().redo();
    expect(
      useStore
        .getState()
        .project.editorMeta.spriteEditorDocuments.some((x) => x.id === d.id),
    ).toBe(true);
  });
  it("merges automatic mesh refresh into the preceding brush gesture", () => {
    studioCommit("Paint brush", (p) => {
      p.name = "painted";
    });
    studioCommit(
      "Update automatic mesh",
      (p) => {
        p.description = "mesh refreshed";
      },
      true,
    );
    expect(useStore.getState().history.past).toHaveLength(1);
    useStore.getState().undo();
    expect(useStore.getState().project.name).not.toBe("painted");
    expect(useStore.getState().project.description).not.toBe("mesh refreshed");
  });
  it("serializes only referenced assets without mutating undo resources", () => {
    addDoc();
    studioCommit("Unused revision", (p) => {
      p.assets!.unused = { ...Object.values(p.assets!)[0], id: "unused" };
    });
    const p = useStore.getState().project;
    expect(compactProjectAssets(p).assets?.unused).toBeUndefined();
    expect(p.assets?.unused).toBeDefined();
  });
  it("migrates simple PNG wrappers and preserves complex SVG", () => {
    const raw = {
      entities: [
        {
          visuals: [
            {
              id: "simple",
              svgData:
                '<svg><image width="64" height="64" href="' + png + '"/></svg>',
            },
            {
              id: "complex",
              svgData:
                '<svg><image href="' + png + '"/><path d="M0 0L4 4"/></svg>',
            },
          ],
        },
      ],
      editorMeta: { spriteEditorDocuments: [] },
    };
    const p = upgradeHybridProject(raw);
    expect(p.entities[0].visuals[0].content.kind).toBe("raster");
    expect(p.entities[0].visuals[1].content.kind).toBe("vector");
    expect(upgradeHybridProject(p)).toEqual(p);
    expect(raw.entities[0].visuals[0]).not.toHaveProperty("content");
  });
  it("preserves formerly exported reference artwork as a layer and excludes tracing", () => {
    const doc = newStudioDocument(64, 64);
    doc.referenceAsset = {
      format: "png",
      dataUri: png,
      name: "art",
      originalFileName: "art.png",
      mimeType: "image/png",
    };
    doc.tracingAsset = { ...doc.referenceAsset, name: "guide" };
    const p = upgradeHybridProject({
        entities: [],
        editorMeta: { spriteEditorDocuments: [doc] },
      }),
      m = p.editorMeta.spriteEditorDocuments[0];
    expect(m.referenceAsset).toBeNull();
    expect(m.layers[0].kind).toBe("raster");
    expect(m.tracingAsset.name).toBe("guide");
    expect(Object.keys(p.assets)).toHaveLength(1);
  });
  it("rejects layer / bone cycles and missing raster resources on load", () => {
    const d = addDoc(),
      raw = structuredClone(useStore.getState().project),
      doc = raw.editorMeta.spriteEditorDocuments.find((x) => x.id === d.id)!;
    doc.layers[0].parentId = doc.layers[0].id;
    expect(() => parseProjectSnapshot(raw)).toThrow(/cycle/);
    doc.layers[0].parentId = null;
    raw.assets = {};
    expect(() => parseProjectSnapshot(raw)).toThrow(/missing raster/);
  });
  it("keeps authored group transforms independent of the bone hierarchy", () => {
    const d = newStudioDocument(),
      g = {
        ...newStudioLayer("group"),
        transform: { x: 10, y: 20, rotation: 0, scaleX: 2, scaleY: 2 },
      },
      l = {
        ...newStudioLayer("vector"),
        parentId: g.id,
        transform: { x: 3, y: 4, rotation: 0, scaleX: 1, scaleY: 1 },
      };
    d.layers = [g, l];
    expect(transformPoint(layerSetupMatrix(d, l), 0, 0)).toEqual({
      x: 16,
      y: 28,
    });
    expect(l.binding).toBeUndefined();
  });
});
describe("automatic and manual textured deformation", () => {
  it("preserves rest geometry, UV and normalized weights", () => {
    const mesh = weighted(),
      vertices = skinVertices(
        { ...mesh, paths: [] },
        new Map(Object.entries(mesh.bindMatrices)),
      );
    vertices.forEach((v, i) => {
      expect(v.x).toBeCloseTo(mesh.vertices[i].x);
      expect(v.y).toBeCloseTo(mesh.vertices[i].y);
      expect(
        mesh.vertices[i].weights.reduce((s, w) => s + w.weight, 0),
      ).toBeCloseTo(1);
      expect(mesh.vertices[i].u).toBeCloseTo(v.x / 32);
    });
  });
  it("bends one surface through multiple bones", () => {
    const mesh = weighted(),
      pose = evaluateSkeleton(
        bones,
        new Map([["b", { tx: 0, ty: 0, rotation: 35, scaleX: 1, scaleY: 1 }]]),
      ),
      vertices = skinVertices(
        { ...mesh, paths: [] },
        new Map(
          [...pose.bones].map(([id, b]) => [id, worldBoneToMatrix(b)] as any),
        ),
      );
    expect(
      vertices.some((p, i) => Math.abs(p.y - mesh.vertices[i].y) > 1),
    ).toBe(true);
  });
  it("leaves transparent holes and separate islands out of the topology", () => {
    const p = pixels(32, 32);
    for (let y = 8; y < 24; y++)
      for (let x = 8; x < 24; x++) p[(y * 32 + x) * 4 + 3] = 0;
    const m = autoMesh(p, 32, 32, identity(), "high");
    for (let i = 0; i < m.triangles.length; i += 3) {
      const t = m.triangles.slice(i, i + 3).map((n) => m.vertices[n]),
        x = t.reduce((s, v) => s + v.x, 0) / 3,
        y = t.reduce((s, v) => s + v.y, 0) / 3;
      expect(x > 9 && x < 23 && y > 9 && y < 23).toBe(false);
    }
    expect(() => autoMesh(new Uint8ClampedArray(64), 4, 4, identity())).toThrow(
      /empty/,
    );
  });
  it("supports painting weights, adding and deleting vertices without invalid indices", () => {
    const mesh = weighted(),
      painted = paintWeights(mesh, { x: 8, y: 8 }, "a", 20, 0.4, "add");
    expect(painted.manualWeights).toBe(true);
    painted.vertices.forEach((v) =>
      expect(v.weights.reduce((s, w) => s + w.weight, 0)).toBeCloseTo(1),
    );
    const a = painted.vertices[painted.triangles[0]],
      b = painted.vertices[painted.triangles[1]],
      c = painted.vertices[painted.triangles[2]],
      added = addMeshVertex(painted, {
        x: (a.x + b.x + c.x) / 3,
        y: (a.y + b.y + c.y) / 3,
      }),
      deleted = deleteMeshVertex(added, added.vertices.length - 1);
    expect(deleted.vertices).toHaveLength(painted.vertices.length);
    expect(deleted.triangles.every((n) => n < deleted.vertices.length)).toBe(
      true,
    );
  });
});
