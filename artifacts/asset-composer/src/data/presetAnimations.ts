import type { AnimationClip, SkeletonFamilyId, LayerMask } from "@/domain/types";

// ── helpers ──────────────────────────────────────────────────────────────────
const kf = (t: number, tx = 0, ty = 0, rot = 0, sx = 1, sy = 1) => ({
  timeMs: t,
  transform: { tx, ty, rotation: rot, scaleX: sx, scaleY: sy },
  easing: "linear" as const,
});
const tr = (boneId: string, keyframes: ReturnType<typeof kf>[]) => ({ boneId, keyframes });
const ly = (mask: LayerMask, tracks: ReturnType<typeof tr>[]) => ({ mask, tracks });

// ── humanoid clips factory ────────────────────────────────────────────────────
// Bone IDs: root, pelvis, spine, chest, neck, head,
//           shoulder_l, elbow_l, hand_l, shoulder_r, elbow_r, hand_r,
//           hip_l, knee_l, foot_l, hip_r, knee_r, foot_r

function makeHumanoidClips(family: SkeletonFamilyId, extra: AnimationClip[] = []): AnimationClip[] {
  const id = (base: string) => `${family}__${base}`;

  const idleTorsoVariants: AnimationClip[] = [
    // 1 – relaxed: very subtle chest bob
    { id: id("idle_01_relaxed"), name: "idle_01_relaxed", label: "Idle – Relaxed", skeletonFamily: family, durationMs: 2400, fps: 12, loops: true, layers: [ly("upper_body", [tr("chest", [kf(0), kf(600,0,-1.2), kf(1200), kf(1800,0,-1.2), kf(2400)])])] },
    // 2 – breathing: clear chest rise
    { id: id("idle_02_breathing"), name: "idle_02_breathing", label: "Idle – Breathing", skeletonFamily: family, durationMs: 2000, fps: 12, loops: true, layers: [ly("upper_body", [tr("chest", [kf(0), kf(400,0,-3), kf(900), kf(1300,0,-3), kf(2000)]), tr("shoulder_l", [kf(0), kf(400,0,-2,-2), kf(900), kf(1300,0,-2,-2), kf(2000)]), tr("shoulder_r", [kf(0), kf(400,0,-2,2), kf(900), kf(1300,0,-2,2), kf(2000)])])] },
    // 3 – shifting: pelvis left/right
    { id: id("idle_03_shifting"), name: "idle_03_shifting", label: "Idle – Shifting", skeletonFamily: family, durationMs: 3200, fps: 12, loops: true, layers: [ly("full_body", [tr("pelvis", [kf(0), kf(800,4,0,3), kf(1600), kf(2400,-4,0,-3), kf(3200)]), tr("chest", [kf(0,0,0,-2), kf(800,0,0,2), kf(1600,0,0,-2), kf(2400,0,0,2), kf(3200,0,0,-2)])])] },
    // 4 – look around: head rotation
    { id: id("idle_04_look_around"), name: "idle_04_look_around", label: "Idle – Look Around", skeletonFamily: family, durationMs: 4000, fps: 12, loops: true, layers: [ly("upper_body", [tr("head", [kf(0), kf(600,0,0,-18), kf(1400,0,0,-18), kf(2200,0,0,20), kf(3000,0,0,20), kf(3600), kf(4000)])])] },
    // 5 – scratch: right arm to head
    { id: id("idle_05_scratch"), name: "idle_05_scratch", label: "Idle – Scratch", skeletonFamily: family, durationMs: 2800, fps: 12, loops: true, layers: [ly("upper_body", [tr("shoulder_r", [kf(0), kf(400,0,-10,40), kf(800,0,-10,40), kf(1200,0,-10,45), kf(1600,0,-10,40), kf(2000), kf(2800)]), tr("elbow_r", [kf(0), kf(400,0,0,-60), kf(800,0,0,-55), kf(1200,0,0,-60), kf(1600,0,0,-60), kf(2000), kf(2800)])])] },
    // 6 – sway: root sways
    { id: id("idle_06_sway"), name: "idle_06_sway", label: "Idle – Sway", skeletonFamily: family, durationMs: 2000, fps: 12, loops: true, layers: [ly("full_body", [tr("root", [kf(0), kf(500,3,0,3), kf(1000), kf(1500,-3,0,-3), kf(2000)])])] },
    // 7 – combat ready: forward lean, arms raised
    { id: id("idle_07_combat_ready"), name: "idle_07_combat_ready", label: "Idle – Combat Ready", skeletonFamily: family, durationMs: 1600, fps: 12, loops: true, layers: [ly("full_body", [tr("spine", [kf(0,0,-2,-8), kf(800,0,-2,-9), kf(1600,0,-2,-8)]), tr("chest", [kf(0,0,0,-5), kf(800,0,0,-6), kf(1600,0,0,-5)]), tr("shoulder_l", [kf(0,0,-2,20), kf(800,0,-2,21), kf(1600,0,-2,20)]), tr("shoulder_r", [kf(0,0,-2,-20), kf(800,0,-2,-21), kf(1600,0,-2,-20)]), tr("elbow_l", [kf(0,0,0,-30), kf(1600,0,0,-30)]), tr("elbow_r", [kf(0,0,0,30), kf(1600,0,0,30)])])] },
    // 8 – tense: stiff minimal motion
    { id: id("idle_08_tense"), name: "idle_08_tense", label: "Idle – Tense", skeletonFamily: family, durationMs: 800, fps: 12, loops: true, layers: [ly("upper_body", [tr("chest", [kf(0,0,0,-6), kf(200,0,-0.5,-6), kf(400,0,0,-6), kf(600,0,-0.5,-6), kf(800,0,0,-6)]), tr("shoulder_l", [kf(0,0,0,-10), kf(800,0,0,-10)]), tr("shoulder_r", [kf(0,0,0,10), kf(800,0,0,10)])])] },
    // 9 – bored: slow slouch, then head up
    { id: id("idle_09_bored"), name: "idle_09_bored", label: "Idle – Bored", skeletonFamily: family, durationMs: 5000, fps: 12, loops: true, layers: [ly("upper_body", [tr("spine", [kf(0), kf(1500,0,4,6), kf(3000,0,4,6), kf(4200), kf(5000)]), tr("head", [kf(0), kf(1500,0,2,-5), kf(3000,0,2,-5), kf(4200), kf(5000)]), tr("shoulder_l", [kf(0), kf(1500,2,0,8), kf(3000,2,0,8), kf(4200), kf(5000)]), tr("shoulder_r", [kf(0), kf(1500,-2,0,-8), kf(3000,-2,0,-8), kf(4200), kf(5000)])])] },
    // 10 – alert: head snaps up
    { id: id("idle_10_alert"), name: "idle_10_alert", label: "Idle – Alert", skeletonFamily: family, durationMs: 1200, fps: 12, loops: true, layers: [ly("upper_body", [tr("head", [kf(0), kf(100,0,-2,-10), kf(300,0,-2,-10), kf(700,0,-1,-8), kf(1200,0,-1,-8)]), tr("chest", [kf(0), kf(100,0,-2,-8), kf(1200,0,-2,-8)])])] },
    // 11 – fidget: small arm twitches
    { id: id("idle_11_fidget"), name: "idle_11_fidget", label: "Idle – Fidget", skeletonFamily: family, durationMs: 2400, fps: 12, loops: true, layers: [ly("upper_body", [tr("shoulder_l", [kf(0), kf(200,2,0,-8), kf(400), kf(700,-2,0,5), kf(1000), kf(1400,3,0,-6), kf(1800), kf(2400)]), tr("elbow_l", [kf(0), kf(300,0,0,-15), kf(600), kf(1200,0,0,-10), kf(2400)])])] },
    // 12 – roll shoulders: shoulder rotation
    { id: id("idle_12_roll_shoulders"), name: "idle_12_roll_shoulders", label: "Idle – Roll Shoulders", skeletonFamily: family, durationMs: 2000, fps: 12, loops: true, layers: [ly("upper_body", [tr("shoulder_l", [kf(0), kf(250,0,-4,10), kf(500,0,0,0), kf(750,0,4,-10), kf(1000), kf(1250,0,-4,10), kf(1500,0,0,0), kf(1750,0,4,-10), kf(2000)]), tr("shoulder_r", [kf(0), kf(250,0,4,-10), kf(500,0,0,0), kf(750,0,-4,10), kf(1000), kf(1250,0,4,-10), kf(1500,0,0,0), kf(1750,0,-4,10), kf(2000)])])] },
    // 13 – tap foot: foot_r bounces
    { id: id("idle_13_tap_foot"), name: "idle_13_tap_foot", label: "Idle – Tap Foot", skeletonFamily: family, durationMs: 1200, fps: 12, loops: true, layers: [ly("full_body", [tr("hip_r", [kf(0), kf(150,0,0,8), kf(300), kf(450,0,0,8), kf(600), kf(750,0,0,8), kf(900), kf(1050,0,0,8), kf(1200)]), tr("knee_r", [kf(0), kf(150,0,0,-12), kf(300), kf(450,0,0,-12), kf(600), kf(750,0,0,-12), kf(900), kf(1050,0,0,-12), kf(1200)]), tr("chest", [kf(0), kf(600,0,0,2), kf(1200)])])] },
    // 14 – cross arms: arms move inward
    { id: id("idle_14_cross_arms"), name: "idle_14_cross_arms", label: "Idle – Cross Arms", skeletonFamily: family, durationMs: 3000, fps: 12, loops: true, layers: [ly("upper_body", [tr("shoulder_l", [kf(0), kf(400,10,0,-30), kf(2600,10,0,-30), kf(3000)]), tr("shoulder_r", [kf(0), kf(400,-10,0,30), kf(2600,-10,0,30), kf(3000)]), tr("elbow_l", [kf(0), kf(400,0,0,40), kf(2600,0,0,40), kf(3000)]), tr("elbow_r", [kf(0), kf(400,0,0,-40), kf(2600,0,0,-40), kf(3000)]), tr("chest", [kf(0,0,0,4), kf(400,0,0,4), kf(3000,0,0,4)])])] },
    // 15 – lean: body tilts to one side
    { id: id("idle_15_lean"), name: "idle_15_lean", label: "Idle – Lean", skeletonFamily: family, durationMs: 3200, fps: 12, loops: true, layers: [ly("full_body", [tr("root", [kf(0), kf(600,5,0,6), kf(2600,5,0,6), kf(3200)]), tr("chest", [kf(0), kf(600,0,0,-4), kf(2600,0,0,-4), kf(3200)]), tr("head", [kf(0), kf(600,0,0,-3), kf(2600,0,0,-3), kf(3200)])])] },
  ];

  const idleFull: AnimationClip = {
    id: id("idle_full"), name: "idle_full", label: "Idle — Full Body",
    skeletonFamily: family, durationMs: 2000, fps: 12, loops: true,
    layers: [ly("full_body", [
      tr("chest", [kf(0), kf(500,0,-2), kf(1000), kf(1500,0,-2), kf(2000)]),
      tr("shoulder_l", [kf(0), kf(500,0,0,-2), kf(1000), kf(1500,0,0,-2), kf(2000)]),
      tr("shoulder_r", [kf(0), kf(500,0,0,2), kf(1000), kf(1500,0,0,2), kf(2000)]),
      tr("neck", [kf(0), kf(500,0,-1), kf(1000), kf(1500,0,-1), kf(2000)]),
    ])],
  };

  const walk: AnimationClip = {
    id: id("walk"), name: "walk", label: "Walk",
    skeletonFamily: family, durationMs: 800, fps: 12, loops: true,
    layers: [
      ly("lower_body", [
        tr("root", [kf(0,0,0), kf(200,0,-2), kf(400,0,0), kf(600,0,-2), kf(800,0,0)]),
        tr("hip_l", [kf(0,0,0,-30), kf(200,0,0,-8), kf(400,0,0,22), kf(600,0,0,5), kf(800,0,0,-30)]),
        tr("knee_l", [kf(0,0,0,15), kf(200,0,0,5), kf(400,0,0,-8), kf(600,0,0,20), kf(800,0,0,15)]),
        tr("foot_l", [kf(0,0,0,10), kf(200,0,0,5), kf(400,0,0,-10), kf(600,0,0,5), kf(800,0,0,10)]),
        tr("hip_r", [kf(0,0,0,22), kf(200,0,0,5), kf(400,0,0,-30), kf(600,0,0,-8), kf(800,0,0,22)]),
        tr("knee_r", [kf(0,0,0,-8), kf(200,0,0,20), kf(400,0,0,15), kf(600,0,0,5), kf(800,0,0,-8)]),
        tr("foot_r", [kf(0,0,0,-10), kf(200,0,0,5), kf(400,0,0,10), kf(600,0,0,5), kf(800,0,0,-10)]),
        tr("pelvis", [kf(0,0,0,2), kf(200,0,0,-2), kf(400,0,0,2), kf(600,0,0,-2), kf(800,0,0,2)]),
      ]),
      ly("upper_body", [
        tr("shoulder_l", [kf(0,0,0,22), kf(400,0,0,-22), kf(800,0,0,22)]),
        tr("shoulder_r", [kf(0,0,0,-22), kf(400,0,0,22), kf(800,0,0,-22)]),
        tr("elbow_l", [kf(0,0,0,-8), kf(400,0,0,8), kf(800,0,0,-8)]),
        tr("elbow_r", [kf(0,0,0,8), kf(400,0,0,-8), kf(800,0,0,8)]),
        tr("chest", [kf(0,0,0,4), kf(400,0,0,-4), kf(800,0,0,4)]),
      ]),
    ],
  };

  const run: AnimationClip = {
    id: id("run"), name: "run", label: "Run",
    skeletonFamily: family, durationMs: 500, fps: 12, loops: true,
    layers: [
      ly("lower_body", [
        tr("root", [kf(0,0,-3), kf(125,0,-1), kf(250,0,-3), kf(375,0,-1), kf(500,0,-3)]),
        tr("hip_l", [kf(0,0,0,-50), kf(125,0,0,0), kf(250,0,0,40), kf(375,0,0,0), kf(500,0,0,-50)]),
        tr("knee_l", [kf(0,0,0,30), kf(125,0,0,10), kf(250,0,0,-15), kf(375,0,0,40), kf(500,0,0,30)]),
        tr("hip_r", [kf(0,0,0,40), kf(125,0,0,0), kf(250,0,0,-50), kf(375,0,0,0), kf(500,0,0,40)]),
        tr("knee_r", [kf(0,0,0,-15), kf(125,0,0,40), kf(250,0,0,30), kf(375,0,0,10), kf(500,0,0,-15)]),
        tr("pelvis", [kf(0,0,0,5), kf(125,0,0,-5), kf(250,0,0,5), kf(375,0,0,-5), kf(500,0,0,5)]),
      ]),
      ly("upper_body", [
        tr("chest", [kf(0,0,0,-10), kf(250,0,0,10), kf(500,0,0,-10)]),
        tr("shoulder_l", [kf(0,0,-4,40), kf(250,0,-4,-40), kf(500,0,-4,40)]),
        tr("shoulder_r", [kf(0,0,-4,-40), kf(250,0,-4,40), kf(500,0,-4,-40)]),
        tr("elbow_l", [kf(0,0,0,-20), kf(250,0,0,20), kf(500,0,0,-20)]),
        tr("elbow_r", [kf(0,0,0,20), kf(250,0,0,-20), kf(500,0,0,20)]),
      ]),
    ],
  };

  const meleeAttack: AnimationClip = {
    id: id("melee_attack"), name: "melee_attack", label: "Melee Attack",
    skeletonFamily: family, durationMs: 400, fps: 12, loops: false,
    layers: [ly("upper_body", [
      tr("chest", [kf(0), kf(80,0,0,-15), kf(160,0,0,20), kf(300,0,0,-5), kf(400)]),
      tr("shoulder_r", [kf(0), kf(80,0,-6,-50), kf(160,0,-6,60), kf(300,0,0,10), kf(400)]),
      tr("elbow_r", [kf(0), kf(80,0,0,40), kf(160,0,0,-60), kf(300,0,0,5), kf(400)]),
      tr("shoulder_l", [kf(0), kf(80,0,0,20), kf(160,0,0,-15), kf(400)]),
    ])],
  };

  const rangedAttack: AnimationClip = {
    id: id("ranged_attack"), name: "ranged_attack", label: "Ranged Attack",
    skeletonFamily: family, durationMs: 600, fps: 12, loops: false,
    layers: [ly("upper_body", [
      tr("chest", [kf(0), kf(200,0,0,-10), kf(300,0,0,-10), kf(350,0,0,5), kf(600)]),
      tr("shoulder_l", [kf(0), kf(200,0,-5,50), kf(300,0,-5,50), kf(350,0,-5,55), kf(600)]),
      tr("shoulder_r", [kf(0), kf(200,0,-5,-60), kf(300,0,-5,-60), kf(350,0,-5,-65), kf(600)]),
      tr("elbow_l", [kf(0), kf(200,0,0,-70), kf(350,0,0,-70), kf(600)]),
      tr("elbow_r", [kf(0), kf(200,0,0,20), kf(350,0,0,20), kf(600)]),
    ])],
  };

  const cast: AnimationClip = {
    id: id("cast"), name: "cast", label: "Cast Spell",
    skeletonFamily: family, durationMs: 1000, fps: 12, loops: false,
    layers: [ly("upper_body", [
      tr("chest", [kf(0), kf(200,0,-3,-15), kf(500,0,-5,-20), kf(700,0,-2,-10), kf(1000)]),
      tr("shoulder_l", [kf(0), kf(200,0,-8,60), kf(500,0,-10,70), kf(700,0,-5,50), kf(1000)]),
      tr("shoulder_r", [kf(0), kf(200,0,-8,50), kf(500,0,-10,60), kf(700,0,-5,40), kf(1000)]),
      tr("elbow_l", [kf(0), kf(200,0,0,-50), kf(500,0,0,-60), kf(700,0,0,-45), kf(1000)]),
      tr("elbow_r", [kf(0), kf(200,0,0,50), kf(500,0,0,60), kf(700,0,0,45), kf(1000)]),
      tr("head", [kf(0), kf(200,0,-2,-5), kf(500,0,-4,-8), kf(1000)]),
    ])],
  };

  const block: AnimationClip = {
    id: id("block"), name: "block", label: "Block",
    skeletonFamily: family, durationMs: 300, fps: 12, loops: false,
    layers: [ly("upper_body", [
      tr("shoulder_l", [kf(0), kf(120,0,-6,60), kf(300,0,-6,58)]),
      tr("elbow_l", [kf(0), kf(120,0,0,-80), kf(300,0,0,-80)]),
      tr("chest", [kf(0), kf(120,0,0,-12), kf(300,0,0,-12)]),
      tr("shoulder_r", [kf(0), kf(120,0,0,-20), kf(300,0,0,-20)]),
    ])],
  };

  const hurt: AnimationClip = {
    id: id("hurt"), name: "hurt", label: "Hurt",
    skeletonFamily: family, durationMs: 500, fps: 12, loops: false,
    layers: [ly("full_body", [
      tr("root", [kf(0), kf(80,6,0,0), kf(200,5,0,0), kf(500)]),
      tr("chest", [kf(0), kf(80,0,0,18), kf(200,0,0,15), kf(500)]),
      tr("head", [kf(0), kf(80,0,2,20), kf(200,0,2,18), kf(500)]),
      tr("shoulder_l", [kf(0), kf(80,0,0,-30), kf(200,0,0,-25), kf(500)]),
      tr("shoulder_r", [kf(0), kf(80,0,0,30), kf(200,0,0,25), kf(500)]),
    ])],
  };

  const stagger: AnimationClip = {
    id: id("stagger"), name: "stagger", label: "Stagger",
    skeletonFamily: family, durationMs: 600, fps: 12, loops: false,
    layers: [ly("full_body", [
      tr("root", [kf(0), kf(100,10,0,0), kf(200,8,4,0), kf(400,4,3,0), kf(600)]),
      tr("spine", [kf(0), kf(100,0,0,20), kf(250,0,0,12), kf(600)]),
      tr("chest", [kf(0), kf(100,0,4,18), kf(250,0,2,10), kf(600)]),
      tr("shoulder_l", [kf(0), kf(100,0,0,-40), kf(300,0,0,-20), kf(600)]),
      tr("shoulder_r", [kf(0), kf(100,0,0,40), kf(300,0,0,20), kf(600)]),
    ])],
  };

  const death: AnimationClip = {
    id: id("death"), name: "death", label: "Death",
    skeletonFamily: family, durationMs: 1200, fps: 12, loops: false,
    layers: [ly("full_body", [
      tr("root", [kf(0), kf(200,4,0,0), kf(600,8,18,0), kf(900,8,30,0), kf(1200,6,32,0)]),
      tr("spine", [kf(0), kf(200,0,0,15), kf(600,0,0,40), kf(900,0,0,80), kf(1200,0,0,90)]),
      tr("chest", [kf(0), kf(200,0,0,10), kf(600,0,0,30), kf(900,0,0,50), kf(1200,0,0,60)]),
      tr("head", [kf(0), kf(200,0,0,5), kf(600,0,0,20), kf(900,0,0,60), kf(1200,0,0,90)]),
      tr("shoulder_l", [kf(0), kf(200,0,0,-20), kf(600,8,0,-50), kf(1200,8,0,-80)]),
      tr("shoulder_r", [kf(0), kf(200,0,0,20), kf(600,-8,0,50), kf(1200,-8,0,80)]),
      tr("hip_l", [kf(0), kf(400,0,0,-20), kf(800,6,0,-30), kf(1200,10,0,-40)]),
      tr("hip_r", [kf(0), kf(400,0,0,15), kf(800,-4,0,20), kf(1200,-8,0,30)]),
    ])],
  };

  const sit: AnimationClip = {
    id: id("sit"), name: "sit", label: "Sit",
    skeletonFamily: family, durationMs: 800, fps: 12, loops: false,
    layers: [ly("full_body", [
      tr("root", [kf(0), kf(400,0,14,0), kf(800,0,16,0)]),
      tr("spine", [kf(0), kf(400,0,0,5), kf(800,0,0,5)]),
      tr("hip_l", [kf(0), kf(400,0,0,90), kf(800,0,0,90)]),
      tr("hip_r", [kf(0), kf(400,0,0,-90), kf(800,0,0,-90)]),
      tr("knee_l", [kf(0), kf(400,0,0,-95), kf(800,0,0,-95)]),
      tr("knee_r", [kf(0), kf(400,0,0,95), kf(800,0,0,95)]),
    ])],
  };

  const interact: AnimationClip = {
    id: id("interact"), name: "interact", label: "Interact",
    skeletonFamily: family, durationMs: 800, fps: 12, loops: false,
    layers: [ly("upper_body", [
      tr("chest", [kf(0), kf(200,0,-2,-10), kf(500,0,-2,-10), kf(800)]),
      tr("shoulder_r", [kf(0), kf(200,0,-8,40), kf(500,0,-8,38), kf(800)]),
      tr("elbow_r", [kf(0), kf(200,0,0,-50), kf(500,0,0,-48), kf(800)]),
      tr("head", [kf(0), kf(200,0,-2,-8), kf(500,0,-2,-8), kf(800)]),
    ])],
  };

  const farmWork: AnimationClip = {
    id: id("farm_work"), name: "farm_work", label: "Farm Work",
    skeletonFamily: family, durationMs: 1200, fps: 12, loops: true,
    layers: [ly("full_body", [
      tr("spine", [kf(0), kf(300,0,4,25), kf(600), kf(900,0,4,25), kf(1200)]),
      tr("chest", [kf(0), kf(300,0,2,15), kf(600), kf(900,0,2,15), kf(1200)]),
      tr("shoulder_r", [kf(0,0,-6,60), kf(300,0,0,20), kf(600,0,-6,60), kf(900,0,0,20), kf(1200,0,-6,60)]),
      tr("elbow_r", [kf(0,0,0,-30), kf(300,0,0,-70), kf(600,0,0,-30), kf(900,0,0,-70), kf(1200,0,0,-30)]),
      tr("shoulder_l", [kf(0,0,-4,40), kf(300,0,0,10), kf(600,0,-4,40), kf(900,0,0,10), kf(1200,0,-4,40)]),
    ])],
  };

  const carry: AnimationClip = {
    id: id("carry"), name: "carry", label: "Carry",
    skeletonFamily: family, durationMs: 1000, fps: 12, loops: true,
    layers: [
      ly("lower_body", [
        tr("root", [kf(0,0,-1), kf(250,0,-2), kf(500,0,-1), kf(750,0,-2), kf(1000,0,-1)]),
        tr("hip_l", [kf(0,0,0,-20), kf(250,0,0,0), kf(500,0,0,15), kf(750,0,0,0), kf(1000,0,0,-20)]),
        tr("hip_r", [kf(0,0,0,15), kf(250,0,0,0), kf(500,0,0,-20), kf(750,0,0,0), kf(1000,0,0,15)]),
        tr("knee_l", [kf(0,0,0,10), kf(500,0,0,-5), kf(1000,0,0,10)]),
        tr("knee_r", [kf(0,0,0,-5), kf(500,0,0,10), kf(1000,0,0,-5)]),
      ]),
      ly("upper_body", [
        tr("spine", [kf(0,0,2,-5), kf(1000,0,2,-5)]),
        tr("chest", [kf(0,0,2,-8), kf(1000,0,2,-8)]),
        tr("shoulder_l", [kf(0,0,-8,50), kf(1000,0,-8,50)]),
        tr("shoulder_r", [kf(0,0,-8,-50), kf(1000,0,-8,-50)]),
        tr("elbow_l", [kf(0,0,0,-80), kf(1000,0,0,-80)]),
        tr("elbow_r", [kf(0,0,0,80), kf(1000,0,0,80)]),
      ]),
    ],
  };

  return [
    idleFull,
    ...idleTorsoVariants,
    walk,
    run,
    meleeAttack,
    rangedAttack,
    cast,
    block,
    hurt,
    stagger,
    death,
    sit,
    interact,
    farmWork,
    carry,
    ...extra,
  ];
}

