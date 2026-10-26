/**
 * Small, shared feedback primitives: haptics on touch devices and a floating "+XP" cue.
 * Everything here is optional polish — it never throws and respects reduced-motion.
 */
export const XP_GAIN_EVENT = "solo-leveling:xp-gain";

type Pattern = "tap" | "success" | "reward" | "warn";
const PATTERNS: Record<Pattern, number | number[]> = { tap: 8, success: [12, 40, 18], reward: [20, 50, 20, 50, 40], warn: [30, 60, 30] };

export function haptic(kind: Pattern = "tap"): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(PATTERNS[kind]);
  } catch { /* unsupported / blocked */ }
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function announceXp(xp: number, label?: string): void {
  if (typeof window === "undefined" || xp <= 0) return;
  window.dispatchEvent(new CustomEvent(XP_GAIN_EVENT, { detail: { xp, label } }));
}

/** Steps that take a brand-new hunter from zero to their first reward (endowed-progress checklist). */
export type FirstStep = { key: "gate" | "conquer" | "cache"; title: string; hint: string; done: boolean };

export function firstSteps(input: { openGates: number; trophiesUnlocked: number; chestClaimed: boolean; conquestsToday: number }): { steps: FirstStep[]; complete: boolean; doneCount: number } {
  const conquered = input.trophiesUnlocked > 0 || input.conquestsToday > 0;       // "First Gate" trophy / any conquest today
  const steps: FirstStep[] = [
    { key: "gate", title: "Open your first gate", hint: "Type a task above and pick its rank.", done: input.openGates > 0 || conquered },
    { key: "conquer", title: "Conquer it", hint: "Tap the circle when it's done to earn XP.", done: conquered },
    { key: "cache", title: "Clear 2 daily quests", hint: "Then open your first quest cache.", done: input.chestClaimed },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  return { steps, complete: doneCount === steps.length, doneCount };
}
