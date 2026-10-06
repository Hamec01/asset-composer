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
const previousBowShoot = action("bow_shoot", "Стрельба из лука", 1250, false, {
  root: [{}, { ty: -1 }, { ty: -2 }, { ty: 1 }, { ty: .5 }, {}],
  chest: [{}, { rotation: -5 }, { rotation: -8 }, { rotation: 8 }, { rotation: 3 }, {}],
  head: [{}, { rotation: 4 }, { rotation: 6 }, { rotation: -4 }, { rotation: -2 }, {}],
  shoulder_l: [{}, { rotation: -25 }, { rotation: -42 }, { rotation: -32 }, { rotation: -15 }, {}],
  elbow_l: [{}, { rotation: -18 }, { rotation: -30 }, { rotation: -12 }, { rotation: -5 }, {}],
  hand_l: [{}, { rotation: -10 }, { rotation: -18 }, { rotation: -5 }, {}, {}],
  shoulder_r: [{}, { rotation: 30 }, { rotation: 48 }, { rotation: 65 }, { rotation: 18 }, {}],
  elbow_r: [{}, { rotation: 65 }, { rotation: 85 }, { rotation: 55 }, { rotation: 20 }, {}],
  hand_r: [{}, { rotation: -20 }, { rotation: -34 }, { rotation: -18 }, { rotation: -5 }, {}],
}, [0, .18, .42, .58, .82, 1]);
// Extend the bow arm horizontally; counter-rotate the wrist to keep the bow upright.
const previousBowShootV2 = action("bow_shoot", "Стрельба из лука", 1600, false, {
  shoulder_l: [ {}, { rotation: -70 }, { rotation: -90 }, { rotation: -90 }, { rotation: -90 }, { rotation: -65 }, {} ],
  elbow_l: [ {}, { rotation: -10 }, {}, {}, {}, { rotation: -10 }, {} ],
  hand_l: [ {}, { rotation: 80 }, { rotation: 90 }, { rotation: 90 }, { rotation: 90 }, { rotation: 75 }, {} ],
  shoulder_r: [ {}, { rotation: -65 }, { rotation: -95 }, { rotation: 45 }, { rotation: 60 }, { rotation: -20 }, {} ],
  elbow_r: [ {}, { rotation: -35 }, { rotation: -80 }, { rotation: -170 }, { rotation: -170 }, { rotation: -50 }, {} ],
  head: [ {}, {}, { rotation: 2 }, { rotation: 2 }, {}, {}, {} ],
}, [0, .2, .35, .62, .68, .85, 1]);

// Solve a two-segment arm from a wrist target (screen Y points down).
function bowArm(x: number, y: number, bend: number) {
  const elbow = bend * Math.acos(Math.max(-1, Math.min(1, (x*x + y*y - 15*15 - 13*13) / (2*15*13))));
  const shoulder = Math.atan2(-x, y) - Math.atan2(13*Math.sin(elbow), 15+13*Math.cos(elbow));
  return [shoulder * 180/Math.PI, elbow * 180/Math.PI];
}
const bowShoot: AnimationClip = (() => {
  const durationMs = 2000;
  const poses: Record<string, Partial<BoneTransform>[]> = { shoulder_l: [], elbow_l: [], hand_l: [], shoulder_r: [], elbow_r: [], hand_r: [] };
  const stops = [0, .2, .32, .57, .68, .71, .82, 1];
  // Grip stays fixed while the string hand moves from the string to the cheek.
  const targets = [[-6,-7,4,-7], [20,-42,10,-42], [20,-42,10,-42], [20,-42,0,-42], [20,-42,0,-42], [20,-42,-3,-45], [20,-42,-3,-45], [-6,-7,4,-7]];
  const fractions = Array.from({ length: 101 }, (_, i) => i/100);
  for (const t of fractions) {
    let i = 0;
    while (i < stops.length-2 && t > stops[i+1]) i++;
    const u = (t-stops[i])/(stops[i+1]-stops[i]);
    const ease = u*u*(3-2*u);
    const target = targets[i].map((v,j) => v+(targets[i+1][j]-v)*ease);
    for (const [side, offset, sx, bend] of [["l",0,-6,1],["r",2,4,-1]] as const) {
      const [shoulder, elbow] = bowArm(target[offset]-sx, target[offset+1]+35, bend);
      poses[`shoulder_${side}`].push({ rotation: shoulder });
      poses[`elbow_${side}`].push({ rotation: elbow });
      const release = side === "r" && t > .68 ? 75 * Math.min(1, (1-t)/.18) : 0;
      poses[`hand_${side}`].push({ rotation: -shoulder-elbow+release });
    }
  }
  return action("bow_shoot", "Стрельба из лука", durationMs, false, poses, fractions);
})();