// ── Quadruped clips ────────────────────────────────────────────────────────────
// Bone IDs: root, body, neck, head, tail, front_leg_l, front_leg_r, back_leg_l, back_leg_r
const QUADRUPED_CLIPS: AnimationClip[] = [
  {
    id: "quad_idle", name: "idle", label: "Idle",
    skeletonFamily: "quadruped_side_v1", durationMs: 2400, fps: 12, loops: true,
    layers: [ly("full_body", [
      tr("body", [kf(0), kf(600,0,-1), kf(1200), kf(1800,0,-1), kf(2400)]),
      tr("neck", [kf(0), kf(800,0,0,-5), kf(1600), kf(2400)]),
      tr("head", [kf(0), kf(800,0,0,-4), kf(1600), kf(2400)]),
      tr("tail", [kf(0), kf(400,0,0,10), kf(800,0,0,0), kf(1200,0,0,12), kf(1600,0,0,0), kf(2400)]),
    ])],
  },
  {
    id: "quad_walk", name: "walk", label: "Walk",
    skeletonFamily: "quadruped_side_v1", durationMs: 800, fps: 12, loops: true,
    layers: [ly("full_body", [
      tr("body", [kf(0), kf(200,0,-2), kf(400,0,0), kf(600,0,-2), kf(800,0,0)]),
      tr("front_leg_l", [kf(0,0,0,-30), kf(200,0,0,0), kf(400,0,0,25), kf(600,0,0,0), kf(800,0,0,-30)]),
      tr("front_leg_r", [kf(0,0,0,25), kf(200,0,0,0), kf(400,0,0,-30), kf(600,0,0,0), kf(800,0,0,25)]),
      tr("back_leg_l", [kf(0,0,0,25), kf(200,0,0,0), kf(400,0,0,-30), kf(600,0,0,0), kf(800,0,0,25)]),
      tr("back_leg_r", [kf(0,0,0,-30), kf(200,0,0,0), kf(400,0,0,25), kf(600,0,0,0), kf(800,0,0,-30)]),
      tr("neck", [kf(0,0,0,-5), kf(400,0,0,5), kf(800,0,0,-5)]),
      tr("tail", [kf(0,0,0,5), kf(400,0,0,-5), kf(800,0,0,5)]),
    ])],
  },
  {
    id: "quad_trot", name: "trot", label: "Trot",
    skeletonFamily: "quadruped_side_v1", durationMs: 600, fps: 12, loops: true,
    layers: [ly("full_body", [
      tr("body", [kf(0), kf(150,0,-3), kf(300,0,0), kf(450,0,-3), kf(600,0,0)]),
      tr("front_leg_l", [kf(0,0,0,-40), kf(150,0,-5,0), kf(300,0,0,35), kf(450,0,0,0), kf(600,0,0,-40)]),
      tr("back_leg_r", [kf(0,0,0,-40), kf(150,0,-5,0), kf(300,0,0,35), kf(450,0,0,0), kf(600,0,0,-40)]),
      tr("front_leg_r", [kf(0,0,0,35), kf(150,0,0,0), kf(300,0,0,-40), kf(450,0,-5,0), kf(600,0,0,35)]),
      tr("back_leg_l", [kf(0,0,0,35), kf(150,0,0,0), kf(300,0,0,-40), kf(450,0,-5,0), kf(600,0,0,35)]),
      tr("neck", [kf(0,0,0,-8), kf(300,0,0,8), kf(600,0,0,-8)]),
      tr("head", [kf(0,0,0,-5), kf(300,0,0,5), kf(600,0,0,-5)]),
    ])],
  },
  {
    id: "quad_gallop", name: "gallop", label: "Gallop",
    skeletonFamily: "quadruped_side_v1", durationMs: 400, fps: 12, loops: true,
    layers: [ly("full_body", [
      tr("body", [kf(0,0,0,-5), kf(100,0,-5,-8), kf(200,0,-4,5), kf(300,0,-2,8), kf(400,0,0,-5)]),
      tr("front_leg_l", [kf(0,0,0,-55), kf(100,0,-8,0), kf(200,0,0,45), kf(300,0,0,10), kf(400,0,0,-55)]),
      tr("front_leg_r", [kf(0,0,0,45), kf(100,0,0,10), kf(200,0,0,-55), kf(300,0,-8,0), kf(400,0,0,45)]),
      tr("back_leg_l", [kf(0,0,0,50), kf(100,0,-6,10), kf(200,0,0,-50), kf(300,0,0,-10), kf(400,0,0,50)]),
      tr("back_leg_r", [kf(0,0,0,-50), kf(100,0,0,-10), kf(200,0,0,50), kf(300,0,-6,10), kf(400,0,0,-50)]),
      tr("neck", [kf(0,0,0,-15), kf(200,0,0,10), kf(400,0,0,-15)]),
      tr("head", [kf(0,0,0,-10), kf(200,0,0,8), kf(400,0,0,-10)]),
      tr("tail", [kf(0,0,0,25), kf(200,0,0,10), kf(400,0,0,25)]),
    ])],
  },
  {
    id: "quad_rear", name: "rear", label: "Rear Up",
    skeletonFamily: "quadruped_side_v1", durationMs: 1200, fps: 12, loops: false,
    layers: [ly("full_body", [
      tr("root", [kf(0), kf(300,-8,-10,-20), kf(700,-8,-12,-22), kf(1000,-4,-4,-10), kf(1200)]),
      tr("body", [kf(0), kf(300,0,0,-30), kf(700,0,0,-35), kf(1000,0,0,-15), kf(1200)]),
      tr("front_leg_l", [kf(0), kf(300,0,-10,-70), kf(700,0,-10,-70), kf(1000,0,-5,-30), kf(1200)]),
      tr("front_leg_r", [kf(0), kf(300,0,-10,70), kf(700,0,-10,70), kf(1000,0,-5,30), kf(1200)]),
      tr("back_leg_l", [kf(0), kf(300,0,0,20), kf(700,0,0,20), kf(1200)]),
      tr("back_leg_r", [kf(0), kf(300,0,0,-20), kf(700,0,0,-20), kf(1200)]),
      tr("neck", [kf(0), kf(300,0,0,25), kf(700,0,0,25), kf(1200)]),
      tr("head", [kf(0), kf(300,0,0,15), kf(700,0,0,15), kf(1200)]),
    ])],
  },
  {
    id: "quad_bite", name: "bite", label: "Bite",
    skeletonFamily: "quadruped_side_v1", durationMs: 600, fps: 12, loops: false,
    layers: [ly("full_body", [
      tr("neck", [kf(0), kf(150,0,0,-20), kf(250,0,0,15), kf(400,0,0,0), kf(600)]),
      tr("head", [kf(0), kf(150,0,0,-25), kf(250,0,0,20), kf(400,0,0,0), kf(600)]),
      tr("body", [kf(0), kf(150,0,0,-5), kf(250,0,0,5), kf(600)]),
    ])],
  },
  {
    id: "quad_hurt", name: "hurt", label: "Hurt",
    skeletonFamily: "quadruped_side_v1", durationMs: 600, fps: 12, loops: false,
    layers: [ly("full_body", [
      tr("root", [kf(0), kf(80,8,0,0), kf(250,5,0,0), kf(600)]),
      tr("body", [kf(0), kf(80,0,0,15), kf(250,0,0,8), kf(600)]),
      tr("neck", [kf(0), kf(80,0,2,20), kf(250,0,1,10), kf(600)]),
      tr("head", [kf(0), kf(80,0,2,15), kf(250,0,1,8), kf(600)]),
    ])],
  },
  {
    id: "quad_death", name: "death", label: "Death",
    skeletonFamily: "quadruped_side_v1", durationMs: 1400, fps: 12, loops: false,
    layers: [ly("full_body", [
      tr("root", [kf(0), kf(300,4,8,0), kf(700,6,22,0), kf(1200,6,28,0), kf(1400,5,30,0)]),
      tr("body", [kf(0), kf(300,0,0,10), kf(700,0,0,30), kf(1200,0,0,45), kf(1400,0,0,50)]),
      tr("neck", [kf(0), kf(400,0,0,-20), kf(800,0,6,-40), kf(1400,0,8,-50)]),
      tr("head", [kf(0), kf(400,0,0,-15), kf(800,0,4,-30), kf(1400,0,6,-40)]),
      tr("front_leg_l", [kf(0), kf(500,0,0,60), kf(1400,0,0,80)]),
      tr("front_leg_r", [kf(0), kf(500,0,0,-60), kf(1400,0,0,-80)]),
      tr("back_leg_l", [kf(0), kf(600,0,0,40), kf(1400,0,0,60)]),
      tr("back_leg_r", [kf(0), kf(600,0,0,-40), kf(1400,0,0,-60)]),
    ])],
  },
];

