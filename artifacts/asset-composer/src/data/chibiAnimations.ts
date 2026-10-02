import type { AnimationClip, BoneTransform } from "@/domain/types";
import { getTrackTransformAt } from "@/lib/animationRuntime";

function gait(name: "walk" | "run", durationMs: number, lift: number): AnimationClip {
  const times = [0, durationMs / 4, durationMs / 2, durationMs * 3 / 4, durationMs];
  const track = (boneId: string, values: Partial<BoneTransform>[]) => ({
    boneId,
    keyframes: times.map((timeMs, index) => ({
      timeMs, easing: "ease_in_out" as const,
      transform: { tx: 0, ty: 0, rotation: 0, scaleX: 1, scaleY: 1, ...values[index] },
    })),
  });
  return {
    id: `chibi_front__${name}`, name, label: name === "walk" ? "Ходьба" : "Бег",
    skeletonFamily: "humanoid_side_v1", durationMs, fps: 24, loops: true,
    layers: [{
      mask: "full_body",
      tracks: [
        track("root", [{}, { ty: -0.8 }, {}, { ty: -0.8 }, {}]),
        track("hip_l", [{}, { scaleY: 0.84 }, {}, {}, {}]),
        track("hip_r", [{}, {}, {}, { scaleY: 0.84 }, {}]),
        track("knee_l", [{}, { scaleY: 0.82 }, {}, {}, {}]),
        track("knee_r", [{}, {}, {}, { scaleY: 0.82 }, {}]),
        track("foot_l", [{}, { ty: -lift }, {}, {}, {}]),
        track("foot_r", [{}, {}, {}, { ty: -lift }, {}]),
        track("shoulder_l", [{ rotation: 2 }, { rotation: 5, scaleY: 0.95 }, { rotation: 2 }, { rotation: -2 }, { rotation: 2 }]),
        track("shoulder_r", [{ rotation: -2 }, { rotation: 2 }, { rotation: -2 }, { rotation: -5, scaleY: 0.95 }, { rotation: -2 }]),
        track("chest", [{}, { rotation: -0.6 }, {}, { rotation: 0.6 }, {}]),
      ],
    }],
  };
}

const idle: AnimationClip = {
  id: "chibi_front__idle", name: "idle_full", label: "Покой",
  skeletonFamily: "humanoid_side_v1", durationMs: 2000, fps: 24, loops: true,
  layers: [{ mask: "full_body", tracks: [{
    boneId: "chest", keyframes: [0, 500, 1000, 1500, 2000].map((timeMs, index) => ({
      timeMs, easing: "ease_in_out" as const,
      transform: { tx: 0, ty: 0, rotation: 0, scaleX: 1, scaleY: index % 2 ? 1.01 : 1 },
    })),
  }] }],
};
const fallTimes = [0, 160, 340, 570, 760, 850, 1040, 1300];
function fallTrack(boneId: string, rotations: number[], translations?: [number, number][]) {
  return {
    boneId,
    keyframes: fallTimes.map((timeMs, index) => ({
      timeMs, easing: "ease_in_out" as const,
      transform: {
        tx: translations?.[index][0] ?? 0, ty: translations?.[index][1] ?? 0,
        rotation: rotations[index], scaleX: 1, scaleY: 1,
      },
    })),
  };
}
const death: AnimationClip = {
  id: "chibi_front__death", name: "death", label: "Падение",
  skeletonFamily: "humanoid_side_v1", durationMs: 1300, fps: 24, loops: false,
  layers: [{ mask: "full_body", tracks: [
    fallTrack("root", [0, 5, -12, -48, -88, -82, -88, -88],
      [[0, 0], [0, 1], [-2, 5], [-10, 8], [-20, 8], [-20, 5], [-20, 8], [-20, 8]]),
    fallTrack("chest", [0, 2, 5, 4, 0, 2, 0, 0]),
    fallTrack("head", [0, -3, 5, 7, 0, -3, 0, 0]),
    fallTrack("hip_l", [0, -8, -28, -24, -14, -17, -14, -14]),
    fallTrack("hip_r", [0, -5, -20, -16, -8, -10, -8, -8]),
    fallTrack("knee_l", [0, 16, 52, 48, 32, 36, 32, 32]),
    fallTrack("knee_r", [0, 10, 40, 34, 22, 25, 22, 22]),
    fallTrack("foot_l", [0, -8, -24, -20, -10, -12, -10, -10]),
    fallTrack("foot_r", [0, -5, -20, -14, -8, -10, -8, -8]),
    fallTrack("shoulder_l", [0, -15, -45, -36, 20, 16, 20, 20]),
    fallTrack("shoulder_r", [0, 12, 35, 22, -18, -14, -18, -18]),
    fallTrack("elbow_l", [0, -8, -25, -38, -35, -30, -35, -35]),
    fallTrack("elbow_r", [0, 8, 20, -12, -20, -16, -20, -20]),
  ] }],
};

