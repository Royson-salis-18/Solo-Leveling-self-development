import type { Bounty, Engagement, Rarity } from "./gameTypes";

/** Fired after any action that can move bounties, the streak, the boss or trophies. */
export const ENGAGEMENT_REFRESH_EVENT = "solo-leveling:engagement-refresh";

export function requestEngagementRefresh() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ENGAGEMENT_REFRESH_EVENT));
}

export const RARITY_COLOR: Record<Rarity, string> = {
  Common: "#9ca3af",
  Rare: "#60a5fa",
  Epic: "#c084fc",
  Legendary: "#fbbf24",
};

/** "04:16:59" for the section header (never negative). */
export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

/** "3h 12m" / "12m 05s" / "45s" — a countdown that never shows negative time. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

export function percent(value: number, total: number | null | undefined): number {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

export function bountyPercent(b: Pick<Bounty, "progress" | "target">): number {
  return percent(b.progress, b.target);
}

/**
 * The single most useful thing to do next, worded as a System directive.
 * Ordered by urgency: a streak about to sever beats a cache ready to open beats a quest that is
 * nearly done beats the raid.
 */
export function nextBestAction(e: Engagement): { kind: "streak" | "chest" | "bounty" | "boss" | "start"; text: string } {
  if (e.streak.at_risk) {
    const backup = e.streak.freezes > 0 ? " A Freeze charge stands by." : "";
    return { kind: "streak", text: `Your ${e.streak.count}-day chain severs at midnight. Conquer one gate to hold it.${backup}` };
  }
  if (!e.chest.claimed && e.chest.unlockable) {
    return { kind: "chest", text: e.bounties_done >= 3 ? "All quests cleared. The cache opens at its best odds." : "The quest cache is unsealed. Clear the last quest for better odds, or open it now." };
  }
  const open = e.bounties.filter((b) => !b.done).sort((a, b) => bountyPercent(b) - bountyPercent(a))[0];
  if (open && !e.chest.claimed) {
    return { kind: "bounty", text: `${open.target - open.progress} remaining on “${open.title}”.` };
  }
  if (e.boss.hp && !e.boss.defeated) {
    return { kind: "boss", text: `${e.boss.name} holds ${Math.max(0, e.boss.hp - e.boss.damage).toLocaleString()} HP. Every conquest is damage.` };
  }
  return { kind: "start", text: "Choose a gate and enter. Momentum is built, not found." };
}

/** Dim copy for the chest odds so the player can see the effort/reward link. */
export function chestHint(doneBounties: number): string {
  return doneBounties >= 3 ? "All quests cleared · best cache odds" : "Clear all 3 quests for better cache odds";
}
