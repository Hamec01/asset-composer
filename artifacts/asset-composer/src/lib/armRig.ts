import type { Bone, BoneTransform } from "@/domain/types";
import { getAnimationContext, setAnimationContext } from "./animationContext";

export function armChains(bones: Bone[], pose?: Map<string, BoneTransform>): [string,string,string][] {
  const named = ["l","r"].map(side => [`shoulder_${side}`,`elbow_${side}`,`hand_${side}`] as [string,string,string])
    .filter(ids => ids.every(id => bones.some(bone => bone.id === id)));
  const explicit = (pose ? getAnimationContext(pose) : undefined)?.clip.ik?.filter(c => c.fixedLength).map(c => c.bones) ?? [];
  return [...named, ...explicit.filter(ids => !named.some(chain => chain[0] === ids[0]))];
}

/** Rig edits define segment offsets; animation controls rotation, not segment length. */
export function fixedArmPose(bones: Bone[], pose: Map<string, BoneTransform>) {
  const next = new Map(pose);
  for (const [root,child,hand] of armChains(bones,pose)) {
    for (const id of [root,child,hand]) {
      const transform = next.get(id) ?? {tx:0,ty:0,rotation:0,scaleX:1,scaleY:1};
      next.set(id,{...transform,scaleX:1,scaleY:1,...(id === root ? {} : {tx:0,ty:0})});
    }
  }
  const context = getAnimationContext(pose);
  if (context) setAnimationContext(next,context.clip,context.timeMs);
  return next;
}
