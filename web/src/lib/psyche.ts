/**
 * The behavioural layer's thinking, as pure functions: the server records what happened
 * (supabase …_behavior.sql → get_behavior), this file decides what to say and when.
 *
 * Every rule has a source and a limit. Evidence notes live in GAME_RULES.md; the short version:
 *   plans            Gollwitzer & Sheeran 2006 (d≈0.65) and Sheeran et al. 2025 (if-then beats schedule-style plans)
 *   mental contrast  Oettingen's WOOP: pair the wish with the obstacle, not the daydream alone
 *   fresh start      Dai, Milkman & Riis 2014; Dai 2018: a reset helps people coming off a lapse, not people on a roll
 *   lapses           one miss barely dents habit formation (Lally 2009); self-forgiveness protects the next attempt (Wohl 2010)
 *   distance         Kross: your own name / "you" lowers distress; Grossmann & Kross 2014: advice-to-a-friend is wiser
 *   reflection       Di Stefano et al.: 15 minutes a day helped most early in learning; no XP, to keep it intrinsic
 *   calibration      keep wins frequent but not guaranteed. The "85% rule" is for simple learning tasks, so treat the band as a heuristic
 *   identity         self-perception: people infer who they are from what they repeatedly do
 */
import type { Behavior, GatePlan, LapseReason } from "./gameTypes";
import { DOMAINS, domainOfCategory, type DomainName } from "./domains";

export const rate = (done: number, n: number): number | null => (n > 0 ? Math.round((done / n) * 100) : null);

/* ── lapse vocabulary ─────────────────────────────────────────────────────── */
export const LAPSE_REASONS: Array<{ id: LapseReason; label: string }> = [
  { id: "too_big", label: "Too big" },
  { id: "forgot", label: "Forgot" },
  { id: "low_energy", label: "No energy" },
  { id: "distracted", label: "Got distracted" },
  { id: "unclear", label: "Unclear first step" },
  { id: "no_time", label: "No time" },
  { id: "other", label: "Something else" },
];

/* ── plans (implementation intentions + WOOP) ─────────────────────────────── */
export const CUE_PRESETS = ["After I wake up", "After breakfast", "When I sit at my desk", "After work", "Before bed"] as const;

/** Obstacles people actually hit, each with a ready-made "then" so the plan takes one tap. */
export const OBSTACLE_PRESETS: Array<{ obstacle: string; then: string }> = [
  { obstacle: "I'm tired", then: "I do only the first 2 minutes" },
  { obstacle: "My phone pulls me away", then: "The phone goes in another room first" },
  { obstacle: "I run out of time", then: "I do the 10-minute version" },
  { obstacle: "I don't feel like it", then: "I start for 2 minutes, then decide" },
];

export const TREAT_PRESETS = ["Podcast", "Good coffee", "Favourite playlist", "Show episode"] as const;

/**
 * Easy gates only need a cue. From B-rank up the obstacle matters: mental contrasting works for
 * realistic goals, and those are the gates people quietly abandon.
 */
export function planDepth(tier: string | undefined, hasDeadline: boolean): "cue" | "woop" | "none" {
  if (!hasDeadline) return "none";
  return tier === "High" || tier === "Super" || tier === "Legendary" ? "woop" : "cue";
}

export const planIsSet = (p: GatePlan | null | undefined) => !!(p && (p.cue || p.then));