// ── Bird clips ─────────────────────────────────────────────────────────────────
// Bone IDs: root, body, neck, head, wing_l, wing_r, tail, leg_l, leg_r
const BIRD_CLIPS: AnimationClip[] = [
  {
    id: "bird_idle", name: "idle", label: "Idle",
    skeletonFamily: "bird_side_v1", durationMs: 2000, fps: 12, loops: true,
    layers: [ly("full_body", [
      tr("body", [kf(0), kf(500,0,-1), kf(1000), kf(1500,0,-1), kf(2000)]),
      tr("wing_l", [kf(0,0,0,5), kf(1000,0,0,2), kf(2000,0,0,5)]),
      tr("wing_r", [kf(0,0,0,-5), kf(1000,0,0,-2), kf(2000,0,0,-5)]),
      tr("head", [kf(0), kf(700,0,0,-8), kf(1400,0,0,5), kf(2000)]),
      tr("tail", [kf(0,0,0,10), kf(1000,0,0,5), kf(2000,0,0,10)]),
    ])],
  },
  {
    id: "bird_flap", name: "flap", label: "Flap",
    skeletonFamily: "bird_side_v1", durationMs: 400, fps: 12, loops: true,
    layers: [ly("full_body", [
      tr("body", [kf(0), kf(100,0,-4), kf(200,0,-8), kf(300,0,-4), kf(400,0,0)]),
      tr("wing_l", [kf(0,0,0,25), kf(100,0,-6,-15), kf(200,0,-10,-40), kf(300,0,-6,-15), kf(400,0,0,25)]),
      tr("wing_r", [kf(0,0,0,-25), kf(100,0,-6,15), kf(200,0,-10,40), kf(300,0,-6,15), kf(400,0,0,-25)]),
      tr("tail", [kf(0,0,0,15), kf(200,0,0,-5), kf(400,0,0,15)]),
    ])],
  },
  {
    id: "bird_glide", name: "glide", label: "Glide",
    skeletonFamily: "bird_side_v1", durationMs: 3000, fps: 12, loops: true,
    layers: [ly("full_body", [
      tr("body", [kf(0,0,0,-5), kf(1500,0,-2,-6), kf(3000,0,0,-5)]),
      tr("wing_l", [kf(0,0,0,-20), kf(750,0,-3,-22), kf(1500,0,0,-18), kf(2250,0,-3,-22), kf(3000,0,0,-20)]),
      tr("wing_r", [kf(0,0,0,20), kf(750,0,-3,22), kf(1500,0,0,18), kf(2250,0,-3,22), kf(3000,0,0,20)]),
      tr("tail", [kf(0,0,0,5), kf(1500,0,0,3), kf(3000,0,0,5)]),
    ])],
  },
  {
    id: "bird_peck", name: "peck", label: "Peck",
    skeletonFamily: "bird_side_v1", durationMs: 500, fps: 12, loops: false,
    layers: [ly("full_body", [
      tr("neck", [kf(0), kf(100,0,0,-20), kf(200,0,0,-25), kf(300,0,0,0), kf(500)]),
      tr("head", [kf(0), kf(100,0,0,-20), kf(200,0,0,-28), kf(300,0,0,0), kf(500)]),
      tr("body", [kf(0), kf(200,0,0,-8), kf(300,0,0,0), kf(500)]),
    ])],
  },
  {
    id: "bird_hurt", name: "hurt", label: "Hurt",
    skeletonFamily: "bird_side_v1", durationMs: 500, fps: 12, loops: false,
    layers: [ly("full_body", [
      tr("root", [kf(0), kf(80,5,0,0), kf(250,3,0,0), kf(500)]),
      tr("wing_l", [kf(0), kf(80,0,0,-30), kf(250,0,0,-15), kf(500)]),
      tr("wing_r", [kf(0), kf(80,0,0,30), kf(250,0,0,15), kf(500)]),
      tr("body", [kf(0), kf(80,0,0,15), kf(500)]),
    ])],
  },
  {
    id: "bird_death", name: "death", label: "Death",
    skeletonFamily: "bird_side_v1", durationMs: 1200, fps: 12, loops: false,
    layers: [ly("full_body", [
      tr("root", [kf(0), kf(400,3,10,0), kf(800,4,22,0), kf(1200,4,28,0)]),
      tr("body", [kf(0), kf(400,0,0,30), kf(800,0,0,65), kf(1200,0,0,80)]),
      tr("wing_l", [kf(0,0,0,20), kf(400,0,0,60), kf(800,0,0,80), kf(1200,0,0,90)]),
      tr("wing_r", [kf(0,0,0,-20), kf(400,0,0,-60), kf(800,0,0,-80), kf(1200,0,0,-90)]),
      tr("neck", [kf(0), kf(600,0,4,-30), kf(1200,0,6,-45)]),
    ])],
  },
];

