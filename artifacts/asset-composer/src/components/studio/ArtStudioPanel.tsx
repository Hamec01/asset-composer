import { openAsset } from "@/lib/assetNavigation";
import { importArtwork } from "@/lib/artworkImport";
import { uiLabel } from "@/lib/uiLabels";
import { documentSetupSpace } from "@/lib/studioSpace";
import { StudioLayerTree } from "./StudioLayerTree";
import { NumberField } from "./StudioNumberField";
import { reassignStudioBone, studioBoneHasDependents } from "@/lib/studioRig";
import { StudioLegend } from "./StudioLegend";
import {
  duplicateLayerTree,
  deleteLayerTree,
  reorderLayer,
} from "@/lib/studioLayers";
import { runMeshJob } from "@/lib/studioMeshJob";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/store";
import type {
  AnimationClip,
  BoneTransform,
  Project,
  SpriteEditorDocument,
  SpriteEditorLayer,
  VisualMesh,
} from "@/domain/types";
import {
  studioCommit,
  editStudioDocument,
  newStudioDocument,
  newStudioLayer,
  createStudioRig,
  starterClip,
  newId,
} from "@/lib/studioActions";
import { artLayerContent, layerSetupMatrix } from "@/lib/artDocument";
import { renderContent } from "@/lib/visualRenderer";
import { makeRasterAsset, contentOf } from "@/lib/visualContent";
import { autoMesh, autoWeights, deleteMeshVertex } from "@/lib/studioMesh";
import { evaluateSkeleton } from "@/lib/evaluationPipeline";
import {
  identity,
  inverse,
  multiply,
  transformPoint,
  worldBoneToMatrix,
} from "@/lib/matrixUtils";
import { getClipsForTemplate } from "@/lib/animationCompatibility";
import { getTrackTransformAt } from "@/lib/animationRuntime";
import { PRESET_ANIMATIONS } from "@/data/presetAnimations";
import { animController } from "@/core-v2/AnimationController";
import { StudioCanvas, type StudioTool } from "./StudioCanvas";
import { StudioPreview } from "./StudioPreview";

const button =
  "px-2 py-1 rounded border border-border hover:bg-accent disabled:opacity-40 text-xs";