const previousBowShootV3 = structuredClone(bowShoot);
// Step the near foot back, settle both soles, then return after the shot.
// Compensate at the spine so the aiming hands do not drift with the pelvis.
for (const boneId of ["pelvis", "spine", "hip_l", "knee_l", "foot_l", "hip_r", "knee_r", "foot_r"]) {
  bowShoot.layers[0].tracks.push({ boneId, keyframes: Array.from({ length: 101 }, (_, i) => {
    const t = i/100;
    const phase = t < .2 ? t/.2 : t > .82 ? (1-t)/.18 : 1;
    const weight = phase*phase*(3-2*phase);
    const lift = phase < 1 ? 2*Math.sin(Math.PI*phase) : 0;
    let rotation = 0, ty = 0;
    if (boneId === "pelvis") ty = 3*weight;
    else if (boneId === "spine") ty = -3*weight;
    else {
      const back = boneId.endsWith("_l");
      const x = back ? -10*weight : 0;
      const y = 23-3*weight-(back ? lift : 0);
      const knee = Math.acos(Math.max(-1,Math.min(1,(x*x+y*y-13*13-10*10)/(2*13*10))));
      const hip = Math.atan2(-x,y)-Math.atan2(10*Math.sin(knee),13+10*Math.cos(knee));
      rotation = (boneId.startsWith("hip") ? hip : boneId.startsWith("knee") ? knee : -hip-knee)*180/Math.PI;
    }
    return { timeMs: t*bowShoot.durationMs, easing: "linear" as const,
      transform: { tx: 0, ty, rotation, scaleX: 1, scaleY: 1 } };
  }) });
}

const previousBowShootV4 = structuredClone(bowShoot);
const previousBowShootV5 = structuredClone(bowShoot);
// Chibi arms need additional reach to clear the oversized head silhouette.
// Scale the chain during aiming and cancel it at the wrist: bow and hand stay their original size.
for (let i = 0; i <= 100; i++) {
  const t = i/100;
  const p = t < .2 ? t/.2 : t > .82 ? (1-t)/.18 : 1;
  const w = p*p*(3-2*p);
  const stops = [0,.2,.32,.57,.68,.71,.82,1];
  const targets = [[-6,-7,4,-7],[38,-40,28,-40],[38,-40,28,-40],[38,-40,10,-40],[38,-40,10,-40],[38,-40,7,-43],[38,-40,7,-43],[-6,-7,4,-7]];
  let k=0;
  while (k<stops.length-2 && t>stops[k+1]) k++;
  const u=(t-stops[k])/(stops[k+1]-stops[k]);
  const ease=u*u*(3-2*u);
  const target=targets[k].map((v,j)=>v+(targets[k+1][j]-v)*ease);
  for (const [side,offset,sx,bend] of [["l",0,-6,1],["r",2,4,-1]] as const) {
    const reach = side === "l" ? 1+.6*w : 1;
    const [shoulder,elbow]=bowArm((target[offset]-sx)/reach,(target[offset+1]+35)/reach,bend);
    const frame=(id: string)=>bowShoot.layers[0].tracks.find(track=>track.boneId===id)!.keyframes[i].transform;
    Object.assign(frame(`shoulder_${side}`),{rotation:shoulder,scaleX:reach,scaleY:reach});
    frame(`elbow_${side}`).rotation=elbow;
    const release=side==="r" && t>.68 ? 75*Math.min(1,(1-t)/.18) : 0;
    Object.assign(frame(`hand_${side}`),{rotation:-shoulder-elbow+release,scaleX:1/reach,scaleY:1/reach});
    const oldReach = 1+.6*w;
    const [oldShoulder,oldElbow] = bowArm((target[offset]-sx)/oldReach,(target[offset+1]+35)/oldReach,bend);
    const oldFrame = (id: string) => previousBowShootV5.layers[0].tracks.find(track=>track.boneId===id)!.keyframes[i].transform;
    Object.assign(oldFrame(`shoulder_${side}`), {rotation:oldShoulder,scaleX:oldReach,scaleY:oldReach});
    oldFrame(`elbow_${side}`).rotation=oldElbow;
    Object.assign(oldFrame(`hand_${side}`), {rotation:-oldShoulder-oldElbow+release,scaleX:1/oldReach,scaleY:1/oldReach});
  }
}

