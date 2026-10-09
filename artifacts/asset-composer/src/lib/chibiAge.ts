import type { Bone, CharacterAppearance } from '@/domain/types';

export const TOKEN_AGES = [
  { value: 'child', label: 'Ребёнок' }, { value: 'teen', label: 'Подросток' },
  { value: 'adult', label: 'Взрослый' }, { value: 'elder', label: 'Пожилой' },
] as const;
export type TokenAge = typeof TOKEN_AGES[number]['value'];
export function tokenAgeAllowsBeard(age: TokenAge = 'adult') { return age === 'adult' || age === 'elder'; }

/** Apply only to the token rig. Attachments inherit the same real bone matrices. */
export function tokenAgeRestPose(bone: Bone, appearance?: CharacterAppearance, tokenRig = false) {
  const pose = { ...bone.restPose };
  if (!tokenRig) return pose;
  const age = appearance?.tokenAge ?? 'adult';
  const size = age === 'child' ? .7 : age === 'teen' ? .86 : 1;
  if (bone.id === 'root') { pose.scaleX *= size; pose.scaleY *= size; }
  if (bone.id === 'chest' && age === 'child') { pose.scaleX *= .9; pose.scaleY *= .78; }
  if (bone.id === 'head' && age === 'child') { pose.scaleX *= 1.3; pose.scaleY *= 1.42; pose.ty -= 8; }
  if (bone.id === 'head' && age === 'teen') { pose.scaleX *= 1.06; pose.scaleY *= 1.06; }
  if (bone.id === 'chest' && age === 'elder') pose.rotation += 4;
  return pose;
}
