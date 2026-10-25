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

## Not implemented
Clan/guild event XP rewards (events are display-only "team goals"), reward-expiry streak penalty.