function action(name: string, label: string, durationMs: number, loops: boolean,
  poses: Record<string, Partial<BoneTransform>[]>, fractions: number[]): AnimationClip {
  return { id: `chibi_front__${name}`, name, label, skeletonFamily: "humanoid_side_v1", durationMs, fps: 24, loops,
    layers: [{ mask: "full_body", tracks: Object.entries(poses).map(([boneId, values]) => ({ boneId,
      keyframes: values.map((value, index) => ({ timeMs: fractions[index] * durationMs,
        easing: "ease_in_out" as const, transform: { tx: 0, ty: 0, rotation: 0, scaleX: 1, scaleY: 1, ...value } })),
    })) }] };
}
const axeStrike = action("axe_strike", "Удар топором", 1100, false, {
  chest: [{}, { rotation: -8 }, { rotation: -12 }, { rotation: 20 }, { rotation: 6 }, {}],
  head: [{}, { rotation: 8 }, { rotation: 12 }, { rotation: -14 }, { rotation: -6 }, {}],
  shoulder_l: [{}, { rotation: -90 }, { rotation: -105 }, { rotation: -70 }, { rotation: -35 }, {}],
  elbow_l: [{}, { rotation: -15 }, {}, { rotation: -15 }, { rotation: -10 }, {}],
  hand_l: [{}, { rotation: -67 }, { rotation: -63 }, { rotation: -25 }, { rotation: -110 }, {}],
  shoulder_r: [{}, { rotation: 10 }, { rotation: 15 }, { rotation: -25 }, { rotation: -10 }, {}],
  elbow_r: [{}, { rotation: 5 }, { rotation: 8 }, { rotation: 12 }, { rotation: 5 }, {}],
  root: [{}, { ty: -1 }, { ty: -2 }, { ty: 2 }, { ty: 1 }, {}],
}, [0, .28, .45, .6, .8, 1]);
const swordStrike = action("sword_strike", "Удар мечом", 900, false, {
  chest: [{}, { rotation: -8 }, { rotation: -10 }, { rotation: 12 }, { rotation: 6 }, {}],
  head: [{}, { rotation: 8 }, { rotation: 10 }, { rotation: -12 }, { rotation: -6 }, {}],
  shoulder_l: [{}, { rotation: -90 }, { rotation: -100 }, { rotation: -60 }, { rotation: -35 }, {}],
  elbow_l: [{}, { rotation: -15 }, { rotation: -10 }, {}, { rotation: -10 }, {}],
  hand_l: [{}, { rotation: -67 }, { rotation: -60 }, { rotation: -7 }, { rotation: -90 }, {}],
  shoulder_r: [{}, { rotation: 10 }, { rotation: 15 }, { rotation: -20 }, { rotation: -10 }, {}],
  elbow_r: [{}, { rotation: 5 }, { rotation: 8 }, { rotation: 10 }, { rotation: 5 }, {}],
  root: [{}, { ty: -1 }, { ty: -1 }, { ty: 1 }, { ty: .5 }, {}],
}, [0, .2, .36, .54, .78, 1]);
const laugh = action("laugh", "Смех", 1500, true, {
  root: [{}, { ty: 1 }, { ty: -1.5 }, { ty: 1 }, { ty: -1.5 }, { ty: 1 }, {}],
  chest: [{}, { rotation: -5 }, { rotation: -9 }, { rotation: -5 }, { rotation: -9 }, { rotation: -5 }, {}],
  head: [{}, { rotation: -8 }, { rotation: -13 }, { rotation: -8 }, { rotation: -13 }, { rotation: -8 }, {}],
  shoulder_l: [{}, { rotation: -60 }, { rotation: -62 }, { rotation: -60 }, { rotation: -62 }, { rotation: -60 }, {}],
  elbow_l: [{}, { rotation: -65 }, { rotation: -68 }, { rotation: -65 }, { rotation: -68 }, { rotation: -65 }, {}],
  shoulder_r: [{}, { rotation: -35 }, { rotation: -37 }, { rotation: -35 }, { rotation: -37 }, { rotation: -35 }, {}],
}, [0, .18, .32, .46, .6, .74, 1]);
const pickup = action("pickup", "Подобрать", 1400, false, {
  root: [{}, { ty: 4.16 }, { ty: 15.13 }, { ty: 15.13 }, { ty: 1.39 }, {}],
  spine: [{}, { rotation: 25 }, { rotation: 60 }, { rotation: 60 }, { rotation: 10 }, {}],
  chest: [{}, { rotation: 10 }, { rotation: 15 }, { rotation: 15 }, { rotation: 6 }, {}],
  head: [{}, { rotation: -15 }, { rotation: -35 }, { rotation: -35 }, { rotation: -10 }, {}],
  hip_l: [{}, { rotation: -35 }, { rotation: -70 }, { rotation: -70 }, { rotation: -20 }, {}],
  hip_r: [{}, { rotation: -35 }, { rotation: -70 }, { rotation: -70 }, { rotation: -20 }, {}],
  knee_l: [{}, { rotation: 70 }, { rotation: 140 }, { rotation: 140 }, { rotation: 40 }, {}],
  knee_r: [{}, { rotation: 70 }, { rotation: 140 }, { rotation: 140 }, { rotation: 40 }, {}],
  foot_l: [{}, { rotation: -35 }, { rotation: -70 }, { rotation: -70 }, { rotation: -20 }, {}],
  foot_r: [{}, { rotation: -35 }, { rotation: -70 }, { rotation: -70 }, { rotation: -20 }, {}],
  shoulder_l: [{}, { rotation: -35 }, { rotation: -75 }, { rotation: -75 }, { rotation: -70 }, {}],
  elbow_l: [{}, {}, {}, {}, { rotation: -55 }, {}],
}, [0, .25, .45, .6, .82, 1]);
// Sample the nonlinear crouch height so both feet stay planted between poses.
const pickupHip = pickup.layers[0].tracks.find(track => track.boneId === "hip_l")!;
pickup.layers[0].tracks.find(track => track.boneId === "root")!.keyframes = Array.from({ length: 71 }, (_, index) => {
  const timeMs = index * 20;
  const angle = getTrackTransformAt(pickupHip, timeMs).rotation * Math.PI / 180;
  return { timeMs, easing: "linear" as const,
    transform: { tx: 0, ty: 23 * (1 - Math.cos(angle)), rotation: 0, scaleX: 1, scaleY: 1 } };
});
const carry = action("carry", "Нести", 1100, true, {
  root: [{}, { ty: -1 }, {}, { ty: -1 }, {}],
  shoulder_l: Array(5).fill({ rotation: -55 }), elbow_l: Array(5).fill({ rotation: -35 }),
  shoulder_r: Array(5).fill({ rotation: -65 }), elbow_r: Array(5).fill({ rotation: -25 }),
  hip_l: [{ rotation: -14 }, {}, { rotation: 14 }, {}, { rotation: -14 }],
  hip_r: [{ rotation: 14 }, {}, { rotation: -14 }, {}, { rotation: 14 }],
  knee_l: [{ rotation: 4 }, { rotation: 12 }, {}, {}, { rotation: 4 }],
  knee_r: [{}, {}, { rotation: 4 }, { rotation: 12 }, {}],
  foot_l: [{ rotation: 10 }, { rotation: -12 }, { rotation: -14 }, {}, { rotation: 10 }],
  foot_r: [{ rotation: -14 }, {}, { rotation: 10 }, { rotation: -12 }, { rotation: -14 }],
}, [0, .25, .5, .75, 1]);
export const CHIBI_ANIMATIONS = [idle, gait("walk", 900, 1), gait("run", 550, 2), death, axeStrike, swordStrike, laugh, pickup, carry];

