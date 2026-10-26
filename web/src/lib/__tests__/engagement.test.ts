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

import { arcPoint, buildHeatGrid, heatLevel, scoreLabel } from "../visuals";

describe("heatmap + gauge helpers", () => {
  it("maps conquests to 0–4 intensity", () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(heatLevel)).toEqual([0, 1, 2, 3, 3, 4, 4]);
  });
  it("lays days out in Monday-first week columns, padded to full weeks", () => {
    // 2026-10-26 is a Monday; 10 days → 2 columns (7 + 3 + 4 padding)
    const days = Array.from({ length: 10 }, (_, i) => ({ date: `2026-10-${String(26 + i).padStart(2, "0")}`.replace(/-(3[2-9]|[4-9]\d)$/, (_m, d) => `-${d}`), points: 0, conquests: i % 3 }));
    const fixed = days.slice(0, 6).concat([{ date: "2026-11-01", points: 0, conquests: 1 }, { date: "2026-11-02", points: 0, conquests: 0 }, { date: "2026-11-03", points: 0, conquests: 2 }, { date: "2026-11-04", points: 0, conquests: 0 }]);
    const g = buildHeatGrid(fixed, 10);
    expect(g.columns).toHaveLength(2);
    expect(g.columns.every((c) => c.length === 7)).toBe(true);
    expect(g.columns[0][0]?.date).toBe("2026-10-26");          // Monday row first
    expect(g.columns[1].filter(Boolean)).toHaveLength(3);      // 10 days → 7 + 3
  });
  it("pads the first column when the window starts mid-week", () => {
    const g = buildHeatGrid([{ date: "2026-10-28", points: 0, conquests: 0 }, { date: "2026-10-29", points: 0, conquests: 1 }], 4);
    expect(g.columns[0].slice(0, 2)).toEqual([null, null]);     // Wed start → Mon, Tue padded
    expect(g.columns[0][2]?.date).toBe("2026-10-28");
  });
  it("returns nothing for no data", () => expect(buildHeatGrid([], 10).columns).toEqual([]));
  it("places the gauge knob on the arc ends and apex", () => {
    const a = arcPoint(0, 100, 100, 50), b = arcPoint(1, 100, 100, 50), m = arcPoint(0.5, 100, 100, 50);
    expect([Math.round(a.x), Math.round(a.y)]).toEqual([50, 100]);
    expect([Math.round(b.x), Math.round(b.y)]).toEqual([150, 100]);
    expect([Math.round(m.x), Math.round(m.y)]).toEqual([100, 50]);
  });
  it("describes scores in plain language", () => {
    expect(scoreLabel(0)).toBe("No data yet");
    expect(scoreLabel(30)).toBe("Getting started");
    expect(scoreLabel(70)).toBe("Strong");
    expect(scoreLabel(90)).toBe("Elite consistency");
  });
});

import { addDays, clampTier, isoDay, minutesLeft, repeatPayload, tierStates } from "../gateRules";

describe("gate creation rules (mirror of the server)", () => {
  const noon = new Date(2026, 9, 26, 12, 0, 0);          // Mon 26 Oct 2026, 12:00 local
  const today = isoDay(noon);
  it("no deadline allows only E-rank", () => {
    const s = tierStates(null, noon);
    expect(s.map((t) => t.ok)).toEqual([true, false, false, false, false]);
    expect(s[1].reason).toMatch(/deadline/);
  });
  it("today at noon fits up to S (11h59m left ≥ 8h)", () => {
    expect(tierStates(today, noon).every((t) => t.ok)).toBe(true);
  });
  it("late in the day, the big ranks drop out with a reason", () => {
    const late = new Date(2026, 9, 26, 21, 30, 0);       // 2h29m left
    const s = tierStates(today, late);
    expect(s.map((t) => t.ok)).toEqual([true, true, true, false, false]);
    expect(s[3].reason).toMatch(/A-rank needs 4h/);
  });
  it("a past deadline allows nothing", () => {
    expect(tierStates(isoDay(addDays(noon, -1)), noon).some((t) => t.ok)).toBe(false);
  });
  it("tomorrow always fits everything", () => {
    expect(tierStates(isoDay(addDays(noon, 1)), new Date(2026, 9, 26, 23, 50)).every((t) => t.ok)).toBe(true);
  });
  it("clampTier steps down to the best allowed rank", () => {
    expect(clampTier("Legendary", null, noon)).toBe("Low");
    expect(clampTier("Legendary", today, new Date(2026, 9, 26, 21, 30))).toBe("High");
    expect(clampTier("Mid", today, noon)).toBe("Mid");
  });
  it("minutesLeft is measured to 23:59", () => expect(minutesLeft(today, new Date(2026, 9, 26, 23, 0))).toBe(59));
  it("repeat payloads", () => {
    expect(repeatPayload("none", today)).toEqual({ is_recurring: false, recurrence_type: "none" });
    expect(repeatPayload("daily", null)).toEqual({ is_recurring: false, recurrence_type: "none" });   // needs a deadline
    expect(repeatPayload("daily", today)).toMatchObject({ is_recurring: true, recurrence_type: "daily" });
    expect(repeatPayload("weekly", today)).toMatchObject({ recurrence_type: "weekly", recurrence_days: [1] });   // Monday
  });
});
