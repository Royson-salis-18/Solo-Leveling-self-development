import { describe, expect, it } from "vitest";
import { afterLapseLine, bestWeekday, calibrate, coachOrder, describePlan, freshStart, identityLines, lapseRemedy, planDepth, planInsight, pledgeDividend, powerWindow, rate, reflectionDue, reflectionNote, reflectionPrompts } from "../psyche";
import type { Behavior } from "../gameTypes";

const base = (over: Partial<Behavior> = {}): Behavior => ({
  today: "2026-10-26", dow: 3, dom: 26, window_days: 60,
  plan_effect: { planned: { n: 0, done: 0 }, unplanned: { n: 0, done: 0 }, n: 0, done: 0 },
  tiers: {}, recent: { n: 0, done: 0, hard_n: 0, hard_done: 0 },
  hours: Array(24).fill(0), weekdays: Array(7).fill(0), lapses: [], categories: [],
  settled: { kept: [], forfeited: [] }, pledges: { open: [], kept_total: 0, forfeited_total: 0 }, unexamined: [],
  reflection: { today: false, days_14: 0, last: null },
  rhythm: { days_since_conquest: 0, this_week_xp: 40, prev_week_xp: 120, streak: 5, best_streak: 9 },
  ...over,
});

describe("rate", () => {
  it("rounds, and is null with no data", () => {
    expect(rate(1, 3)).toBe(33);
    expect(rate(0, 0)).toBeNull();
  });
});

describe("planInsight", () => {
  const w = (p: [number, number], u: [number, number]) => base({ plan_effect: { planned: { n: p[0], done: p[1] }, unplanned: { n: u[0], done: u[1] }, n: p[0] + u[0], done: p[1] + u[1] } });
  it("makes no claim until both sides have three gates", () => {
    expect(planInsight(w([2, 2], [5, 1])).ready).toBe(false);
    expect(planInsight(w([5, 4], [2, 0])).ready).toBe(false);
  });
  it("reports a real lift with the player's own numbers", () => {
    const i = planInsight(w([4, 3], [4, 1]));
    expect(i).toMatchObject({ ready: true, planned: 75, unplanned: 25, lift: 50, tone: "good" });
    expect(i.text).toContain("75%");
  });
  it("is honest when plans are not helping, and when they hurt", () => {
    expect(planInsight(w([5, 3], [5, 3])).tone).toBe("flat");
    expect(planInsight(w([5, 1], [5, 4])).tone).toBe("warn");
  });
});

describe("planDepth / describePlan", () => {
  it("asks for the obstacle only on harder gates with a deadline", () => {
    expect(planDepth("Low", true)).toBe("cue");
    expect(planDepth("Mid", true)).toBe("cue");
    expect(planDepth("High", true)).toBe("woop");
    expect(planDepth("Legendary", true)).toBe("woop");
    expect(planDepth("High", false)).toBe("none");
  });
  it("reads a plan back as sentences", () => {
    expect(describePlan({ cue: "After breakfast", obstacle: "I'm tired", then: "I do two minutes", pair: "Podcast" }))
      .toBe("After breakfast, I start. If I'm tired, then I do two minutes. Treat: Podcast, only during this.");
    expect(describePlan({ obstacle: "My phone pulls me away", then: "The phone goes away" })).toBe("If my phone pulls me away, then the phone goes away.");
    expect(describePlan(null)).toBeNull();
    expect(describePlan({})).toBeNull();
  });
});

describe("powerWindow / bestWeekday", () => {
  const hrs = (m: Record<number, number>) => Array.from({ length: 24 }, (_, h) => m[h] ?? 0);
  it("needs enough conquests before naming a window", () => {
    expect(powerWindow(hrs({ 7: 3 }))).toBeNull();
  });
  it("finds the densest three-hour window", () => {
    const w = powerWindow(hrs({ 6: 2, 7: 4, 8: 3, 21: 1 }));
    expect(w).toMatchObject({ start: 6, end: 9, share: 90 });
    expect(w?.label).toBe("6–9am");
  });
  it("labels a window that crosses noon in full", () => {
    expect(powerWindow(hrs({ 11: 3, 12: 3, 13: 2 }))?.label).toBe("11am–2pm");
  });
  it("picks the best weekday", () => {
    expect(bestWeekday([0, 1, 1, 9, 1, 0, 0])).toMatchObject({ dow: 3, label: "Wednesday" });
    expect(bestWeekday([0, 1, 1, 2, 1, 0, 0])).toBeNull();
  });
});

