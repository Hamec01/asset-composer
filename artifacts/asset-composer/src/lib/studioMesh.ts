import { triangulateAlpha } from "./studioContours";
import type { VisualMesh, Matrix2D, Bone } from "@/domain/types";
import { transformPoint, worldBoneToMatrix } from "./matrixUtils";
import type { EvaluatedSkeleton } from "./evaluationPipeline";

/** Triangulate alpha components and holes, then add shared internal vertices. */
export function autoMesh(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  setup: Matrix2D,
  quality: VisualMesh["quality"] = "medium",
): VisualMesh {
  const { points, triangles } = triangulateAlpha(
    alpha,
    width,
    height,
    quality === "low" ? 20 : quality === "high" ? 60 : 36,
  );
  return {
    vertices: points.map((p) => ({
      ...transformPoint(setup, p.x, p.y),
      u: p.x / width,
      v: p.y / height,
      weights: [],
    })),
    triangles,
    bindMatrices: {},
    quality,
  };
}
export function meshAdjacency(mesh: VisualMesh): Map<number, number>[] {
  const adj = mesh.vertices.map(() => new Map<number, number>());
  for (let i = 0; i < mesh.triangles.length; i += 3) {
    const t = mesh.triangles.slice(i, i + 3);
    for (let j = 0; j < 3; j++) {
      const a = t[j],
        b = t[(j + 1) % 3],
        d = Math.hypot(
          mesh.vertices[a].x - mesh.vertices[b].x,
          mesh.vertices[a].y - mesh.vertices[b].y,
        );
      adj[a].set(b, d);
      adj[b].set(a, d);
    }
  }
  return adj;
}
const segmentDistance = (
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
) => {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = Math.max(
      0,
      Math.min(
        1,
        ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
      ),
    );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};