// Refresh only exact earlier built-ins; authored keyframes must survive loading.
export function upgradeChibiActionClip(clip: AnimationClip): AnimationClip {
  const canonical = CHIBI_ANIMATIONS.find(candidate => candidate.id === clip.id);
  const previous = canonical && structuredClone(canonical);
  if (!previous || !["axe_strike", "pickup"].includes(clip.name)) return clip;
  const oldRotations: Record<string, number[]> = clip.name === "axe_strike"
    ? { hand_l: [0, -25, -30, 45, 20, 0], shoulder_l: [0, -150, -165, -45, -35, 0], elbow_l: [0, 55, 45, -25, -10, 0],
      shoulder_r: [0, -85, -110, -60, -25, 0], elbow_r: [0, -25, -25, -25, 0, 0] }
    : { hip_l: [0, -25, -38, -38, -20, 0], hip_r: [0, -20, -35, -35, -15, 0],
      knee_l: [0, 50, 76, 76, 40, 0], knee_r: [0, 40, 70, 70, 30, 0],
      foot_l: [0, -25, -38, -38, -20, 0], foot_r: [0, -20, -35, -35, -15, 0],
      spine: [0, 15, 25, 25, 10, 0], chest: [0, 10, 12, 12, 6, 0], head: [0, -15, -20, -20, -10, 0],
      shoulder_l: [0, -15, -25, -25, -70, 0] };
  for (const track of previous.layers.flatMap(layer => layer.tracks)) {
    if (clip.name === "pickup" && track.boneId === "root") {
      track.keyframes = previous.layers[0].tracks.find(candidate => candidate.boneId === "hip_l")!.keyframes.map((frame, index) => ({
        ...structuredClone(frame), transform: { tx: 0, ty: [0, 8, 13, 13, 6, 0][index], rotation: 0, scaleX: 1, scaleY: 1 },
      }));
      continue;
    }
    track.keyframes.forEach((frame, index) => {
      if (oldRotations[track.boneId]) frame.transform.rotation = oldRotations[track.boneId][index];
    });
  }
  const fingerprint = (value: AnimationClip) => JSON.stringify([value.name, value.label, value.skeletonFamily,
    value.durationMs, value.fps, value.loops, value.layers.map(layer => [layer.mask, layer.tracks.map(track => [
      track.boneId, track.keyframes.map(frame => [frame.timeMs, frame.easing, frame.transform.tx, frame.transform.ty,
        frame.transform.rotation, frame.transform.scaleX, frame.transform.scaleY]),
    ])])]);
  if (fingerprint(clip) === fingerprint(previous)) return structuredClone(canonical!);
  if (clip.name === "axe_strike") {
    const wrist = previous.layers[0].tracks.find(track => track.boneId === "hand_l")!;
    wrist.keyframes.forEach((frame, index) => { frame.transform.rotation = [0, 110, 120, 140, 70, 0][index]; });
    if (fingerprint(clip) === fingerprint(previous)) return structuredClone(canonical!);
    for (const track of previous.layers[0].tracks) {
      if (["shoulder_l", "elbow_l"].includes(track.boneId)) {
        track.keyframes = structuredClone(canonical!.layers[0].tracks.find(candidate => candidate.boneId === track.boneId)!.keyframes);
      }
    }
    wrist.keyframes.forEach((frame, index) => { frame.transform.rotation = [0, 113, 117, 155, 70, 0][index]; });
    if (fingerprint(clip) === fingerprint(previous)) return structuredClone(canonical!);
    wrist.keyframes = structuredClone(canonical!.layers[0].tracks.find(track => track.boneId === "hand_l")!.keyframes);
    if (fingerprint(clip) === fingerprint(previous)) return structuredClone(canonical!);
  } else {
    for (const track of previous.layers[0].tracks) {
      track.keyframes.forEach((frame, index) => {
        if (track.boneId === "root") frame.transform.ty = [0, 2.69, 7.61, 7.61, 1.39, 0][index];
        if (/^(hip|foot)_[lr]$/.test(track.boneId)) frame.transform.rotation = [0, -28, -48, -48, -20, 0][index];
        if (/^knee_[lr]$/.test(track.boneId)) frame.transform.rotation = [0, 56, 96, 96, 40, 0][index];
      });
    }
    if (fingerprint(clip) === fingerprint(previous)) return structuredClone(canonical!);
  }
  return clip;
}

