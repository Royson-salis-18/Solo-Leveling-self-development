import type { CompleteResult, FailResult } from "./gameTypes";

export type Feedback = { title: string; message: string; kind: "success" | "info" | "error" };

/** Turn a complete_gate result into the toast the player sees. Pure, so it's unit-tested. */
export function describeCompletion(r: CompleteResult): Feedback {
  if (r.already) {
    return { kind: "info", title: "Already conquered", message: "This gate was already resolved." };
  }
  const xp = r.xp;
  if (!xp) return { kind: "success", title: "Gate conquered", message: "" };
  if (!xp.paid) {
    return { kind: "info", title: "Gate re-conquered", message: "No XP: a gate pays out only once." };
  }

  const parts: string[] = [];
  parts.push(xp.applied === xp.earned ? `+${xp.earned} XP` : `+${xp.applied} XP (of ${xp.earned})`);
  if (xp.absorbed_by_dark_mana > 0) parts.push(`${xp.absorbed_by_dark_mana} cleared Dark Mana`);
  if (xp.capped) parts.push(xp.earned === 0 ? "E-rank daily cap reached" : "E-rank cap applied");
  if (xp.arise_bonus > 0) parts.push(`ARISE +${xp.arise_bonus}`);
  if (xp.burst > 0) parts.push(`Burst +${xp.burst}`);
  if (xp.multipliers.flow > 1) parts.push(`Flow ×${xp.multipliers.flow}`);
  if (xp.multipliers.boost > 1) parts.push(`Boost ×${xp.multipliers.boost}`);
  if (xp.multipliers.resonance > 1) parts.push(`Shadows +${Math.round((xp.multipliers.resonance - 1) * 100)}%`);
  return { kind: "success", title: "Gate conquered", message: parts.join(" · ") };
}

export function describeFailure(r: FailResult): Feedback {
  if (r.already) return { kind: "info", title: "Already resolved", message: "This gate was already closed." };
  const parts = [`−${r.penalty} XP`];
  if (r.redemption_spawned) parts.push("a redemption gate was offered");
  return { kind: "error", title: "Gate failed", message: parts.join(" · ") };
}

/** Friendly label for a streak number. */
export function streakLabel(n: number): string {
  if (n <= 0) return "No streak";
  return `${n}-day streak`;
}
