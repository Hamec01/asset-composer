import type { AnimationClip } from "@/domain/types";
import type { EvaluatedSkeleton } from "./evaluationPipeline";
import { ikKeyAt, virtualGripTarget } from "./ikConstraint";
import { transformPoint, worldBoneToMatrix } from "./matrixUtils";
import { angleDelta } from "./angles";

export function armDiagnostics(clip: AnimationClip, timeMs: number, pose: EvaluatedSkeleton,
  rest: EvaluatedSkeleton, previous?: EvaluatedSkeleton, mirrored = false) {
  const constraints = [...(clip.ik ?? [])];
  for (const side of ["l","r"]) {
    const bones=[`shoulder_${side}`,`elbow_${side}`,`hand_${side}`] as [string,string,string];
    if (bones.every(id => rest.bones.has(id)) && !constraints.some(c => c.bones[0] === bones[0])) {
      constraints.push({bones,bend:1,keyframes:[{timeMs:0,x:0,y:0,mix:0}]});
    }
  }
  return constraints.flatMap(constraint => {
    const [a,b,c]=constraint.bones.map(id => pose.bones.get(id));
    const [ra,rb,rc]=constraint.bones.map(id => rest.bones.get(id));
    const key=ikKeyAt(constraint.keyframes,timeMs);
    if (!a || !b || !c || !ra || !rb || !rc || !key) return [];
    const goal=key.mix<=0 ? null : constraint.target ? virtualGripTarget(clip,constraint.target,timeMs) : key;
    const target=goal ? {x:goal.x*(mirrored ? -1 : 1),y:goal.y} : null;
    const socket=constraint.gripSocket ?? {x:0,y:0};
    const grip=transformPoint(worldBoneToMatrix(c),socket.x,socket.y);
    const upper=Math.hypot(b.x-a.x,b.y-a.y), lower=Math.hypot(c.x-b.x,c.y-b.y);
    const restUpper=Math.hypot(rb.x-ra.x,rb.y-ra.y),restLower=Math.hypot(rc.x-rb.x,rc.y-rb.y);
    const prior=constraint.bones.map(id => previous?.bones.get(id));
    const velocity=Math.max(...[a,b,c].map((p,i) => prior[i] ? Math.hypot(p.x-prior[i]!.x,p.y-prior[i]!.y) : 0));
    const turn=Math.max(...[a,b,c].map((p,i) => prior[i] ? Math.abs(angleDelta(prior[i]!.rotation,p.rotation)) : 0));
    const lengthError=Math.max(Math.abs(upper/restUpper-1),Math.abs(lower/restLower-1))*100;
    const gripError=target ? Math.hypot(grip.x-target.x,grip.y-target.y) : null;
    const cross=(c.x-a.x)*(b.y-a.y)-(c.y-a.y)*(b.x-a.x);
    const [pa,pb,pc]=prior;
    const priorCross=pa && pb && pc ? (pc.x-pa.x)*(pb.y-pa.y)-(pc.y-pa.y)*(pb.x-pa.x) : 0;
    const flipped=Math.abs(cross)>1e-5 && Math.abs(priorCross)>1e-5 && Math.sign(cross)!==Math.sign(priorCross);
    const pole=constraint.pole ? {x:constraint.pole.x*(mirrored ? -1 : 1),y:constraint.pole.y} : null;
    return [{id:constraint.bones[0],upper,lower,lengthError,gripError,grip,target,pole,
      bend:(Math.abs(cross)<1e-5 ? 0 : Math.sign(cross))*(mirrored ? -1 : 1),velocity,turn,mix:key.mix,
      warnings:[...(lengthError>1 ? ["length"] : []),...(key.mix>=.999 && (gripError === null || gripError>2) ? ["target"] : []),
        ...(turn>45 ? ["rotation"] : []),...(velocity>10 ? ["velocity"] : []),...(flipped && key.bend === undefined ? ["pole flip"] : [])]}];
  });
}
