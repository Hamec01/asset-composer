import type { AnimationClip, BoneTransform } from "@/domain/types";
import { getAnimationContext, setAnimationContext, type AnimationContext } from "./animationContext";
import { identity, inverse, transformPoint, worldBoneToMatrix } from "./matrixUtils";
import { shortestAngleLerp } from "./angles";

type Pose = Map<string, BoneTransform>;
type World = Map<string, { x: number; y: number; rotation: number; scaleX: number; scaleY: number }>;
type IkKey = NonNullable<AnimationClip["ik"]>[number]["keyframes"][number];

const DEG = 180 / Math.PI;
/** Bone direction convention: rotation θ maps the bone axis (0, 1) to (-sin θ, cos θ). */
const angleOf = (dx: number, dy: number) => Math.atan2(-dx, dy) * DEG;
const wrap = (deg: number) => ((deg + 180) % 360 + 360) % 360 - 180;

export function ikKeyAt(keys: IkKey[], timeMs: number): IkKey | null {
  if (!keys.length) return null;
  const ordered = [...keys].sort((a, b) => a.timeMs - b.timeMs);
  const right = ordered.findIndex(k => k.timeMs > timeMs);
  if (right === 0) return ordered[0];
  if (right < 0) return {...ordered.at(-1)!, bend: ordered.filter(key => key.bend !== undefined).at(-1)?.bend};
  const a = ordered[right - 1], b = ordered[right];
  const alpha = (timeMs - a.timeMs) / (b.timeMs - a.timeMs);
  const t = a.easing === "smooth" ? alpha*alpha*(3-2*alpha) : alpha;
  const mix = (p: number, q: number) => p + (q - p) * t;
  const bend = ordered.slice(0,right).filter(key => key.bend !== undefined).at(-1)?.bend;
  return { timeMs, x: mix(a.x, b.x), y: mix(a.y, b.y), rotation: a.rotation === undefined && b.rotation === undefined ? undefined : shortestAngleLerp(a.rotation ?? 0, b.rotation ?? 0,t), mix: mix(a.mix, b.mix), bend };
}

export function virtualGripTarget(clip: AnimationClip, target: {objectId:string;socketId:string}, timeMs: number) {
  const object=clip.gripObjects?.find(object => object.id === target.objectId);
  const socket=object?.sockets[target.socketId];
  if (!object || !socket || !object.keyframes.length) return null;
  const ordered=[...object.keyframes].sort((a,b)=>a.timeMs-b.timeMs);
  const a=ordered.filter(key => key.timeMs<=timeMs).at(-1) ?? ordered[0];
  const b=ordered.find(key => key.timeMs>timeMs) ?? a;
  const alpha=a===b ? 0 : Math.max(0,Math.min(1,(timeMs-a.timeMs)/(b.timeMs-a.timeMs)));
  // Ease the shared object, never its hands independently: socket spacing stays rigid.
  const t=a.easing === "smooth" ? alpha*alpha*(3-2*alpha)
    : a.easing === "ease_in" ? alpha*alpha
    : a.easing === "ease_out" ? 1-(1-alpha)*(1-alpha) : alpha;
  const rotation=shortestAngleLerp(a.rotation,b.rotation,t);
  const radians=rotation/DEG;
  return {x:a.x+(b.x-a.x)*t+socket.x*Math.cos(radians)-socket.y*Math.sin(radians),
    y:a.y+(b.y-a.y)*t+socket.x*Math.sin(radians)+socket.y*Math.cos(radians),rotation:rotation+(socket.rotation ?? 0)};
}

export function profileIkRootX(context: AnimationContext | undefined, boneId: string, setupX: number): number {
  const constraint = context?.clip.ik?.find(candidate => candidate.bones[0] === boneId && candidate.profileRootX !== undefined);
  if (!constraint || !context) return setupX;
  const mix = Math.max(0, Math.min(1, ikKeyAt(constraint.keyframes, context.timeMs)?.mix ?? 0));
  return setupX + (constraint.profileRootX! - setupX)*mix;
}

/**
 * Two-bone IK (Spine IkConstraint / Godot TwoBoneIK) solved against the actual
 * skeleton, so one authored target works for every view, body morph and rig variant.
 * Targets are in skeleton space before view mirroring. With `stretch`, both bones
 * lengthen along their own axis when the target is out of reach; the child and
 * effector should use Inherit.noScale so their artwork keeps its width.
 */