// ── Monster-specific extra clips ──────────────────────────────────────────────
function makeMonsterExtras(): AnimationClip[] {
  const family: SkeletonFamilyId = "humanoid_monster_v1";
  const id = (base: string) => `${family}__${base}`;
  return [
    {
      id: id("roar"), name: "roar", label: "Roar",
      skeletonFamily: family, durationMs: 1200, fps: 12, loops: false,
      layers: [ly("upper_body", [
        tr("spine", [kf(0), kf(200,0,-5,-15), kf(500,0,-6,-18), kf(900,0,-3,-8), kf(1200)]),
        tr("chest", [kf(0), kf(200,0,-4,-20), kf(500,0,-5,-22), kf(900,0,-2,-10), kf(1200)]),
        tr("head", [kf(0), kf(200,0,-4,-25), kf(500,0,-6,-30), kf(900,0,-3,-15), kf(1200)]),
        tr("shoulder_l", [kf(0), kf(200,0,-4,50), kf(500,0,-5,55), kf(900,0,-2,25), kf(1200)]),
        tr("shoulder_r", [kf(0), kf(200,0,-4,-50), kf(500,0,-5,-55), kf(900,0,-2,-25), kf(1200)]),
        tr("elbow_l", [kf(0), kf(200,0,0,-30), kf(500,0,0,-35), kf(900,0,0,-15), kf(1200)]),
        tr("elbow_r", [kf(0), kf(200,0,0,30), kf(500,0,0,35), kf(900,0,0,15), kf(1200)]),
      ])],
    },
    {
      id: id("charge"), name: "charge", label: "Charge",
      skeletonFamily: family, durationMs: 500, fps: 12, loops: true,
      layers: [
        ly("lower_body", [
          tr("root", [kf(0,0,-4), kf(125,0,-2), kf(250,0,-4), kf(375,0,-2), kf(500,0,-4)]),
          tr("hip_l", [kf(0,0,0,-55), kf(125,0,0,0), kf(250,0,0,45), kf(375,0,0,0), kf(500,0,0,-55)]),
          tr("hip_r", [kf(0,0,0,45), kf(125,0,0,0), kf(250,0,0,-55), kf(375,0,0,0), kf(500,0,0,45)]),
          tr("knee_l", [kf(0,0,0,35), kf(250,0,0,-15), kf(500,0,0,35)]),
          tr("knee_r", [kf(0,0,0,-15), kf(250,0,0,35), kf(500,0,0,-15)]),
        ]),
        ly("upper_body", [
          tr("spine", [kf(0,0,0,-15), kf(500,0,0,-15)]),
          tr("chest", [kf(0,0,0,-12), kf(500,0,0,-12)]),
          tr("shoulder_l", [kf(0,0,0,35), kf(500,0,0,35)]),
          tr("shoulder_r", [kf(0,0,0,-35), kf(500,0,0,-35)]),
        ]),
      ],
    },
  ];
}

