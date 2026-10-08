import type { AnimationClip, EvaluatedVisual } from "@/domain/types";
import type { EvaluatedScene } from "./evaluationPipeline";
import { transformPoint, worldBoneToMatrix } from "./matrixUtils";
import { resolveArmRoles, resolveLimbDepth } from "./limbDepth";

type Point = {x:number;y:number};
export interface HeadClearance { center: Point; radiusX: number; radiusY: number }
/** Inner 76% of the actual rendered head's bounds, not a hard-coded rig coordinate. */
export function headClearance(visuals: EvaluatedVisual[]): HeadClearance | null {
  const head=visuals.find(v=>v.sourceKind==="bone-part" && v.boneId==="head");
  if(!head)return null;
  const b=head.worldBounds;
  if(![b.minX,b.maxX,b.minY,b.maxY].every(Number.isFinite))return null;
  const radiusX=(b.maxX-b.minX)*.38,radiusY=(b.maxY-b.minY)*.38;
  return radiusX>0 && radiusY>0 ? {center:{x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2},radiusX,radiusY} : null;
}
export function isPointInsideHeadClearance(p:Point,core:HeadClearance):boolean {
  return ((p.x-core.center.x)/core.radiusX)**2+((p.y-core.center.y)/core.radiusY)**2<1;
}
export function segmentIntersectsHeadClearance(a:Point,b:Point,core:HeadClearance):boolean {
  const x=(a.x-core.center.x)/core.radiusX,y=(a.y-core.center.y)/core.radiusY;
  const dx=(b.x-a.x)/core.radiusX,dy=(b.y-a.y)/core.radiusY;
  const length=dx*dx+dy*dy;
  const t=length>0 ? Math.max(0,Math.min(1,-(x*dx+y*dy)/length)) : 0;
  return (x+t*dx)**2+(y+t*dy)**2<1;
}
export function allowsHeadOverlap(clip:AnimationClip|undefined,timeMs:number,boneId:string) {
  return !!clip?.headOverlap?.some(p=>p.reason.trim() && p.startMs<=timeMs && timeMs<p.endMs && p.bones.includes(boneId));
}
export function validateHeadClearance(scene:EvaluatedScene,clip?:AnimationClip,timeMs=0) {
  const core=headClearance(scene.visuals);
  if(!core)return [];
  const violations:{boneId:string;kind:"hand"|"grip"|"forearm";message:string}[]=[];
  for(const side of ["l","r"]) {
    const id=`hand_${side}`,wrist=scene.skeleton.bones.get(id),elbow=scene.skeleton.bones.get(`elbow_${side}`);
    if(!wrist || !elbow)continue;
    const hand=scene.visuals.find(v=>v.sourceKind==="bone-part" && v.boneId===id);
    const center=hand && transformPoint(hand.worldMatrix,(hand.localBounds.minX+hand.localBounds.maxX)/2,(hand.localBounds.minY+hand.localBounds.maxY)/2);
    const constraint=clip?.ik?.find(c=>c.bones[2]===id);
    const grip=transformPoint(worldBoneToMatrix(wrist),constraint?.gripSocket?.x??0,constraint?.gripSocket?.y??0);
    if(!allowsHeadOverlap(clip,timeMs,id)) {
      if(center && isPointInsideHeadClearance(center,core))violations.push({boneId:id,kind:"hand",message:`${id}: palm inside head core`});
      if(isPointInsideHeadClearance(grip,core))violations.push({boneId:id,kind:"grip",message:`${id}: grip inside head core`});
    }
    if(!allowsHeadOverlap(clip,timeMs,`elbow_${side}`) && segmentIntersectsHeadClearance(elbow,wrist,core)) {
      violations.push({boneId:`elbow_${side}`,kind:"forearm",message:`elbow_${side}: forearm crosses head core`});
    }
  }
  return violations;
}

/** Non-blocking authoring warnings; depth does not itself excuse head penetration. */
export function validateAnimationDepth(clip:AnimationClip):string[] {
  const warnings=new Set<string>();
  for(const facing of ["left","right"] as const) {
    const times=[...new Set([0,clip.durationMs,...(clip.limbDepth??[]).map(k=>k.timeMs),...(clip.headOverlap??[]).flatMap(p=>[p.startMs,p.endMs])])].filter(t=>t>=0&&t<=clip.durationMs).sort((a,b)=>a-b);
    const durations=new Map<string,number>();
    const roles=resolveArmRoles(facing);
    for(let i=0;i<times.length-1;i++) {
      const time=times[i],duration=times[i+1]-time,state=resolveLimbDepth(clip,time,facing);
      const front=Object.entries(state).filter(([,slot])=>slot==="HAND_FRONT").map(([key])=>key);
      for(const key of front) {
        durations.set(key,(durations.get(key)??0)+duration);
        const bone=`${key.endsWith("Hand")?"hand":key.endsWith("Forearm")?"elbow":"shoulder"}_${key.startsWith("near")?roles.near:roles.far}`;
        if(!allowsHeadOverlap(clip,time,bone))warnings.add(`${facing}: ${key}=HAND_FRONT without explicit phase justification (${time}–${times[i+1]} ms)`);
      }
      if(front.includes("nearHand")&&front.includes("farHand"))warnings.add(`${facing}: both hands HAND_FRONT (${time}–${times[i+1]} ms)`);
    }
    for(const [key,duration] of durations)if(duration>=clip.durationMs*.8)warnings.add(`${facing}: ${key}=HAND_FRONT for ${Math.round(duration/clip.durationMs*100)}% of clip`);
  }
  return [...warnings];
}
