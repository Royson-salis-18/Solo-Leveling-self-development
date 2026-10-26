/**
 * Client-side mirror of the server's gate-creation rules (supabase …_game_engine.sql: save_gate),
 * used only to guide the UI — the server stays the authority and re-validates everything.
 *   • no deadline            → forced to E-rank
 *   • deadline (date)        → local 23:59 of that day must be ≥ now + the tier's preparation buffer
 */
export type TierId = "Low" | "Mid" | "High" | "Super" | "Legendary";

export const TIER_INFO: Array<{ id: TierId; rank: string; xp: number; bufferMin: number }> = [
  { id: "Low", rank: "E", xp: 5, bufferMin: 30 },
  { id: "Mid", rank: "C", xp: 15, bufferMin: 60 },
  { id: "High", rank: "B", xp: 25, bufferMin: 120 },
  { id: "Super", rank: "A", xp: 35, bufferMin: 240 },
  { id: "Legendary", rank: "S", xp: 50, bufferMin: 480 },
];

export const RANK_OF: Record<string, string> = Object.fromEntries(TIER_INFO.map((t) => [t.id, t.rank]));

export function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12, 0, 0);
  return x;
}

/** Minutes between `now` and the end of the deadline day (23:59 local). Negative if already past. */
export function minutesLeft(deadlineIso: string, now: Date = new Date()): number {
  const [y, m, d] = deadlineIso.split("-").map(Number);
  const cut = new Date(y, m - 1, d, 23, 59, 0);
  return Math.floor((cut.getTime() - now.getTime()) / 60000);
}

export type TierState = { id: TierId; rank: string; xp: number; ok: boolean; reason?: string };

/** Which ranks can be chosen for this deadline, and why not when they can't. */
export function tierStates(deadlineIso: string | null, now: Date = new Date()): TierState[] {
  return TIER_INFO.map((t) => {
    if (deadlineIso === null) {
      return t.id === "Low" ? { ...t, ok: true } : { ...t, ok: false, reason: "Add a deadline to unlock higher ranks" };
    }
    const left = minutesLeft(deadlineIso, now);
    if (left < t.bufferMin) {
      const need = t.bufferMin >= 60 ? `${t.bufferMin / 60}h` : `${t.bufferMin}m`;
      return { ...t, ok: false, reason: `${t.rank}-rank needs ${need} of preparation before the deadline` };
    }
    return { ...t, ok: true };
  });
}

/** Best allowed tier at or below the requested one (so changing the deadline never leaves an invalid pick). */
export function clampTier(want: TierId, deadlineIso: string | null, now: Date = new Date()): TierId {
  const states = tierStates(deadlineIso, now);
  const idx = TIER_INFO.findIndex((t) => t.id === want);
  for (let i = idx; i >= 0; i--) if (states[i].ok) return states[i].id;
  return "Low";
}

export type RepeatKind = "none" | "daily" | "weekly";

/** Recurrence fields for the server payload (weekly repeats on the deadline's weekday). */
export function repeatPayload(kind: RepeatKind, deadlineIso: string | null): Record<string, unknown> {
  if (kind === "none" || !deadlineIso) return { is_recurring: false, recurrence_type: "none" };
  if (kind === "daily") return { is_recurring: true, recurrence_type: "daily", recurrence_interval: 1 };
  const [y, m, d] = deadlineIso.split("-").map(Number);
  return { is_recurring: true, recurrence_type: "weekly", recurrence_interval: 1, recurrence_days: [new Date(y, m - 1, d, 12).getDay()] };
}