// ── Siege clips ────────────────────────────────────────────────────────────────
// Bone IDs: root, base, arm_main, arm_counter
const SIEGE_CLIPS: AnimationClip[] = [
  {
    id: "siege_idle", name: "idle", label: "Idle",
    skeletonFamily: "siege_static_v1", durationMs: 3000, fps: 12, loops: true,
    layers: [ly("full_body", [
      tr("arm_main", [kf(0), kf(750,0,0,2), kf(1500), kf(2250,0,0,-2), kf(3000)]),
      tr("arm_counter", [kf(0), kf(750,0,0,-2), kf(1500), kf(2250,0,0,2), kf(3000)]),
      tr("base", [kf(0), kf(1500,0,-1), kf(3000)]),
    ])],
  },
  {
    id: "siege_fire", name: "fire", label: "Fire",
    skeletonFamily: "siege_static_v1", durationMs: 1400, fps: 12, loops: false,
    layers: [ly("full_body", [
      tr("arm_main", [kf(0), kf(300,0,0,-20), kf(500,0,0,-150), kf(700,0,0,-160), kf(1000,0,0,-155), kf(1400,0,0,-5)]),
      tr("arm_counter", [kf(0), kf(300,0,0,20), kf(500,0,0,150), kf(700,0,0,160), kf(1000,0,0,155), kf(1400,0,0,5)]),
      tr("base", [kf(0), kf(500,0,0,-5), kf(700,0,4,-6), kf(1400,0,0,0)]),
    ])],
  },
  {
    id: "siege_open", name: "open", label: "Open",
    skeletonFamily: "siege_static_v1", durationMs: 800, fps: 12, loops: false,
    layers: [ly("full_body", [
      tr("arm_main", [kf(0), kf(400,0,-8,-55), kf(700,0,-10,-60), kf(800,0,-10,-60)]),
    ])],
  },
  {
    id: "siege_close", name: "close", label: "Close",
    skeletonFamily: "siege_static_v1", durationMs: 800, fps: 12, loops: false,
    layers: [ly("full_body", [
      tr("arm_main", [kf(0,0,-10,-60), kf(400,0,-4,-30), kf(700,0,0,0), kf(800)]),
    ])],
  },
];

