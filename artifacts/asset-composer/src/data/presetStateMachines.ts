import type { StateMachine, SkeletonFamilyId } from "@/domain/types";

function sm(
  family: SkeletonFamilyId,
  suffix: string,
  entryStateId: string,
  states: StateMachine["states"],
  transitions: StateMachine["transitions"],
): StateMachine {
  return { id: `sm_${family}_${suffix}`, name: `Default — ${family}`, skeletonFamily: family, entryStateId, states, transitions };
}

function st(id: string, clipId: string, speed = 1, loop = true): StateMachine["states"][number] {
  return { id, clipId, speed, loop };
}

function tx(id: string, from: string, to: string, condition: string, durationMs = 150, priority = 0): StateMachine["transitions"][number] {
  return { id, fromStateId: from, toStateId: to, condition, durationMs, priority };
}

// ── Humanoid Top-Down ─────────────────────────────────────────────────────────
const humanoidTopdownSM = sm(
  "humanoid_topdown_v1", "default",
  "idle",
  [
    st("idle",    "humanoid_topdown_v1__idle_full", 1, true),
    st("walk",    "humanoid_topdown_v1__walk",       1, true),
    st("run",     "humanoid_topdown_v1__run",         1, true),
    st("attack",  "humanoid_topdown_v1__melee_attack", 1, false),
    st("cast",    "humanoid_topdown_v1__cast",         1, false),
    st("block",   "humanoid_topdown_v1__block",        1, false),
    st("hurt",    "humanoid_topdown_v1__hurt",          1, false),
    st("stagger", "humanoid_topdown_v1__stagger",       1, false),
    st("death",   "humanoid_topdown_v1__death",         1, false),
  ],
  [
    tx("idle_to_walk",    "idle",    "walk",    "velocity > 0",    200),
    tx("walk_to_idle",    "walk",    "idle",    "velocity == 0",   200),
    tx("walk_to_run",     "walk",    "run",     "velocity > 3",    150),
    tx("run_to_walk",     "run",     "walk",    "velocity <= 3",   150),
    tx("any_to_attack",   "*",       "attack",  "attack_trigger",  80, 10),
    tx("attack_to_idle",  "attack",  "idle",    "clip_end",        150),
    tx("any_to_cast",     "*",       "cast",    "cast_trigger",    80, 10),
    tx("cast_to_idle",    "cast",    "idle",    "clip_end",        150),
    tx("any_to_block",    "*",       "block",   "block_held",      80, 5),
    tx("block_to_idle",   "block",   "idle",    "!block_held",     150),
    tx("any_to_hurt",     "*",       "hurt",    "hit",             50, 20),
    tx("hurt_to_idle",    "hurt",    "idle",    "timer > 0.5",     150),
    tx("hurt_to_stagger", "hurt",    "stagger", "hp < 30",         80),
    tx("stagger_to_idle", "stagger", "idle",    "timer > 0.6",     200),
    tx("any_to_death",    "*",       "death",   "hp <= 0",         80, 100),
  ],
);

// ── Humanoid Side ─────────────────────────────────────────────────────────────
const humanoidSideSM = sm(
  "humanoid_side_v1", "default",
  "idle",
  [
    st("idle",   "humanoid_side_v1__idle_full", 1, true),
    st("walk",   "humanoid_side_v1__walk",       1, true),
    st("run",    "humanoid_side_v1__run",         1, true),
    st("attack", "humanoid_side_v1__melee_attack", 1, false),
    st("hurt",   "humanoid_side_v1__hurt",          1, false),
    st("death",  "humanoid_side_v1__death",          1, false),
  ],
  [
    tx("idle_to_walk",   "idle",   "walk",   "velocity > 0",   200),
    tx("walk_to_idle",   "walk",   "idle",   "velocity == 0",  200),
    tx("walk_to_run",    "walk",   "run",    "velocity > 3",   150),
    tx("run_to_walk",    "run",    "walk",   "velocity <= 3",  150),
    tx("any_to_attack",  "*",      "attack", "attack_trigger", 80, 10),
    tx("attack_to_idle", "attack", "idle",   "clip_end",       150),
    tx("any_to_hurt",    "*",      "hurt",   "hit",            50, 20),
    tx("hurt_to_idle",   "hurt",   "idle",   "timer > 0.5",    150),
    tx("any_to_death",   "*",      "death",  "hp <= 0",        80, 100),
  ],
);

