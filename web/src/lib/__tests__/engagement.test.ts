import { describe, expect, it } from "vitest";
import { bountyPercent, chestHint, clock, formatCountdown, nextBestAction, percent } from "../engagement";
import { captureReferral, referralLink, storedReferral } from "../referral";
import { firstSteps } from "../feedback";
import type { Engagement } from "../gameTypes";

const base = (over: Partial<Engagement> = {}): Engagement => ({
  day: "2026-10-25", seconds_left: 3600,
  bounties: [
    { key: "a", title: "Warm-Up", description: "", difficulty: 1, target: 2, progress: 1, done: false },
    { key: "b", title: "Power Surge", description: "", difficulty: 2, target: 40, progress: 10, done: false },
    { key: "c", title: "Gatebreaker", description: "", difficulty: 3, target: 1, progress: 0, done: false },
  ],
  bounties_done: 0,
  chest: { claimed: false, unlockable: false, pity: 0 },
  streak: { count: 4, best: 9, freezes: 1, freeze_cap: 2, done_today: true, at_risk: false, next_freeze_in: 3 },
  boss: { week: "2026-10-19", name: "Doomscroll Wraith", hp: 2500, damage: 500, my_damage: 30, players: 3, defeated: false,
          ends_at: "2026-10-26T00:00:00Z", top: [], claimable: [] },
  achievements: { unlocked: 2, total: 28, next: null },
  referral: { code: "ABCD1234", recruited: 0, active: 0 },
  ...over,
});

describe("formatCountdown", () => {
  it("formats hours, minutes and seconds and never goes negative", () => {
    expect(formatCountdown(3 * 3600 + 12 * 60)).toBe("3h 12m");
    expect(formatCountdown(12 * 60 + 5)).toBe("12m 05s");
    expect(formatCountdown(45)).toBe("45s");
    expect(formatCountdown(-30)).toBe("0s");
  });
});

describe("clock", () => {
  it("is zero-padded and never negative", () => {
    expect(clock(4 * 3600 + 16 * 60 + 59)).toBe("04:16:59");
    expect(clock(61)).toBe("00:01:01");
    expect(clock(-5)).toBe("00:00:00");
  });
});

describe("percent", () => {
  it("clamps and tolerates empty totals", () => {
    expect(percent(5, 10)).toBe(50);
    expect(percent(20, 10)).toBe(100);
    expect(percent(-3, 10)).toBe(0);
    expect(percent(5, 0)).toBe(0);
    expect(percent(5, null)).toBe(0);
  });
  it("bountyPercent uses target", () => expect(bountyPercent({ progress: 1, target: 2 })).toBe(50));
});

describe("nextBestAction", () => {
  it("a streak about to end outranks everything", () => {
    const a = nextBestAction(base({ streak: { ...base().streak, at_risk: true, done_today: false }, chest: { claimed: false, unlockable: true, pity: 0 } }));
    expect(a.kind).toBe("streak");
    expect(a.text).toContain("4-day chain");
    expect(a.text).toContain("Freeze charge");
  });
  it("then a chest that is ready", () => {
    expect(nextBestAction(base({ chest: { claimed: false, unlockable: true, pity: 0 }, bounties_done: 2 })).kind).toBe("chest");
  });
  it("then the bounty that is closest to done", () => {
    const a = nextBestAction(base());
    expect(a.kind).toBe("bounty");
    expect(a.text).toContain("Warm-Up");           // 50% beats 25% and 0%
  });
  it("falls through to the boss, then a plain nudge to start", () => {
    const claimed = { claimed: true as const, rarity: "Common" as const, xp: 15, item: null };
    expect(nextBestAction(base({ chest: claimed })).kind).toBe("boss");
    expect(nextBestAction(base({ chest: claimed, boss: { ...base().boss, defeated: true } })).kind).toBe("start");
  });
});

describe("chestHint", () => {
  it("explains the effort/reward link", () => {
    expect(chestHint(2)).toMatch(/all 3/);
    expect(chestHint(3)).toMatch(/best/);
  });
});

describe("referral links", () => {
  it("builds an encoded link", () => expect(referralLink("ABCD1234", "https://x.app")).toBe("https://x.app/register?ref=ABCD1234"));
  it("only remembers well-formed codes (no storage in node ⇒ no throw)", () => {
    expect(() => captureReferral("?ref=ABCD1234")).not.toThrow();
    expect(() => captureReferral("?ref=<script>")).not.toThrow();
    expect(storedReferral()).toBeUndefined();
  });
});



describe("firstSteps (starter checklist)", () => {
  it("a brand-new hunter starts at 0 of 3 with the first step next", () => {
    const r = firstSteps({ openGates: 0, trophiesUnlocked: 0, chestClaimed: false, conquestsToday: 0 });
    expect(r.doneCount).toBe(0);
    expect(r.steps.map((s) => s.done)).toEqual([false, false, false]);
    expect(r.complete).toBe(false);
  });
  it("opening a gate completes step 1 only", () => {
    const r = firstSteps({ openGates: 1, trophiesUnlocked: 0, chestClaimed: false, conquestsToday: 0 });
    expect(r.steps.map((s) => s.done)).toEqual([true, false, false]);
  });
  it("a conquest implies the gate step even if the gate is already closed", () => {
    const r = firstSteps({ openGates: 0, trophiesUnlocked: 1, chestClaimed: false, conquestsToday: 0 });
    expect(r.steps.map((s) => s.done)).toEqual([true, true, false]);
  });
  it("is complete once the first cache is opened", () => {
    const r = firstSteps({ openGates: 0, trophiesUnlocked: 3, chestClaimed: true, conquestsToday: 2 });
    expect(r.complete).toBe(true);
    expect(r.doneCount).toBe(3);
  });
});
