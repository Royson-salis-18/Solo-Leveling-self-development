import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { calcLevel, calcRank, calcTitle, calculateEffectiveXp, CLASS_TITLES, TIER_POINTS, xpForLevel, calcXpProgress, nextRankInfo } from "../levelEngine";
import { MODE_CONFIGS } from "../modeConfig";
import { SYSTEM_CATEGORIES } from "../categoryConfig";
import { SHADOW_CATALOG, SYSTEM_REWARDS } from "../catalog";
import { describeCompletion, describeFailure } from "../gameFormat";
import { toGameError } from "../rpc";
import { parseScheduleText, tierForPoints } from "../nlpParser";

const sql = (f: string) => readFileSync(resolve(__dirname, "../../../supabase/migrations", f), "utf8");
const FOUNDATION = sql("20261025000001_foundation.sql");
const ENGINE = sql("20261025000002_game_engine.sql");

describe("levels / ranks (golden values also asserted in the SQL suite)", () => {
  it("level from standing", () => {
    expect([0, 499, 500, -300].map(calcLevel)).toEqual([1, 1, 2, 1]);
    expect(xpForLevel(3)).toBe(1500);
    expect(calcXpProgress(750)).toBe(50);
  });
  it("rank thresholds", () => {
    expect([4, 5, 10, 16, 25, 40, 101].map(calcRank)).toEqual(["E", "D", "C", "B", "A", "S", "SS"]);
    expect(nextRankInfo("E")).toEqual({ rank: "D", minLevel: 5 });
    expect(nextRankInfo("SS")).toBeNull();
  });
  it("XP dampening and category weight", () => {
    expect(calculateEffectiveXp(50, "Work")).toBe(50);
    expect(calculateEffectiveXp(100, "Work")).toBe(Math.round(50 + 10 * Math.log10(51)));
    expect(calculateEffectiveXp(15, "Learning")).toBe(12);
    expect(calculateEffectiveXp(15, "Nope")).toBe(15);
  });
  it("titles", () => {
    expect(calcTitle("Warrior", 5000)).toBe("Vanguard");
    expect(calcTitle("Archer", 25000)).toBe("Dimensional Tracker");
    expect(calcTitle("Bard", 0)).toBe("Rookie");
  });
});

describe("TypeScript config matches the SQL seeds (single source of truth)", () => {
  it("game modes", () => {
    for (const m of Object.values(MODE_CONFIGS)) {
      const row = new RegExp(`\\('${m.name}',\\s*([^)]*)\\)`).exec(FOUNDATION)?.[1];
      expect(row, `mode ${m.name} missing in SQL`).toBeTruthy();
      const f = row!.split(",").map((x) => x.trim());
      expect(Number(f[0])).toBe(m.xpMultiplier);
      expect(Number(f[1])).toBe(m.decayRate);
      expect(Number(f[2])).toBe(m.softDecayCapXp);
      expect(Number(f[3])).toBe(m.gracePeriod);
      expect(Number(f[4])).toBe(m.streakGraceDays);
      expect(Number(f[5])).toBe(m.dmOnFail);
      expect(Number(f[6])).toBe(m.failXpPenaltyRate);
      expect(Number(f[7])).toBe(m.dmCap);
      expect(Number(f[8])).toBe(m.deceasedThreshold);
      expect(f[10] === "true").toBe(m.postponeEnabled);
      expect(f[11] === "true").toBe(m.rankDownEnabled);
      expect(f[12] === "true").toBe(m.compoundingDecay);
      expect(Number(f[13])).toBe(m.resonanceBurstChance);
    }
  });
  it("categories → stat and weight", () => {
    for (const c of SYSTEM_CATEGORIES) {
      const m = new RegExp(`\\('${c.name}','(domain_\\w+)',([\\d.]+)\\)`).exec(FOUNDATION);
      expect(m, `category ${c.name} missing in SQL`).toBeTruthy();
      expect(m![1]).toBe(c.stat);
    }
  });
  it("shadow catalog names and rarities", () => {
    for (const s of SHADOW_CATALOG) {
      const esc = s.name.replace(/[()]/g, "\\$&");
      expect(new RegExp(`\\('${esc}','${s.rarity}',`).test(FOUNDATION), `shadow ${s.name}`).toBe(true);
    }
  });
  it("system rewards", () => {
    for (const r of SYSTEM_REWARDS) expect(FOUNDATION).toContain(`'${r.id}'`);
    for (const r of SYSTEM_REWARDS) expect(new RegExp(`'${r.id}',[^\\n]*${r.xp_cost}`).test(FOUNDATION)).toBe(true);
  });
  it("class titles", () => {
    for (const [cls, titles] of Object.entries(CLASS_TITLES)) {
      for (const t of titles) expect(ENGINE, `${cls}:${t}`).toContain(`"${t}"`);
    }
  });
  it("tier points", () => {
    const m = /when 'Legendary' then 50 when 'Super' then 35 when 'High' then 25\s+when 'Mid' then 15 else 5/.exec(ENGINE);
    expect(m).toBeTruthy();
    expect(TIER_POINTS).toEqual({ Low: 5, Mid: 15, High: 25, Super: 35, Legendary: 50 });
  });
});