// ── Item own-animation clips (cloak, boomerang) ───────────────────────────────
export const ITEM_ANIMATION_CLIPS: AnimationClip[] = [
  {
    id: "item_cloak_flap", name: "item_cloak_flap", label: "Cloak Flap",
    skeletonFamily: "humanoid_topdown_v1", durationMs: 600, fps: 12, loops: true,
    layers: [ly("additive", [
      tr("chest", [kf(0), kf(150,1,0,3), kf(300,0,0,0), kf(450,-1,0,-3), kf(600)]),
    ])],
  },
  {
    id: "item_boomerang_spin", name: "item_boomerang_spin", label: "Boomerang Spin",
    skeletonFamily: "humanoid_topdown_v1", durationMs: 200, fps: 24, loops: true,
    layers: [ly("additive", [
      tr("hand_r", [kf(0,0,0,0), kf(100,0,0,180), kf(200,0,0,360)]),
    ])],
  },
];

// ── Assembled exports ─────────────────────────────────────────────────────────
const HUMANOID_TOPDOWN_CLIPS = makeHumanoidClips("humanoid_topdown_v1");
const HUMANOID_SIDE_CLIPS    = makeHumanoidClips("humanoid_side_v1");
const MONSTER_CLIPS          = makeHumanoidClips("humanoid_monster_v1", makeMonsterExtras());

