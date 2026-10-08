import type { AnimationClip, BoneTransform } from "@/domain/types";

export const SPEARMAN_TEMPLATE_ID = "biped_profile_reference_spearman_v1";
const phases = [0, 240, 420, 540, 700, 1200];
const track = (boneId: string, poses: Partial<BoneTransform>[]) => ({ boneId,
  keyframes: phases.map((timeMs, i) => ({ timeMs, easing: "ease_in_out" as const,
    transform: { tx: 0, ty: 0, rotation: 0, scaleX: 1, scaleY: 1, ...poses[i] } })) });

/** One rigid shaft frame drives both palms; no independently animated weapon. */
export const spearmanThrust: AnimationClip = {
  id: "spearman__thrust", name: "spear_thrust", label: "Копьё · Укол с выпадом",
  templateId: SPEARMAN_TEMPLATE_ID, skeletonFamily: "humanoid_side_v1",
  durationMs: 1200, fps: 30, loops: false,
  reviewMarkers: ["Guard", "Windup", "Apex", "Contact", "Follow-through", "Recover"].map((label, i) => ({ label, timeMs: phases[i] })),
  // The right palm is the forward guide. The left palm drives the shaft from
  // beside the waist; keeping the hands in shoulder order avoids crossed arms.
  gripObjects: [{ id: "spear_shaft", sockets: { rear: { x: 0, y: 46 }, forward: { x: 0, y: 0 } },
    keyframes: [
      { timeMs: 0, x: 36, y: -17, rotation: 85, easing: "smooth" },
      { timeMs: 240, x: 29, y: -17, rotation: 85, easing: "smooth" },
      { timeMs: 420, x: 30, y: -18, rotation: 88, easing: "ease_in" },
      { timeMs: 540, x: 48, y: -23, rotation: 90 },
      { timeMs: 700, x: 49, y: -23, rotation: 90, easing: "smooth" },
      { timeMs: 900, x: 40, y: -17, rotation: 85, easing: "smooth" },
      { timeMs: 1200, x: 36, y: -17, rotation: 85 },
    ] }],
  ik: [
    ...(["l", "r"] as const).map(side => ({
      bones: [`shoulder_${side}`, `elbow_${side}`, `hand_${side}`] as [string, string, string],
      bend: -1 as const, fixedLength: true, gripSocket: { x: 0, y: 4 },
      target: { objectId: "spear_shaft", socketId: side === "l" ? "rear" : "forward" },
      keyframes: [{ timeMs: 0, x: 0, y: 0, mix: 1 }],
    })),
    ...(["l", "r"] as const).map(side => ({
      bones: [`hip_${side}`, `knee_${side}`, `foot_${side}`] as [string, string, string],
      bend: 1 as const, fixedLength: true,
      keyframes: [
        { timeMs: 0, x: side === "l" ? -7 : 8, y: 30, rotation: 0, mix: 1 },
        { timeMs: 420, x: side === "l" ? -7 : 8, y: 30, rotation: 0, mix: 1 },
        { timeMs: 540, x: side === "l" ? -7 : 17, y: 30, rotation: 0, mix: 1 },
        { timeMs: 700, x: side === "l" ? -7 : 17, y: 30, rotation: 0, mix: 1 },
        { timeMs: 1200, x: side === "l" ? -7 : 8, y: 30, rotation: 0, mix: 1 },
      ],
    })),
  ],
  equipmentDepth: [{ slotId: "side_slot_weapon_main", keyframes: [{ timeMs: 0, slot: "HAND_FRONT", occludedByBones: ["hand_l", "hand_r"] }] }],
  limbDepth: [{ timeMs: 0, state: { farUpperArm: "FAR_LIMB", farForearm: "CROSS_BODY", farHand: "CROSS_BODY",
    nearUpperArm: "NEAR_LIMB", nearForearm: "NEAR_LIMB", nearHand: "NEAR_LIMB" } }],
  layers: [{ mask: "full_body", tracks: [
    track("root", [{ ty: 0 }, { tx: -2, ty: 1 }, { tx: -2, ty: 1 }, { tx: 4, ty: 2 }, { tx: 5, ty: 2 }, { ty: 0 }]),
    track("spine", [3, -5, -5, 13, 15, 3].map(rotation => ({ rotation }))),
    track("head", [-3, 5, 5, -13, -15, -3].map(rotation => ({ rotation }))),
  ] }],
};

export const spearmanGuard: AnimationClip = {
  ...structuredClone(spearmanThrust), id: "spearman__guard", name: "spear_guard", label: "Копьё · Боевая стойка",
  durationMs: 1800, loops: true, reviewMarkers: undefined,
  gripObjects: [{ ...structuredClone(spearmanThrust.gripObjects![0]), keyframes: [
    { timeMs: 0, x: 36, y: -17, rotation: 85, easing: "smooth" },
    { timeMs: 900, x: 36, y: -16.5, rotation: 84, easing: "smooth" },
    { timeMs: 1800, x: 36, y: -17, rotation: 85 },
  ] }],
  ik: spearmanThrust.ik!.map(constraint => ({ ...structuredClone(constraint), keyframes: [constraint.keyframes[0]] })),
  layers: [{ mask: "full_body", tracks: [
    { boneId: "root", keyframes: [0, 900, 1800].map((timeMs, i) => ({ timeMs, easing: "ease_in_out", transform: { tx: 0, ty: i === 1 ? -.6 : 0, rotation: 0, scaleX: 1, scaleY: 1 } })) },
    { boneId: "spine", keyframes: [0, 1800].map(timeMs => ({ timeMs, easing: "linear", transform: { tx: 0, ty: 0, rotation: 3, scaleX: 1, scaleY: 1 } })) },
    { boneId: "head", keyframes: [0, 1800].map(timeMs => ({ timeMs, easing: "linear", transform: { tx: 0, ty: 0, rotation: -3, scaleX: 1, scaleY: 1 } })) },
  ] }],
};