const previousBowShootV6 = structuredClone(bowShoot);
// Recover by lowering the joint angles, not pulling both wrists through the torso.
for (const track of bowShoot.layers[0].tracks.filter(track => /^(shoulder|elbow|hand)_[lr]$/.test(track.boneId))) {
  const start = { ...track.keyframes[82].transform };
  for (let i = 83; i <= 100; i++) {
    const u = (i-82)/18;
    const w = u*u*(3-2*u);
    const frame = track.keyframes[i].transform;
    frame.rotation = start.rotation*(1-w);
    frame.scaleX = start.scaleX+(1-start.scaleX)*w;
    frame.scaleY = start.scaleY+(1-start.scaleY)*w;
  }
}

const previousBowShootV7 = structuredClone(bowShoot);
bowShoot.drawOrder = [
  {timeMs:0,boneOrder:[],slotOrder:[]},
  {timeMs:400,boneOrder:["hip_r","knee_r","foot_r","shoulder_r","hip_l","knee_l","foot_l","pelvis","spine","chest","neck","shoulder_l","elbow_l","hand_l","head","elbow_r","hand_r"],slotOrder:[]},
  {timeMs:1800,boneOrder:[],slotOrder:[]},
];

const previousBowShootV8 = structuredClone(bowShoot);
// IK stretch lengthens each arm segment along its own axis. Elbow and wrist do not
// inherit the parent's scale (Spine Inherit.noScale), so sleeves, hands and the bow
// keep their authored width instead of being corrected per clip in the renderer.
for (const side of ["l", "r"] as const) {
  const track = (id: string) => bowShoot.layers[0].tracks.find(candidate => candidate.boneId === id)!.keyframes;
  const [shoulder, elbow, hand] = [track(`shoulder_${side}`), track(`elbow_${side}`), track(`hand_${side}`)];
  shoulder.forEach((key, i) => {
    const reach = key.transform.scaleY;
    key.transform.scaleX = 1;
    Object.assign(elbow[i].transform, { scaleX: 1, scaleY: reach });
    Object.assign(hand[i].transform, { scaleX: 1, scaleY: 1 });
  });
}
bowShoot.inherit = { elbow_l: "noScale", hand_l: "noScale", elbow_r: "noScale", hand_r: "noScale" };
// Closed grip while the bow is raised and while the right hand holds the string.
bowShoot.attachments = [
  { boneId: "hand_l", keyframes: [{ timeMs: 0, name: null }, { timeMs: 220, name: "grip" }, { timeMs: 1820, name: null }] },
  { boneId: "hand_r", keyframes: [{ timeMs: 0, name: null }, { timeMs: 400, name: "grip" }, { timeMs: 1360, name: null }] },
];

