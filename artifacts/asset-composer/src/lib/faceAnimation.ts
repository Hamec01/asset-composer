import type { FaceFeatureConfig } from "@/domain/types";
import type { AnimationContext } from "./animationContext";

export const DEFAULT_BLINK = {
  enabled: true,
  intervalMs: 2600,
  durationMs: 180,
};
export const DEFAULT_MOUTH_MOTION = { enabled: false, periodMs: 650 };

/** An optional repeatable open/close cycle, not audio lip sync. */
export function mouthOpennessAt(
  config: FaceFeatureConfig,
  context?: AnimationContext,
): number | undefined {
  if (!config.mouthMotion?.enabled || !context) return config.mouthOpenness;
  const phase =
    (((context.timeMs % config.mouthMotion.periodMs) +
      config.mouthMotion.periodMs) %
      config.mouthMotion.periodMs) /
    config.mouthMotion.periodMs;
  return (config.mouthOpenness ?? 1) * Math.sin(Math.PI * phase) ** 2;
}
/** Timeline-driven, deterministic and independent of renderer wall-clock time. */
export function eyeOpennessAt(
  config: FaceFeatureConfig,
  context?: AnimationContext,
): number {
  const base = Math.max(0, Math.min(1, config.eyeOpenness ?? 1));
  if (!context || !config.blink?.enabled) return base;
  const interval = Math.max(600, config.blink.intervalMs),
    duration = Math.min(interval * 0.5, Math.max(80, config.blink.durationMs));
  const center = Math.min(1100, context.clip.durationMs * 0.6);
  const distance =
    ((((context.timeMs - center + interval / 2) % interval) + interval) %
      interval) -
    interval / 2;
  if (Math.abs(distance) >= duration / 2) return base;
  // Close quickly, hold briefly, then open more gently. No scaling of the iris.
  const phase = (distance + duration / 2) / duration;
  const opening =
    phase < 0.4 ? 1 - phase / 0.4 : phase < 0.55 ? 0 : (phase - 0.55) / 0.45;
  return base * Math.max(0, Math.min(1, opening));
}

export function eyelidArt(openness: number, ink: string): string {
  const top = 4 - 3.5 * openness,
    bottom = 4 + 3.5 * openness;
  if (openness <= 0.025)
    return `<path d="M-3.6 3.7 Q0 5.2 3.6 3.7" fill="none" stroke="${ink}" stroke-width=".65" stroke-linecap="round"/>`;
  return `<path d="M-3.6 4 Q0 ${2 * top - 4} 3.6 4 M-3.6 4 Q0 ${2 * bottom - 4} 3.6 4" fill="none" stroke="${ink}" stroke-width=".45" stroke-linecap="round"/>`;
}

export function clipEyeArt(
  art: string,
  openness: number,
  id: string,
  ink: string,
): string {
  if (openness >= 0.999) return art;
  if (openness <= 0.025) return eyelidArt(0, ink);
  const top = 4 - 3.5 * openness,
    bottom = 4 + 3.5 * openness;
  return `<defs><clipPath id="${id}"><path d="M-3.8 4 Q0 ${2 * top - 4} 3.8 4 Q0 ${2 * bottom - 4} -3.8 4Z"/></clipPath></defs><g clip-path="url(#${id})">${art}</g>${eyelidArt(openness, ink)}`;
}