/** Geodesic falloff follows the connected surface rather than crossing transparent gaps. */
export function autoWeights(
  mesh: VisualMesh,
  bones: Bone[],
  skeleton: EvaluatedSkeleton,
  ids: string[],
  matrices?: Record<string, Matrix2D>,
): VisualMesh {
  const chosen = bones.filter((b) => ids.includes(b.id));
  if (!chosen.length) throw new Error("Choose at least one influencing bone");
  const adj = meshAdjacency(mesh),
    components: number[][] = [],
    seen = new Set<number>();
  for (let v = 0; v < mesh.vertices.length; v++) {
    if (seen.has(v)) continue;
    const component = [v];
    seen.add(v);
    for (let i = 0; i < component.length; i++)
      for (const n of adj[component[i]].keys())
        if (!seen.has(n)) {
          seen.add(n);
          component.push(n);
        }
    components.push(component);
  }
  const distances = chosen.map((b) => {
    const wb = skeleton.bones.get(b.id);
    if (!wb) throw new Error("Missing influence bone");
    const m = matrices?.[b.id] ?? worldBoneToMatrix(wb),
      end = transformPoint(m, b.length, 0),
      dist = mesh.vertices.map(() => Infinity);
    for (const component of components) {
      const direct = component.map((i) =>
          segmentDistance(mesh.vertices[i], wb, end),
        ),
        minimum = Math.min(...direct),
        heap: { id: number; d: number }[] = [];
      const push = (entry: { id: number; d: number }) => {
        heap.push(entry);
        let i = heap.length - 1;
        while (i > 0) {
          const parent = (i - 1) >> 1;
          if (heap[parent].d <= entry.d) break;
          heap[i] = heap[parent];
          i = parent;
        }
        heap[i] = entry;
      };
      const pop = () => {
        const first = heap[0],
          last = heap.pop()!;
        if (heap.length) {
          let i = 0;
          while (i * 2 + 1 < heap.length) {
            let child = i * 2 + 1;
            if (child + 1 < heap.length && heap[child + 1].d < heap[child].d)
              child++;
            if (last.d <= heap[child].d) break;
            heap[i] = heap[child];
            i = child;
          }
          heap[i] = last;
        }
        return first;
      };
      component.forEach((id, j) => {
        if (direct[j] <= minimum + Math.max(1, b.length * 0.08)) {
          dist[id] = direct[j];
          push({ id, d: direct[j] });
        }
      });
      while (heap.length) {
        const best = pop();
        if (best.d !== dist[best.id]) continue;
        for (const [id, d] of adj[best.id]) {
          const next = best.d + d;
          if (next < dist[id]) {
            dist[id] = next;
            push({ id, d: next });
          }
        }
      }
    }
    return dist;
  });
  const vertices = mesh.vertices.map((v, i) => {
    const values = chosen
        .map((b, j) => ({
          boneId: b.id,
          weight: 1 / Math.pow(1 + distances[j][i], 2),
        }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 4),
      total = values.reduce((s, w) => s + w.weight, 0);
    return {
      ...v,
      weights: values.map((w) => ({ ...w, weight: w.weight / total })),
    };
  });
  return {
    ...mesh,
    vertices,
    bindMatrices: Object.fromEntries(
      chosen.map((b) => [
        b.id,
        matrices?.[b.id] ?? worldBoneToMatrix(skeleton.bones.get(b.id)!),
      ]),
    ),
    manualWeights: false,
  };
}
export function paintWeights(
  mesh: VisualMesh,
  point: { x: number; y: number },
  boneId: string,
  radius: number,
  strength: number,
  mode: "add" | "subtract" | "replace" | "smooth",
): VisualMesh {
  const adj = meshAdjacency(mesh);
  const vertices = mesh.vertices.map((v, i) => {
    const d = Math.hypot(v.x - point.x, v.y - point.y);
    if (d > radius) return v;
    const values = new Map(v.weights.map((w) => [w.boneId, w.weight])),
      old = values.get(boneId) ?? 0,
      amount = (1 - d / radius) * strength;
    const neighbors = [...adj[i].keys()];
    const target =
      mode === "smooth"
        ? neighbors.reduce(
            (s, n) =>
              s +
              (mesh.vertices[n].weights.find((w) => w.boneId === boneId)
                ?.weight ?? 0),
            0,
          ) / (neighbors.length || 1)
        : mode === "replace"
          ? strength
          : Math.max(
              0,
              Math.min(1, old + (mode === "subtract" ? -amount : amount)),
            );
    const weight = mode === "smooth" ? old + (target - old) * amount : target;
    values.delete(boneId);
    const others = [...values.values()].reduce((a, b) => a + b, 0);
    if (others < 1e-9) return { ...v, weights: [{ boneId, weight: 1 }] };
    return {
      ...v,
      weights: [
        ...[...values].map(([boneId, w]) => ({
          boneId,
          weight: (w * (1 - weight)) / others,
        })),
        { boneId, weight },
      ],
    };
  });
  return { ...mesh, vertices, manualWeights: true };
}
export function addMeshVertex(
  mesh: VisualMesh,
  point: { x: number; y: number },
): VisualMesh {
  for (let i = 0; i < mesh.triangles.length; i += 3) {
    const [a, b, c] = mesh.triangles
        .slice(i, i + 3)
        .map((n) => mesh.vertices[n]),
      den = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    if (Math.abs(den) < 1e-9) continue;
    const u =
        ((b.y - c.y) * (point.x - c.x) + (c.x - b.x) * (point.y - c.y)) / den,
      v = ((c.y - a.y) * (point.x - c.x) + (a.x - c.x) * (point.y - c.y)) / den,
      w = 1 - u - v;
    if (Math.min(u, v, w) < -1e-6) continue;
    const weights = new Map<string, number>();
    [a, b, c].forEach((p, j) =>
      p.weights.forEach((q) =>
        weights.set(
          q.boneId,
          (weights.get(q.boneId) ?? 0) + q.weight * [u, v, w][j],
        ),
      ),
    );
    const vertex = {
        ...point,
        u: a.u * u + b.u * v + c.u * w,
        v: a.v * u + b.v * v + c.v * w,
        weights: [...weights].map(([boneId, weight]) => ({ boneId, weight })),
      },
      id = mesh.vertices.length,
      t = mesh.triangles.slice(i, i + 3),
      triangles = [
        ...mesh.triangles.slice(0, i),
        t[0],
        t[1],
        id,
        t[1],
        t[2],
        id,
        t[2],
        t[0],
        id,
        ...mesh.triangles.slice(i + 3),
      ];
    return {
      ...mesh,
      vertices: [...mesh.vertices, vertex],
      triangles,
      manualMesh: true,
    };
  }
  throw new Error("Add vertices inside an existing mesh triangle");
}
export function deleteMeshVertex(mesh: VisualMesh, id: number): VisualMesh {
  const edges = new Map<number, number>();
  for (let i = 0; i < mesh.triangles.length; i += 3) {
    const t = mesh.triangles.slice(i, i + 3),
      at = t.indexOf(id);
    if (at < 0) continue;
    edges.set(t[(at + 1) % 3], t[(at + 2) % 3]);
  }
  const ring: number[] = [];
  if (edges.size) {
    let start =
      [...edges.keys()].find((k) => ![...edges.values()].includes(k)) ??
      edges.keys().next().value!;
    for (let i = 0; i <= edges.size; i++) {
      if (ring.includes(start)) break;
      ring.push(start);
      const next = edges.get(start);
      if (next === undefined) break;
      start = next;
    }
  }
  const kept: number[] = [];
  for (let i = 0; i < mesh.triangles.length; i += 3) {
    const t = mesh.triangles.slice(i, i + 3);
    if (!t.includes(id)) kept.push(...t);
  }
  // Ear clipping handles concave neighborhoods without crossing their boundary.
  const polygon = [...ring],
    cross = (a: number, b: number, c: number) => {
      const p = mesh.vertices[a],
        q = mesh.vertices[b],
        r = mesh.vertices[c];
      return (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    };
  const area = polygon.reduce((sum, id, i) => {
      const a = mesh.vertices[id],
        b = mesh.vertices[polygon[(i + 1) % polygon.length]];
      return sum + a.x * b.y - b.x * a.y;
    }, 0),
    sign = area >= 0 ? 1 : -1;
  while (polygon.length > 2) {
    let clipped = false;
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[(i + polygon.length - 1) % polygon.length],
        b = polygon[i],
        c = polygon[(i + 1) % polygon.length];
      if (cross(a, b, c) * sign < 1e-8) continue;
      if (
        polygon.some(
          (p) =>
            p !== a &&
            p !== b &&
            p !== c &&
            cross(a, b, p) * sign >= -1e-8 &&
            cross(b, c, p) * sign >= -1e-8 &&
            cross(c, a, p) * sign >= -1e-8,
        )
      )
        continue;
      kept.push(a, b, c);
      polygon.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped)
      throw new Error(
        "This removal would create invalid topology; move the vertex or regenerate the mesh",
      );
  }
  if (mesh.vertices.length <= 3 || !kept.length)
    throw new Error("Mesh needs at least one triangle");
  return {
    ...mesh,
    vertices: mesh.vertices.filter((_, i) => i !== id),
    triangles: kept.map((n) => (n > id ? n - 1 : n)),
    manualMesh: true,
  };
}