const previousBowShootV9 = structuredClone(bowShoot);
// Anatomical side-view draw, solved by runtime IK (Spine IkConstraint) so the hands
// land on the same targets in either facing, whatever the shoulder placement or body
// morph. The bow hand stays at shoulder height just past the chin; the string hand
// anchors under the chin. FK keys underneath raise and lower the arms; IK mix blends in
// while aiming and out during recovery. Stretch only engages when a target is beyond
// natural reach, and only along the bones (elbow and wrist use Inherit.noScale).
function anatomicalBowArms(clip: AnimationClip, lift: number, forward = 26, anchor = 7) {
  const stops = [0, .2, .32, .57, .68, .71, .82, 1];
  // Targets are wrist positions; `lift` raises them so the palm (grip point) holds the bow at shoulder height.
  const targets = [[-6,-7,4,-7], [forward,-37,forward-10,-37], [forward,-37,forward-10,-37], [forward,-37,anchor,-37], [forward,-37,anchor,-37], [forward,-37,anchor-3,-40], [forward,-37,anchor-3,-40], [-6,-7,4,-7]]
    .map((row, i) => i === 0 || i === 7 ? row : row.map((v, j) => j % 2 ? v - lift : v));
  const track = (id: string) => clip.layers[0].tracks.find(candidate => candidate.boneId === id)!.keyframes;
  const ikKeys: Record<"l" | "r", NonNullable<AnimationClip["ik"]>[number]["keyframes"]> = { l: [], r: [] };
  for (let i = 0; i <= 100; i++) {
    const t = i/100;
    const p = t < .2 ? t/.2 : t > .82 ? (1-t)/.18 : 1;
    const w = p*p*(3-2*p);
    let k = 0;
    while (k < stops.length-2 && t > stops[k+1]) k++;
    const u = (t-stops[k])/(stops[k+1]-stops[k]);
    const ease = u*u*(3-2*u);
    const target = targets[k].map((v,j) => v+(targets[k+1][j]-v)*ease);
    for (const [side, offset, sx, bend] of [["l",0,-6,1],["r",2,4,-1]] as const) {
      const [shoulder, elbow] = bowArm(target[offset]-sx, target[offset+1]+35, bend);
      const release = side === "r" && t > .68 ? 75*Math.min(1, (1-t)/.18) : 0;
      Object.assign(track(`shoulder_${side}`)[i].transform, { rotation: shoulder, scaleX: 1, scaleY: 1 });
      Object.assign(track(`elbow_${side}`)[i].transform, { rotation: elbow, scaleX: 1, scaleY: 1 });
      Object.assign(track(`hand_${side}`)[i].transform, { rotation: -shoulder-elbow+release, scaleX: 1, scaleY: 1 });
      ikKeys[side].push({ timeMs: t*clip.durationMs, x: target[offset], y: target[offset+1], rotation: release, mix: w });
    }
  }
  // Recover by lowering the joint angles, not by pulling the wrists through the torso.
  for (const id of ["shoulder_l", "elbow_l", "hand_l", "shoulder_r", "elbow_r", "hand_r"]) {
    const keys = track(id);
    const start = { ...keys[82].transform };
    for (let i = 83; i <= 100; i++) {
      const u = (i-82)/18;
      keys[i].transform.rotation = start.rotation*(1-u*u*(3-2*u));
    }
  }
  clip.ik = [
    { bones: ["shoulder_l", "elbow_l", "hand_l"], bend: 1, stretch: true, keyframes: ikKeys.l },
    { bones: ["shoulder_r", "elbow_r", "hand_r"], bend: -1, stretch: true, keyframes: ikKeys.r },
  ];
  // Whichever arm faces the viewer passes in front of the face: lift only that arm
  // (sleeves and held items follow). The far arm stays behind the head and torso.
  const nearArmAboveHead = ["shoulder", "elbow", "hand"].flatMap(joint => ["l", "r"].map(side => ({ boneId: `${joint}_${side}`, above: "head", onlyNear: true })));
  clip.drawOrder = [
    { timeMs: 0, boneOrder: [], slotOrder: [] },
    { timeMs: 160, boneOrder: [], slotOrder: [], raise: nearArmAboveHead },
    { timeMs: 1880, boneOrder: [], slotOrder: [] },
  ];
}
anatomicalBowArms(bowShoot, 0);