export const PRESET_ANIMATIONS: AnimationClip[] = [
  ...HUMANOID_TOPDOWN_CLIPS,
  ...HUMANOID_SIDE_CLIPS,
  ...MONSTER_CLIPS,
  ...QUADRUPED_CLIPS,
  ...BIRD_CLIPS,
  ...SIEGE_CLIPS,
  ...ITEM_ANIMATION_CLIPS,
];

export function getClipsByFamily(family: SkeletonFamilyId): AnimationClip[] {
  return PRESET_ANIMATIONS.filter(c => c.skeletonFamily === family);
}

export function getClipById(id: string): AnimationClip | undefined {
  return PRESET_ANIMATIONS.find(c => c.id === id);
}

export const CLIP_GROUPS: Record<string, { label: string; clipNames: string[] }> = {
  humanoid_topdown_v1: {
    label: "Humanoid (Top-Down)",
    clipNames: [
      "idle_full",
      "idle_01_relaxed", "idle_02_breathing", "idle_03_shifting",
      "idle_04_look_around", "idle_05_scratch", "idle_06_sway",
      "idle_07_combat_ready", "idle_08_tense", "idle_09_bored",
      "idle_10_alert", "idle_11_fidget", "idle_12_roll_shoulders",
      "idle_13_tap_foot", "idle_14_cross_arms", "idle_15_lean",
      "walk", "run", "melee_attack", "ranged_attack",
      "cast", "block", "hurt", "stagger", "death",
      "sit", "interact", "farm_work", "carry",
    ],
  },
};
