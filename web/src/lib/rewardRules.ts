/**
 * Client mirror of the server's reward rules (supabase …_foundation.sql: reward_tiers, claim_reward).
 * Used only to explain *why* something is locked before the player taps; the server re-checks everything.
 */
export const RANK_ORDER = ["E", "D", "C", "B", "A", "S", "SS"] as const;
export const rankIndex = (r: string | null | undefined) => Math.max(0, (RANK_ORDER as readonly string[]).indexOf(r ?? "E"));

export type TierRule = { tier: string; name: string; streak: number; rank: string; blocksOnDarkMana: boolean; needsTrigger: boolean };
export const REWARD_TIERS: TierRule[] = [
  { tier: "1", name: "Indulgence", streak: 3, rank: "E", blocksOnDarkMana: false, needsTrigger: false },
  { tier: "2", name: "Comfort", streak: 7, rank: "C", blocksOnDarkMana: false, needsTrigger: true },
  { tier: "3", name: "Leisure", streak: 14, rank: "B", blocksOnDarkMana: true, needsTrigger: true },
  { tier: "4", name: "Splurge", streak: 21, rank: "A", blocksOnDarkMana: true, needsTrigger: true },
  { tier: "5", name: "Legendary", streak: 60, rank: "S", blocksOnDarkMana: true, needsTrigger: false },
];
export const tierRule = (tier: string): TierRule => REWARD_TIERS.find((t) => t.tier === tier) ?? REWARD_TIERS[0];

export type Check = { key: "streak" | "rank" | "mana" | "gate" | "xp"; label: string; ok: boolean };
export type Standing = { streak: number; rank: string; darkMana: number; xp: number };

/** Every requirement for one reward, in the server's order, plus the first thing in the way. */
export function rewardChecks(tier: string, cost: number, s: Standing, hasTriggerGate: boolean): { checks: Check[]; blocker: string | null; short: string | null; ready: boolean } {
  const r = tierRule(tier);
  const checks: Check[] = [
    { key: "streak", label: `${r.streak}-day streak`, ok: s.streak >= r.streak },
    { key: "rank", label: `${r.rank}-rank or higher`, ok: rankIndex(s.rank) >= rankIndex(r.rank) },
  ];
  if (r.blocksOnDarkMana) checks.push({ key: "mana", label: "No Dark Mana", ok: s.darkMana === 0 });
  if (r.needsTrigger) checks.push({ key: "gate", label: "Gate conquered in the last 48h", ok: hasTriggerGate });
  checks.push({ key: "xp", label: `${cost.toLocaleString()} XP in hand`, ok: s.xp >= cost });
  const first = checks.find((c) => !c.ok);
  const blocker = !first ? null
    : first.key === "streak" ? `Needs a ${r.streak}-day streak (you have ${s.streak})`
    : first.key === "rank" ? `Needs ${r.rank}-rank`
    : first.key === "mana" ? "Clear your Dark Mana first"
    : first.key === "gate" ? "Pick a gate you conquered in the last 48 hours"
    : `${(cost - s.xp).toLocaleString()} XP short`;
  const short = !first ? null
    : first.key === "streak" ? `${r.streak}-day streak`
    : first.key === "rank" ? `${r.rank}-rank`
    : first.key === "mana" ? "Clear Dark Mana"
    : first.key === "gate" ? "Anchor gate needed"
    : `${(cost - s.xp).toLocaleString()} XP short`;
  return { checks, blocker, short, ready: !first };
}

/** The nearest reward you can't yet afford: a concrete next goal, closer than any milestone. */
export function nextGoal(rewards: Array<{ name: string; xp_cost: number; is_claimed?: boolean }>, xp: number): { name: string; remaining: number; pct: number } | null {
  const ahead = rewards.filter((r) => !r.is_claimed && r.xp_cost > xp).sort((a, b) => a.xp_cost - b.xp_cost)[0];
  return ahead ? { name: ahead.name, remaining: ahead.xp_cost - xp, pct: Math.max(0, Math.min(100, Math.round((xp / ahead.xp_cost) * 100))) } : null;
}

export function hoursLeft(expiresAt: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 3_600_000));
}
