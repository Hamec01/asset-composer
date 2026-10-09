import { transformedArtwork } from "@/lib/studioLayers";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Matrix2D,
  SpriteEditorDocument,
  SpriteEditorLayer,
  Template,
  VisualMesh,
} from "@/domain/types";
import { artLayerContent, layerSetupMatrix } from "@/lib/artDocument";
import {
  drawVisual,
  renderContent,
  setLiveRaster,
  loadImage,
} from "@/lib/visualRenderer";
import { makeRasterAsset } from "@/lib/visualContent";
import { editStudioDocument, newId } from "@/lib/studioActions";
import {
  identity,
  inverse,
  multiply,
  transformPoint,
  worldBoneToMatrix,
} from "@/lib/matrixUtils";
import {
  evaluateSkeleton,
  type EvaluatedSkeleton,
} from "@/lib/evaluationPipeline";
import { addMeshVertex, paintWeights } from "@/lib/studioMesh";

export type StudioTool =
  | "brush"
  | "pencil"
  | "eraser"
  | "fill"
  | "picker"
  | "rect-select"
  | "lasso"
  | "move"
  | "pen"
  | "rectangle"
  | "ellipse"
  | "bone"
  | "pivot"
  | "mesh"
  | "add-vertex"
  | "weights";
export interface StudioCanvasProps {
  setupSpace?: Matrix2D;
  setupSkeleton?: EvaluatedSkeleton;
  doc: SpriteEditorDocument;
  layer?: SpriteEditorLayer;
  template?: Template;
  tool: StudioTool;
  color: string;
  size: number;
  opacity: number;
  selectedBone: string;
  weightMode: "add" | "subtract" | "replace" | "smooth";
  selection: { x: number; y: number }[];
  setSelection: (p: { x: number; y: number }[]) => void;
  setColor: (c: string) => void;
  setBone: (id: string) => void;
  setVertex: (i: number) => void;
  selectedVertex: number;
  camera: { x: number; y: number; zoom: number };
  setCamera: (c: { x: number; y: number; zoom: number }) => void;
  onDraft?: (document: SpriteEditorDocument | null) => void;
  onLive: () => void;
  onArtworkChanged: (layerId: string) => void;
  onError: (message: string) => void;
}
const inside = (
  p: { x: number; y: number },
  polygon: { x: number; y: number }[],
) => {
  let yes = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++)
    if (
      polygon[i].y > p.y !== polygon[j].y > p.y &&
      p.x <
        ((polygon[j].x - polygon[i].x) * (p.y - polygon[i].y)) /
          (polygon[j].y - polygon[i].y) +
          polygon[i].x
    )
      yes = !yes;
  return yes;
};
export function StudioCanvas(props: StudioCanvasProps) {
  const { doc, layer, template, tool, color, size, opacity, camera } = props;
  const setupSpace = props.setupSpace ?? identity(),
    fromWorld = inverse(setupSpace),
    meshSpace = layer?.binding?.setupMatrix ?? identity();
  const meshPoint = (p: { x: number; y: number }) =>
    transformPoint(meshSpace, p.x, p.y);
  const weightRadius =
    size *
    Math.max(
      Math.hypot(meshSpace[0], meshSpace[1]),
      Math.hypot(meshSpace[2], meshSpace[3]),
    );
  const canvasRef = useRef<HTMLCanvasElement>(null),
    overlayRef = useRef<SVGSVGElement>(null),
    working = useRef<HTMLCanvasElement | null>(null),
    generation = useRef(0);
  const gesture = useRef<{
    start: { x: number; y: number };
    last: { x: number; y: number };
    points: { x: number; y: number }[];
    layer: SpriteEditorLayer;
    vertex?: number;
    mesh?: VisualMesh;
    boneId?: string;
    pan?: { x: number; y: number };
  } | null>(null);
  const [revision, setRevision] = useState(0),
    [draftLayer, setDraftLayer] = useState<SpriteEditorLayer | null>(null);
  const paintedDoc = useMemo(
    () =>
      draftLayer
        ? tool === "move"
          ? transformedArtwork(doc, draftLayer)
          : {
              ...doc,
              layers: doc.layers.map((l) =>
                l.id === draftLayer.id ? draftLayer : l,
              ),
            }
        : doc,
    [doc, draftLayer, tool],
  );
  useEffect(() => {
    props.onDraft?.(draftLayer ? paintedDoc : null);
  }, [paintedDoc, draftLayer]);
  const loadingStroke = useRef<Promise<HTMLCanvasElement> | null>(null);
  const skeleton =
    props.setupSkeleton ??
    (template ? evaluateSkeleton(template.bones, new Map()) : null);
  const redraw = () => {
    setRevision((v) => v + 1);
    props.onLive();
  };
  useEffect(() => {
    const token = ++generation.current,
      buffer = document.createElement("canvas");
    buffer.width = doc.width;
    buffer.height = doc.height;
    const ctx = buffer.getContext("2d")!;
    const render = async () => {
      if (doc.tracingVisible !== false && doc.tracingAsset?.dataUri) {
        try {
          const image = await loadImage(doc.tracingAsset.dataUri);
          ctx.save();
          ctx.globalAlpha = doc.tracingOpacity ?? 0.35;
          const t = doc.tracingTransform;
          ctx.translate(
            doc.width / 2 + (t?.x ?? 0),
            doc.height / 2 + (t?.y ?? 0),
          );
          ctx.rotate(((t?.rotation ?? 0) * Math.PI) / 180);
          ctx.scale(t?.scale ?? 1, t?.scale ?? 1);
          ctx.drawImage(
            image,
            -doc.width / 2,
            -doc.height / 2,
            doc.width,
            doc.height,
          );
          ctx.restore();
        } catch {}
      }
      for (const l of paintedDoc.layers
        .filter((l) => !l.parentId)
        .sort((a, b) => a.zIndex - b.zIndex))
        if (l.visible)
          await drawVisual(ctx, {
            id: l.id,
            content: artLayerContent(paintedDoc, l),
            worldMatrix: layerSetupMatrix(paintedDoc, l),
            localBounds: {
              minX: 0,
              minY: 0,
              maxX: doc.width,
              maxY: doc.height,
            },
            worldBounds: {
              minX: 0,
              minY: 0,
              maxX: doc.width,
              maxY: doc.height,
            },
            zIndex: l.zIndex,
            opacity: l.opacity ?? 1,
            sampling: l.sampling ?? doc.sampling,
          });
      const selected = paintedDoc.layers.find((l) => l.id === layer?.id);
      if (
        selected?.binding?.mode === "weighted" &&
        (selected.binding.mesh.manualMesh ||
          selected.binding.mesh.manualWeights)
      ) {
        const coverage = await renderContent(
            artLayerContent(paintedDoc, selected),
            doc.width,
            doc.height,
          ),
          out = coverage.getContext("2d")!,
          mesh = selected.binding.mesh;
        out.globalCompositeOperation = "destination-out";
        for (let i = 0; i < mesh.triangles.length; i += 3) {
          out.beginPath();
          mesh.triangles
            .slice(i, i + 3)
            .map((n) => mesh.vertices[n])
            .forEach((v, j) =>
              j
                ? out.lineTo(v.u * doc.width, v.v * doc.height)
                : out.moveTo(v.u * doc.width, v.v * doc.height),
            );
          out.closePath();
          out.fill();
        }
        out.globalCompositeOperation = "source-in";
        out.fillStyle = "#ff376d";
        out.fillRect(0, 0, doc.width, doc.height);
        ctx.save();
        ctx.transform(...layerSetupMatrix(paintedDoc, selected));
        ctx.drawImage(coverage, 0, 0);
        ctx.restore();
      }
      if (token !== generation.current) return;
      const c = canvasRef.current;
      if (!c) return;
      const out = c.getContext("2d")!;
      out.clearRect(0, 0, c.width, c.height);
      out.save();
      out.scale(camera.zoom, camera.zoom);
      out.translate(-camera.x, -camera.y);
      out.imageSmoothingEnabled = doc.sampling !== "pixel";
      out.drawImage(buffer, 0, 0);
      out.restore();
    };
    void render().catch((error) => props.onError(error.message));
    return () => {
      generation.current++;
    };
  }, [doc, draftLayer, revision, camera]);
  useEffect(
    () => () => {
      if (layer?.assetId) setLiveRaster(layer.assetId, null);
    },
    [layer?.assetId],
  );
  const point = (e: React.PointerEvent) => {
    const r = overlayRef.current!.getBoundingClientRect();
    return {
      x: camera.x + ((e.clientX - r.left) * doc.width) / r.width / camera.zoom,
      y: camera.y + ((e.clientY - r.top) * doc.height) / r.height / camera.zoom,
    };
  };
  const local = (p: { x: number; y: number }) =>
    layer ? transformPoint(inverse(layerSetupMatrix(doc, layer)), p.x, p.y) : p;
  const clip = (ctx: CanvasRenderingContext2D) => {
    if (props.selection.length < 3) return;
    ctx.beginPath();
    props.selection
      .map(local)
      .forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.clip();
  };
  const stroke = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const c = working.current;
    if (!c) return;
    const ctx = c.getContext("2d")!,
      p = local(a),
      q = local(b);
    ctx.save();
    clip(ctx);
    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation =
      tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (tool === "pencil") {
      const steps = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y)));
      for (let i = 0; i <= steps; i++)
        ctx.fillRect(
          Math.round(p.x + ((q.x - p.x) * i) / steps) - Math.floor(size / 2),
          Math.round(p.y + ((q.y - p.y) * i) / steps) - Math.floor(size / 2),
          Math.max(1, Math.round(size)),
          Math.max(1, Math.round(size)),
        );
    } else {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x + 0.001, q.y + 0.001);
      ctx.stroke();
    }
    ctx.restore();
    redraw();
  };
  const fill = (p: { x: number; y: number }) => {
    const c = working.current!,
      ctx = c.getContext("2d")!,
      data = ctx.getImageData(0, 0, c.width, c.height),
      q = local(p),
      x = Math.floor(q.x),
      y = Math.floor(q.y);
    if (x < 0 || y < 0 || x >= c.width || y >= c.height) return;
    const i = (y * c.width + x) * 4,
      target = [...data.data.slice(i, i + 4)],
      rgb = [1, 3, 5].map((n) => parseInt(color.slice(n, n + 2), 16)),
      seen = new Uint8Array(c.width * c.height),
      queue = [y * c.width + x];
    for (let j = 0; j < queue.length; j++) {
      const id = queue[j];
      if (seen[id]) continue;
      seen[id] = 1;
      const ix = id % c.width,
        iy = Math.floor(id / c.width),
        at = id * 4;
      if (
        props.selection.length >= 3 &&
        !inside(
          transformPoint(layerSetupMatrix(doc, layer!), ix, iy),
          props.selection,
        )
      )
        continue;
      if (target.some((v, n) => Math.abs(v - data.data[at + n]) > 8)) continue;
      rgb.forEach(
        (v, n) =>
          (data.data[at + n] = Math.round(
            v * opacity + data.data[at + n] * (1 - opacity),
          )),
      );
      data.data[at + 3] = Math.round(
        255 * opacity + data.data[at + 3] * (1 - opacity),
      );
      if (ix > 0) queue.push(id - 1);
      if (ix < c.width - 1) queue.push(id + 1);
      if (iy > 0) queue.push(id - c.width);
      if (iy < c.height - 1) queue.push(id + c.width);
    }
    ctx.putImageData(data, 0, 0);
    redraw();
  };
  const start = async (e: React.PointerEvent<SVGSVGElement>) => {
    const p = point(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (e.button === 1 || e.altKey) {
      gesture.current = {
        start: p,
        last: p,
        points: [],
        layer: layer ?? {
          id: "",
          name: "",
          visible: true,
          zIndex: 0,
          shapes: [],
        },
        pan: { x: camera.x, y: camera.y },
      };
      return;
    }
    if (tool === "rect-select" || tool === "lasso") {
      gesture.current = {
        start: p,
        last: p,
        points: [p],
        layer: layer ?? {
          id: "",
          name: "",
          visible: true,
          zIndex: 0,
          shapes: [],
        },
      };
      props.setSelection([p]);
      return;
    }
    if ((tool === "bone" || tool === "pivot") && skeleton && template) {
      const nearest = [...skeleton.bones]
        .map(([id, b]) => ({
          ...b,
          ...transformPoint(fromWorld, b.x, b.y),
          id,
        }))
        .sort(
          (a, b) =>
            Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
        )[0];
      if (tool === "pivot") {
        gesture.current = {
          start: p,
          last: p,
          points: [],
          layer: layer ?? {
            id: "",
            name: "",
            visible: true,
            zIndex: 0,
            shapes: [],
          },
          boneId: props.selectedBone,
        };
        return;
      }
      if (
        nearest &&
        Math.hypot(nearest.x - p.x, nearest.y - p.y) < 14 / camera.zoom
      ) {
        props.setBone(nearest.id);
        gesture.current = {
          start: p,
          last: p,
          points: [],
          layer: layer ?? {
            id: "",
            name: "",
            visible: true,
            zIndex: 0,
            shapes: [],
          },
          boneId: nearest.id,
        };
      }
      return;
    }
    if (!layer || layer.locked) {
      props.onError("Выберите слой и снимите его блокировку в панели слоёв.");
      return;
    }
    const g = {
      start: p,
      last: p,
      points: [p],
      layer: structuredClone(layer),
      mesh:
        layer.binding?.mode === "weighted"
          ? structuredClone(layer.binding.mesh)
          : undefined,
      vertex: undefined as number | undefined,
    };
    gesture.current = g;
    if (tool === "mesh" && g.mesh) {
      g.vertex = g.mesh.vertices
        .map((v, i) => ({
          i,
          d: Math.hypot(v.x - meshPoint(p).x, v.y - meshPoint(p).y),
        }))
        .sort((a, b) => a.d - b.d)[0]?.i;
      props.setVertex(g.vertex ?? -1);
      return;
    }
    if (tool === "add-vertex" && g.mesh) {
      try {
        g.mesh = addMeshVertex(g.mesh, meshPoint(p));
        if (layer.binding?.mode === "weighted")
          setDraftLayer({
            ...layer,
            binding: { ...layer.binding, mesh: g.mesh },
          });
      } catch (err) {
        props.onError((err as Error).message);
      }
      return;
    }
    if (tool === "weights" && g.mesh) {
      if (skeleton?.bones.has(props.selectedBone))
        g.mesh.bindMatrices[props.selectedBone] = worldBoneToMatrix(
          skeleton.bones.get(props.selectedBone)!,
        );
      g.mesh = paintWeights(
        g.mesh,
        meshPoint(p),
        props.selectedBone,
        weightRadius,
        opacity,
        props.weightMode,
      );
      if (layer.binding?.mode === "weighted")
        setDraftLayer({
          ...layer,
          binding: { ...layer.binding, mesh: g.mesh },
        });
      return;
    }
    if (["brush", "pencil", "eraser", "fill", "picker"].includes(tool)) {
      if (layer.kind !== "raster") {
        gesture.current = null;
        props.onError("Для кисти выберите растровый слой. Для векторного слоя используйте перо или фигуры.");
        return;
      }
      working.current = null;
      loadingStroke.current = layer.assetId
        ? renderContent(
            { kind: "raster", assetId: layer.assetId },
            doc.width,
            doc.height,
          )
        : Promise.resolve(
            Object.assign(document.createElement("canvas"), {
              width: doc.width,
              height: doc.height,
            }),
          );
      working.current = await loadingStroke.current;
      if (gesture.current !== g) return;
      if (layer.assetId) setLiveRaster(layer.assetId, working.current);
      if (tool === "picker") {
        const q = local(p),
          pixel = working.current
            .getContext("2d")!
            .getImageData(
              Math.max(0, Math.min(doc.width - 1, q.x)),
              Math.max(0, Math.min(doc.height - 1, q.y)),
              1,
              1,
            ).data;
        props.setColor(
          "#" +
            [...pixel.slice(0, 3)]
              .map((v) => v.toString(16).padStart(2, "0"))
              .join(""),
        );
        gesture.current = null;
        return;
      }
      if (tool === "fill") fill(p);
      else {
        stroke(p, p);
        for (let i = 1; i < g.points.length; i++)
          stroke(g.points[i - 1], g.points[i]);
      }
      loadingStroke.current = null;
    }
  };
  const move = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const p = point(e);
    if (g.pan) {
      props.setCamera({
        ...camera,
        x: g.pan.x - (p.x - g.start.x),
        y: g.pan.y - (p.y - g.start.y),
      });
      return;
    }
    if (tool === "rect-select")
      props.setSelection([
        g.start,
        { x: p.x, y: g.start.y },
        p,
        { x: g.start.x, y: p.y },
      ]);
    else if (tool === "lasso") {
      g.points.push(p);
      props.setSelection([...g.points]);
    } else if (["brush", "pencil", "eraser"].includes(tool)) {
      if (loadingStroke.current) g.points.push(p);
      else stroke(g.last, p);
    } else if (tool === "move") {
      const matrix = g.layer.parentId
        ? layerSetupMatrix(
            doc,
            doc.layers.find((l) => l.id === g.layer.parentId)!,
          )
        : ([1, 0, 0, 1, 0, 0] as const);
      const a = transformPoint(inverse([...matrix]), g.start.x, g.start.y),
        b = transformPoint(inverse([...matrix]), p.x, p.y);
      setDraftLayer({
        ...g.layer,
        transform: {
          ...(g.layer.transform ?? {
            x: 0,
            y: 0,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          }),
          x: (g.layer.transform?.x ?? 0) + b.x - a.x,
          y: (g.layer.transform?.y ?? 0) + b.y - a.y,
        },
      });
    } else if (tool === "mesh" && g.mesh && g.vertex !== undefined) {
      const uv = transformPoint(
        inverse(layerSetupMatrix(doc, g.layer)),
        p.x,
        p.y,
      );
      g.mesh.vertices[g.vertex] = {
        ...g.mesh.vertices[g.vertex],
        ...meshPoint(p),
        u: uv.x / doc.width,
        v: uv.y / doc.height,
      };
      g.mesh.manualMesh = true;
      if (g.layer.binding?.mode === "weighted")
        setDraftLayer({
          ...g.layer,
          binding: { ...g.layer.binding, mesh: g.mesh },
        });
    } else if (tool === "weights" && g.mesh) {
      if (skeleton?.bones.has(props.selectedBone))
        g.mesh.bindMatrices[props.selectedBone] = worldBoneToMatrix(
          skeleton.bones.get(props.selectedBone)!,
        );
      g.mesh = paintWeights(
        g.mesh,
        meshPoint(p),
        props.selectedBone,
        weightRadius,
        opacity,
        props.weightMode,
      );
      if (g.layer.binding?.mode === "weighted")
        setDraftLayer({
          ...g.layer,
          binding: { ...g.layer.binding, mesh: g.mesh },
        });
    } else g.points.push(p);
    g.last = p;
  };
  const end = async () => {
    const g = gesture.current;
    if (!g) return;
    if (loadingStroke.current) await loadingStroke.current;
    if (gesture.current !== g) return;
    gesture.current = null;
    if (g.pan || tool === "rect-select" || tool === "lasso") return;
    if (g.boneId && template) {
      const bone = template.bones.find((b) => b.id === g.boneId)!,
        parent = bone.parentId ? skeleton?.bones.get(bone.parentId) : null;
      const global = transformPoint(setupSpace, g.last.x, g.last.y);
      const p = parent
        ? transformPoint(inverse(worldBoneToMatrix(parent)), global.x, global.y)
        : global;
      // The inspector handles rebinding affected parts in the same transaction.
      overlayRef.current?.dispatchEvent(
        new CustomEvent("studio-bone-move", {
          bubbles: true,
          detail: { id: bone.id, x: p.x, y: p.y },
        }),
      );
      return;
    }
    if (
      working.current &&
      ["brush", "pencil", "eraser", "fill"].includes(tool)
    ) {
      const asset = makeRasterAsset(
        working.current.toDataURL("image/png"),
        doc.width,
        doc.height,
        layer?.name,
      );
      editStudioDocument(doc.id, "Paint " + tool, (d, p) => {
        p.assets ??= {};
        p.assets[asset.id] = asset;
        const l = d.layers.find((l) => l.id === g.layer.id);
        if (l) l.assetId = asset.id;
      });
      if (g.layer.assetId) setLiveRaster(g.layer.assetId, null);
      working.current = null;
      props.onArtworkChanged(g.layer.id);
    } else if (draftLayer) {
      editStudioDocument(
        doc.id,
        tool === "move" ? "Move layer" : "Edit " + tool,
        (d) => {
          d.layers = paintedDoc.layers;
        },
      );
      setDraftLayer(null);
    } else if (["pen", "rectangle", "ellipse"].includes(tool)) {
      if (layer?.kind !== "vector") {
        props.onError("Для фигур и пера выберите векторный слой.");
        return;
      }
      const a = local(g.start),
        b = local(g.last),
        points = g.points.map(local);
      editStudioDocument(doc.id, "Draw " + tool, (d) =>
        d.layers
          .find((l) => l.id === g.layer.id)!
          .shapes.push({
            id: newId(),
            type:
              tool === "pen" ? "path" : tool === "ellipse" ? "ellipse" : "rect",
            x: Math.min(a.x, b.x),
            y: Math.min(a.y, b.y),
            width: Math.max(1, Math.abs(a.x - b.x)),
            height: Math.max(1, Math.abs(a.y - b.y)),
            rotation: 0,
            fill: tool === "pen" ? "none" : color,
            stroke: color,
            strokeWidth: tool === "pen" ? size : 0,
            pathData:
              tool === "pen"
                ? points
                    .map((p, i) => (i ? "L" : "M") + p.x + " " + p.y)
                    .join(" ")
                : undefined,
          }),
      );
      props.onArtworkChanged(g.layer.id);
    }
  };
  const mesh =
    (draftLayer ?? layer)?.binding?.mode === "weighted"
      ? ((draftLayer ?? layer)!.binding as { mesh: VisualMesh }).mesh
      : null;
  return (
    <div
      className="relative flex-1 min-h-0 overflow-auto bg-[#20232a] p-3"
      data-testid="studio-art-canvas"
    >
      <div
        className="relative mx-auto max-h-full"
        style={{
          width: "min(100%, 700px)",
          aspectRatio: doc.width + " / " + doc.height,
          backgroundImage:
            "conic-gradient(#30343b 25%,#292c32 0 50%,#30343b 0 75%,#292c32 0)",
          backgroundSize: "20px 20px",
        }}
      >
        <canvas
          ref={canvasRef}
          width={doc.width}
          height={doc.height}
          className="absolute inset-0 w-full h-full"
        />
        <svg
          ref={overlayRef}
          className="absolute inset-0 w-full h-full touch-none"
          viewBox={[
            camera.x,
            camera.y,
            doc.width / camera.zoom,
            doc.height / camera.zoom,
          ].join(" ")}
          onPointerDown={(e) =>
            void start(e).catch((error) => props.onError(error.message))
          }
          onPointerMove={move}
          onPointerUp={() =>
            void end().catch((error) => props.onError(error.message))
          }
          onPointerCancel={() => {
            gesture.current = null;
            working.current = null;
            if (layer?.assetId) setLiveRaster(layer.assetId, null);
            setDraftLayer(null);
          }}
          onWheel={(e) =>
            props.setCamera({
              ...camera,
              zoom: Math.max(
                0.25,
                Math.min(8, camera.zoom * (e.deltaY < 0 ? 1.1 : 0.9)),
              ),
            })
          }
        >
          {props.selection.length > 1 && (
            <polygon
              points={props.selection.map((p) => p.x + "," + p.y).join(" ")}
              fill="rgba(80,160,255,.12)"
              stroke="#80bcff"
              strokeWidth={1 / camera.zoom}
              strokeDasharray="5 3"
            />
          )}
          {(tool === "bone" || tool === "pivot") &&
            template?.bones.map((b) => {
              const world = skeleton?.bones.get(b.id),
                wb = world
                  ? transformPoint(fromWorld, world.x, world.y)
                  : undefined,
                parentWorld = b.parentId
                  ? skeleton?.bones.get(b.parentId)
                  : null,
                parent = parentWorld
                  ? transformPoint(fromWorld, parentWorld.x, parentWorld.y)
                  : null;
              return wb ? (
                <g key={b.id}>
                  {parent && (
                    <line
                      x1={parent.x}
                      y1={parent.y}
                      x2={wb.x}
                      y2={wb.y}
                      stroke="#ffcc55"
                      strokeWidth={2 / camera.zoom}
                    />
                  )}
                  <circle
                    cx={wb.x}
                    cy={wb.y}
                    r={5 / camera.zoom}
                    fill={props.selectedBone === b.id ? "#ff6655" : "#ffcc55"}
                  />
                  <text
                    x={wb.x + 7 / camera.zoom}
                    y={wb.y - 6 / camera.zoom}
                    fontSize={11 / camera.zoom}
                    fill="white"
                  >
                    {b.name}
                  </text>
                </g>
              ) : null;
            })}
          {mesh && ["mesh", "add-vertex", "weights"].includes(tool) && (
            <g transform={"matrix(" + inverse(meshSpace).join(" ") + ")"}>
              {mesh.triangles.map((_, i) =>
                i % 3 ? null : (
                  <polygon
                    key={i}
                    points={mesh.triangles
                      .slice(i, i + 3)
                      .map((n) => mesh.vertices[n].x + "," + mesh.vertices[n].y)
                      .join(" ")}
                    fill={
                      tool === "weights"
                        ? "hsl(" +
                          (240 -
                            (240 *
                              mesh.triangles
                                .slice(i, i + 3)
                                .reduce(
                                  (sum, n) =>
                                    sum +
                                    (mesh.vertices[n].weights.find(
                                      (w) => w.boneId === props.selectedBone,
                                    )?.weight ?? 0),
                                  0,
                                )) /
                              3) +
                          " 95% 55% / .45)"
                        : "none"
                    }
                    stroke="#69f5d5"
                    strokeOpacity=".5"
                    strokeWidth={0.7 / camera.zoom}
                  />
                ),
              )}
              {mesh.vertices.map((v, i) => (
                <circle
                  key={i}
                  cx={v.x}
                  cy={v.y}
                  r={(i === props.selectedVertex ? 4 : mesh.vertices.length > 500 ? .8 : tool === "weights" ? 3 : 2) / camera.zoom}
                  stroke={i === props.selectedVertex ? "#ffcf55" : "none"}
                  strokeWidth={2 / camera.zoom}
                  fill={
                    i === props.selectedVertex ? "#ffcf55" : tool === "weights"
                      ? "hsl(" +
                        (240 -
                          240 *
                            (v.weights.find(
                              (w) => w.boneId === props.selectedBone,
                            )?.weight ?? 0)) +
                        " 95% 55%)"
                      : "#ffffff"
                  }
                />
              ))}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