// ── Monster Humanoid ──────────────────────────────────────────────────────────
const monsterSM = sm(
  "humanoid_monster_v1", "default",
  "idle",
  [
    st("idle",    "humanoid_monster_v1__idle_full",     1, true),
    st("walk",    "humanoid_monster_v1__walk",           1, true),
    st("run",     "humanoid_monster_v1__run",             1, true),
    st("charge",  "humanoid_monster_v1__charge",          1.2, true),
    st("attack",  "humanoid_monster_v1__melee_attack",    1, false),
    st("roar",    "humanoid_monster_v1__roar",             0.9, false),
    st("hurt",    "humanoid_monster_v1__hurt",              1, false),
    st("death",   "humanoid_monster_v1__death",             0.8, false),
  ],
  [
    tx("idle_to_walk",    "idle",    "walk",    "velocity > 0",    200),
    tx("walk_to_idle",    "walk",    "idle",    "velocity == 0",   200),
    tx("idle_to_roar",    "idle",    "roar",    "roar_trigger",    100),
    tx("roar_to_idle",    "roar",    "idle",    "clip_end",        200),
    tx("any_to_charge",   "*",       "charge",  "charge_trigger",  100, 5),
    tx("charge_to_attack","charge",  "attack",  "attack_trigger",  80, 10),
    tx("attack_to_idle",  "attack",  "idle",    "clip_end",        150),
    tx("any_to_hurt",     "*",       "hurt",    "hit",             50, 20),
    tx("hurt_to_idle",    "hurt",    "idle",    "timer > 0.5",     200),
    tx("any_to_death",    "*",       "death",   "hp <= 0",         80, 100),
  ],
);

// ── Quadruped ─────────────────────────────────────────────────────────────────
const quadrupedSM = sm(
  "quadruped_side_v1", "default",
  "idle",
  [
    st("idle",   "quad_idle",   1, true),
    st("walk",   "quad_walk",   1, true),
    st("trot",   "quad_trot",   1, true),
    st("gallop", "quad_gallop", 1, true),
    st("rear",   "quad_rear",   1, false),
    st("bite",   "quad_bite",   1, false),
    st("hurt",   "quad_hurt",   1, false),
    st("death",  "quad_death",  1, false),
  ],
  [
    tx("idle_to_walk",    "idle",   "walk",   "velocity > 0",    200),
    tx("walk_to_idle",    "walk",   "idle",   "velocity == 0",   200),
    tx("walk_to_trot",    "walk",   "trot",   "velocity > 2",    150),
    tx("trot_to_walk",    "trot",   "walk",   "velocity <= 2",   150),
    tx("trot_to_gallop",  "trot",   "gallop", "velocity > 5",    150),
    tx("gallop_to_trot",  "gallop", "trot",   "velocity <= 5",   200),
    tx("idle_to_rear",    "idle",   "rear",   "rear_trigger",    100),
    tx("rear_to_idle",    "rear",   "idle",   "clip_end",        250),
    tx("any_to_bite",     "*",      "bite",   "attack_trigger",  80, 10),
    tx("bite_to_idle",    "bite",   "idle",   "clip_end",        150),
    tx("any_to_hurt",     "*",      "hurt",   "hit",             50, 20),
    tx("hurt_to_idle",    "hurt",   "idle",   "timer > 0.6",     200),
    tx("any_to_death",    "*",      "death",  "hp <= 0",         80, 100),
  ],
);

// ── Bird ──────────────────────────────────────────────────────────────────────
const birdSM = sm(
  "bird_side_v1", "default",
  "idle",
  [
    st("idle",  "bird_idle",  1, true),
    st("flap",  "bird_flap",  1, true),
    st("glide", "bird_glide", 1, true),
    st("peck",  "bird_peck",  1, false),
    st("hurt",  "bird_hurt",  1, false),
    st("death", "bird_death", 1, false),
  ],
  [
    tx("idle_to_flap",  "idle",  "flap",  "airborne",        200),
    tx("flap_to_glide", "flap",  "glide", "velocity > 4",    300),
    tx("glide_to_flap", "glide", "flap",  "velocity <= 4",   200),
    tx("flap_to_idle",  "flap",  "idle",  "!airborne",       300),
    tx("idle_to_peck",  "idle",  "peck",  "attack_trigger",  80, 10),
    tx("peck_to_idle",  "peck",  "idle",  "clip_end",        150),
    tx("any_to_hurt",   "*",     "hurt",  "hit",             50, 20),
    tx("hurt_to_idle",  "hurt",  "idle",  "timer > 0.5",     150),
    tx("any_to_death",  "*",     "death", "hp <= 0",         80, 100),
  ],
);

// ── Siege/Static ──────────────────────────────────────────────────────────────
const siegeSM = sm(
  "siege_static_v1", "default",
  "idle",
  [
    st("idle",  "siege_idle",  1, true),
    st("fire",  "siege_fire",  1, false),
    st("open",  "siege_open",  1, false),
    st("closed","siege_close", 1, false),
  ],
  [
    tx("idle_to_fire",  "idle",   "fire",   "fire_trigger",   50, 10),
    tx("fire_to_idle",  "fire",   "idle",   "clip_end",       200),
    tx("idle_to_open",  "idle",   "open",   "open_trigger",   100),
    tx("open_to_idle",  "open",   "idle",   "clip_end",       200),
    tx("idle_to_close", "idle",   "closed", "close_trigger",  100),
    tx("close_to_idle", "closed", "idle",   "clip_end",       200),
  ],
);

export const PRESET_STATE_MACHINES: StateMachine[] = [
  humanoidTopdownSM,
  humanoidSideSM,
  monsterSM,
  quadrupedSM,
  birdSM,
  siegeSM,
];

export function getStateMachineByFamily(family: SkeletonFamilyId): StateMachine | undefined {
  return PRESET_STATE_MACHINES.find(sm => sm.skeletonFamily === family);
}