describe("calibrate", () => {
  const r = (n: number, done: number, hard_n: number, lapses: Behavior["lapses"] = []) => base({ recent: { n, done, hard_n, hard_done: 0 }, lapses });
  it("waits for data", () => expect(calibrate(r(3, 3, 0)).kind).toBe("learning"));
  it("pushes people who only win on easy gates", () => expect(calibrate(r(10, 10, 2)).kind).toBe("stretch"));
  it("leaves strong, stretched players alone", () => expect(calibrate(r(10, 10, 7)).kind).toBe("hold"));
  it("eases off when most gates fail, naming the main reason", () => {
    const c = calibrate(r(10, 3, 6, [{ reason: "too_big", n: 4 }, { reason: "forgot", n: 1 }]));
    expect(c.kind).toBe("ease");
    expect(c.text).toContain("too big");
  });
  it("calls the middle the learning zone", () => expect(calibrate(r(10, 7, 5)).title).toBe("In the learning zone"));
});

describe("freshStart", () => {
  it("offers a reset on a Monday after a rough week", () => {
    const f = freshStart(base({ dow: 1, rhythm: { days_since_conquest: 1, this_week_xp: 0, prev_week_xp: 40, streak: 3, best_streak: 9 } }), 100);
    expect(f?.kind).toBe("landmark");
    expect(f?.title).toBe("A fresh week");
  });
  it("does NOT reset someone on a good run: it says keep going", () => {
    const f = freshStart(base({ dow: 1, rhythm: { days_since_conquest: 0, this_week_xp: 10, prev_week_xp: 160, streak: 12, best_streak: 12 } }), 100);
    expect(f?.kind).toBe("momentum");
    expect(f?.cta).toBeNull();
  });
  it("recognises the first of the month", () => {
    const f = freshStart(base({ dow: 4, dom: 1, rhythm: { days_since_conquest: 4, this_week_xp: 0, prev_week_xp: 0, streak: 0, best_streak: 6 } }), 100);
    expect(f?.title).toBe("A fresh month");
  });
  it("lets a lapsed player create their own landmark midweek", () => {
    const f = freshStart(base({ dow: 3, dom: 14, rhythm: { days_since_conquest: 5, this_week_xp: 0, prev_week_xp: 20, streak: 0, best_streak: 8 } }), 100);
    expect(f?.kind).toBe("self");
  });
  it("stays quiet midweek for an active player, and for a brand-new one", () => {
    expect(freshStart(base(), 100)).toBeNull();
    expect(freshStart(base({ dow: 1, rhythm: { days_since_conquest: null, this_week_xp: 0, prev_week_xp: 0, streak: 0, best_streak: 0 } }), 100)).toBeNull();
  });
});

describe("lapseRemedy", () => {
  it("talks about the player in the third person and offers a concrete fix", () => {
    const r = lapseRemedy("too_big", "Royson", null);
    expect(r.headline.startsWith("Royson")).toBe(true);
    expect(r.action).toBe("shrink");
  });
  it("uses the player's power window for low energy when it is known", () => {
    expect(lapseRemedy("low_energy", "Ana", { label: "6–9am" }).fix).toContain("6–9am");
    expect(lapseRemedy("low_energy", "Ana", null).fix).not.toContain("undefined");
  });
  it("covers every reason", () => {
    for (const id of ["too_big", "forgot", "low_energy", "distracted", "unclear", "no_time", "other"] as const) {
      expect(lapseRemedy(id, "X", null).headline.length).toBeGreaterThan(10);
    }
  });
  it("falls back to 'You' without a name", () => expect(afterLapseLine("")).toContain("You,"));
});

