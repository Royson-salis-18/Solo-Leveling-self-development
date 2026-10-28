import { describe, expect, it } from "vitest";
import { hoursLeft, nextGoal, rankIndex, rewardChecks, tierRule } from "../rewardRules";

const me = { streak: 8, rank: "C", darkMana: 0, xp: 500 };

describe("rewardChecks", () => {
  it("tier 1 needs only a short streak and the XP", () => {
    expect(rewardChecks("1", 50, me, false)).toMatchObject({ ready: true, blocker: null });
    expect(rewardChecks("1", 50, { ...me, streak: 2 }, false).blocker).toBe("Needs a 3-day streak (you have 2)");
  });
  it("tier 2 needs a trigger gate", () => {
    const r = rewardChecks("2", 150, me, false);
    expect(r.ready).toBe(false);
    expect(r.blocker).toMatch(/48 hours/);
    expect(rewardChecks("2", 150, me, true).ready).toBe(true);
  });
  it("tier 3+ is locked by Dark Mana, tier 2 is not", () => {
    expect(rewardChecks("3", 400, { ...me, rank: "B", streak: 20, darkMana: 5 }, true).blocker).toBe("Clear your Dark Mana first");
    expect(rewardChecks("2", 150, { ...me, darkMana: 5 }, true).ready).toBe(true);
  });
  it("legendary needs rank and streak but no trigger gate", () => {
    const r = rewardChecks("5", 3000, { streak: 70, rank: "S", darkMana: 0, xp: 5000 }, false);
    expect(r.ready).toBe(true);
    expect(r.checks.some((c) => c.key === "gate")).toBe(false);
  });
  it("reports the first blocker in the server's order, and the XP gap last", () => {
    expect(rewardChecks("3", 400, { streak: 1, rank: "E", darkMana: 9, xp: 0 }, false).blocker).toMatch(/streak/);
    expect(rewardChecks("1", 600, me, false).blocker).toBe("100 XP short");
  });
  it("gives a short label for lists", () => {
    expect(rewardChecks("3", 400, { ...me, streak: 12 }, true).short).toBe("14-day streak");
    expect(rewardChecks("2", 150, me, false).short).toBe("Anchor gate needed");
    expect(rewardChecks("1", 50, me, false).short).toBeNull();
  });
  it("knows ranks in order", () => {
    expect(rankIndex("S")).toBeGreaterThan(rankIndex("A"));
    expect(rankIndex("nonsense")).toBe(0);
    expect(tierRule("9").tier).toBe("1");
  });
});

describe("nextGoal", () => {
  const list = [{ name: "A", xp_cost: 50 }, { name: "B", xp_cost: 150 }, { name: "C", xp_cost: 400, is_claimed: true }, { name: "D", xp_cost: 800 }];
  it("picks the cheapest reward you can't afford yet", () => expect(nextGoal(list, 100)).toEqual({ name: "B", remaining: 50, pct: 67 }));
  it("ignores claimed rewards and is null when everything is affordable", () => {
    expect(nextGoal(list, 400)).toEqual({ name: "D", remaining: 400, pct: 50 });
    expect(nextGoal(list, 5000)).toBeNull();
  });
});

describe("hoursLeft", () => {
  it("rounds up and never goes negative", () => {
    const now = Date.parse("2026-10-28T00:00:00Z");
    expect(hoursLeft("2026-10-28T01:30:00Z", now)).toBe(2);
    expect(hoursLeft("2026-10-27T00:00:00Z", now)).toBe(0);
  });
});