export function getSideGaitClip(clip: AnimationClip, heldHands: readonly string[] = []): AnimationClip {
  if (clip.name !== "walk" && clip.name !== "run") return clip;
  const swing = clip.name === "run" ? 28 : 22;
  const armSwing = clip.name === "run" ? 24 : 18;
  const rotations: Record<string, number[]> = {
    hip_l: [-swing, 0, swing, 0, -swing],
    hip_r: [swing, 0, -swing, 0, swing],
    knee_l: [8, 18, 0, 0, 8], knee_r: [0, 0, 8, 18, 0],
    shoulder_l: [armSwing, 0, -armSwing, 0, armSwing],
    shoulder_r: [-armSwing, 0, armSwing, 0, -armSwing],
  };
  for (const side of ["l", "r"]) {
    if (!heldHands.includes(`hand_${side}`)) continue;
    const heldSwing = clip.name === "run" ? 14 : 10;
    const sign = side === "l" ? 1 : -1;
    rotations[`shoulder_${side}`] = [heldSwing * sign, 0, -heldSwing * sign, 0, heldSwing * sign];
    rotations[`elbow_${side}`] = [6, 8, 6, 8, 6];
    rotations[`hand_${side}`] = rotations[`shoulder_${side}`].map((value, index) => -value - rotations[`elbow_${side}`][index]);
  }
  for (const side of ["l", "r"]) rotations[`foot_${side}`] = rotations[`hip_${side}`].map((value, index) => -value - rotations[`knee_${side}`][index]);
  return {
    ...clip,
    layers: [{
      mask: "full_body",
      tracks: [
        {
          boneId: "root",
          keyframes: [0, 1, 2, 3, 4].map(index => ({
            timeMs: clip.durationMs * index / 4, easing: "ease_in_out" as const,
            transform: { tx: 0, ty: index % 2 ? -1 : 0, rotation: 0, scaleX: 1, scaleY: 1 },
          })),
        },
        ...Object.entries(rotations).map(([boneId, values]) => ({
          boneId,
          keyframes: values.map((rotation, index) => ({
            timeMs: clip.durationMs * index / 4, easing: "ease_in_out" as const,
            transform: { tx: 0, ty: 0, rotation, scaleX: 1, scaleY: 1 },
          })),
        })),
      ],
    }],
  };
}
