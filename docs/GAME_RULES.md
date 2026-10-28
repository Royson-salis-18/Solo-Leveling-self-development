# Game rules (authoritative)

Implemented in `web/supabase/migrations/20261025000002_game_engine.sql`; tested by `web/supabase/tests/10_engine.test.sql`.
The older design docs (V5 bible, technical report) described rules the code never matched and were removed.

## XP for a conquest
`base` (by rank: E 5 · C 15 · B 25 · A 35 · S 50, derived from the gate's tier by the server) → dampened above 50 (`50 + 10·log10(base−49)`) → × category weight (Fitness 1.2, Learning/Academics 0.8, Errands/General 0.7, Mindfulness/Social 1.1, others 1.0)
→ × mode multiplier (Easy .8 · Normal 1 · Hard 1.5 · Hell 2.5) → × Flow ×2.5 (5+ non-E conquests in 90 min) → × Ego ×1.1 (ego > 50) → × XP-boost item ×2 → × shadow resonance (+ top-5 shadows' bonuses, capped +25%). Rounded once at the end.
- **E-rank cap:** 15 XP per local day.
- **Pays once:** a gate pays XP once (reactivating and re-completing pays nothing); it is penalised once.
- **Dark Mana "dopamine hole":** earned XP first pays down Dark Mana.
- **Resonance burst:** 3+ non-E conquests in 90 min → mode-dependent chance of a bonus.
- **Shadow extraction:** S 100% · A 40% · B 15% · C 5% · E 2%; never duplicates; disabled while in XP debt.

## Level, rank, title
Derived from **standing = XP balance + XP spent on rewards** (spending never de-levels you). Level = ⌊standing/500⌋+1. Rank: E<5≤D<10≤C<16≤B<25≤A<40≤S<101≤SS. Rank only falls in Hard/Hell.

## Time
Every "day" is the player's local day (profile timezone). A daily tick runs lazily when the app is opened and catches up all elapsed days identically however long you were away.

## Streak
Counts days with a conquered gate. A gap survives if its missed days ≤ the mode's grace (Easy 2, Normal 1, Hard/Hell 0); otherwise it resets. Failing a gate or spending XP is not activity.

## Decay, status
Decay starts after the mode's grace period of idle days (Easy 14 · Normal 5 · Hard 2 · Hell 1): per day `rate × XP` (Normal 1%, Hard 2%, Hell 3% compounding), capped per day (30/60/100). Easy: none.
Status priority: **DECEASED** (idle > Easy 14 / Normal 10 / Hard 5 / Hell 3 days since last conquest; ends only via ARISE = conquer a B-rank+ gate, which also restores half of the decayed XP) › **PENALTY** (XP < 0) › **STAGNANT** (weekly C-rank+ XP below Normal 150 / Hard 300 / Hell 500; new accounts exempt for 7 days) › **ACTIVE**.

## Failure and debt
Penalty = `fail rate × the gate's XP` (Easy 10% · Normal 20% · Hard 35% · Hell 50%), ×(1 + 10%/day of lingering Dark Mana), max 200. Dark Mana +3/7/15/25 (capped). A redemption gate is offered. Redeeming Dark Mana costs 1.5× its amount in XP.
Postponing a deadline: −5 XP, +5 Dark Mana; forbidden in Hard/Hell.

## Rewards
Tier unlocks: T1 streak 3 · T2 streak 7, rank C, trigger gate · T3 14, B, trigger, no Dark Mana · T4 21, A, trigger, no Dark Mana · T5 60, S, no Dark Mana. A trigger gate must be conquered < 48h ago and anchors only one reward.

## Modes
First pick free; later switches have a 7-day cooldown; Hell is a 30-day lock-in.

## Engagement layer (all server-side)
- **Streak Freezes.** Every 7th streak day banks one (Free holds 2, Pro 5 — `plans.limits.streak_freeze_cap`). On a missed day beyond the mode's grace, a Freeze is spent automatically: the day counts as active (no streak reset, no decay). No Freeze ⇒ the streak resets as before.
- **Daily Bounties.** Three per local day, one each of difficulty 1–3, picked by a stable hash of (player, day) from `bounty_catalog`. Progress is derived from the XP ledger (gates, XP, C-rank+, B-rank+, before-noon, category variety). **2 of 3** opens the Bounty Chest; **3 of 3** improves the odds. Chest: Common 15 XP · Rare 40 XP + Surge Crystal · Epic 90 XP + Streak Freeze (or +30 XP if full). Odds Rare/Epic: 2/3 → 22%/4%, 3/3 → 30%/7%. **Pity:** five Commons in a row guarantee the next Rare. One chest per local day.
- **Trophies.** 28 achievements across conquests, streak, level, shadows, B-rank+, chests, XP, referrals and boss kills; each pays its XP once, at the moment it unlocks.
- **World Boss.** One per UTC week (Mon–Sun). Every first-time conquest deals its earned XP as damage. HP adapts: last week's boss beaten → +15%, missed → −10% (min 2,000; first boss 2,500). When defeated, anyone with ≥ 20 damage can claim 80 XP + a Surge Crystal (current or previous week only).
- **Comeback Surge.** Returning after 3+ idle days grants 3 Surge Crystals (×2 XP on a conquest each), at most once per 7 days.
- **Referrals.** `…/register?ref=CODE` (the hunter code). On the recruit's **first conquest** the recruiter gets 2 Surge Crystals and the recruit 1. Capped at 20 paid recruits per recruiter.
- **Bonus XP** (chest, trophy, boss, referral) is ledgered (`bounty`/`achievement`/`boss`), bypasses Dark Mana, and never counts toward the weekly threshold.
- **Reminders.** `private.send_return_nudges()` (see SETUP.md): one reminder/day, only while the streak is savable.

## Behaviour layer (migration 09)
Mechanics taken from self-regulation research instead of casino design. Each one lists what the research says **and where it stops**; where a claim is weaker than it sounds, the app does not make it. Sources are linked at the end of the section.

| Mechanic | What it does | Evidence, honestly |
|---|---|---|
| **Gate plans** (`set_gate_plan`) | A gate can carry an if-then **cue** ("After breakfast"), an **obstacle** and the pre-decided **response**, and an optional **treat** allowed only during it. B-rank+ gates open the obstacle fields by default. | Implementation intentions: mean effect d ≈ 0.65 on goal attainment (Gollwitzer & Sheeran 2006); a 2025 meta-analysis of 642 tests found if-then plans (0.43) beat schedule-style plans (0.29), and larger effects when motivation was high. Mental contrasting (obstacle next to the wish, i.e. WOOP) helps for *realistic* goals, and daydreaming alone can backfire. Temptation bundling: modest, early gym-attendance gains that faded (Milkman et al. 2014); a larger 2020 trial found 10–14% more weekly workouts from supplying the audiobook, with teaching the technique adding only a little. |
| **"Do plans work for you?"** (Insights) | Compares *your* follow-through on gates with and without a plan. Makes no claim until each side has ≥ 3 resolved gates. | Personal evidence persuades more than a citation, and it can say "no". If planned gates fail more often it says the plans were too ambitious. |
| **Lapse diagnosis** (`log_lapse`) | After a missed gate: one tap on *what got in the way* (too big, forgot, no energy, distracted, unclear, no time). The reply is a specific fix: a 2-minute version, a cue, a lighter gate in your power window, a treat, a rewrite. No XP, no penalty, one diagnosis per gate. The reply is written in the third person. | A single missed opportunity did not materially affect habit formation; being very inconsistent did (Lally et al. 2009; the 66-day figure is a median with a range of 18–254). Self-forgiveness after a procrastination lapse predicted less procrastination next time (Wohl et al. 2010). Using your own name or "you" lowered distress and improved performance in lab stress tasks (Kross et al. 2014), and advising a friend produced wiser reasoning than reasoning about yourself (Grossmann & Kross 2014). Mostly lab and student samples. |
| **Fresh start** (Home Coach) | On a Monday or the 1st, *after a rough stretch*, offers "A fresh week/month". After 3+ idle days it offers to make *today* the landmark. On a good run it says "keep what is working" and offers no reset. | Temporal landmarks raise aspirational behaviour (Dai, Milkman & Riis 2014). The effect is for aspirational goals, not chores, and a later result found resets help people after a lapse but can demotivate people already winning, hence the gate. |
| **Daily reflection** (`save_reflection`) | Evening card: "What did *you* do well?" and "What would you tell a friend to change tomorrow?" Yesterday's change reappears next morning as a ready-made plan. **Pays no XP.** | Fifteen minutes of daily reflection improved final test scores by about 23% in a field study, mostly early in learning (Di Stefano et al.). Rewards for an activity people already enjoy can undermine it (Deci, Koestner & Ryan 1999), so reflection gets words, not points. |
| **Pledges** (`pledge_gate`) | Stake 5, 10 or 20 XP on a C-rank+ gate with a deadline. Escrowed from `total_points` into `spent_xp`, so level and rank never move. Conquer it: stake back plus a dividend of ¼ of the stake (1–5 XP). Miss the deadline, abandon or delete it: the stake is gone. At most 2 open; no pledge on E-rank or deadline-less gates. | Commitment contracts with a real loss helped (Giné, Karlan & Zinman: about 3 points more quit at six months, small uptake of 11%); weight-loss contracts gained early and faded (Halpern, Asch & Volpp 2012). The loss only bites if the stake is real, hence escrow, but it stays small and capped so one bad week can't wreck a player. Deleting a pledged gate is not an escape. |
| **Calibration** (Insights) | Looks at your last 14 gates. Nearly all finished and mostly easy: *raise the bar*. Under 55% finished: *ease the load*, naming your most common miss reason. In between: stay. | Wins should be common but not certain. The published "85% rule" (Wilson et al. 2019) is derived for simple learning tasks with right and wrong answers, so the band here is a heuristic, not a law. |
| **Power hours & weekdays** | Finds your best 3-hour window and weekday once there are ≥ 6 / ≥ 8 conquests. | Descriptive, from your own ledger. |
| **Identity votes** (Profile) | Each finished gate is a vote for a domain (Physical, Mind, Soul, Execution, Builder); titles unlock at 3, 12, 40, 100 votes. | Self-perception theory: people infer who they are from what they repeatedly do. The titles are a mirror of behaviour, never a reward for it. |

**Server rules.** `get_behavior` settles pledges lazily and idempotently (the row is claimed by flipping `status` first, so a repeat call or a race pays nothing twice, verified by two concurrency scenarios). Conquests settle a satisfied pledge in the same transaction (`after_conquest` wrapper). Plans are clipped (120/120/160/80 characters) and unknown keys dropped. Reflection and lapse rows are private (RLS) and write-only through the RPCs.

**Researched and left out.** The Zeigarnik "unfinished tasks are remembered" effect did not hold up in a 2025 meta-analysis (the Ovsiankina urge to *resume* interrupted tasks did), so nothing here nags about unfinished gates on that theory. Endowed progress (a pre-stamped loyalty card lifted completion from 19% to 34%) stops working when the head start feels arbitrary, so no progress bar is pre-filled; the first-steps list only ticks what you actually did. Sources: [Ovsiankina/Zeigarnik meta-analysis (2025)](https://ideas.repec.org/a/pal/palcom/v12y2025i1d10.1057_s41599-025-05000-w.html) · [Endowed progress summary](https://en.wikipedia.org/wiki/Goal_pursuit).

**What is deliberately missing.** XP for planning or reflecting (it would hollow both out), streak-loss shaming, and any claim from the table above that the app can't back with the player's own data.

Sources: [Gollwitzer & Sheeran meta-analysis and 2025 follow-up](https://siliconcanals.com/t-most-self-improvement-plans-stop-at-i-will-a-meta-analysis-of-642-tests-found-plans-worked-better-when-they-linked-one-clear-cue-to-one-useful-response-in-an-if-then-format/) · [Fresh Start Effect (Dai, Milkman & Riis 2014)](https://faculty.wharton.upenn.edu/wp-content/uploads/2014/06/Dai_Fresh_Start_2014_Mgmt_Sci.pdf) · [Habit formation (Lally et al., UCL)](https://www.ucl.ac.uk/news/2009/aug/how-long-does-it-take-form-habit) · [Temptation bundling (Milkman, Minson & Volpp)](https://repository.upenn.edu/oid_papers/150) · [Self-distancing (Kross et al.)](https://www.weforum.org/stories/jobs-and-the-future-of-work/could-this-trick-help-you-perform-better-in-stressful-situations/) · [Solomon's paradox (Grossmann & Kross 2014)](https://journals.sagepub.com/doi/10.1177/0956797614535400) · [Commitment contract for smoking cessation (Giné, Karlan & Zinman)](https://poverty-action.org/publication/put-your-money-where-your-butt-commitment-contract-smoking-cessation) · [Learning by Thinking (Di Stefano, Gino, Pisano, Staats)](https://papers.ssrn.com/abstract=2414478) · [Extrinsic rewards and intrinsic motivation (Deci, Koestner & Ryan 1999)](https://www.selfdeterminationtheory.org/SDT/documents/2001_DeciKoestnerRyan.pdf) · [The Eighty Five Percent Rule (Wilson et al. 2019)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6831579)

## Not implemented
Clan/guild event XP rewards (events are display-only "team goals"), reward-expiry streak penalty.