describe("reflection", () => {
  it("is due in the evening, or after a big day, and never twice", () => {
    expect(reflectionDue(new Date(2026, 9, 26, 19, 0), 0, false)).toBe(true);
    expect(reflectionDue(new Date(2026, 9, 26, 10, 0), 1, false)).toBe(false);
    expect(reflectionDue(new Date(2026, 9, 26, 10, 0), 3, false)).toBe(true);
    expect(reflectionDue(new Date(2026, 9, 26, 22, 0), 5, true)).toBe(false);
  });
  it("answers in words, scaled to consistency, never in points", () => {
    expect(reflectionNote(1, true)).toMatch(/Two sentences/);
    expect(reflectionNote(8, true)).toContain("8 reflective days");
    expect(reflectionNote(2, false)).toMatch(/Updated/);
    expect(reflectionNote(8, true)).not.toMatch(/XP/);
  });
  it("asks for advice as if to a friend, by name", () => {
    const q = reflectionPrompts("Royson");
    expect(q.worked).toContain("Royson");
    expect(q.change).toMatch(/friend/);
  });
});

describe("identityLines", () => {
  it("turns category counts into votes per domain, strongest first", () => {
    const lines = identityLines([{ category: "Fitness", n: 14 }, { category: "Health", n: 2 }, { category: "Work", n: 4 }, { category: "Unknown", n: 99 }]);
    expect(lines[0]).toMatchObject({ domain: "Physical", votes: 16, title: "Iron Habit" });
    expect(lines[0].next).toEqual({ title: "Iron Vessel", at: 40 });
    expect(lines[1]).toMatchObject({ domain: "Mind", votes: 4, title: "Student" });
  });
  it("has no title before the first threshold and caps at the last", () => {
    expect(identityLines([{ category: "Fitness", n: 2 }]).find((l) => l.domain === "Physical")).toMatchObject({ title: null, votes: 2 });
    const top = identityLines([{ category: "Fitness", n: 500 }])[0];
    expect(top.title).toBe("Body Sovereign");
    expect(top.next).toBeNull();
    expect(top.progress).toBe(1);
  });
});

describe("pledgeDividend", () => {
  it("mirrors the database: a quarter of the stake, between 1 and 5", () => {
    expect([5, 10, 20].map(pledgeDividend)).toEqual([1, 2, 5]);
  });
});

describe("coachOrder", () => {
  const cal = (kind: "learning" | "stretch" | "hold" | "ease") => ({ kind, rate: 80, title: "", text: "" });
  const fresh = { kind: "landmark" as const, title: "", body: "", cta: "x" };
  const ctx = (o: Partial<Parameters<typeof coachOrder>[0]> = {}) => ({ b: base(), fresh: null, calibration: cal("hold"), reflectDue: false, hour: 14, ...o });
  it("is empty when there is nothing worth saying", () => expect(coachOrder(ctx())).toEqual([]));
  it("puts an unexamined miss first and caps at two", () => {
    const b = base({ unexamined: [{ id: "1", title: "t", tier: "Mid", category: "Work", deadline: null, had_plan: false }] });
    expect(coachOrder(ctx({ b, fresh, reflectDue: true }))).toEqual(["lapse", "fresh"]);
    expect(coachOrder(ctx({ b, fresh, reflectDue: true, limit: 3 }))).toEqual(["lapse", "fresh", "reflect"]);
  });
  it("offers yesterday's note only in the morning and only if there is one", () => {
    const b = base({ reflection: { today: false, days_14: 3, last: { day: "2026-10-25", change: "Plan the night before" } } });
    expect(coachOrder(ctx({ b, hour: 8 }))).toEqual(["note"]);
    expect(coachOrder(ctx({ b, hour: 15 }))).toEqual([]);
  });
  it("stays quiet about calibration when the player is in the zone", () => {
    expect(coachOrder(ctx({ calibration: cal("hold") }))).toEqual([]);
    expect(coachOrder(ctx({ calibration: cal("learning") }))).toEqual([]);
    expect(coachOrder(ctx({ calibration: cal("ease") }))).toEqual(["calibrate"]);
  });
});
