import type { AnimationClip, AnimationLayer, KeyframeTrack, Keyframe, BoneTransform, LayerMask } from "@/domain/types";

export type BoneTransformMap = Map<string, BoneTransform>;

const ZERO_TRANSFORM: BoneTransform = { tx: 0, ty: 0, rotation: 0, scaleX: 1, scaleY: 1 };

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpTransform(a: BoneTransform, b: BoneTransform, t: number): BoneTransform {
  return {
    tx: lerp(a.tx, b.tx, t),
    ty: lerp(a.ty, b.ty, t),
    rotation: lerp(a.rotation, b.rotation, t),
    scaleX: lerp(a.scaleX, b.scaleX, t),
    scaleY: lerp(a.scaleY, b.scaleY, t),
  };
}

export function getTrackTransformAt(track: KeyframeTrack, timeMs: number): BoneTransform {
  const kfs = track.keyframes;
  if (!kfs.length) return { ...ZERO_TRANSFORM };
  if (timeMs <= kfs[0].timeMs) return { ...kfs[0].transform };
  const last = kfs[kfs.length - 1];
  if (timeMs >= last.timeMs) return { ...last.transform };
  for (let i = 0; i < kfs.length - 1; i++) {
    const kfA = kfs[i];
    const kfB = kfs[i + 1];
    if (timeMs >= kfA.timeMs && timeMs <= kfB.timeMs) {
      const span = kfB.timeMs - kfA.timeMs;
      const alpha = span === 0 ? 0 : (timeMs - kfA.timeMs) / span;
      return lerpTransform(kfA.transform, kfB.transform, alpha);
    }
  }
  return { ...ZERO_TRANSFORM };
}

export function resolveLayerPose(layer: AnimationLayer, timeMs: number): BoneTransformMap {
  const map: BoneTransformMap = new Map();
  for (const track of layer.tracks) {
    map.set(track.boneId, getTrackTransformAt(track, timeMs));
  }
  return map;
}

const UPPER_BONES = new Set([
  "spine", "chest", "neck", "head",
  "shoulder_l", "elbow_l", "hand_l",
  "shoulder_r", "elbow_r", "hand_r",
  "claw_l", "claw_r", "jaw", "horn_l", "horn_r",
]);

const LOWER_BONES = new Set([
  "root", "pelvis", "spine",
  "hip_l", "knee_l", "foot_l", "toe_l",
  "hip_r", "knee_r", "foot_r", "toe_r",
  "tail_base", "tail_mid", "tail_tip",
  "front_hip_l", "front_knee_l", "front_foot_l",
  "front_hip_r", "front_knee_r", "front_foot_r",
  "rear_hip_l",  "rear_knee_l",  "rear_foot_l",
  "rear_hip_r",  "rear_knee_r",  "rear_foot_r",
  "wing_l_base", "wing_l_mid", "wing_l_tip",
  "wing_r_base", "wing_r_mid", "wing_r_tip",
]);

function boneMatchesMask(boneId: string, mask: LayerMask): boolean {
  if (mask === "full_body" || mask === "additive") return true;
  if (mask === "upper_body") return UPPER_BONES.has(boneId);
  if (mask === "lower_body") return LOWER_BONES.has(boneId);
  return true;
}

export function resolveClipPose(clip: AnimationClip, timeMs: number): BoneTransformMap {
  const wrappedTime = clip.loops && clip.durationMs > 0
    ? timeMs % clip.durationMs
    : Math.min(timeMs, clip.durationMs);

  const result: BoneTransformMap = new Map();

  for (const layer of clip.layers) {
    const layerPose = resolveLayerPose(layer, wrappedTime);
    for (const [boneId, transform] of layerPose) {
      if (!boneMatchesMask(boneId, layer.mask as LayerMask)) continue;
      const existing = result.get(boneId);
      if (!existing) {
        result.set(boneId, transform);
      } else if (layer.mask === "additive") {
        result.set(boneId, {
          tx: existing.tx + transform.tx,
          ty: existing.ty + transform.ty,
          rotation: existing.rotation + transform.rotation,
          scaleX: existing.scaleX * transform.scaleX,
          scaleY: existing.scaleY * transform.scaleY,
        });
      } else {
        result.set(boneId, transform);
      }
    }
  }
  return result;
}

export function blendPoses(
  lower: BoneTransformMap,
  upper: BoneTransformMap,
  spineBlend = 1.0,
): BoneTransformMap {
  const out: BoneTransformMap = new Map(lower);
  for (const [boneId, upperT] of upper) {
    const lowerT = lower.get(boneId);
    if (!lowerT) {
      out.set(boneId, upperT);
    } else {
      const alpha = UPPER_BONES.has(boneId) ? 1.0 : boneId === "spine" ? spineBlend : 0.0;
      out.set(boneId, lerpTransform(lowerT, upperT, alpha));
    }
  }
  return out;
}

export function getClipDurationFrames(clip: AnimationClip): number {
  return Math.round((clip.durationMs / 1000) * clip.fps);
}

export function timeMsToFrame(timeMs: number, fps: number): number {
  return Math.round((timeMs / 1000) * fps);
}

export function frameToTimeMs(frame: number, fps: number): number {
  return (frame / fps) * 1000;
}

export function getAllBoneIds(clip: AnimationClip): string[] {
  const ids = new Set<string>();
  for (const layer of clip.layers) {
    for (const track of layer.tracks) {
      ids.add(track.boneId);
    }
  }
  return Array.from(ids);
}

export function getKeyframesForBone(clip: AnimationClip, boneId: string): Keyframe[] {
  for (const layer of clip.layers) {
    for (const track of layer.tracks) {
      if (track.boneId === boneId) return track.keyframes;
    }
  }
  return [];
}
