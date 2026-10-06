import type { AnimationClip, BoneTransform } from "@/domain/types";
import { getAnimationContext, setAnimationContext, type AnimationContext } from "./animationContext";
import { identity, inverse, transformPoint, worldBoneToMatrix } from "./matrixUtils";

type Pose = Map<string, BoneTransform>;
type World = Map<string, { x: number; y: number; rotation: number; scaleX: number; scaleY: number }>;
type IkKey = NonNullable<AnimationClip["ik"]>[number]["keyframes"][number];

const DEG = 180 / Math.PI;
/** Bone direction convention: rotation θ maps the bone axis (0, 1) to (-sin θ, cos θ). */
const angleOf = (dx: number, dy: number) => Math.atan2(-dx, dy) * DEG;
const wrap = (deg: number) => ((deg + 180) % 360 + 360) % 360 - 180;

function keyAt(keys: IkKey[], timeMs: number): IkKey | null {
  if (!keys.length) return null;
  const ordered = [...keys].sort((a, b) => a.timeMs - b.timeMs);
  const right = ordered.findIndex(k => k.timeMs > timeMs);
  if (right === 0) return ordered[0];
  if (right < 0) return ordered.at(-1)!;
  const a = ordered[right - 1], b = ordered[right];
  const t = (timeMs - a.timeMs) / (b.timeMs - a.timeMs);
  const mix = (p: number, q: number) => p + (q - p) * t;
  return { timeMs, x: mix(a.x, b.x), y: mix(a.y, b.y), rotation: a.rotation === undefined && b.rotation === undefined ? undefined : mix(a.rotation ?? 0, b.rotation ?? 0), mix: mix(a.mix, b.mix) };
}

/**
 * Two-bone IK (Spine IkConstraint / Godot TwoBoneIK) solved against the actual
 * skeleton, so one authored target works for every view, body morph and rig variant.
 * Targets are in skeleton space before view mirroring. With `stretch`, both bones
 * lengthen along their own axis when the target is out of reach; the child and
 * effector should use Inherit.noScale so their artwork keeps its width.
 */
export function solveIkPose(pose: Pose, context: AnimationContext, evaluate: (pose: Pose) => World, parentOf: (boneId: string) => string | null): Pose {
  const constraints = context.clip.ik ?? [];
  if (!constraints.length) return pose;
  let current: Pose = pose;
  for (const constraint of constraints) {
    const key = keyAt(constraint.keyframes, context.timeMs);
    if (!key || key.mix <= 0) continue;
    const [parentId, childId, effectorId] = constraint.bones;
    const world = evaluate(current);
    const parent = world.get(parentId), child = world.get(childId), effector = world.get(effectorId);
    if (!parent || !child || !effector) continue;
    // Work in the frame of the chain root's parent, which the solve does not move.
    const frameBone = world.get(parentOf(parentId) ?? "");
    const toFrame = frameBone ? inverse(worldBoneToMatrix(frameBone)) : identity();
    const local = (p: { x: number; y: number }) => transformPoint(toFrame, p.x, p.y);
    const a = local(parent), b = local(child), c = local(effector);
    const target = local({ x: key.x, y: key.y });
    const l1 = Math.hypot(b.x - a.x, b.y - a.y), l2 = Math.hypot(c.x - b.x, c.y - b.y);
    if (l1 < 1e-6 || l2 < 1e-6) continue;
    const dx = target.x - a.x, dy = target.y - a.y;
    const distance = Math.max(1e-6, Math.hypot(dx, dy));
    const stretch = constraint.stretch && distance > l1 + l2 ? distance / (l1 + l2) : 1;
    const s1 = l1 * stretch, s2 = l2 * stretch;
    const cosBend = Math.max(-1, Math.min(1, (distance * distance - s1 * s1 - s2 * s2) / (2 * s1 * s2)));
    const bend = constraint.bend * Math.acos(cosBend);
    const parentAngle = angleOf(dx, dy) - Math.atan2(s2 * Math.sin(bend), s1 + s2 * Math.cos(bend)) * DEG;

    const currentParent = angleOf(b.x - a.x, b.y - a.y);
    const currentChild = angleOf(c.x - b.x, c.y - b.y) - currentParent;
    const dParent = wrap(parentAngle - currentParent) * key.mix;
    const dChild = wrap(bend * DEG - currentChild) * key.mix;
    const effectorRelative = effector.rotation - (frameBone?.rotation ?? 0);
    const dEffector = key.rotation === undefined ? 0 : wrap(key.rotation - (effectorRelative + dParent + dChild)) * key.mix;

    const next: Pose = new Map(current);
    const adjust = (id: string, rotation: number, scaleY?: number) => {
      const base = next.get(id) ?? { tx: 0, ty: 0, rotation: 0, scaleX: 1, scaleY: 1 };
      next.set(id, { ...base, rotation: base.rotation + rotation, scaleY: scaleY === undefined ? base.scaleY : base.scaleY * scaleY });
    };
    const lengthScale = 1 + (stretch - 1) * key.mix;
    adjust(parentId, dParent, lengthScale);
    adjust(childId, dChild, lengthScale);
    adjust(effectorId, dEffector);
    setAnimationContext(next, context.clip, context.timeMs);
    current = next;
  }
  return current;
}

export function ikContext(pose: Pose) {
  const context = getAnimationContext(pose);
  return context?.clip.ik?.length ? context : undefined;
}