export function describePlan(p: GatePlan | null | undefined): string | null {
  if (!p) return null;
  const parts: string[] = [];
  const end = (t: string) => (/[.!?]$/.test(t) ? t : `${t}.`);
  // lower-case the first word mid-sentence, but never the pronoun "I" ("I'm", "I do")
  const mid = (t: string) => (/^I(\s|')/.test(t) ? t : `${t.charAt(0).toLowerCase()}${t.slice(1)}`);
  if (p.cue) parts.push(end(`${p.cue}, I start`));
  if (p.obstacle && p.then) parts.push(end(`If ${mid(p.obstacle)}, then ${mid(p.then)}`));
  else if (p.then) parts.push(end(p.then));
  if (p.pair) parts.push(end(`Treat: ${p.pair}, only during this`));
  return parts.join(" ") || null;
}

/** What the player's own history says about planning. Only claims a difference once there is enough data to mean something. */
export function planInsight(b: Behavior): { ready: boolean; planned: number | null; unplanned: number | null; lift: number | null; tone: "good" | "flat" | "warn" | "learning"; text: string } {
  const { planned, unplanned } = b.plan_effect;
  const pr = rate(planned.done, planned.n), ur = rate(unplanned.done, unplanned.n);
  if (planned.n < 3 || unplanned.n < 3 || pr === null || ur === null) {
    return { ready: false, planned: pr, unplanned: ur, lift: null, tone: "learning",
      text: "Add a when-and-where to a few gates. After about three of each, the System compares your follow-through with and without a plan." };
  }
  const lift = pr - ur;
  if (lift >= 10) return { ready: true, planned: pr, unplanned: ur, lift, tone: "good", text: `With a plan you finish ${pr}% of your gates. Without one, ${ur}%. Your own numbers agree with the research.` };
  if (lift <= -10) return { ready: true, planned: pr, unplanned: ur, lift, tone: "warn", text: `Your planned gates slip more often (${pr}% vs ${ur}%). The plans are probably too ambitious. Shrink the first step.` };
  return { ready: true, planned: pr, unplanned: ur, lift, tone: "flat", text: `Plans are not moving your follow-through yet (${pr}% vs ${ur}%). Make the cue more concrete: a moment and a place.` };
}

/* ── rhythm ───────────────────────────────────────────────────────────────── */
const h12 = (h: number) => { const x = ((h % 24) + 24) % 24; return x % 12 === 0 ? 12 : x % 12; };
const mer = (h: number) => (((h % 24) + 24) % 24 < 12 ? "am" : "pm");
export const hourLabel = (h: number) => `${h12(h)}${mer(h)}`;

/** The best three-hour window for finishing gates, once there are enough conquests to say. */
export function powerWindow(hours: number[], minTotal = 6): { start: number; end: number; share: number; label: string } | null {
  if (hours.length !== 24) return null;
  const total = hours.reduce((a, b) => a + b, 0);
  if (total < minTotal) return null;
  let best = 0, at = 0;
  for (let s = 0; s <= 21; s++) {
    const v = hours[s] + hours[s + 1] + hours[s + 2];
    if (v > best) { best = v; at = s; }
  }
  const end = at + 3;
  const label = mer(at) === mer(end) ? `${h12(at)}–${h12(end)}${mer(end)}` : `${hourLabel(at)}–${hourLabel(end)}`;
  return { start: at, end, share: Math.round((best / total) * 100), label };
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export function bestWeekday(weekdays: number[], minTotal = 8): { dow: number; label: string; share: number } | null {
  if (weekdays.length !== 7) return null;
  const total = weekdays.reduce((a, b) => a + b, 0);
  if (total < minTotal) return null;
  let at = 0;
  weekdays.forEach((v, i) => { if (v > weekdays[at]) at = i; });
  return { dow: at, label: DAYS[at], share: Math.round((weekdays[at] / total) * 100) };
}

/* ── difficulty calibration ───────────────────────────────────────────────── */
export type Calibration = { kind: "learning" | "stretch" | "hold" | "ease"; rate: number | null; title: string; text: string };

/**
 * Wins should be common but not guaranteed. Too easy teaches nothing; too hard teaches helplessness.
 * Heuristic band, not a law: the published "85% rule" covers simple learning tasks only.
 */
export function calibrate(b: Behavior): Calibration {
  const { n, done, hard_n } = b.recent;
  if (n < 6) return { kind: "learning", rate: rate(done, n), title: "Calibrating", text: "A few more finished or missed gates and the System will tell you whether to push or ease off." };
  const r = Math.round((done / n) * 100);
  const hardShare = hard_n / n;
  if (r >= 90 && hardShare < 0.5) {
    return { kind: "stretch", rate: r, title: "Raise the bar", text: `You finished ${r}% of your last ${n} gates, mostly easy ones. Make one gate a rank harder this week. A win that costs nothing teaches nothing.` };
  }
  if (r >= 90) return { kind: "hold", rate: r, title: "Strong and stretched", text: `${r}% finished with real difficulty in the mix. Stay here and protect the rhythm.` };
  if (r < 55) {
    const top = [...b.lapses].sort((x, y) => y.n - x.n)[0];
    const why = top ? { too_big: "Most misses were too big", forgot: "Most misses were forgotten", low_energy: "Most misses came with no energy", distracted: "Most misses were distraction", unclear: "Most misses had no clear first step", no_time: "Most misses ran out of time", other: "Your misses vary" }[top.reason] : "Something is outrunning you";
    return { kind: "ease", rate: r, title: "Ease the load", text: `${why}. ${r}% finished lately. Drop a rank or shrink the first step until wins come back. Confidence is built on them.` };
  }
  return { kind: "hold", rate: r, title: "In the learning zone", text: `${r}% of your last ${n} gates finished. Hard enough to matter, close enough to reach.` };
}

/* ── fresh start ──────────────────────────────────────────────────────────── */
export type FreshStart = { kind: "landmark" | "self" | "momentum"; title: string; body: string; cta: string | null } | null;

/**
 * Temporal landmarks (a Monday, a new month) make people feel detached from past failures and more willing to start.
 * Dai (2018) found the opposite for people already doing well: a reset can make them slack. So the card is only
 * offered after a rough stretch; on a good run, it says to keep going.
 */
export function freshStart(b: Behavior, weeklyTarget: number | null): FreshStart {
  const r = b.rhythm;
  const brandNew = r.best_streak === 0 && r.prev_week_xp === 0 && r.this_week_xp === 0 && (r.days_since_conquest ?? 99) >= 99;
  if (brandNew) return null;
  const idle = r.days_since_conquest ?? 99;
  const struggling = (weeklyTarget != null && r.prev_week_xp < weeklyTarget) || idle >= 2 || (r.streak === 0 && r.best_streak > 0);
  const landmark = b.dow === 1 ? "week" : b.dom === 1 ? "month" : null;

  if (landmark && struggling) {
    return { kind: "landmark", title: `A fresh ${landmark}`,
      body: `Last ${landmark} is closed. It doesn't get a vote in this one. Pick the first gate and put a time on it.`, cta: "Plan the first gate" };
  }
  if (landmark && !struggling) {
    return { kind: "momentum", title: `New ${landmark}, same momentum`, body: `${r.prev_week_xp} XP last week and a ${r.streak}-day chain. Nothing to reset. Keep what is working.`, cta: null };
  }
  if (idle >= 3) {
    return { kind: "self", title: "Make today the landmark",
      body: `${idle} days away is only a gap, not a verdict. You don't need a Monday: name today the day you start again and take one small gate.`, cta: "Start again, small" };
  }
  return null;
}

/* ── lapse → remedy ───────────────────────────────────────────────────────── */
export type Remedy = { headline: string; fix: string; action: "shrink" | "cue" | "reschedule" | "treat" | "rewrite" | "none"; actionLabel: string | null };

/** Third-person on purpose: talking to yourself by name lowers distress and makes the advice better. */
export function lapseRemedy(reason: LapseReason, name: string, power: { label: string } | null): Remedy {
  const who = name.trim() || "You";
  switch (reason) {
    case "too_big":
      return { headline: `${who} aimed too big. That's a design problem, not a character flaw.`, fix: "Cut it to a two-minute start. Starting is the hard part; the rest follows.", action: "shrink", actionLabel: "Create the 2-minute version" };
    case "forgot":
      return { headline: `${who} forgot, which means the gate had no anchor.`, fix: "Tie it to something that already happens every day.", action: "cue", actionLabel: "Add a cue" };
    case "low_energy":
      return { headline: `${who} was running on empty. That's a scheduling signal.`, fix: power ? `Your best window is ${power.label}. Put the next one there.` : "Try the same gate earlier in the day, or a lighter version of it.", action: "reschedule", actionLabel: "Schedule a lighter one" };
    case "distracted":
      return { headline: `${who} got pulled away. Willpower isn't the lever; friction is.`, fix: "Pair the gate with a treat you only get during it, and move the temptation out of reach.", action: "treat", actionLabel: "Add a treat" };
    case "unclear":
      return { headline: `${who} didn't know where to begin.`, fix: "Rewrite it as the first physical action: open the file, lace the shoes.", action: "rewrite", actionLabel: "Rewrite the gate" };
    case "no_time":
      return { headline: `${who} ran out of time. Either the day was full or the gate was too large.`, fix: "Plan the ten-minute version, or give it a day that has room.", action: "shrink", actionLabel: "Create a 10-minute version" };
    default:
      return { headline: `${who} hit a wall. Noting it is enough for now.`, fix: "One miss rarely matters. A second in a row does, so make the next one easy.", action: "none", actionLabel: null };
  }
}

export const TINY_SUFFIX: Record<string, string> = { too_big: " (2-minute start)", no_time: " (10-minute version)" };

/** The "never miss twice" nudge, shown the day after a miss. */
export function afterLapseLine(name: string): string {
  return `One miss barely moves a habit. Two in a row starts a new pattern. ${name.trim() || "You"}, make today's gate small and finish it.`;
}

/* ── reflection ───────────────────────────────────────────────────────────── */
export function reflectionPrompts(name: string): { worked: string; change: string } {
  const who = name.trim() || "you";
  return {
    worked: `What did ${who} do well today?`,
    change: `A friend in ${who}'s position had this day. What would you tell them to change tomorrow?`,
  };
}

/** Feedback in words, never XP: paying for reflection tends to hollow it out. Process-focused and specific. */
export function reflectionNote(days14: number, firstToday: boolean): string {
  if (!firstToday) return "Updated. Noticing what worked is how it gets repeated.";
  if (days14 >= 7) return `${days14} reflective days in two weeks. This is the habit that makes the other habits improve.`;
  if (days14 >= 3) return `${days14} days of noticing so far. Patterns start to show around the fifth.`;
  return "Logged. Two sentences a day are enough: what worked, what changes.";
}

/** Offer the evening card once the day has mostly happened, or earlier after a big one. */
export function reflectionDue(now: Date, conqueredToday: number, reflectedToday: boolean): boolean {
  if (reflectedToday) return false;
  return now.getHours() >= 18 || conqueredToday >= 3;
}

/* ── identity ─────────────────────────────────────────────────────────────── */
const IDENTITY: Record<DomainName, { votes: string; titles: [string, string, string, string] }> = {
  Physical: { votes: "someone who looks after their body", titles: ["Mover", "Iron Habit", "Iron Vessel", "Body Sovereign"] },
  Mind: { votes: "someone who thinks and learns on purpose", titles: ["Student", "Deep Worker", "Architect of Thought", "Mind Sovereign"] },
  Soul: { votes: "someone who tends their inner life and people", titles: ["Listener", "Steady Heart", "Anchor", "Soul Sovereign"] },
  Execution: { votes: "someone who finishes what they start", titles: ["Starter", "Finisher", "Operator", "Execution Sovereign"] },
  Builder: { votes: "someone who makes things", titles: ["Tinkerer", "Maker", "Builder", "Creation Sovereign"] },
};
export const IDENTITY_STEPS = [3, 12, 40, 100] as const;

export type IdentityLine = { domain: DomainName; color: string; votes: number; title: string | null; next: { title: string; at: number } | null; progress: number; phrase: string };

/** Each finished gate is a vote for who the player is becoming. Self-perception: people infer identity from repeated behaviour. */
export function identityLines(categories: Behavior["categories"]): IdentityLine[] {
  const counts = new Map<DomainName, number>();
  for (const c of categories) {
    const d = domainOfCategory(c.category);
    if (d) counts.set(d, (counts.get(d) ?? 0) + c.n);
  }
  return DOMAINS.map((d) => {
    const votes = counts.get(d.name) ?? 0;
    const meta = IDENTITY[d.name];
    let tier = -1;
    IDENTITY_STEPS.forEach((t, i) => { if (votes >= t) tier = i; });
    const nextAt = IDENTITY_STEPS[tier + 1];
    const prevAt = tier >= 0 ? IDENTITY_STEPS[tier] : 0;
    return {
      domain: d.name, color: d.color, votes,
      title: tier >= 0 ? meta.titles[tier] : null,
      next: nextAt ? { title: meta.titles[tier + 1], at: nextAt } : null,
      progress: nextAt ? Math.min(1, (votes - prevAt) / (nextAt - prevAt)) : 1,
      phrase: votes > 0 ? `${votes} vote${votes === 1 ? "" : "s"} for being ${meta.votes}` : `No votes yet for being ${meta.votes}`,
    };
  }).sort((a, b) => b.votes - a.votes);
}

/* ── pledges ──────────────────────────────────────────────────────────────── */
export const PLEDGE_STAKES = [5, 10, 20] as const;
export const pledgeDividend = (stake: number) => Math.min(5, Math.max(1, Math.floor(stake / 4)));

/* ── what to show on Home ─────────────────────────────────────────────────── */
export type CoachKind = "lapse" | "fresh" | "reflect" | "note" | "calibrate" | "pledge";

/**
 * At most two coaching cards at a time, most useful first. Too many prompts is itself a
 * motivation killer, so the rest waits for the Insights view.
 *   1. a missed gate nobody has looked at yet (the sooner, the better the diagnosis)
 *   2. a fresh start, when one is warranted
 *   3. tonight's reflection
 *   4. yesterday's note-to-self, in the morning (a ready-made plan for today)
 *   5. an open pledge that is due soon
 *   6. a calibration nudge, only when it says something other than "carry on"
 */
export function coachOrder(a: { b: Behavior; fresh: FreshStart; calibration: Calibration; reflectDue: boolean; hour: number; limit?: number }): CoachKind[] {
  const out: CoachKind[] = [];
  if (a.b.unexamined.length > 0) out.push("lapse");
  if (a.fresh) out.push("fresh");
  if (a.reflectDue) out.push("reflect");
  if (a.hour < 12 && !a.b.reflection.today && a.b.reflection.last?.change) out.push("note");
  if (a.b.pledges.open.length > 0) out.push("pledge");
  if (a.calibration.kind === "stretch" || a.calibration.kind === "ease") out.push("calibrate");
  return out.slice(0, a.limit ?? 2);
}