const previousBowShootV10 = structuredClone(bowShoot);
// Rebuilt from the V9 keys: the palm sits ~5 units below the wrist on the generated body.
anatomicalBowArms(bowShoot, 5);

const previousBowShootV11 = structuredClone(bowShoot);
// Clear the oversized chibi head with the whole bow, not just its grip.
anatomicalBowArms(bowShoot, 5, 38, 10);
// The drawing forearm emerges in front of the torso/head in both facings.
// Its upper arm remains behind the torso, preserving the shoulder connection.
for (const key of bowShoot.drawOrder ?? []) {
  if (key.raise) key.raise = key.raise.map(rule => ({
    ...rule, onlyNear: rule.boneId.startsWith("shoulder_") ? true : false,
  }));
}

const upgradedBowClips = new WeakMap<AnimationClip, AnimationClip>();
export function upgradeBowClip(clip: AnimationClip): AnimationClip {
  const cached = upgradedBowClips.get(clip);
  if (cached) return cached;
  // Schema parsing changes property order, so compare values, not raw JSON objects.
  const fingerprint = (c: AnimationClip) => JSON.stringify([c.id,c.durationMs,c.loops,c.layers.map(l => [l.mask,l.tracks.map(t => [t.boneId,t.keyframes.map(k => [k.timeMs,k.easing,k.transform.tx,k.transform.ty,k.transform.rotation,k.transform.scaleX,k.transform.scaleY])])])]);
  const revisions = [previousBowShoot, previousBowShootV2, previousBowShootV3, previousBowShootV4, previousBowShootV5, previousBowShootV6, previousBowShootV7, previousBowShootV8, previousBowShootV9, previousBowShootV10, previousBowShootV11];
  const known = revisions.some(old => fingerprint(old) === fingerprint(clip));
  let result = clip;
  if (known) {
    // Keys are canonical; keep user-authored deform and draw-order timelines.
    result = structuredClone(bowShoot);
    if (clip.deform) result.deform = structuredClone(clip.deform);
    const authored = (field: "drawOrder" | "ik" | "inherit" | "attachments") => clip[field] !== undefined && !revisions.some(old => JSON.stringify(clip[field]) === JSON.stringify(old[field]));
    if (authored("drawOrder")) result.drawOrder = structuredClone(clip.drawOrder);
    if (authored("ik")) result.ik = structuredClone(clip.ik);
    if (authored("inherit")) result.inherit = structuredClone(clip.inherit);
    if (authored("attachments")) result.attachments = structuredClone(clip.attachments);
  }
  upgradedBowClips.set(clip, result);
  return result;
}

