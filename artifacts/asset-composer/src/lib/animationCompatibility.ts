import { PRESET_ANIMATIONS } from "@/data/presetAnimations";
import { PRESET_STATE_MACHINES } from "@/data/presetStateMachines";
import type { AnimationClip, StateMachine, Template } from "@/domain/types";
import { templateMatchesCompatibilityFamily } from "@/lib/templateCompatibility";

export function templateSupportsAnimationFamily(template: Template, family: string): boolean {
  return templateMatchesCompatibilityFamily(template, family);
}

export function getClipsForTemplate(
  template: Template,
  clips: AnimationClip[] = PRESET_ANIMATIONS,
): AnimationClip[] {
  return clips.filter(clip => templateSupportsAnimationFamily(template, clip.skeletonFamily));
}

export function getLoopingClipForTemplate(
  template: Template,
  clips: AnimationClip[],
): AnimationClip | null {
  return getClipsForTemplate(template, clips).find(clip => clip.loops) ?? null;
}

export function getStateMachineForTemplate(
  template: Template,
  stateMachines: StateMachine[] = PRESET_STATE_MACHINES,
): StateMachine | null {
  return stateMachines.find(machine => templateSupportsAnimationFamily(template, machine.skeletonFamily)) ?? null;
}
