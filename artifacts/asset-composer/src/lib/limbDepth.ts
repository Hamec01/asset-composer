import type { AnimationClip, DepthSlot, EvaluatedVisual, Item, LimbDepthState } from "@/domain/types";

export const DEPTH_SLOTS: Record<DepthSlot, number> = {
  FAR_BACK:0,FAR_LIMB:10,BODY_BACK:20,BODY:30,CROSS_BODY:40,BODY_FRONT:55,
  NEAR_LIMB:50,HAND_FRONT:60,EQUIPMENT_FRONT:70,
};
export const DEPTH_COLORS: Record<DepthSlot,string> = {
  FAR_BACK:"#6385C4",FAR_LIMB:"#4CA6FF",BODY_BACK:"#8D929C",BODY:"#A3A7AE",
  CROSS_BODY:"#FFCE5C",BODY_FRONT:"#B5B9C2",NEAR_LIMB:"#69D98E",HAND_FRONT:"#FF737D",EQUIPMENT_FRONT:"#DFA3FF",
};

/** Anatomical IDs stay unchanged; camera-facing roles exchange on reflection. */
export function resolveArmRoles(facing: "left" | "right") {
  const near = facing === "right" ? "l" : "r";
  return {near,far:near === "l" ? "r" : "l"} as const;
}

export function resolveLimbDepth(clip?: AnimationClip, timeMs = 0, facing: "left" | "right" = "right"): Required<LimbDepthState> {
  const defaults: Required<LimbDepthState> = {
    farUpperArm:"FAR_LIMB",farForearm:"FAR_LIMB",farHand:"FAR_LIMB",
    nearUpperArm:"NEAR_LIMB",nearForearm:"NEAR_LIMB",nearHand:"NEAR_LIMB",
  };
  const key=clip?.limbDepth?.filter(key => key.timeMs<=timeMs && (!key.facing || key.facing === facing)).sort((a,b)=>a.timeMs-b.timeMs).at(-1);
  return {...defaults,...key?.state};
}

/** Only render metadata/order is changed. Matrices, joints, grips and IK are untouched. */
export function applyLimbDepth(visuals: EvaluatedVisual[], items: Item[], facing: "left" | "right", clip?: AnimationClip, timeMs = 0) {
  const roles=resolveArmRoles(facing);
  const state=resolveLimbDepth(clip,timeMs,facing);
  const authored=clip?.limbDepth?.filter(key=>key.timeMs<=timeMs && (!key.facing || key.facing === facing)).sort((a,b)=>a.timeMs-b.timeMs).at(-1)?.state;
  const rows=visuals.map((visual,index) => {
    const item=items.find(item=>item.id === visual.itemId);
    const part=item?.parts?.find(part=>part.id === visual.partId);
    const boneId=visual.boneId ?? part?.boneId;
    const depthBoneId=part?.depthBinding?.boneId ?? boneId;
    const arm=/^(shoulder|elbow|hand)_([lr])$/.exec(depthBoneId ?? "");
    let slot:DepthSlot = boneId === "head" || boneId === "neck" || visual.entityVisualId?.startsWith("face__") ? "BODY_FRONT" : "BODY";
    let segment: "upperArm" | "forearm" | "hand" | undefined;
    let role: "near" | "far" | undefined;
    let source: "default" | "clip" | "binding" = "default";
    let segmentOrder=0;
    if(arm) {
      role=arm[2] === roles.near ? "near" : "far";
      segment=arm[1] === "shoulder" ? "upperArm" : arm[1] === "elbow" ? "forearm" : "hand";
      segmentOrder=segment === "upperArm" ? 0 : segment === "forearm" ? 1 : 2;
      const key=`${role}${segment[0].toUpperCase()}${segment.slice(1)}` as keyof LimbDepthState;
      slot=state[key];
      source=authored?.[key] ? "clip" : "default";
      // A handle authored behind the palm must not jump over the head
      // just because the fingers enter HAND_FRONT. Positive offsets stay in front.
      if(part?.depthBinding) {
        slot=role === "near" ? part.depthBinding.nearSlot : part.depthBinding.farSlot;
        source="binding";
        segmentOrder=-1;
      } else if(segment === "hand" && slot === "HAND_FRONT" && item && ["weapon_main","weapon_off","shield"].includes(item.category)) {
        slot=(part?.zOffset ?? 0)<0 ? role === "far" ? "CROSS_BODY" : "NEAR_LIMB" : "EQUIPMENT_FRONT";
      }
    }
    visual.renderDepth={slot,role,segment,boneId,depthBoneId,source,occlusion:DEPTH_SLOTS[slot]<DEPTH_SLOTS.BODY ? "behindBody" : "none"};
    return {visual,index,old:visual.zIndex,slot,segmentOrder};
  });
  rows.sort((a,b)=>DEPTH_SLOTS[a.slot]-DEPTH_SLOTS[b.slot] || a.segmentOrder-b.segmentOrder || a.old-b.old || a.index-b.index);
  // Renderer-facing ranks are assigned here only; semantic slots remain available to inspectors/masks.
  rows.forEach((row,index)=>{row.visual.zIndex=index;});
}
