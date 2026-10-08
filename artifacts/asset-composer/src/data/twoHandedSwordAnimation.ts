import type { AnimationClip, BoneTransform } from "@/domain/types";

export const TWO_HANDED_PHASES = [0, 280, 600, 760, 880, 1060, 1600] as const;

function track(boneId: string, poses: Partial<BoneTransform>[]) {
  return { boneId, keyframes: TWO_HANDED_PHASES.map((timeMs, i) => ({
    timeMs, easing: "linear" as const, transform: { tx: 0, ty: 0, rotation: 0, scaleX: 1, scaleY: 1, ...poses[i] },
  })) };
}

/** The handle is a constraint frame, never artwork. Both hands follow its sockets. */
export const twoHandedSwordStrike: AnimationClip = {
  id: "chibi_front__two_handed_sword_strike", name: "two_handed_sword_strike",
  label: "Удар двуручным мечом", skeletonFamily: "humanoid_side_v1",
  durationMs: 1600, fps: 30, loops: false,
  reviewMarkers: [
    { label: "Guard", timeMs: 0 }, { label: "Windup", timeMs: 280 },
    { label: "Apex", timeMs: 600 }, { label: "Contact", timeMs: 880 },
    { label: "Follow-through", timeMs: 1060 }, { label: "Recover", timeMs: 1600 },
  ],
  gripObjects: [{ id: "two_hand_handle", sockets: {
    bladeHand: { x: 0, y: -7.5 }, pommelHand: { x: 0, y: 7.5 },
  }, keyframes: [
    { timeMs: 0, x: 18, y: -25, rotation: 15 },
    { timeMs: 140, x: 6, y: -22, rotation: -10 },
    { timeMs: 280, x: -7, y: -28, rotation: -35, easing: "ease_out" },
    { timeMs: 600, x: -8, y: -30, rotation: -80, easing: "ease_in" },
    { timeMs: 760, x: 14, y: -12, rotation: 25 },
    { timeMs: 880, x: 30, y: -18, rotation: 60 },
    { timeMs: 940, x: 29, y: -16, rotation: 75 },
    { timeMs: 1060, x: 17, y: -5, rotation: 100, easing: "smooth" },
    { timeMs: 1280, x: 12, y: -25, rotation: 50 },
    { timeMs: 1440, x: 24, y: -24, rotation: 20, easing: "ease_out" },
    { timeMs: 1600, x: 18, y: -25, rotation: 15 },
  ] }],
  ik: [
    ...(["l", "r"] as const).map(side => ({
      bones: [`shoulder_${side}`, `elbow_${side}`, `hand_${side}`] as [string, string, string],
      bend: -1 as const, fixedLength: true,
      profileRootX: side === "l" ? -6 : 4,
      gripSocket: { x: 6, y: 0 },
      target: { objectId: "two_hand_handle", socketId: side === "l" ? "bladeHand" : "pommelHand" },
      keyframes: [{ timeMs: 0, x: 0, y: 0, mix: 1 }],
    })),
    ...(["l", "r"] as const).map(side => ({
      bones: [`hip_${side}`, `knee_${side}`, `foot_${side}`] as [string, string, string],
      bend: -1 as const, fixedLength: true,
      keyframes: [{ timeMs: 0, x: side === "l" ? -18 : 18, y: 23, rotation: 0, mix: 1 }],
    })),
  ],
  attachments: ["l", "r"].map(side => ({ boneId: `hand_${side}`,
    keyframes: [{ timeMs: 0, name: "two_hand_grip" }] })),
  limbDepth: [{ timeMs: 0, state: {
    farUpperArm: "FAR_LIMB", farForearm: "CROSS_BODY", farHand: "CROSS_BODY",
    nearUpperArm: "NEAR_LIMB", nearForearm: "NEAR_LIMB", nearHand: "NEAR_LIMB",
  } }],
  layers: [{ mask: "full_body", tracks: [
    ...["l", "r"].map(side => track(`hip_${side}`,
      TWO_HANDED_PHASES.map(() => ({ tx: side === "l" ? -4 : 4 })))),
    track("root", [{ ty: 5 }, { tx: -3, ty: 6 }, { tx: -2, ty: 3 },
      { tx: 1, ty: 5 }, { tx: 4, ty: 7 }, { tx: 4, ty: 7 }, { ty: 5 }]),
    track("pelvis", [0, -4, -3, 3, 6, 5, 0].map(rotation => ({ rotation }))),
    track("spine", [3, 20, 20, 15, 12, 10, 3].map(rotation => ({ rotation }))),
    track("chest", [0, 0, 3, 3, 6, 4, 0].map(rotation => ({ rotation }))),
    track("head", [-3, -16, -20, -15, -18, -15, -3].map(rotation => ({ rotation }))),
    ...["l", "r"].map(side => track(`shoulder_${side}`,
      [0, -5, -7, -2, 0, 0, 0].map(ty => ({ ty })))),
  ] }],
};

