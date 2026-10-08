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
  gripObjects: [{ id: "two_hand_handle", sockets: {
    bladeHand: { x: 0, y: -7.5 }, pommelHand: { x: 0, y: 7.5 },
  }, keyframes: [
    { timeMs: 0, x: 20, y: -36, rotation: 15 },
    { timeMs: 140, x: 17, y: -47, rotation: -10 },
    { timeMs: 280, x: -2, y: -53, rotation: -35 },
    { timeMs: 600, x: 1, y: -71, rotation: -80 },
    { timeMs: 760, x: 17, y: -45, rotation: 5 },
    { timeMs: 880, x: 32, y: -27, rotation: 60 },
    { timeMs: 940, x: 28, y: -16, rotation: 75 },
    { timeMs: 1060, x: 17, y: -5, rotation: 100 },
    { timeMs: 1280, x: 12, y: -25, rotation: 50 },
    { timeMs: 1440, x: 24, y: -24, rotation: 20 },
    { timeMs: 1600, x: 20, y: -36, rotation: 15 },
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
    farUpperArm: "FAR_LIMB", farForearm: "HAND_FRONT", farHand: "HAND_FRONT",
    nearUpperArm: "NEAR_LIMB", nearForearm: "HAND_FRONT", nearHand: "HAND_FRONT",
  } }],
  layers: [{ mask: "full_body", tracks: [
    ...["l", "r"].map(side => track(`hip_${side}`,
      TWO_HANDED_PHASES.map(() => ({ tx: side === "l" ? -4 : 4 })))),
    track("root", [{ ty: 5 }, { tx: -3, ty: 6 }, { tx: -2, ty: 3 },
      { tx: 1, ty: 5 }, { tx: 4, ty: 7 }, { tx: 4, ty: 7 }, { ty: 5 }]),
    track("pelvis", [0, -4, -3, 3, 6, 5, 0].map(rotation => ({ rotation }))),
    track("spine", [3, 0, 12, 4, 12, 10, 3].map(rotation => ({ rotation }))),
    track("chest", [0, 0, 3, 3, 6, 4, 0].map(rotation => ({ rotation }))),
    track("head", [-3, 4, 5, -8, -18, -15, -3].map(rotation => ({ rotation }))),
    ...["l", "r"].map(side => track(`shoulder_${side}`,
      [0, -5, -7, -2, 0, 0, 0].map(ty => ({ ty })))),
  ] }],
};
