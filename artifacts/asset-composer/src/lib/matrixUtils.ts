/**
 * matrixUtils.ts
 *
 * 2-D affine matrix operations for the scene coordinate system.
 *
 * Convention: Column-vector, row-major storage.
 * Matrix2D = [a, b, c, d, tx, ty]  (CSS / Canvas 2D / Fabric.js convention)
 *
 * Point transform:  x' = a·x + c·y + tx
 *                   y' = b·x + d·y + ty
 *
 * Composition: result = multiply(parent, child)  →  child is applied FIRST
 */

export type Matrix2D = [number, number, number, number, number, number];

export interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface DecomposedTransform {
  tx:       number;
  ty:       number;
  rotation: number;   // degrees
  scaleX:   number;
  scaleY:   number;
}

// ── Constructors ──────────────────────────────────────────────────────────────

export function identity(): Matrix2D {
  return [1, 0, 0, 1, 0, 0];
}

export function translation(tx: number, ty: number): Matrix2D {
  return [1, 0, 0, 1, tx, ty];
}

export function rotationDeg(angleDeg: number): Matrix2D {
  const r = (angleDeg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [c, s, -s, c, 0, 0];
}

export function scaling(sx: number, sy: number): Matrix2D {
  return [sx, 0, 0, sy, 0, 0];
}

// ── Algebra ───────────────────────────────────────────────────────────────────

/** A × B  — apply B first, then A */
export function multiply(A: Matrix2D, B: Matrix2D): Matrix2D {
  const [a1, b1, c1, d1, tx1, ty1] = A;
  const [a2, b2, c2, d2, tx2, ty2] = B;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * tx2 + c1 * ty2 + tx1,
    b1 * tx2 + d1 * ty2 + ty1,
  ];
}

/** Invert an affine 2-D matrix. Returns identity if singular. */
export function inverse(M: Matrix2D): Matrix2D {
  const [a, b, c, d, tx, ty] = M;
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-12) return identity();
  const inv = 1 / det;
  return [
    d  * inv,
    -b * inv,
    -c * inv,
    a  * inv,
    (c * ty - d * tx) * inv,
    (b * tx - a * ty) * inv,
  ];
}

export function transformPoint(
  M: Matrix2D,
  x: number,
  y: number,
): { x: number; y: number } {
  return {
    x: M[0] * x + M[2] * y + M[4],
    y: M[1] * x + M[3] * y + M[5],
  };
}

/**
 * Transform an AABB through M by transforming all four corners.
 * Handles rotation (non-axis-aligned → axis-aligned output bounds).
 */
export function transformAABB(M: Matrix2D, aabb: AABB): AABB {
  const pts = [
    transformPoint(M, aabb.minX, aabb.minY),
    transformPoint(M, aabb.maxX, aabb.minY),
    transformPoint(M, aabb.minX, aabb.maxY),
    transformPoint(M, aabb.maxX, aabb.maxY),
  ];
  return {
    minX: Math.min(...pts.map(p => p.x)),
    minY: Math.min(...pts.map(p => p.y)),
    maxX: Math.max(...pts.map(p => p.x)),
    maxY: Math.max(...pts.map(p => p.y)),
  };
}

export function unionAABB(a: AABB, b: AABB): AABB {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

/** Extract translation, rotation (°) and scale from a 2-D affine matrix. */
export function decompose(M: Matrix2D): DecomposedTransform {
  const [a, b, c, d, tx, ty] = M;
  const scaleX   = Math.sqrt(a * a + b * b);
  const scaleY   = Math.sqrt(c * c + d * d);
  const na       = scaleX > 1e-12 ? a / scaleX : 1;
  const nb       = scaleX > 1e-12 ? b / scaleX : 0;
  const rotation = Math.atan2(nb, na) * (180 / Math.PI);
  return { tx, ty, rotation, scaleX, scaleY };
}

// ── High-level builders ───────────────────────────────────────────────────────

/**
 * Build a local-to-parent matrix for a LocalTransform, honouring pivot.
 *
 * The pivot is expressed in local content units (e.g. centre of the visual).
 * Composition order:
 *   T(x, y) × R(rotation) × S(scaleX, scaleY) × T(-pivotX, -pivotY)
 *
 * This places the pivot point at (x, y) in parent space after rotation/scale.
 */
export function localTransformToMatrix(
  x:        number,
  y:        number,
  rotation: number,
  scaleX:   number,
  scaleY:   number,
  pivotX  = 0,
  pivotY  = 0,
): Matrix2D {
  return multiply(
    multiply(
      multiply(translation(x, y), rotationDeg(rotation)),
      scaling(scaleX, scaleY),
    ),
    translation(-pivotX, -pivotY),
  );
}

/** Build a world matrix from an EvaluatedSkeleton WorldBone. */
export function worldBoneToMatrix(wb: {
  x: number; y: number; rotation: number; scaleX: number; scaleY: number;
}): Matrix2D {
  return multiply(
    multiply(translation(wb.x, wb.y), rotationDeg(wb.rotation)),
    scaling(wb.scaleX, wb.scaleY),
  );
}
