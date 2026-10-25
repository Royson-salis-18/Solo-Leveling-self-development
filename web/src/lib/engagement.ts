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
 * The single most useful thing to do next — the engine of "just one more gate".
 * Ordered by urgency: a streak about to end beats a chest ready to open beats a bounty that is
 * one step away beats the boss.
 */
export function nextBestAction(e: Engagement): { kind: "streak" | "chest" | "bounty" | "boss" | "start"; text: string } {
  if (e.streak.at_risk) {
    const backup = e.streak.freezes > 0 ? ` (a Streak Freeze is on standby)` : "";
    return { kind: "streak", text: `Conquer one gate to keep your ${e.streak.count}-day streak alive${backup}.` };
  }
  if (!e.chest.claimed && e.chest.unlockable) {
    return { kind: "chest", text: e.bounties_done >= 3 ? "Perfect day — your Bounty Chest has the best odds. Open it." : "Your Bounty Chest is ready. Finish the last bounty first for better odds, or open it now." };
  }
  const open = e.bounties.filter((b) => !b.done).sort((a, b) => bountyPercent(b) - bountyPercent(a))[0];
  if (open && !e.chest.claimed) {
    const left = open.target - open.progress;
    return { kind: "bounty", text: `${left} to go on “${open.title}”.` };
  }
  if (e.boss.hp && !e.boss.defeated) {
    return { kind: "boss", text: `${e.boss.name} has ${Math.max(0, e.boss.hp - e.boss.damage).toLocaleString()} HP left this week.` };
  }
  return { kind: "start", text: "Pick a gate and start. Momentum beats motivation." };
}

/** Dim copy for the chest odds so the player can see the effort/reward link. */
export function chestHint(doneBounties: number): string {
  return doneBounties >= 3 ? "Perfect day: best odds for Rare & Epic loot" : "Finish all 3 bounties for better odds";
}
