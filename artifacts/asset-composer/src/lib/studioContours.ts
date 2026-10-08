import earcut from "earcut";
type Point = { x: number; y: number };
const key = (p: Point) => p.x + "," + p.y;
const area = (ring: Point[]) =>
  ring.reduce((sum, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return sum + p.x * q.y - q.x * p.y;
  }, 0) / 2;
const inside = (p: Point, ring: Point[]) => {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++)
    if (
      ring[i].y > p.y !== ring[j].y > p.y &&
      p.x <
        ((ring[j].x - ring[i].x) * (p.y - ring[i].y)) /
          (ring[j].y - ring[i].y) +
          ring[i].x
    )
      yes = !yes;
  return yes;
};
/** Exact alpha boundary components and holes, followed by conforming interior subdivision. */
export function triangulateAlpha(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  density: number,
) {
  const filled = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x < width &&
    y < height &&
    alpha[(y * width + x) * 4 + 3] > 0;
  const edges = new Map<string, { a: Point; b: Point; direction: number }[]>();
  let minX = width,
    minY = height,
    maxX = 0,
    maxY = 0;
  const add = (a: Point, b: Point, direction: number) => {
    const list = edges.get(key(a)) ?? [];
    list.push({ a, b, direction });
    edges.set(key(a), list);
  };
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (filled(x, y)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + 1);
        maxY = Math.max(maxY, y + 1);
        if (!filled(x, y - 1)) add({ x, y }, { x: x + 1, y }, 0);
        if (!filled(x + 1, y)) add({ x: x + 1, y }, { x: x + 1, y: y + 1 }, 1);
        if (!filled(x, y + 1)) add({ x: x + 1, y: y + 1 }, { x, y: y + 1 }, 2);
        if (!filled(x - 1, y)) add({ x, y: y + 1 }, { x, y }, 3);
      }
  if (!edges.size)
    throw new Error("The layer is empty; draw or import artwork first");
  const rings: Point[][] = [];
  while (edges.size) {
    let edge = edges.values().next().value![0];
    const start = key(edge.a),
      ring: Point[] = [];
    for (;;) {
      ring.push(edge.a);
      const list = edges.get(key(edge.a))!,
        at = list.indexOf(edge);
      list.splice(at, 1);
      if (!list.length) edges.delete(key(edge.a));
      if (key(edge.b) === start) break;
      const choices = edges.get(key(edge.b));
      if (!choices?.length) throw new Error("Open alpha contour");
      // At diagonal contacts, keep the right turn in this component.
      const direction = edge.direction;
      edge = [...choices].sort(
        (a, b) =>
          ((a.direction - direction + 3) % 4) -
          ((b.direction - direction + 3) % 4),
      )[0];
    }
    const simplified = ring.filter((p, i) => {
      const a = ring[(i + ring.length - 1) % ring.length],
        b = ring[(i + 1) % ring.length];
      return (p.x - a.x) * (b.y - p.y) !== (p.y - a.y) * (b.x - p.x);
    });
    if (simplified.length >= 3) rings.push(simplified);
  }
  const points: Point[] = [],
    triangles: number[] = [],
    outers = rings.filter((r) => area(r) > 0),
    holes = rings.filter((r) => area(r) < 0);
  for (const outer of outers) {
    const nested = holes.filter(
        (h) =>
          inside({ x: h[0].x + 0.01, y: h[0].y + 0.01 }, outer) &&
          !outers.some(
            (other) =>
              other !== outer &&
              Math.abs(area(other)) < Math.abs(area(outer)) &&
              inside(h[0], other),
          ),
      ),
      flat = [...outer, ...nested.flat()],
      offset = points.length,
      holeIndices: number[] = [];
    let length = outer.length;
    for (const hole of nested) {
      holeIndices.push(length);
      length += hole.length;
    }
    points.push(...flat);
    triangles.push(
      ...earcut(
        flat.flatMap((p) => [p.x, p.y]),
        holeIndices,
      ).map((i) => i + offset),
    );
  }
  const step = Math.max(1, Math.max(maxX - minX, maxY - minY) / density),
    midpoints = new Map<string, number>();
  const middle = (a: number, b: number) => {
    const edge = a < b ? a + "," + b : b + "," + a;
    let id = midpoints.get(edge);
    if (id === undefined) {
      id = points.length;
      points.push({
        x: (points[a].x + points[b].x) / 2,
        y: (points[a].y + points[b].y) / 2,
      });
      midpoints.set(edge, id);
    }
    return id;
  };
  let work = triangles;
  for (let pass = 0; pass < 12; pass++) {
    const split = new Set<string>(),
      edgeKey = (a: number, b: number) => (a < b ? a + "," + b : b + "," + a);
    for (let i = 0; i < work.length; i += 3)
      for (let j = 0; j < 3; j++) {
        const a = work[i + j],
          b = work[i + ((j + 1) % 3)];
        if (
          Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y) >
          step * 1.5
        )
          split.add(edgeKey(a, b));
      }
    if (!split.size) break;
    const next: number[] = [];
    for (let i = 0; i < work.length; i += 3) {
      const [a, b, c] = work.slice(i, i + 3),
        ab = split.has(edgeKey(a, b)) ? middle(a, b) : -1,
        bc = split.has(edgeKey(b, c)) ? middle(b, c) : -1,
        ca = split.has(edgeKey(c, a)) ? middle(c, a) : -1;
      if (ab < 0 && bc < 0 && ca < 0) {
        next.push(a, b, c);
        continue;
      }
      if (ab >= 0 && bc >= 0 && ca >= 0) {
        next.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
        continue;
      }
      if (ab >= 0 && bc >= 0) {
        next.push(b, bc, ab, a, ab, c, ab, bc, c);
        continue;
      }
      if (bc >= 0 && ca >= 0) {
        next.push(c, ca, bc, b, bc, a, bc, ca, a);
        continue;
      }
      if (ca >= 0 && ab >= 0) {
        next.push(a, ab, ca, c, ca, b, ca, ab, b);
        continue;
      }
      if (ab >= 0) next.push(a, ab, c, ab, b, c);
      else if (bc >= 0) next.push(b, bc, a, bc, c, a);
      else next.push(c, ca, b, ca, a, b);
    }
    work = next;
    if (points.length > 50_000)
      throw new Error(
        "Artwork contour is too complex; choose a lower mesh quality or simplify isolated pixels",
      );
  }
  return { points, triangles: work };
}
