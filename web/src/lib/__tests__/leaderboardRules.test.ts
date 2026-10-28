import { describe, expect, it } from "vitest";
import { podium, standingLine, standingOf } from "../leaderboardRules";

const board = [
  { id: "a", name: "Kaito", xp: 900 }, { id: "b", name: "Mira", xp: 700 }, { id: "me", name: "Royson", xp: 650 },
  { id: "d", name: "Sol", xp: 400 }, { id: "e", name: "Ivy", xp: 400 },
];

describe("standingOf", () => {
  it("finds rank, percentile and both neighbours", () => {
    const s = standingOf(board, "me")!;
    expect(s).toMatchObject({ rank: 3, total: 5, topPct: 60, xp: 650 });
    expect(s.ahead).toEqual({ name: "Mira", gap: 50 });
    expect(s.behind).toEqual({ name: "Sol", gap: 250 });
  });
  it("is null for a player who is not on the board", () => {
    expect(standingOf(board, "ghost")).toBeNull();
    expect(standingOf(board, undefined)).toBeNull();
  });
  it("shares rank on a tie", () => {
    const s = standingOf(board, "e")!;
    expect(s.rank).toBe(4);
    expect(s.ahead).toEqual({ name: "Sol", gap: 0 });
  });
  it("handles first and last place", () => {
    expect(standingOf(board, "a")).toMatchObject({ rank: 1, ahead: null, topPct: 20 });
    expect(standingOf([{ id: "me", name: "Solo", xp: 5 }], "me")).toMatchObject({ rank: 1, topPct: 100, ahead: null, behind: null });
  });
});

describe("standingLine", () => {
  it("names the rival to pass", () => expect(standingLine(standingOf(board, "me")!)).toBe("50 XP to pass Mira"));
  it("talks about a tie, a lead, and being alone", () => {
    expect(standingLine(standingOf(board, "e")!)).toMatch(/Level with Sol/);
    expect(standingLine(standingOf(board, "a")!)).toBe("You lead Mira by 200 XP");
    expect(standingLine(standingOf([{ id: "me", name: "Solo", xp: 5 }], "me")!)).toBe("Alone at the top");
  });
});

describe("podium", () => {
  it("orders second, first, third, and copes with short lists", () => {
    expect(podium([1, 2, 3, 4]).map((p) => p.place)).toEqual([2, 1, 3]);
    expect(podium([1, 2]).map((p) => p.place)).toEqual([2, 1]);
    expect(podium([1]).map((p) => p.place)).toEqual([1]);
    expect(podium([])).toEqual([]);
  });
});