const fistStrike = action("fist_strike", "Удары руками", 1250, false, {
  root: [{}, { ty: -1 }, { ty: 0 }, { ty: -1 }, { ty: 1 }, { ty: 0 }, { ty: -1 }, { ty: .5 }, {}],
  chest: [{}, { rotation: -4 }, { rotation: -7 }, { rotation: 5 }, { rotation: 2 }, { rotation: -5 }, { rotation: 7 }, { rotation: 2 }, {}],
  head: [{}, { rotation: 3 }, { rotation: 5 }, { rotation: -3 }, { rotation: -1 }, { rotation: 4 }, { rotation: -5 }, { rotation: -2 }, {}],
  shoulder_l: [{}, { rotation: 4 }, { rotation: 8 }, { rotation: -16 }, { rotation: -8 }, { rotation: -22 }, { rotation: -34 }, { rotation: -10 }, {}],
  elbow_l: [{}, { rotation: -8 }, { rotation: -14 }, { rotation: -28 }, { rotation: -14 }, { rotation: 8 }, { rotation: 18 }, { rotation: 8 }, {}],
  hand_l: [{}, { rotation: 4 }, { rotation: 8 }, { rotation: 35 }, { rotation: 18 }, { rotation: -12 }, { rotation: -28 }, { rotation: -8 }, {}],
  shoulder_r: [{}, { rotation: -18 }, { rotation: -30 }, { rotation: -8 }, { rotation: 8 }, { rotation: 16 }, { rotation: 30 }, { rotation: 8 }, {}],
  elbow_r: [{}, { rotation: 8 }, { rotation: 18 }, { rotation: 8 }, { rotation: -8 }, { rotation: -12 }, { rotation: -22 }, { rotation: -8 }, {}],
  hand_r: [{}, { rotation: -12 }, { rotation: -28 }, { rotation: -8 }, { rotation: 4 }, { rotation: 8 }, { rotation: 28 }, { rotation: 8 }, {}],
}, [0, .12, .24, .36, .48, .62, .74, .88, 1]);
const dance = action("dance", "Танец", 1800, true, {
  root: [{}, { ty: -2, rotation: -2 }, { ty: 0, rotation: 2 }, { ty: -2, rotation: -2 }, {}, { ty: -2, rotation: 2 }, { ty: 0, rotation: -2 }, { ty: -2, rotation: 2 }, {}],
  chest: [{}, { rotation: -8 }, { rotation: 7 }, { rotation: -6 }, {}, { rotation: 8 }, { rotation: -7 }, { rotation: 6 }, {}],
  head: [{}, { rotation: 9 }, { rotation: -8 }, { rotation: 7 }, {}, { rotation: -10 }, { rotation: 8 }, { rotation: -7 }, {}],
  shoulder_l: [{ rotation: -18 }, { rotation: -48 }, { rotation: -12 }, { rotation: 30 }, { rotation: 18 }, { rotation: 48 }, { rotation: 12 }, { rotation: -30 }, { rotation: -18 }],
  elbow_l: [{ rotation: -32 }, { rotation: -62 }, { rotation: -36 }, { rotation: 4 }, { rotation: -32 }, { rotation: -62 }, { rotation: -36 }, { rotation: 4 }, { rotation: -32 }],
  shoulder_r: [{ rotation: 30 }, { rotation: 8 }, { rotation: -34 }, { rotation: -8 }, { rotation: 30 }, { rotation: 8 }, { rotation: -34 }, { rotation: -8 }, { rotation: 30 }],
  elbow_r: [{ rotation: 42 }, { rotation: 22 }, { rotation: -8 }, { rotation: -40 }, { rotation: 42 }, { rotation: 22 }, { rotation: -8 }, { rotation: -40 }, { rotation: 42 }],
  hip_l: [{ rotation: -8 }, { rotation: -20 }, { rotation: 8 }, { rotation: 20 }, { rotation: -8 }, { rotation: -20 }, { rotation: 8 }, { rotation: 20 }, { rotation: -8 }],
  hip_r: [{ rotation: 8 }, { rotation: 20 }, { rotation: -8 }, { rotation: -20 }, { rotation: 8 }, { rotation: 20 }, { rotation: -8 }, { rotation: -20 }, { rotation: 8 }],
  knee_l: [{}, { rotation: 12 }, { rotation: 5 }, { rotation: -8 }, {}, { rotation: 12 }, { rotation: 5 }, { rotation: -8 }, {}],
  knee_r: [{ rotation: 5 }, { rotation: -8 }, {}, { rotation: 12 }, { rotation: 5 }, { rotation: -8 }, {}, { rotation: 12 }, { rotation: 5 }],
}, [0, .12, .24, .36, .5, .62, .74, .86, 1]);
const drink = action("drink", "Пить", 1350, false, {
  root: [{}, { ty: 1 }, { ty: 2 }, { ty: 1 }, {}, { ty: -1 }, {}],
  chest: [{}, { rotation: 4 }, { rotation: 8 }, { rotation: 10 }, { rotation: 4 }, { rotation: -2 }, {}],
  head: [{}, { rotation: -4 }, { rotation: -12 }, { rotation: -18 }, { rotation: -10 }, { rotation: 3 }, {}],
  shoulder_r: [{}, { rotation: -20 }, { rotation: -42 }, { rotation: -58 }, { rotation: -45 }, { rotation: -18 }, {}],
  elbow_r: [{}, { rotation: -20 }, { rotation: -45 }, { rotation: -70 }, { rotation: -55 }, { rotation: -22 }, {}],
  hand_r: [{}, { rotation: 8 }, { rotation: 18 }, { rotation: 26 }, { rotation: 18 }, { rotation: 8 }, {}],
  shoulder_l: [{}, { rotation: 8 }, { rotation: 16 }, { rotation: 20 }, { rotation: 12 }, { rotation: 5 }, {}],
}, [0, .14, .3, .48, .64, .84, 1]);
const eat = action("eat", "Есть", 1250, false, {
  root: [{}, { ty: 1 }, { ty: 0 }, { ty: 1 }, { ty: -1 }, { ty: 0 }, {}],
  chest: [{}, { rotation: 5 }, { rotation: 8 }, { rotation: 6 }, { rotation: -4 }, { rotation: -2 }, {}],
  head: [{}, { rotation: -3 }, { rotation: -10 }, { rotation: -16 }, { rotation: 8 }, { rotation: 3 }, {}],
  shoulder_r: [{}, { rotation: -18 }, { rotation: -44 }, { rotation: -58 }, { rotation: 26 }, { rotation: 8 }, {}],
  elbow_r: [{}, { rotation: -12 }, { rotation: -40 }, { rotation: -66 }, { rotation: 42 }, { rotation: 12 }, {}],
  hand_r: [{}, { rotation: 6 }, { rotation: 17 }, { rotation: 24 }, { rotation: -18 }, { rotation: -8 }, {}],
  shoulder_l: [{}, { rotation: 8 }, { rotation: 14 }, { rotation: 18 }, { rotation: 24 }, { rotation: 8 }, {}],
  elbow_l: [{}, { rotation: 4 }, { rotation: 8 }, { rotation: 12 }, { rotation: 32 }, { rotation: 12 }, {}],
}, [0, .12, .28, .44, .62, .82, 1]);
const trade = action("trade", "Торговаться", 1600, true, {
  root: [{}, { ty: -1 }, { ty: 0 }, { ty: 1 }, { ty: 0 }, { ty: -1 }, {}],
  chest: [{}, { rotation: -4 }, { rotation: 5 }, { rotation: 8 }, { rotation: -6 }, { rotation: -3 }, {}],
  head: [{}, { rotation: 8 }, { rotation: -6 }, { rotation: -9 }, { rotation: 6 }, { rotation: 3 }, {}],
  shoulder_l: [{}, { rotation: -20 }, { rotation: -38 }, { rotation: -18 }, { rotation: 14 }, { rotation: 5 }, {}],
  elbow_l: [{}, { rotation: -22 }, { rotation: -42 }, { rotation: -30 }, { rotation: 12 }, { rotation: 5 }, {}],
  hand_l: [{}, { rotation: -8 }, { rotation: -18 }, { rotation: -10 }, { rotation: 22 }, { rotation: 8 }, {}],
  shoulder_r: [{}, { rotation: 24 }, { rotation: 42 }, { rotation: 22 }, { rotation: -16 }, { rotation: -5 }, {}],
  elbow_r: [{}, { rotation: 24 }, { rotation: 42 }, { rotation: 30 }, { rotation: -12 }, { rotation: -5 }, {}],
  hand_r: [{}, { rotation: 8 }, { rotation: 18 }, { rotation: 10 }, { rotation: -22 }, { rotation: -8 }, {}],
}, [0, .16, .32, .5, .68, .84, 1]);
export const CHIBI_ANIMATIONS = [idle, gait("walk", 900, 1), gait("run", 550, 2), death, axeStrike, swordStrike, bowShoot, fistStrike, laugh, dance, drink, eat, trade, pickup, carry];

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
