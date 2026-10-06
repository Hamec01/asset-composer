import type { AnimationClip } from "@/domain/types";
export interface AnimationContext { clip: AnimationClip; timeMs: number }
const contexts=new WeakMap<object,AnimationContext>();
export function setAnimationContext(target:object,clip:AnimationClip,timeMs:number) {
  const time=clip.loops && clip.durationMs>0 ? ((timeMs%clip.durationMs)+clip.durationMs)%clip.durationMs : Math.max(0,Math.min(timeMs,clip.durationMs));
  contexts.set(target,{clip,timeMs:time});
}
export function getAnimationContext(target:object) { return contexts.get(target); }
export function meshDeformAt(context:AnimationContext|undefined,partId:string) {
  const frames=context?.clip.deform?.find(t=>t.partId===partId)?.keyframes;
  if(!frames?.length || !context)return [];
  const ordered=[...frames].sort((a,b)=>a.timeMs-b.timeMs);
  const left=ordered.filter(f=>f.timeMs<=context.timeMs).at(-1);
  if(!left)return [];
  const right=ordered.find(f=>f.timeMs>context.timeMs);
  if(!right)return left.offsets;
  const t=(context.timeMs-left.timeMs)/(right.timeMs-left.timeMs);
  return Array.from({length:Math.max(left.offsets.length,right.offsets.length)},(_,i)=>({x:(left.offsets[i]?.x??0)*(1-t)+(right.offsets[i]?.x??0)*t,y:(left.offsets[i]?.y??0)*(1-t)+(right.offsets[i]?.y??0)*t}));
}
/** Stepped attachment timeline: the latest key at or before the current time wins. */
export function attachmentAt(context:AnimationContext|undefined,boneId:string):string|null {
  const frames=context?.clip.attachments?.find(t=>t.boneId===boneId)?.keyframes;
  if(!frames?.length || !context)return null;
  return [...frames].sort((a,b)=>a.timeMs-b.timeMs).filter(f=>f.timeMs<=context.timeMs).at(-1)?.name ?? null;
}
