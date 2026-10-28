export type Ranked = { id: string; name: string; xp: number };

export type Standing = {
  rank: number; total: number; topPct: number; xp: number;
  /** the player directly above, and how far away */
  ahead: { name: string; gap: number } | null;
  /** the player directly below, and how far behind */
  behind: { name: string; gap: number } | null;
};

/**
 * Where the player stands in an already-sorted list (highest XP first). Ties share the better rank.
 * The comparison that motivates is the *next* player up, not the leader, so `ahead` is the rival to pass.
 */
export function standingOf(sorted: Ranked[], meId: string | undefined): Standing | null {
  if (!meId) return null;
  const i = sorted.findIndex((r) => r.id === meId);
  if (i < 0) return null;
  const me = sorted[i];
  const rank = sorted.findIndex((r) => r.xp === me.xp) + 1;
  const above = i > 0 ? sorted[i - 1] : null;
  const below = i < sorted.length - 1 ? sorted[i + 1] : null;
  return {
    rank, total: sorted.length, xp: me.xp,
    topPct: Math.max(1, Math.ceil((rank / sorted.length) * 100)),
    ahead: above ? { name: above.name, gap: Math.max(0, above.xp - me.xp) } : null,
    behind: below ? { name: below.name, gap: Math.max(0, me.xp - below.xp) } : null,
  };
}

export function standingLine(s: Standing): string {
  if (s.ahead && s.ahead.gap > 0) return `${s.ahead.gap.toLocaleString()} XP to pass ${s.ahead.name}`;
  if (s.ahead) return `Level with ${s.ahead.name}. One conquest breaks the tie`;
  if (s.behind) return `You lead ${s.behind.name} by ${s.behind.gap.toLocaleString()} XP`;
  return "Alone at the top";
}

/** Podium order for display: second, first, third. */
export function podium<T>(list: T[]): Array<{ item: T; place: 1 | 2 | 3 }> {
  const [a, b, c] = list;
  return [b && { item: b, place: 2 as const }, a && { item: a, place: 1 as const }, c && { item: c, place: 3 as const }].filter(Boolean) as Array<{ item: T; place: 1 | 2 | 3 }>;
}