// Preserve authored clips; recognize only exact previous built-in motions.
const previousStrike = structuredClone(twoHandedSwordStrike);
previousStrike.gripObjects![0].keyframes = [
  [0,20,-36,15], [140,17,-47,-10], [280,-2,-53,-35], [600,1,-71,-80],
  [760,17,-45,5], [880,32,-27,60], [940,28,-16,75], [1060,17,-5,100],
  [1280,12,-25,50], [1440,24,-24,20], [1600,20,-36,15],
].map(([timeMs,x,y,rotation])=>({timeMs,x,y,rotation}));
previousStrike.limbDepth![0].state = {
  farUpperArm:"FAR_LIMB",farForearm:"HAND_FRONT",farHand:"HAND_FRONT",
  nearUpperArm:"NEAR_LIMB",nearForearm:"HAND_FRONT",nearHand:"HAND_FRONT",
};
for (const [boneId, rotations] of Object.entries({
  spine:[3,0,12,4,12,10,3], head:[-3,4,5,-8,-18,-15,-3],
})) {
  previousStrike.layers[0].tracks.find(t=>t.boneId===boneId)!.keyframes.forEach((k,i)=>{k.transform.rotation=rotations[i];});
}
const previousTiming = structuredClone(previousStrike);
for(const key of previousTiming.gripObjects![0].keyframes) {
  if(key.timeMs===280 || key.timeMs===1440) key.easing="ease_out";
  if(key.timeMs===600) {key.easing="ease_in";key.y=-68;}
  if(key.timeMs===940) key.x=29;
  if(key.timeMs===1060) key.easing="smooth";
}
const previousTimingBeforeElbowFix=structuredClone(previousTiming);
previousTimingBeforeElbowFix.gripObjects![0].keyframes.find(k=>k.timeMs===940)!.x=28;
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([key,entry]) => [key,stable(entry)]));
  return value;
}
export function upgradeTwoHandedSwordClip(clip: AnimationClip): AnimationClip {
  if (clip.id !== twoHandedSwordStrike.id) return clip;
  const motion = (c: AnimationClip) => JSON.stringify(stable({
    durationMs:c.durationMs, fps:c.fps, loops:c.loops, layers:c.layers,
    ik:c.ik, gripObjects:c.gripObjects, attachments:c.attachments, limbDepth:c.limbDepth,
    headOverlap:c.headOverlap, drawOrder:c.drawOrder,
  }));
  const upgraded = [previousStrike,previousTiming,previousTimingBeforeElbowFix].some(old=>motion(clip)===motion(old))
    ? {...clip,gripObjects:structuredClone(twoHandedSwordStrike.gripObjects),
      layers:structuredClone(twoHandedSwordStrike.layers),limbDepth:structuredClone(twoHandedSwordStrike.limbDepth)} : clip;
  return !upgraded.reviewMarkers && motion(upgraded) === motion(twoHandedSwordStrike)
    ? { ...upgraded, reviewMarkers: structuredClone(twoHandedSwordStrike.reviewMarkers) } : upgraded;
}