describe("result formatting", () => {
  const base = { ok: true, already: false, profile: {} as never };
  const xp = (o = {}) => ({ base: 15, effective: 18, earned: 18, applied: 18, absorbed_by_dark_mana: 0, capped: false, arise_bonus: 0, burst: 0, paid: true, multipliers: { mode: 1, flow: 1, ego: 1, boost: 1, resonance: 1 }, ...o });
  it("plain", () => expect(describeCompletion({ ...base, xp: xp() }).message).toBe("+18 XP"));
  it("absorbed + flow + shadows", () => {
    const m = describeCompletion({ ...base, xp: xp({ applied: 11, absorbed_by_dark_mana: 7, multipliers: { mode: 1, flow: 2.5, ego: 1, boost: 1, resonance: 1.1 } }) }).message;
    expect(m).toContain("+11 XP (of 18)"); expect(m).toContain("7 cleared Dark Mana"); expect(m).toContain("Flow ×2.5"); expect(m).toContain("Shadows +10%");
  });
  it("cap / already / repaid", () => {
    expect(describeCompletion({ ...base, xp: xp({ earned: 0, applied: 0, capped: true }) }).message).toContain("daily cap");
    expect(describeCompletion({ ...base, already: true }).kind).toBe("info");
    expect(describeCompletion({ ...base, xp: xp({ paid: false }) }).message).toContain("only once");
  });
  it("failure", () => expect(describeFailure({ ok: true, already: false, penalty: 3, redemption_spawned: true, profile: {} as never }).message).toBe("−3 XP · a redemption gate was offered"));
});

describe("error mapping", () => {
  it("server CODE: message", () => { const e = toGameError({ message: "BOSS_SHIELD: Clear minions first." }); expect([e.code, e.message]).toEqual(["BOSS_SHIELD", "Clear minions first."]); });
  it("permission denied", () => expect(toGameError({ message: "permission denied for table x", code: "42501" }).code).toBe("PERMISSION_DENIED"));
  it("network", () => expect(toGameError(new TypeError("Failed to fetch")).code).toBe("NETWORK"));
});

describe("schedule import", () => {
  it("maps point hints onto tiers", () => {
    expect([5, 15, 25, 35, 50, 80].map(tierForPoints)).toEqual(["Low", "Mid", "High", "Super", "Legendary", "Legendary"]);
    const [t] = parseScheduleText("1. Morning meeting (urgent) - 80 XP");
    expect(t.xp_tier).toBeDefined();
    expect(Object.values(TIER_POINTS)).toContain(t.points);
  });
});