export function solveIkPose(pose: Pose, context: AnimationContext, evaluate: (pose: Pose) => World, parentOf: (boneId: string) => string | null, fixedChains: [string,string,string][] = []): Pose {
  const constraints = context.clip.ik ?? [];
  if (!constraints.length) return pose;
  let current: Pose = pose;
  const restPose: Pose = new Map();
  setAnimationContext(restPose,context.clip,context.timeMs);
  const rest=evaluate(restPose);
  for (const constraint of constraints) {
    const key = ikKeyAt(constraint.keyframes, context.timeMs);
    if (!key || key.mix <= 0) continue;
    const [parentId, childId, effectorId] = constraint.bones;
    const world = evaluate(current);
    const parent = world.get(parentId), child = world.get(childId), effector = world.get(effectorId);
    if (!parent || !child || !effector) continue;
    // Work in the frame of the chain root's parent, which the solve does not move.
    const frameBone = world.get(parentOf(parentId) ?? "");
    const fixed=constraint.fixedLength || fixedChains.some(chain => chain[0] === parentId);
    const toFrame = !fixed && frameBone ? inverse(worldBoneToMatrix(frameBone)) : identity();
    const local = (p: { x: number; y: number }) => transformPoint(toFrame, p.x, p.y);
    const a = local(parent), b = local(child), c = local(effector);
    const objectTarget=constraint.target && virtualGripTarget(context.clip,constraint.target,context.timeMs);
    // Invalid object references do not silently attach a hand to an unrelated origin.
    if (constraint.target && !objectTarget) continue;
    const frameAngle=!fixed ? frameBone?.rotation ?? 0 : 0;
    const rotationWorld=objectTarget ? objectTarget.rotation-(constraint.gripSocket?.rotation ?? 0)
      : key.rotation === undefined ? undefined : key.rotation+(frameBone?.rotation ?? 0)-(constraint.gripSocket?.rotation ?? 0);
    const socket=constraint.gripSocket ?? {x:0,y:0};
    const radians=((rotationWorld ?? effector.rotation)-effector.rotation)/DEG;
    const handMatrix=worldBoneToMatrix(effector);
    const offsetX=handMatrix[0]*socket.x+handMatrix[2]*socket.y;
    const offsetY=handMatrix[1]*socket.x+handMatrix[3]*socket.y;
    const contact=objectTarget || key;
    const target = local({x:contact.x-offsetX*Math.cos(radians)+offsetY*Math.sin(radians),
      y:contact.y-offsetX*Math.sin(radians)-offsetY*Math.cos(radians)});
    const rigA=rest.get(parentId),rigB=rest.get(childId),rigC=rest.get(effectorId);
    const l1 = fixed && rigA && rigB ? Math.hypot(rigB.x-rigA.x,rigB.y-rigA.y) : Math.hypot(b.x - a.x, b.y - a.y);
    const l2 = fixed && rigB && rigC ? Math.hypot(rigC.x-rigB.x,rigC.y-rigB.y) : Math.hypot(c.x - b.x, c.y - b.y);
    if (l1 < 1e-6 || l2 < 1e-6) continue;
    const dx = target.x - a.x, dy = target.y - a.y;
    const distance = Math.max(1e-6, Math.hypot(dx, dy));
    const stretch = !fixed && constraint.stretch && distance > l1 + l2 ? distance / (l1 + l2) : 1;
    const s1 = l1 * stretch, s2 = l2 * stretch;
    const cosBend = Math.max(-1, Math.min(1, (distance * distance - s1 * s1 - s2 * s2) / (2 * s1 * s2)));
    let bendDirection=key.bend ?? constraint.bend;
    if (constraint.pole && key.bend === undefined) {
      // Pick one branch from the phase's reference target, not the current frame.
      // Stateless evaluation must give the same result on playback, reverse seek and export.
      const reference=[...constraint.keyframes].sort((a,b)=>a.timeMs-b.timeMs).find(key => key.mix>0);
      const referencePose: Pose = new Map();
      if (reference) setAnimationContext(referencePose,context.clip,reference.timeMs);
      const referenceRoot=reference && evaluate(referencePose).get(parentId);
      const referenceGoal=reference && (constraint.target ? virtualGripTarget(context.clip,constraint.target,reference.timeMs) : reference);
      if (referenceGoal && referenceRoot) {
        const cross=(referenceGoal.x-referenceRoot.x)*(constraint.pole.y-referenceRoot.y)-(referenceGoal.y-referenceRoot.y)*(constraint.pole.x-referenceRoot.x);
        if (Math.abs(cross)>1e-6) bendDirection=cross<0 ? 1 : -1;
      }
    }
    const bend = bendDirection * Math.acos(cosBend);
    const parentAngle = angleOf(dx, dy) - Math.atan2(s2 * Math.sin(bend), s1 + s2 * Math.cos(bend)) * DEG;

    const currentParent = angleOf(b.x - a.x, b.y - a.y);
    const currentChild = angleOf(c.x - b.x, c.y - b.y) - currentParent;
    const dParent = wrap(parentAngle - currentParent) * key.mix;
    const dChild = wrap(bend * DEG - currentChild) * key.mix;
    const effectorRelative = effector.rotation - frameAngle;
    const dEffector = rotationWorld === undefined ? 0 : wrap(rotationWorld-frameAngle - (effectorRelative + dParent + dChild)) * key.mix;

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