export function ArtStudioPanel({
  onLegacyEditor,
  mode: controlledMode,
  onModeChange,
}: {
  onLegacyEditor: () => void;
  mode?: "DRAW" | "RIG" | "ANIMATE";
  onModeChange?: (mode: "DRAW" | "RIG" | "ANIMATE") => void;
}) {
  const project = useStore((s) => s.project),
    playback = useStore((s) => s.animPlayback),
    history = useStore((s) => s.history);
  const doc = project.editorMeta.spriteEditorDocuments.find(
    (d) => d.id === project.editorMeta.activeSpriteDocumentId,
  );
  const [replacementBone, setReplacementBone] = useState(""),
    [localMode, setLocalMode] = useState<"DRAW" | "RIG" | "ANIMATE">("DRAW"),
    [tool, setTool] = useState<StudioTool>("brush"),
    [layerId, setLayerId] = useState(""),
    [boneId, setBoneId] = useState("root"),
    [vertexId, setVertexId] = useState(-1);
  const mode = controlledMode ?? localMode;
  const setMode = (next: "DRAW" | "RIG" | "ANIMATE") => { setLocalMode(next); onModeChange?.(next); };
  const [color, setColor] = useState("#478d3b"),
    [size, setSize] = useState(12),
    [opacity, setOpacity] = useState(1),
    [selection, setSelection] = useState<{ x: number; y: number }[]>([]),
    [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [layersOpen, setLayersOpen] = useState(false), [propertiesOpen, setPropertiesOpen] = useState(false);
  const [split, setSplit] = useState(true),
    [debug, setDebug] = useState("artwork"),
    [revision, setRevision] = useState(0),
    [draft, setDraft] = useState<SpriteEditorDocument | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [quality, setQuality] = useState<VisualMesh["quality"]>("medium"),
    [weightMode, setWeightMode] = useState<
      "add" | "subtract" | "replace" | "smooth"
    >("add"),
    [influences, setInfluences] = useState<string[]>([]),
    [autoKey, setAutoKey] = useState(false),
    [keyTime, setKeyTime] = useState<number | null>(null),
    [keyClipboard, setKeyClipboard] = useState<BoneTransform | null>(null),
    [poseDirty, setPoseDirty] = useState(false),
    [pose, setPose] = useState<BoneTransform>({
      tx: 0,
      ty: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    });
  const rootRef = useRef<HTMLDivElement>(null),
    fileRef = useRef<HTMLInputElement>(null),
    guideRef = useRef<HTMLInputElement>(null),
    pendingAuto = useRef(0);
  const entity = project.entities.find(
      (e) =>
        e.id ===
        (doc?.studioEntityId ??
          (doc?.target.itemId ? project.activeEntityId : doc?.target.entityId)),
    ),
    template = project.templates.find((t) => t.id === entity?.templateId),
    layer = doc?.layers.find((l) => l.id === layerId) ?? doc?.layers[0],
    bone = template?.bones.find((b) => b.id === boneId);
  const clip = project.animationClips.find(
    (c) => c.id === (playback.activeClipId ?? entity?.activeAnimationClipId),
  );
  const mesh = layer?.binding?.mode === "weighted" ? layer.binding.mesh : null;
  const setupSpace = useMemo(
    () => (doc ? documentSetupSpace(doc, project) : identity()),
    [doc, project],
  );
  useEffect(() => {
    if (!doc || doc.studioEntityId) return;
    const target = doc.target;
    const current =
      target.kind === "entity-visual"
        ? project.entities
            .find((e) => e.id === target.entityId)
            ?.visuals?.find((v) => v.id === target.visualId)
        : target.kind === "item-part"
          ? project.items
              .find((i) => i.id === target.itemId)
              ?.parts?.find((v) => v.id === target.partId)
          : target.kind === "face-overlay"
            ? project.entities
                .find((e) => e.id === target.entityId)
                ?.faceCustomization?.overlays.find(
                  (v) => v.id === target.overlayId,
                )
            : undefined;
    if (
      current &&
      (current.content?.kind !== "document" ||
        current.content.documentId !== doc.id || !doc.studioArtwork)
    )
      studioCommit("Link artwork", (p) => {
        p.editorMeta.spriteEditorDocuments.find(d=>d.id===doc.id)!.studioArtwork = true;
        const visual =
          target.kind === "entity-visual"
            ? p.entities
                .find((e) => e.id === target.entityId)
                ?.visuals?.find((v) => v.id === target.visualId)
            : target.kind === "item-part"
              ? p.items
                  .find((i) => i.id === target.itemId)
                  ?.parts?.find((v) => v.id === target.partId)
              : p.entities
                  .find((e) => e.id === target.entityId)
                  ?.faceCustomization?.overlays.find(
                    (v) => v.id === target.overlayId,
                  );
        if (visual) {
          visual.content = { kind: "document", documentId: doc.id };
          delete visual.svgData;
          if (target.kind === "item-part") {
            const item = p.items.find((i) => i.id === target.itemId);
            if (
              item &&
              item.parts?.[0]?.id === target.partId &&
              item.svgLayers[0]
            ) {
              item.svgLayers[0].content = visual.content;
              delete item.svgLayers[0].svgData;
            }
          }
        }
      });
  }, [doc?.id]);
  useEffect(() => {
    if (doc) {
      setLayerId(doc.layers[0]?.id ?? "");
      setSelection([]);
      setDraft(null);
      setError("");
    }
  }, [doc?.id]);
  useEffect(() => {
    if (mode === "DRAW") setTool(layer?.kind === "raster" ? "brush" : "pen");
    else setTool("bone");
    if (!layer?.binding) return;
    setBoneId(layer.binding.boneId);
  }, [layer?.id, layer?.binding?.boneId, mode]);
  const fail = (e: unknown) =>
    setError(e instanceof Error ? e.message : String(e));
  const patchLayer = (
    label: string,
    edit: (l: SpriteEditorLayer, d: SpriteEditorDocument, p: Project) => void,
  ) => {
    if (doc && layer)
      editStudioDocument(doc.id, label, (d, p) => {
        const old = new Map(
            d.layers.map((l) => [l.id, layerSetupMatrix(d, l)]),
          ),
          l = d.layers.find((l) => l.id === layer.id);
        if (l) edit(l, d, p);
        for (const node of d.layers) {
          const change = multiply(
            layerSetupMatrix(d, node),
            inverse(old.get(node.id) ?? identity()),
          );
          const space = node.binding?.setupMatrix ?? identity(),
            worldChange = multiply(multiply(space, change), inverse(space));
          for (const mesh of [
            node.binding?.mode === "weighted" ? node.binding.mesh : undefined,
            node.savedMesh,
          ])
            if (mesh)
              mesh.vertices = mesh.vertices.map((v) => ({
                ...v,
                ...transformPoint(worldChange, v.x, v.y),
              }));
        }
      });
  };
  const activate = (d: SpriteEditorDocument) => {
    const item = project.items.find(i => i.id === d.target.itemId || i.parts?.some(part => part.editorDocumentId === d.id));
    const ref = item ? { kind: "item" as const, id: item.id } : d.studioEntityId || !d.target.entityId ? { kind: "artwork" as const, id: d.id } : { kind: "entity" as const, id: d.target.entityId };
    openAsset(ref, ref.kind === "entity" ? "parts" : "draw");
    useStore.setState(s => { s.project.editorMeta.activeSpriteDocumentId = d.id; });
  };
  const addDocument = (example = false) => {
    const d = newStudioDocument();
    d.name = example
      ? "Дерево"
      : "Рисунок " + (project.editorMeta.spriteEditorDocuments.length + 1);
    const assets: NonNullable<Project["assets"]> = {};
    if (example) {
      const parts = [
        "trunk",
        "branch_left",
        "branch_right",
        "branch_top",
        "leaves_left",
        "leaves_right",
        "leaves_top",
      ];
      parts.forEach((name, i) => {
        const c = document.createElement("canvas");
        c.width = d.width;
        c.height = d.height;
        const ctx = c.getContext("2d")!;
        ctx.lineCap = "round";
        if (i === 0) {
          ctx.strokeStyle = "#7c4b2a";
          ctx.lineWidth = 30;
          ctx.beginPath();
          ctx.moveTo(256, 460);
          ctx.lineTo(256, 180);
          ctx.stroke();
        } else if (i < 4) {
          ctx.strokeStyle = "#96613b";
          ctx.lineWidth = 18;
          ctx.beginPath();
          ctx.moveTo(256, 360 - i * 40);
          ctx.quadraticCurveTo(
            i === 1 ? 180 : i === 2 ? 330 : 256,
            220,
            i === 1 ? 125 : i === 2 ? 390 : 256,
            i === 3 ? 65 : 160,
          );
          ctx.stroke();
        } else {
          ctx.fillStyle = ["#397e35", "#4b963e", "#65aa43"][i - 4];
          ctx.beginPath();
          ctx.ellipse(
            i === 4 ? 135 : i === 5 ? 390 : 256,
            i === 6 ? 85 : 160,
            i === 6 ? 85 : 95,
            65,
            0,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
        const asset = makeRasterAsset(
          c.toDataURL("image/png"),
          d.width,
          d.height,
          name,
        );
        assets[asset.id] = asset;
        d.layers.push({
          ...newStudioLayer("raster", name),
          assetId: asset.id,
          zIndex: i,
        });
      });
    }
    studioCommit("New artwork", (p) => {
      p.assets = { ...p.assets, ...assets };
      p.editorMeta.spriteEditorDocuments.push(d);
      p.editorMeta.activeSpriteDocumentId = d.id;
    });
    openAsset({ kind: "artwork", id: d.id }, "draw");
    setLayerId(d.layers[0]?.id ?? "");
  };
  const addLayer = (kind: SpriteEditorLayer["kind"]) => {
    if (!doc) return;
    const l = newStudioLayer(kind);
    l.zIndex = Math.max(0, ...doc.layers.map((l) => l.zIndex)) + 1;
    if (layer?.kind === "group") l.parentId = layer.id;
    let asset: ReturnType<typeof makeRasterAsset> | undefined;
    if (kind === "raster") {
      const c = document.createElement("canvas");
      c.width = doc.width;
      c.height = doc.height;
      asset = makeRasterAsset(
        c.toDataURL("image/png"),
        c.width,
        c.height,
        l.name,
      );
      l.assetId = asset.id;
    }
    if (template && !l.parentId) {
      const rest = evaluateSkeleton(
          template.bones,
          new Map(),
          entity?.bodyMorphs,
          entity?.appearance,
        ),
        root = template.bones[0];
      l.binding = {
        mode: "rigid",
        boneId: root.id,
        bindMatrix: worldBoneToMatrix(rest.bones.get(root.id)!),
        setupMatrix: setupSpace,
      };
    }
    editStudioDocument(doc.id, "Add layer", (d, p) => {
      if (asset) {
        p.assets ??= {};
        p.assets[asset.id] = asset;
      }
      d.layers.push(l);
    });
    setLayerId(l.id);
  };
  const importFile = async (file: File, guide = false) => {
    if (!doc) return;
    setBusy(true);
    try {
      const id = await importArtwork(file, doc.id, guide);
      setLayerId(id);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const splitPixels = async (cut: boolean) => {
    if (!doc || !layer) return;
    if (layer.kind !== "raster")
      throw new Error("Для выделения пикселей сначала нажмите «Растровая копия».");
    if (selection.length < 3)
      throw new Error("Сначала выделите пиксели рамкой или лассо.");
    const source = await renderContent(
        artLayerContent(doc, layer),
        doc.width,
        doc.height,
      ),
      copy = document.createElement("canvas");
    copy.width = doc.width;
    copy.height = doc.height;
    const mask = document.createElement("canvas");
    mask.width = doc.width;
    mask.height = doc.height;
    const ctx = mask.getContext("2d")!,
      m = inverse(layerSetupMatrix(doc, layer));
    ctx.beginPath();
    selection
      .map((p) => transformPoint(m, p.x, p.y))
      .forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
    const c = copy.getContext("2d")!;
    c.drawImage(source, 0, 0);
    c.globalCompositeOperation = "destination-in";
    c.drawImage(mask, 0, 0);
    const asset = makeRasterAsset(
        copy.toDataURL("image/png"),
        doc.width,
        doc.height,
        layer.name + " selection",
      ),
      l = {
        ...structuredClone(layer),
        id: newId(),
        name: layer.name + " selection",
        assetId: asset.id,
        zIndex: layer.zIndex + 0.5,
        binding:
          layer.binding?.mode === "weighted"
            ? {
                mode: "rigid" as const,
                boneId: layer.binding.boneId,
                bindMatrix: layer.binding.bindMatrix,
                setupMatrix: layer.binding.setupMatrix,
              }
            : layer.binding,
        savedMesh: undefined,
      };
    let old: ReturnType<typeof makeRasterAsset> | undefined;
    if (cut) {
      const ctx = source.getContext("2d")!;
      ctx.globalCompositeOperation = "destination-out";
      ctx.drawImage(mask, 0, 0);
      old = makeRasterAsset(
        source.toDataURL("image/png"),
        doc.width,
        doc.height,
        layer.name,
      );
    }
    editStudioDocument(
      doc.id,
      cut ? "Cut to New Layer" : "Copy to New Layer",
      (d, p) => {
        p.assets ??= {};
        p.assets[asset.id] = asset;
        if (old) {
          p.assets[old.id] = old;
          d.layers.find((l) => l.id === layer.id)!.assetId = old.id;
        }
        d.layers.push(l);
      },
    );
    setLayerId(l.id);
    setSelection([]);
    if (cut) void refreshAutomatic(layer.id);
  };
  const rasterizeCopy = async () => {
    if (!doc || !layer) return;
    const canvas = await renderContent(
        artLayerContent(doc, layer),
        doc.width,
        doc.height,
      ),
      asset = makeRasterAsset(
        canvas.toDataURL("image/png"),
        doc.width,
        doc.height,
        layer.name + " raster",
      ),
      l = {
        ...newStudioLayer("raster", layer.name + " raster copy"),
        assetId: asset.id,
        parentId: layer.parentId,
        transform: layer.transform,
        binding: layer.binding,
        zIndex: layer.zIndex + 0.5,
      };
    editStudioDocument(doc.id, "Rasterize Copy", (d, p) => {
      p.assets ??= {};
      p.assets[asset.id] = asset;
      d.layers.push(l);
    });
    setLayerId(l.id);
  };
  const descendants = (id: string): string[] =>
    template?.bones
      .filter((b) => b.parentId === id)
      .flatMap((b) => [b.id, ...descendants(b.id)]) ?? [];
  const flexible = async (
    regenerate = true,
    reweight = true,
    automatic = false,
    targetId = layer?.id,
  ) => {
    if (!doc || !template || !targetId) return;
    const current = useStore
        .getState()
        .project.editorMeta.spriteEditorDocuments.find((d) => d.id === doc.id),
      part = current?.layers.find((l) => l.id === targetId);
    if (!current || !part) return;
    if (
      current.layers.some((l) => {
        let parent = l.parentId;
        while (parent) {
          if (parent === part.id) return !!l.binding;
          parent = current.layers.find((p) => p.id === parent)?.parentId;
        }
        return false;
      })
    )
      throw new Error(
        "Выберите группу без дочерних слоёв с отдельными привязками.",
      );
    const old =
      part.binding?.mode === "weighted" ? part.binding.mesh : part.savedMesh;
    if (
      !automatic &&
      ((regenerate && old?.manualMesh) || (reweight && old?.manualWeights)) &&
      !window.confirm(
        "Заменить ручные " +
          (regenerate ? "правки сетки" : "веса") +
          "? Действие можно отменить.",
      )
    )
      return;
    if (automatic && old?.manualMesh) {
      setError(
        "Рисунок изменён. Ручная сетка сохранена. Проверьте покрытие и нажмите «Пересоздать сетку», чтобы расширить её.",
      );
      return;
    }
    setBusy(true);
    try {
      const token = ++pendingAuto.current,
        rest = evaluateSkeleton(
          template.bones,
          new Map(),
          entity?.bodyMorphs,
          entity?.appearance,
        ),
        owner = part.binding?.boneId ?? boneId,
        ids = influences.length ? influences : [owner, ...descendants(owner)];
      let pixels: Uint8ClampedArray | undefined;
      if (regenerate || !old) {
        const canvas = await renderContent(
          artLayerContent(current, part),
          doc.width,
          doc.height,
        );
        pixels = canvas
          .getContext("2d")!
          .getImageData(0, 0, canvas.width, canvas.height).data;
      }
      let mesh = await runMeshJob({
        pixels,
        width: doc.width,
        height: doc.height,
        setup: multiply(setupSpace, layerSetupMatrix(current, part)),
        quality,
        mesh: old,
        bones: template.bones,
        skeleton: rest,
        influences: ids,
        weights: reweight || !old,
      });
      if (!reweight && old) {
        const { inheritMeshWeights } = await import("@/lib/skinning");
        mesh = {
          ...mesh!,
          vertices: inheritMeshWeights(
            { ...old, paths: [] },
            mesh!.vertices,
          ).map((v, i) => ({
            ...v,
            u: mesh!.vertices[i].u,
            v: mesh!.vertices[i].v,
          })),
          bindMatrices: old.bindMatrices,
          manualWeights: old.manualWeights,
        };
      }
      if (token !== pendingAuto.current) return;
      editStudioDocument(
        doc.id,
        automatic ? "Update automatic mesh" : "Make Flexible",
        (d) => {
          const l = d.layers.find((l) => l.id === part.id)!;
          l.binding = {
            mode: "weighted",
            boneId: owner,
            bindMatrix: worldBoneToMatrix(rest.bones.get(owner)!),
            setupMatrix: setupSpace,
            mesh: mesh!,
          };
        },
        automatic,
      );
      if (ids.length === 1)
        setError(
          "Одна влияющая кость только перемещает рисунок. Для изгиба добавьте цепочку костей.",
        );
      if (!automatic) setTool("mesh");
    } finally {
      setBusy(false);
    }
  };
  const refreshAutomatic = async (id: string) => {
    const d = useStore
      .getState()
      .project.editorMeta.spriteEditorDocuments.find((d) => d.id === doc?.id);
    let l = d?.layers.find((l) => l.id === id);
    while (l && l.binding?.mode !== "weighted" && l.parentId)
      l = d?.layers.find((parent) => parent.id === l!.parentId);
    if (!d || l?.binding?.mode !== "weighted") return;
    try {
      const art = await renderContent(artLayerContent(d, l), d.width, d.height),
        pixels = art
          .getContext("2d")!
          .getImageData(0, 0, d.width, d.height).data;
      const mask = document.createElement("canvas");
      mask.width = d.width;
      mask.height = d.height;
      const ctx = mask.getContext("2d")!,
        mesh = l.binding.mesh;
      ctx.fillStyle = "white";
      for (let i = 0; i < mesh.triangles.length; i += 3) {
        ctx.beginPath();
        mesh.triangles
          .slice(i, i + 3)
          .map((n) => mesh.vertices[n])
          .forEach((v, j) =>
            j
              ? ctx.lineTo(v.u * d.width, v.v * d.height)
              : ctx.moveTo(v.u * d.width, v.v * d.height),
          );
        ctx.closePath();
        ctx.fill();
      }
      const covered = ctx.getImageData(0, 0, d.width, d.height).data;
      let outside = false;
      for (let i = 3; i < pixels.length; i += 4)
        if (pixels[i] > 8 && covered[i] < 8) {
          outside = true;
          break;
        }
      if (outside) await flexible(true, !mesh.manualWeights, true, l.id);
    } catch (e) {
      fail(e);
    }
  };
  const bind = (id: string) => {
    if (!template) return;
    const rest = evaluateSkeleton(
      template.bones,
      new Map(),
      entity?.bodyMorphs,
      entity?.appearance,
    );
    patchLayer("Bind layer", (l) => {
      if (l.binding?.mode === "weighted") l.savedMesh = l.binding.mesh;
      l.anatomicalOwner ??= id;
      l.binding = {
        mode: "rigid",
        boneId: id,
        bindMatrix: worldBoneToMatrix(rest.bones.get(id)!),
        setupMatrix: setupSpace,
      };
    });
    setBoneId(id);
  };
  const changeBone = (
    edit: (b: NonNullable<typeof bone>, p: Project) => void,
    label = "Edit bone",
  ) => {
    if (!template || !bone) return;
    studioCommit(label, (p) => {
      const t = p.templates.find((t) => t.id === template.id)!,
        b = t.bones.find((b) => b.id === bone.id)!;
      edit(b, p);
      const rest = evaluateSkeleton(
        t.bones,
        new Map(),
        entity?.bodyMorphs,
        entity?.appearance,
      );
      for (const d of p.editorMeta.spriteEditorDocuments)
        if (d.studioEntityId === entity?.id)
          for (const l of d.layers)
            if (l.binding) {
              l.binding.bindMatrix = worldBoneToMatrix(
                rest.bones.get(l.binding.boneId)!,
              );
              if (l.binding.mode === "weighted")
                for (const id of Object.keys(l.binding.mesh.bindMatrices))
                  l.binding.mesh.bindMatrices[id] = worldBoneToMatrix(
                    rest.bones.get(id)!,
                  );
            }
    });
  };
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail.id !== boneId) setBoneId(detail.id);
      const t = useStore
        .getState()
        .project.templates.find((t) => t.id === template?.id);
      if (!t) return;
      if (mode === "ANIMATE") {
        const b = t.bones.find((b) => b.id === detail.id)!;
        const next = {
          ...pose,
          tx: detail.x - b.restPose.tx,
          ty: detail.y - b.restPose.ty,
        };
        useStore.getState().setPlaybackPlaying(false);
        setPoseDirty(true);
        setPose(next);
        if (autoKey) keyframe(next);
        return;
      }
      studioCommit("Move bone", (p) => {
        const bones = p.templates.find(
            (candidate) => candidate.id === t.id,
          )!.bones,
          b = bones.find((b) => b.id === detail.id)!;
        b.restPose.tx = detail.x;
        b.restPose.ty = detail.y;
        const rest = evaluateSkeleton(
          bones,
          new Map(),
          entity?.bodyMorphs,
          entity?.appearance,
        );
        for (const d of p.editorMeta.spriteEditorDocuments)
          if (d.studioEntityId === entity?.id)
            for (const l of d.layers)
              if (l.binding) {
                l.binding.bindMatrix = worldBoneToMatrix(
                  rest.bones.get(l.binding.boneId)!,
                );
                if (l.binding.mode === "weighted")
                  l.binding.mesh.bindMatrices = Object.fromEntries(
                    Object.keys(l.binding.mesh.bindMatrices).map((id) => [
                      id,
                      worldBoneToMatrix(rest.bones.get(id)!),
                    ]),
                  );
              }
      });
    };
    el.addEventListener("studio-bone-move", handler);
    return () => el.removeEventListener("studio-bone-move", handler);
  }, [template?.id, entity?.id, boneId, mode, autoKey, pose]);
  const editClip = (label: string, edit: (c: AnimationClip) => void) => {
    if (!clip || !entity || !template) return;
    let id = clip.id;
    studioCommit(label, (p) => {
      let c = p.animationClips.find((c) => c.id === clip.id)!;
      if (PRESET_ANIMATIONS.some((p) => p.id === c.id)) {
        c = structuredClone(clip);
        c.id = newId();
        c.name += "_copy";
        c.label += " (копия)";
        c.templateId = template.id;
        p.animationClips.push(c);
        id = c.id;
        p.entities.find((e) => e.id === entity.id)!.activeAnimationClipId = id;
      }
      edit(c);
    });
    const edited = useStore
      .getState()
      .project.animationClips.find((c) => c.id === id);
    if (edited) {
      animController.setDuration(edited.durationMs);
      animController.setLoop(edited.loops);
    }
    if (id !== clip.id) {
      const time = playback.timeMs;
      useStore.getState().setPlaybackClip(id);
      useStore.getState().setPlaybackTime(time);
      if (playback.playing) useStore.getState().setPlaybackPlaying(true);
    }
  };
  const keyframe = (value = pose, time = playback.timeMs) => {
    editClip("Set keyframe", (c) => {
      let track = c.layers[0]?.tracks.find((t) => t.boneId === boneId);
      if (!c.layers.length) c.layers = [{ mask: "full_body", tracks: [] }];
      if (!track) {
        track = { boneId, keyframes: [] };
        c.layers[0].tracks.push(track);
      }
      const key = {
          timeMs: Math.round(time),
          transform: { ...value },
          easing: "linear" as const,
        },
        i = track.keyframes.findIndex((k) => k.timeMs === key.timeMs);
      if (i >= 0) track.keyframes[i] = key;
      else track.keyframes.push(key);
      track.keyframes.sort((a, b) => a.timeMs - b.timeMs);
    });
  };
  const updatePose = (field: keyof BoneTransform, n: number) => {
    useStore.getState().setPlaybackPlaying(false);
    setPoseDirty(true);
    const next = { ...pose, [field]: n };
    setPose(next);
    if (autoKey) keyframe(next);
  };
  useEffect(() => {
    const track = clip?.layers
      .flatMap((l) => l.tracks)
      .find((t) => t.boneId === boneId);
    setPoseDirty(false);
    setPose(
      track
        ? getTrackTransformAt(track, playback.timeMs)
        : { tx: 0, ty: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    );
  }, [clip, boneId, playback.timeMs]);
  const createClip = (kind: "wind" | "rotation" | "empty") => {
    if (!template) return;
    const c =
      kind === "empty"
        ? {
            ...starterClip(template, "rotation"),
            name: "new_clip",
            label: "Новый клип",
            layers: [{ mask: "full_body" as const, tracks: [] }],
          }
        : starterClip(template, kind);
    studioCommit("Create animation", (p) => p.animationClips.push(c));
    useStore.getState().setPlaybackClip(c.id);
  };
  const tools: StudioTool[] =
    mode === "DRAW"
      ? [
          "brush",
          "pencil",
          "eraser",
          "fill",
          "picker",
          "rect-select",
          "lasso",
          "move",
          "pen",
          "rectangle",
          "ellipse",
        ]
      : mode === "RIG"
        ? ["bone", "pivot", "move", "mesh", "add-vertex", "weights"]
        : ["bone"];
  return (
    <div
      ref={rootRef}
      data-testid="art-studio"
        className="art-studio-layout flex flex-col h-full min-h-0 text-foreground bg-background"
    >
      <div className="flex flex-wrap items-center gap-2 p-2 border-b">
        <strong className="text-sm">Рисунок и слои</strong>
        {!controlledMode && (["DRAW", "RIG", "ANIMATE"] as const).map((m) => (
          <button
            key={m}
            aria-pressed={mode === m}
            className={button + (mode === m ? " bg-accent" : "")}
            onClick={() => {
              setMode(m);
              setTool(m === "DRAW" ? "brush" : "bone");
            }}
          >
            {uiLabel(m)}
          </button>
        ))}
        <button className={button} onClick={() => addDocument()}>
          Новый рисунок
        </button>
        <button className={button} onClick={() => addDocument(true)}>
          Пример дерева
        </button>
        <select
          aria-label="Документ рисунка"
          className="bg-background border text-xs max-w-44"
          value={doc?.id ?? ""}
          onChange={(e) =>
            activate(
              project.editorMeta.spriteEditorDocuments.find(
                (d) => d.id === e.target.value,
              )!,
            )
          }
        >
          <option value="" disabled>
            Выберите рисунок
          </option>
          {project.editorMeta.spriteEditorDocuments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <button
          className={button}
          onClick={() => useStore.getState().undo()}
          disabled={!history.past.length}
        >
          Отменить
        </button>
        <button
          className={button}
          onClick={() => useStore.getState().redo()}
          disabled={!history.future.length}
        >
          Повторить
        </button>
        <label className="text-xs">
          <input
            type="checkbox"
            checked={split}
            onChange={(e) => setSplit(e.target.checked)}
          />{" "}
          Предпросмотр скелета
        </label>
        <button className={button} onClick={onLegacyEditor}>
          Векторные контуры
        </button>
      </div>
      {error && (
        <div
          role="alert"
          className="bg-amber-950 text-amber-100 text-xs p-2 flex justify-between"
        >
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}
      {!doc ? (
        <div className="p-6">
          Создайте или откройте рисунок для рисования, привязки и анимации.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1 p-2 border-b">
            {tools.map((t) => (
              <button
                key={t}
                className={button + (tool === t ? " bg-accent" : "")}
                aria-pressed={tool === t}
                onClick={() => setTool(t)}
              >
                {uiLabel(t)}
              </button>
            ))}
            {mode === "DRAW" && <><input
              aria-label="Цвет кисти"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
            <NumberField label="Размер" value={size} min={1} onChange={setSize} />
            <NumberField
              label="Непрозрачность"
              value={opacity}
              min={0}
              step={0.05}
              onChange={(n) => setOpacity(Math.min(1, n))}
            /></>}
            <button
              className={button}
              onClick={() => setCamera({ x: 0, y: 0, zoom: 1 })}
            >
              Вписать
            </button>
            <select
              aria-label="Сглаживание пикселей"
              className="bg-background border text-xs"
              value={doc.sampling ?? "smooth"}
              onChange={(e) =>
                editStudioDocument(doc.id, "Sampling", (d) => {
                  d.sampling = e.target.value as "smooth" | "pixel";
                })
              }
            >
              <option value="smooth">Плавное</option>
              <option value="pixel">Пиксельный</option>
            </select>
          </div>
          <div className="studio-drawer-controls"><button className={button} aria-pressed={layersOpen} onClick={() => setLayersOpen(!layersOpen)}>Слои и рисунок</button>{mode !== "DRAW" && <button className={button} aria-pressed={propertiesOpen} onClick={() => setPropertiesOpen(!propertiesOpen)}>Кости и деформация</button>}</div>
          <div className="studio-content flex flex-1 min-h-0">
            <aside className={`studio-layers ${layersOpen ? "drawer-open" : ""} w-48 min-w-40 border-r overflow-auto p-2 space-y-2`}>
              <input
                aria-label="Название рисунка"
                className="w-full bg-background border rounded text-xs p-1"
                defaultValue={doc.name}
                key={doc.id}
                onBlur={(e) =>
                  editStudioDocument(doc.id, "Rename artwork", (d) => {
                    d.name = e.target.value;
                  })
                }
              />
              <div className="flex flex-wrap gap-1">
                {(["raster", "vector", "group"] as const).map((k) => (
                  <button
                    className={button}
                    key={k}
                    onClick={() => addLayer(k)}
                  >
                    + {uiLabel(k)}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                <button
                  className={button}
                  onClick={() => fileRef.current?.click()}
                >
                  Импорт рисунка
                </button>
                <button
                  className={button}
                  onClick={() => guideRef.current?.click()}
                >
                  Подложка
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                hidden
                accept=".svg,.png,.webp,.jpg,.jpeg"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importFile(f);
                  e.target.value = "";
                }}
              />
              <input
                ref={guideRef}
                type="file"
                hidden
                accept=".svg,.png,.webp,.jpg,.jpeg"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importFile(f, true);
                  e.target.value = "";
                }}
              />
              {doc.tracingAsset && (
                <label className="text-xs">
                  <input
                    type="checkbox"
                    checked={doc.tracingVisible !== false}
                    onChange={(e) =>
                      editStudioDocument(
                        doc.id,
                        "Reference visibility",
                        (d) => {
                          d.tracingVisible = e.target.checked;
                        },
                      )
                    }
                  />
                  Только подложка
                </label>
              )}
              <StudioLayerTree
                doc={doc}
                selectedId={layer?.id}
                onSelect={(id) => {
                  setLayerId(id);
                  setVertexId(-1);
                  setInfluences([]);
                }}
                onVisibility={(id, visible) =>
                  editStudioDocument(doc.id, "Layer visibility", (d) => {
                    d.layers.find((l) => l.id === id)!.visible = visible;
                  })
                }
              />
              {layer && (
                <>
                  <input
                    aria-label="Название слоя"
                    key={layer.id}
                    defaultValue={layer.name}
                    className="w-full bg-background border text-xs p-1"
                    onBlur={(e) =>
                      patchLayer("Rename layer", (l) => {
                        l.name = e.target.value;
                      })
                    }
                  />
                  <label className="text-xs">
                    <input
                      type="checkbox"
                      checked={!!layer.locked}
                      onChange={(e) =>
                        patchLayer("Lock layer", (l) => {
                          l.locked = e.target.checked;
                        })
                      }
                    />
                    Заблокирован
                  </label>
                  <NumberField
                    label="Непрозрачность слоя"
                    value={layer.opacity ?? 1}
                    min={0}
                    step={0.1}
                    onChange={(n) =>
                      patchLayer("Layer opacity", (l) => {
                        l.opacity = Math.min(1, n);
                      })
                    }
                  />
                  <select
                    aria-label="Группа слоя"
                    className="w-full bg-background border text-xs"
                    value={layer.parentId ?? ""}
                    onChange={(e) => {
                      const parent = e.target.value || null;
                      patchLayer("Group layer", (l, d) => {
                        let cursor = parent;
                        while (cursor) {
                          if (cursor === l.id) throw new Error("Группа не может содержать сама себя.");
                          cursor =
                            d.layers.find((l) => l.id === cursor)?.parentId ??
                            null;
                        }
                        const old = layerSetupMatrix(d, l),
                          p = parent
                            ? layerSetupMatrix(
                                d,
                                d.layers.find((l) => l.id === parent)!,
                              )
                            : identity(),
                          local = multiply(inverse(p), old);
                        l.parentId = parent;
                        l.transform = {
                          x: local[4],
                          y: local[5],
                          rotation:
                            (Math.atan2(local[1], local[0]) * 180) / Math.PI,
                          scaleX: Math.hypot(local[0], local[1]),
                          scaleY:
                            (local[0] * local[3] - local[1] * local[2]) /
                            Math.hypot(local[0], local[1]),
                        };
                      });
                    }}
                  >
                    <option value="">Без группы</option>
                    {doc.layers
                      .filter((l) => l.kind === "group" && l.id !== layer.id)
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                  </select>
                  <div className="flex flex-wrap gap-1">
                    <button
                      className={button}
                      onClick={() =>
                        editStudioDocument(doc.id, "Raise layer", (d) =>
                          reorderLayer(d, layer.id, 1),
                        )
                      }
                    >
                      Выше
                    </button>
                    <button
                      className={button}
                      onClick={() =>
                        editStudioDocument(doc.id, "Lower layer", (d) =>
                          reorderLayer(d, layer.id, -1),
                        )
                      }
                    >
                      Ниже
                    </button>
                    <button
                      className={button}
                      onClick={() => {
                        let id = "";
                        editStudioDocument(doc.id, "Duplicate layer", (d) => {
                          id = duplicateLayerTree(d, layer.id);
                        });
                        setLayerId(id);
                      }}
                    >
                      Дублировать
                    </button>
                    <button
                      className={button}
                      onClick={() => {
                        editStudioDocument(doc.id, "Delete layer", (d) =>
                          deleteLayerTree(d, layer.id),
                        );
                      }}
                    >
                      Удалить
                    </button>
                  </div>
                  <button
                    className={button}
                    disabled={selection.length < 3}
                    onClick={() => void splitPixels(true).catch(fail)}
                  >
                    Вырезать на новый слой
                  </button>
                  <button
                    className={button}
                    disabled={selection.length < 3}
                    onClick={() => void splitPixels(false).catch(fail)}
                  >
                    Копировать на новый слой
                  </button>
                  <button className={button} onClick={() => setSelection([])}>
                    Снять выделение
                  </button>
                  <button
                    className={button}
                    onClick={() => void rasterizeCopy().catch(fail)}
                  >
                    Растровая копия
                  </button>
                  {(["x", "y", "rotation", "scaleX", "scaleY"] as const).map(
                    (key) => (
                      <NumberField
                        key={key}
                        label={"Слой: " + uiLabel(key)}
                        value={
                          layer.transform?.[key] ??
                          (key.startsWith("scale") ? 1 : 0)
                        }
                        step={0.1}
                        onChange={(n) =>
                          patchLayer("Transform layer", (l) => {
                            l.transform ??= {
                              x: 0,
                              y: 0,
                              rotation: 0,
                              scaleX: 1,
                              scaleY: 1,
                            };
                            if (key.startsWith("scale") && Math.abs(n) < 0.001)
                              return;
                            l.transform[key] = n;
                          })
                        }
                      />
                    ),
                  )}
                </>
              )}
            </aside>
            <div className="flex flex-1 min-w-0">
              <StudioCanvas
                doc={doc}
                setupSpace={setupSpace}
                setupSkeleton={
                  template
                    ? evaluateSkeleton(
                        template.bones,
                        new Map(),
                        entity?.bodyMorphs,
                        entity?.appearance,
                      )
                    : undefined
                }
                layer={layer}
                template={template}
                tool={tool}
                color={color}
                size={size}
                opacity={opacity}
                selectedBone={boneId}
                weightMode={weightMode}
                selection={selection}
                setSelection={setSelection}
                setColor={setColor}
                setBone={setBoneId}
                setVertex={setVertexId}
                selectedVertex={vertexId}
                camera={camera}
                setCamera={setCamera}
                onDraft={setDraft}
                onLive={() => setRevision((v) => v + 1)}
                onArtworkChanged={(id) => void refreshAutomatic(id)}
                onError={setError}
              />
              {split && (
                <div className="studio-preview-pane flex flex-col w-1/2 min-w-0 border-l">
                  <div className="p-1 text-xs border-b flex gap-2">
                    <span>Предпросмотр анимации</span>
                    <select
                      aria-label="Диагностика скелета"
                      className="bg-background border"
                      value={debug}
                      onChange={(e) => setDebug(e.target.value)}
                    >
                      {[
                        "artwork",
                        "rig",
                        "depth",
                        "bones",
                        "mesh",
                        "weights",
                        "pivots",
                        "z",
                      ].map((d) => (
                        <option key={d} value={d}>{uiLabel(d)}</option>
                      ))}
                    </select>
                  </div>
                  <StudioLegend doc={doc} template={template} mode={debug} />
                  <StudioPreview
                    doc={doc}
                    revision={revision}
                    draft={draft}
                    debug={debug}
                    selectedBone={boneId}
                    onError={setError}
                    poseOverride={
                      mode === "ANIMATE" && poseDirty ? pose : undefined
                    }
                  />
                </div>
              )}
            </div>
            {mode !== "DRAW" && (
              <aside className={`studio-properties ${propertiesOpen ? "drawer-open" : ""} w-56 border-l overflow-auto p-2 space-y-2`}>
                {!template ? (
                  <>
                    <strong className="text-xs">Создать скелет</strong>
                    <button
                      className={button}
                      onClick={() => {
                        try {
                          createStudioRig(doc.id, "empty");
                        } catch (e) {
                          fail(e);
                        }
                      }}
                    >
                      Пустой скелет
                    </button>
                    <button
                      className={button}
                      onClick={() => {
                        try {
                          createStudioRig(doc.id, "tree");
                        } catch (e) {
                          fail(e);
                        }
                      }}
                    >
                      Скелет дерева
                    </button>
                    <select
                      aria-label="Основа скелета"
                      className="bg-background border text-xs w-full"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value)
                          try {
                            createStudioRig(doc.id, e.target.value);
                          } catch (err) {
                            fail(err);
                          }
                      }}
                    >
                      <option value="">Готовая основа скелета</option>
                      {project.templates
                        .filter((t) => t.skeletonFamily !== "custom_2d_v1")
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {uiLabel(t.name)}
                          </option>
                        ))}
                    </select>
                  </>
                ) : (
                  <>
                    <strong className="text-xs">{uiLabel(template.name)}</strong>
                    <select
                      aria-label="Выбранная кость"
                      className="bg-background border text-xs w-full"
                      value={boneId}
                      onChange={(e) => setBoneId(e.target.value)}
                    >
                      {template.bones.map((b) => (
                        <option key={b.id} value={b.id}>
                          {uiLabel(b.name)}
                        </option>
                      ))}
                    </select>
                    {mode === "RIG" && (
                      <>
                        <button
                          className={button}
                          onClick={() => {
                            const id = "bone_" + newId().slice(0, 8);
                            studioCommit("Add bone", (p) =>
                              p.templates
                                .find((t) => t.id === template.id)!
                                .bones.push({
                                  id,
                                  name: id,
                                  parentId: boneId,
                                  length: 40,
                                  restPose: {
                                    tx: bone?.length ?? 0,
                                    ty: 0,
                                    rotation: 0,
                                    scaleX: 1,
                                    scaleY: 1,
                                  },
                                }),
                            );
                            setBoneId(id);
                          }}
                        >
                          Добавить дочернюю кость
                        </button>
                        {bone && (
                          <>
                            <input
                              aria-label="Название кости"
                              defaultValue={bone.name}
                              key={bone.id}
                              className="w-full bg-background border text-xs"
                              onBlur={(e) =>
                                changeBone((b) => {
                                  b.name = e.target.value;
                                })
                              }
                            />
                            <select
                              aria-label="Родитель кости"
                              className="bg-background border text-xs w-full"
                              value={bone.parentId ?? ""}
                              onChange={(e) => {
                                const parentId = e.target.value || null;
                                if (
                                  parentId === bone.id ||
                                  descendants(bone.id).includes(parentId ?? "")
                                ) {
                                  setError(
                                    "Кость не может быть родителем самой себя или своего предка.",
                                  );
                                  return;
                                }
                                const rest = evaluateSkeleton(
                                    template.bones,
                                    new Map(),
                                  ),
                                  world = worldBoneToMatrix(
                                    rest.bones.get(bone.id)!,
                                  ),
                                  parent = parentId
                                    ? worldBoneToMatrix(
                                        rest.bones.get(parentId)!,
                                      )
                                    : identity(),
                                  local = multiply(inverse(parent), world);
                                changeBone((b) => {
                                  b.parentId = parentId;
                                  b.restPose = {
                                    tx: local[4],
                                    ty: local[5],
                                    rotation:
                                      (Math.atan2(local[1], local[0]) * 180) /
                                      Math.PI,
                                    scaleX: Math.hypot(local[0], local[1]),
                                    scaleY:
                                      (local[0] * local[3] -
                                        local[1] * local[2]) /
                                      Math.hypot(local[0], local[1]),
                                  };
                                }, "Reparent bone");
                              }}
                            >
                              <option value="">Без родителя</option>
                              {template.bones
                                .filter((b) => b.id !== bone.id)
                                .map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {uiLabel(b.name)}
                                  </option>
                                ))}
                            </select>
                            <NumberField
                              label="Длина кости"
                              value={bone.length}
                              min={0}
                              onChange={(n) =>
                                changeBone((b) => {
                                  b.length = n;
                                })
                              }
                            />
                            {(
                              [
                                "tx",
                                "ty",
                                "rotation",
                                "scaleX",
                                "scaleY",
                              ] as const
                            ).map((key) => (
                              <NumberField
                                key={key}
                                label={"Исходное: " + uiLabel(key)}
                                value={bone.restPose[key]}
                                step={0.1}
                                onChange={(n) =>
                                  changeBone((b) => {
                                    if (
                                      key.startsWith("scale") &&
                                      Math.abs(n) < 0.001
                                    )
                                      return;
                                    b.restPose[key] = n;
                                  })
                                }
                              />
                            ))}
                            <button
                              className={button}
                              onClick={() => {
                                const referenced = studioBoneHasDependents(
                                  project,
                                  template.id,
                                  bone.id,
                                );
                                if (referenced) {
                                  setError(
                                    "Сначала перенесите дочерние кости, привязки и дорожки на другую кость. Выберите замену ниже.",
                                  );
                                  return;
                                }
                                studioCommit("Delete bone", (p) => {
                                  const t = p.templates.find(
                                    (t) => t.id === template.id,
                                  )!;
                                  t.bones = t.bones.filter(
                                    (b) => b.id !== bone.id,
                                  );
                                });
                                setBoneId(template.bones[0]?.id ?? "root");
                              }}
                            >
                              Удалить кость
                            </button>
                            <select
                              aria-label="Перенести связи на кость"
                              className="bg-background border text-xs w-full"
                              value={replacementBone}
                              onChange={(e) =>
                                setReplacementBone(e.target.value)
                              }
                            >
                              <option value="">Выберите заменяющую кость</option>
                              {template.bones
                                .filter(
                                  (b) =>
                                    b.id !== bone.id &&
                                    !descendants(bone.id).includes(b.id),
                                )
                                .map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {uiLabel(b.name)}
                                  </option>
                                ))}
                            </select>
                            <button
                              className={button}
                              disabled={!replacementBone}
                              onClick={() => {
                                try {
                                  studioCommit(
                                    "Reassign and delete bone",
                                    (p) =>
                                      reassignStudioBone(
                                        p,
                                        template.id,
                                        bone.id,
                                        replacementBone,
                                      ),
                                  );
                                  setBoneId(replacementBone);
                                  setReplacementBone("");
                                } catch (e) {
                                  fail(e);
                                }
                              }}
                            >
                              Переназначить связи и удалить кость
                            </button>
                          </>
                        )}
                        {layer && (
                          <>
                            <hr />
                            <strong className="text-xs">Деформация</strong>
                            <div className="text-xs">
                              {uiLabel(layer.binding?.mode ?? "Unbound")} →{" "}
                              {layer.binding?.boneId ?? "—"}
                            </div>
                            <button
                              className={button}
                              onClick={() => bind(boneId)}
                            >
                              Жёстко привязать к кости
                            </button>
                            <button
                              className={button}
                              onClick={() =>
                                patchLayer("Use group binding", (l) => {
                                  if (l.binding?.mode === "weighted")
                                    l.savedMesh = l.binding.mesh;
                                  delete l.binding;
                                })
                              }
                            >
                              Наследовать привязку группы / отвязать
                            </button>
                            <label className="block text-xs">
                              Анатомическая принадлежность
                              <select
                                aria-label="Анатомическая принадлежность"
                                className="bg-background border text-xs w-full"
                                value={
                                  layer.anatomicalOwner ??
                                  layer.binding?.boneId ??
                                  ""
                                }
                                onChange={(e) =>
                                  patchLayer("Anatomical owner", (l) => {
                                    l.anatomicalOwner =
                                      e.target.value || undefined;
                                  })
                                }
                              >
                                <option value="">Не задано</option>
                                {template.bones.map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {uiLabel(b.name)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button
                              className={button}
                              disabled={busy}
                              onClick={() => void flexible().catch(fail)}
                            >
                              Сделать гибким
                            </button>
                            <select
                              aria-label="Качество сетки"
                              className="bg-background border text-xs"
                              value={quality}
                              onChange={(e) =>
                                setQuality(
                                  e.target.value as VisualMesh["quality"],
                                )
                              }
                            >
                              {["low", "medium", "high"].map((q) => (
                                <option key={q} value={q}>{uiLabel(q)}</option>
                              ))}
                            </select>
                            <details>
                              <summary className="text-xs">
                                Влияющие кости
                              </summary>
                              {template.bones.map((b) => (
                                <label className="block text-xs" key={b.id}>
                                  <input
                                    type="checkbox"
                                    checked={influences.includes(b.id)}
                                    onChange={(e) =>
                                      setInfluences((ids) =>
                                        e.target.checked
                                          ? [...ids, b.id]
                                          : ids.filter((id) => id !== b.id),
                                      )
                                    }
                                  />
                                  {uiLabel(b.name)}
                                </label>
                              ))}
                            </details>
                            {mesh && (
                              <>
                                <div className="text-xs">
                                  {mesh.vertices.length} вершин ·{" "}
                                  {mesh.triangles.length / 3} треугольников
                                </div>
                                <button
                                  className={button}
                                  disabled={busy}
                                  onClick={() =>
                                    void flexible(true, false).catch(fail)
                                  }
                                >
                                  Пересоздать сетку
                                </button>
                                <button
                                  className={button}
                                  disabled={busy}
                                  onClick={() =>
                                    void flexible(false, true).catch(fail)
                                  }
                                >
                                  Пересчитать веса
                                </button>
                                <button
                                  className={button}
                                  onClick={() => setTool("mesh")}
                                >
                                  Изменить сетку
                                </button>
                                <button
                                  className={button}
                                  onClick={() => setTool("weights")}
                                >
                                  Изменить веса
                                </button>
                                <select
                                  aria-label="Режим кисти весов"
                                  className="bg-background border text-xs"
                                  value={weightMode}
                                  onChange={(e) =>
                                    setWeightMode(
                                      e.target.value as typeof weightMode,
                                    )
                                  }
                                >
                                  {["add", "subtract", "replace", "smooth"].map(
                                    (m) => (
                                      <option key={m} value={m}>{uiLabel(m)}</option>
                                    ),
                                  )}
                                </select>
                                <button
                                  className={button}
                                  onClick={() => {
                                    try {
                                      const next = deleteMeshVertex(
                                        mesh,
                                        vertexId,
                                      );
                                      patchLayer("Delete vertex", (l) => {
                                        if (l.binding?.mode === "weighted")
                                          l.binding.mesh = next;
                                      });
                                      setVertexId(-1);
                                    } catch (e) {
                                      fail(e);
                                    }
                                  }}
                                  disabled={vertexId < 0}
                                >
                                  Удалить вершину
                                </button>
                                {mesh.vertices[vertexId] && (
                                  <NumberField
                                    label="Вес выбранной вершины"
                                    value={
                                      mesh.vertices[vertexId].weights.find(
                                        (w) => w.boneId === boneId,
                                      )?.weight ?? 0
                                    }
                                    min={0}
                                    step={0.05}
                                    onChange={(n) =>
                                      patchLayer("Set vertex weight", (l) => {
                                        if (l.binding?.mode !== "weighted")
                                          return;
                                        const rest = evaluateSkeleton(
                                          template.bones,
                                          new Map(),
                                        );
                                        l.binding.mesh.bindMatrices[boneId] =
                                          worldBoneToMatrix(
                                            rest.bones.get(boneId)!,
                                          );
                                        const v =
                                            l.binding.mesh.vertices[vertexId],
                                          other = v.weights.filter(
                                            (w) => w.boneId !== boneId,
                                          ),
                                          total = other.reduce(
                                            (s, w) => s + w.weight,
                                            0,
                                          ),
                                          weight = Math.min(1, n);
                                        v.weights = [
                                          ...other.map((w) => ({
                                            ...w,
                                            weight: total
                                              ? (w.weight * (1 - weight)) /
                                                total
                                              : 0,
                                          })),
                                          { boneId, weight },
                                        ];
                                        if (!total)
                                          v.weights = [{ boneId, weight: 1 }];
                                        l.binding.mesh.manualWeights = true;
                                      })
                                    }
                                  />
                                )}
                              </>
                            )}
                            {layer.savedMesh &&
                              layer.binding?.mode !== "weighted" && (
                                <button
                                  className={button}
                                  onClick={() =>
                                    patchLayer("Restore Flexible", (l) => {
                                      if (l.binding)
                                        l.binding = {
                                          ...l.binding,
                                          mode: "weighted",
                                          mesh: l.savedMesh!,
                                        };
                                    })
                                  }
                                >
                                  Восстановить гибкость
                                </button>
                              )}
                          </>
                        )}
                      </>
                    )}
                    {mode === "ANIMATE" && (
                      <>
                        <button
                          className={button}
                          onClick={() => createClip("empty")}
                        >
                          Новый клип
                        </button>
                        <button
                          className={button}
                          onClick={() => createClip("wind")}
                        >
                          Пример ветра
                        </button>
                        <button
                          className={button}
                          onClick={() => createClip("rotation")}
                        >
                          Пример вращения
                        </button>
                        <label className="text-xs">
                          <input
                            type="checkbox"
                            checked={autoKey}
                            onChange={(e) => setAutoKey(e.target.checked)}
                          />
                          Автоключ
                        </label>
                        {(
                          ["tx", "ty", "rotation", "scaleX", "scaleY"] as const
                        ).map((k) => (
                          <NumberField
                            key={k}
                            label={"Поза: " + uiLabel(k)}
                            value={pose[k]}
                            step={0.1}
                            onChange={(n) => updatePose(k, n)}
                          />
                        ))}
                        <button
                          className={button}
                          disabled={!clip}
                          onClick={() => keyframe()}
                        >
                          Добавить / заменить ключ
                        </button>
                      </>
                    )}
                  </>
                )}
              </aside>
            )}
          </div>
          {template && (
            <div className="border-t p-2 flex flex-wrap items-center gap-2 text-xs">
              <select
                aria-label="Проверка анимации"
                className="bg-background border max-w-52"
                value={clip?.id ?? ""}
                onChange={(e) =>
                  useStore.getState().setPlaybackClip(e.target.value || null)
                }
              >
                <option value="">Исходная поза</option>
                {getClipsForTemplate(template, project.animationClips).map(
                  (c) => (
                    <option key={c.id} value={c.id}>
                      {uiLabel(c.label)}
                    </option>
                  ),
                )}
              </select>
              <button
                className={button}
                disabled={!clip}
                onClick={() =>
                  useStore.getState().setPlaybackPlaying(!playback.playing)
                }
              >
                {playback.playing ? "Пауза" : "Воспроизвести"}
              </button>
              <input
                aria-label="Время анимации"
                type="range"
                min={0}
                max={clip?.durationMs ?? 1}
                step={1}
                value={playback.timeMs}
                onChange={(e) =>
                  useStore.getState().setPlaybackTime(Number(e.target.value))
                }
                className="flex-1 min-w-32"
              />
              <span>{Math.round(playback.timeMs)} мс</span>
              {clip && mode === "ANIMATE" && (
                <details className="studio-clip-settings"><summary>Параметры клипа</summary><div className="flex flex-wrap gap-3 p-2">
                  <input
                    aria-label="Название клипа"
                    key={clip.id}
                    defaultValue={clip.name}
                    className="bg-background border text-xs w-32"
                    onBlur={(e) => {
                      const name = e.target.value.trim();
                      if (name)
                        editClip("Clip name", (c) => {
                          c.name = name;
                          c.label = name;
                        });
                    }}
                  />
                  <NumberField
                    label="Длительность, мс"
                    value={clip.durationMs}
                    min={1}
                    onChange={(n) =>
                      editClip("Clip duration", (c) => {
                        c.durationMs = n;
                        for (const l of c.layers)
                          for (const t of l.tracks)
                            t.keyframes = t.keyframes.filter(
                              (k) => k.timeMs <= n,
                            );
                      })
                    }
                  />
                  <NumberField
                    label="Кадров/с"
                    value={clip.fps}
                    min={1}
                    onChange={(n) =>
                      editClip("Clip FPS", (c) => {
                        c.fps = n;
                      })
                    }
                  />
                  <label>
                    <input
                      type="checkbox"
                      checked={clip.loops}
                      onChange={(e) => {
                        editClip("Clip loop", (c) => {
                          c.loops = e.target.checked;
                        });
                        useStore
                          .getState()
                          .setPlaybackLooping(e.target.checked);
                      }}
                    />
                    Зациклить
                  </label>
                  <button
                    className={button}
                    onClick={() => {
                      const c = {
                        ...structuredClone(clip),
                        id: newId(),
                        label: clip.label + " (копия)",
                        name: clip.name + "_copy",
                        templateId: template.id,
                      };
                      studioCommit("Duplicate clip", (p) =>
                        p.animationClips.push(c),
                      );
                      useStore.getState().setPlaybackClip(c.id);
                    }}
                  >
                    Дублировать клип
                  </button>
                  <select
                    aria-label="Интерполяция поворота"
                    className="bg-background border"
                    value={
                      clip.layers
                        .flatMap((l) => l.tracks)
                        .find((t) => t.boneId === boneId)?.rotationMode ??
                      "shortest"
                    }
                    onChange={(e) =>
                      editClip("Rotation mode", (c) => {
                        let track = c.layers
                          .flatMap((l) => l.tracks)
                          .find((t) => t.boneId === boneId);
                        if (!track) {
                          if (!c.layers.length)
                            c.layers = [{ mask: "full_body", tracks: [] }];
                          track = { boneId, keyframes: [] };
                          c.layers[0].tracks.push(track);
                        }
                        track.rotationMode = e.target.value as
                          | "shortest"
                          | "unwrapped";
                      })
                    }
                  >
                    <option value="shortest">Кратчайший путь</option>
                    <option value="unwrapped">Полный оборот</option>
                  </select>
                </div></details>
              )}
            </div>
          )}
          {mode === "ANIMATE" && clip && (
            <div
              className="border-t p-2 flex flex-wrap gap-2 text-xs"
              data-testid="studio-keyframes"
            >
              <span>{uiLabel(template?.bones.find(b => b.id === boneId)?.name ?? boneId)} · ключи:</span>
              {clip.layers
                .flatMap((l) => l.tracks)
                .find((t) => t.boneId === boneId)
                ?.keyframes.map((k) => (
                  <button
                    key={k.timeMs}
                    className={
                      button + (keyTime === k.timeMs ? " bg-accent" : "")
                    }
                    onClick={() => {
                      setKeyTime(k.timeMs);
                      useStore.getState().setPlaybackTime(k.timeMs);
                      setPose(k.transform);
                    }}
                  >
                    ◆ {k.timeMs}
                  </button>
                ))}
              {keyTime !== null && (
                <>
                  <NumberField
                    label="Время ключа"
                    value={keyTime}
                    min={0}
                    onChange={(n) => {
                      if (n > (clip?.durationMs ?? 0)) {
                        setError("Время ключа должно находиться внутри клипа.");
                        return;
                      }
                      editClip("Move key", (c) => {
                        const track = c.layers
                          .flatMap((l) => l.tracks)
                          .find((t) => t.boneId === boneId);
                        if (track) {
                          const k = track.keyframes.find(
                            (k) => k.timeMs === keyTime,
                          );
                          track.keyframes = track.keyframes.filter(
                            (k) => k.timeMs !== n,
                          );
                          if (k) k.timeMs = n;
                          track.keyframes.sort((a, b) => a.timeMs - b.timeMs);
                        }
                      });
                      setKeyTime(n);
                    }}
                  />
                  <button
                    className={button}
                    onClick={() => {
                      setKeyClipboard({ ...pose });
                    }}
                  >
                    Копировать ключ
                  </button>
                  <button
                    className={button}
                    disabled={!keyClipboard}
                    onClick={() => keyClipboard && keyframe(keyClipboard)}
                  >
                    Вставить ключ
                  </button>
                  <button
                    className={button}
                    onClick={() => {
                      editClip("Delete key", (c) => {
                        for (const l of c.layers)
                          for (const t of l.tracks)
                            if (t.boneId === boneId)
                              t.keyframes = t.keyframes.filter(
                                (k) => k.timeMs !== keyTime,
                              );
                      });
                      setKeyTime(null);
                    }}
                  >
                    Удалить ключ
                  </button>
                  <select
                    aria-label="Сглаживание ключа"
                    className="bg-background border"
                    value={
                      clip.layers
                        .flatMap((l) => l.tracks)
                        .find((t) => t.boneId === boneId)
                        ?.keyframes.find((k) => k.timeMs === keyTime)?.easing ??
                      "linear"
                    }
                    onChange={(e) =>
                      editClip("Key easing", (c) => {
                        const k = c.layers
                          .flatMap((l) => l.tracks)
                          .find((t) => t.boneId === boneId)
                          ?.keyframes.find((k) => k.timeMs === keyTime);
                        if (k) k.easing = e.target.value as typeof k.easing;
                      })
                    }
                  >
                    {["linear", "ease_in", "ease_out", "ease_in_out"].map(
                      (e) => (
                        <option key={e} value={e}>{uiLabel(e)}</option>
                      ),
                    )}
                  </select>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
