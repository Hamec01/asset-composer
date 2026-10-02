import type { Bone } from "@/domain/types";

export const bipedProfileChibiBones: Bone[] = [
  { id: "root", name: "Root", parentId: null, restPose: { tx: 0, ty: 0, rotation: 0, scaleX: 1, scaleY: 1 }, length: 10 },
  { id: "pelvis", name: "Pelvis", parentId: "root", restPose: { tx: 0, ty: -2, rotation: 0, scaleX: 1, scaleY: 1 }, length: 11 },
  { id: "spine", name: "Spine", parentId: "pelvis", restPose: { tx: 0, ty: -15, rotation: 0, scaleX: 1, scaleY: 1 }, length: 15 },
  { id: "chest", name: "Chest", parentId: "spine", restPose: { tx: 0, ty: -17, rotation: 0, scaleX: 1, scaleY: 1 }, length: 13 },
  { id: "neck", name: "Neck", parentId: "chest", restPose: { tx: 0, ty: -10, rotation: 0, scaleX: 1, scaleY: 1 }, length: 5 },
  { id: "head", name: "Head", parentId: "neck", restPose: { tx: 0, ty: -9, rotation: 0, scaleX: 1, scaleY: 1 }, length: 18 },
  { id: "shoulder_l", name: "Shoulder L", parentId: "chest", restPose: { tx: -16, ty: -1, rotation: 0, scaleX: 1, scaleY: 1 }, length: 11 },
  { id: "elbow_l", name: "Elbow L", parentId: "shoulder_l", restPose: { tx: 0, ty: 15, rotation: 0, scaleX: 1, scaleY: 1 }, length: 10 },
  { id: "hand_l", name: "Hand L", parentId: "elbow_l", restPose: { tx: 0, ty: 13, rotation: 0, scaleX: 1, scaleY: 1 }, length: 7 },
  { id: "shoulder_r", name: "Shoulder R", parentId: "chest", restPose: { tx: 16, ty: -1, rotation: 0, scaleX: 1, scaleY: 1 }, length: 11 },
  { id: "elbow_r", name: "Elbow R", parentId: "shoulder_r", restPose: { tx: 0, ty: 15, rotation: 0, scaleX: 1, scaleY: 1 }, length: 10 },
  { id: "hand_r", name: "Hand R", parentId: "elbow_r", restPose: { tx: 0, ty: 13, rotation: 0, scaleX: 1, scaleY: 1 }, length: 7 },
  { id: "hip_l", name: "Hip L", parentId: "pelvis", restPose: { tx: -7, ty: 5, rotation: 0, scaleX: 1, scaleY: 1 }, length: 11 },
  { id: "knee_l", name: "Knee L", parentId: "hip_l", restPose: { tx: 0, ty: 13, rotation: 0, scaleX: 1, scaleY: 1 }, length: 10 },
  { id: "foot_l", name: "Foot L", parentId: "knee_l", restPose: { tx: 0, ty: 10, rotation: 0, scaleX: 1, scaleY: 1 }, length: 7 },
  { id: "hip_r", name: "Hip R", parentId: "pelvis", restPose: { tx: 7, ty: 5, rotation: 0, scaleX: 1, scaleY: 1 }, length: 11 },
  { id: "knee_r", name: "Knee R", parentId: "hip_r", restPose: { tx: 0, ty: 13, rotation: 0, scaleX: 1, scaleY: 1 }, length: 10 },
  { id: "foot_r", name: "Foot R", parentId: "knee_r", restPose: { tx: 0, ty: 10, rotation: 0, scaleX: 1, scaleY: 1 }, length: 7 },
];
