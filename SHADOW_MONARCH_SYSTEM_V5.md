# Shadow Monarch System — Full Design & Instruction Bible
**Version**: 5.0 (Reward Economy Update)
**Status**: ACTIVE
**Last Updated**: 2026-05-08

---

## Table of Contents
1. [Philosophy & Core Rules](#1-philosophy--core-rules)
2. [Page-by-Page Instructions](#2-page-by-page-instructions)
   - 2.1 [Dashboard](#21-dashboard)
   - 2.2 [Dungeon Gates (Task Creation)](#22-dungeon-gates-task-creation)
   - 2.3 [Rewards Page](#23-rewards-page)
   - 2.4 [Punishments / Penalty Registry](#24-punishments--penalty-registry)
   - 2.5 [Profile Page](#25-profile-page)
   - 2.6 [Arsenal (Item Shop)](#26-arsenal-item-shop)
3. [Reward Design Rules](#3-reward-design-rules)
   - 3.1 [What Good Rewards Look Like](#31-what-good-rewards-look-like)
   - 3.2 [What Bad Rewards Look Like](#32-what-bad-rewards-look-like)
   - 3.3 [Reward Tiers & Unlock Conditions](#33-reward-tiers--unlock-conditions)
   - 3.4 [System-Provided Reward Templates](#34-system-provided-reward-templates)
   - 3.5 [Anti-Abuse Rules for Rewards](#35-anti-abuse-rules-for-rewards)
4. [Punishment Design Rules](#4-punishment-design-rules)
   - 4.1 [What Good Punishments Look Like](#41-what-good-punishments-look-like)
   - 4.2 [What Bad Punishments Look Like](#42-what-bad-punishments-look-like)
   - 4.3 [Punishment Severity Tiers](#43-punishment-severity-tiers)
   - 4.4 [System-Provided Punishment Templates](#44-system-provided-punishment-templates)
   - 4.5 [Anti-Abuse Rules for Punishments](#45-anti-abuse-rules-for-punishments)
5. [XP & Progression Rules (V5 Fixes)](#5-xp--progression-rules-v5-fixes)
6. [Dark Mana & Redemption Rules (V5 Fixes)](#6-dark-mana--redemption-rules-v5-fixes)
7. [UI Instruction Copy — Ready to Implement](#7-ui-instruction-copy--ready-to-implement)

---

## 1. Philosophy & Core Rules

The Shadow Monarch System is a **hardcore accountability engine**, not a casual gamified to-do list. Every mechanic must serve one goal: making the user's real life measurably better through consistent effort and honest self-accountability.

### The Three Laws
1. **XP is identity, not just currency.** Spending XP visibly reduces your rank and BID. Every purchase is a real sacrifice of power. The system must show the user their rank impact before they confirm any purchase.
2. **Rewards must be earned twice.** Once through XP cost, once through the streak/rank gate. A user who just started cannot buy a Tier 4 reward no matter what. Time and consistency are the second price.
3. **Punishments must build, not break.** A punishment that causes a user to quit the system is a failed punishment. The goal is correction, not destruction. Every punishment must have a clear completion condition and a visible path back to good standing.

### What This System Is NOT
- It is not a tool for self-harm or extreme restriction.
- It is not a system where failure means permanent loss. Every state has a recovery path.
- It is not a passive tracker. If you don't interact with it, it will decay you.

---

## 2. Page-by-Page Instructions

### 2.1 Dashboard

**Purpose**: Real-time status overview of your Hunter profile.

#### What you see here
- **Hunter Status**: Your current state — ACTIVE, STAGNANT, PENALTY, or DECEASED.
- **Mana (XP)**: Your total accumulated power. This number defines your rank and BID.
- **Dark Mana**: Corruption debt from failures and postponements. Carry this long enough and it compounds.
- **BID**: Your Hunter contract value: `(Level × 1,000,000) + (Total XP × 10,000) + (Streak × 500,000)`. This is a prestige number, not a functional stat.
- **Weekly Activity Bar**: Your XP earned in the last 7 days vs the 300 XP threshold needed to stay ACTIVE.
- **Active Gates**: Count of currently running dungeon gates.

#### How to read your status
| Status | Meaning | What to do |
|--------|---------|-----------|
| **ACTIVE** | ≥ 300 XP in last 7 days | Keep going. Maintain momentum. |
| **STAGNANT** | < 300 XP in last 7 days | Decay is doubled. Complete at least 2 tasks today. |
| **PENALTY** | Total XP < 0 | Shop and extraction locked. Clear Dark Mana debt first. |
| **DECEASED** | No activity for 7+ days | Trigger ARISE ritual: complete one B-Rank task to restore 50% of decayed XP. |

#### Dashboard does NOT let you do anything
It is a read-only overview. All actions happen on their respective pages. Treat it like your mission briefing screen.

---

### 2.2 Dungeon Gates (Task Creation)

**Purpose**: Create, manage, and complete missions (tasks).

#### How to create a gate

**Step 1 — Name it like a mission, not a chore.**
Bad: `"email"` | Good: `"Send project proposal to client by EOD"`
The name must describe a specific, completable action. Vague names produce vague effort.

**Step 2 — Assign a rank honestly.**
This is the most important step and the most commonly abused one. Read the rank definitions below and assign based on genuine time and difficulty — not how you feel about the task.

| Rank | Tier | XP | What it actually means |
|------|------|----|------------------------|
| E | Low | 5 XP | ≤ 15 minutes, zero cognitive load. Brush teeth, reply to one message, fill a form. |
| C | Mid | 15 XP | 30–60 minutes of focused work. A single deliverable, a focused study session, a workout. |
| B | High | 25 XP | 90+ minutes of sustained effort. A significant work block, a complete project phase. |
| A | Super | 35 XP | Several hours, high complexity or high stakes. Exam prep, major deliverable, hard physical challenge. |
| S | Legendary | 50 XP | Life-altering difficulty. Things you've been avoiding for weeks. Full-day efforts. |

**Step 3 — Set a real deadline.**
- Deadlines must be at minimum `current time + (rank × 30 minutes)` in the future. You cannot backdate.
- No deadline = the task auto-assigns as E-Rank regardless of what you selected.
- Soft tasks (no real urgency) can have deadlines 7+ days out. Don't fake urgency — it dilutes what real urgency means.

**Step 4 — Choose a category.**
Categories affect XP multipliers. Assign honestly.

| Category | Multiplier | Includes |
|----------|-----------|---------|
| Fitness | 1.2x | Workouts, sports, physical challenges, meal prep |
| Mindfulness / Social | 1.1x | Meditation, therapy, meaningful conversations, journaling |
| Learning / Academics | 0.8x | Study, reading, courses — high volume, normalized |
| General / Errands | 0.7x | Admin, chores, logistics |

**Step 5 — Add subtasks (optional but recommended for B-Rank+)**
Subtasks activate the Boss Shield — the gate cannot be completed until all subtasks are cleared. Use subtasks to break large tasks into honest checkpoints. Do not add fake subtasks to inflate a task's apparent size.

**Step 6 — Mark as Red Gate (for A and S Rank only)**
Red Gates signal maximum-stakes missions. Failure on a Red Gate costs 50% of the gate's XP and adds heavy Dark Mana. Only mark a task Red if you genuinely cannot afford to fail it.

#### Honesty contract
The ranking system only works if you rank tasks honestly. If you consistently rank E-Rank tasks as B-Rank, you will inflate your stats, your rewards will feel unearned, and the entire system loses meaning. The system cannot enforce this — you can only enforce it yourself.

#### Gate lifecycle
```
Created → Active → [Completed ✓ | Failed ✗ | Overdue ⚠]
                          ↓              ↓           ↓
                      XP awarded    Dark Mana    Penalty state
                                    +10 DM       +20% base penalty
```

#### Rules that prevent gaming
- E-Rank tasks are capped at **15 XP total per day** across all E-Rank completions.
- E-Rank tasks do **not count** toward the 300 XP weekly threshold. Only C-Rank and above count.
- You cannot create more than 20 active gates simultaneously. Quality over quantity.
- Completing the same recurring task more than once per recurrence window gives 0 XP on duplicates.

---

### 2.3 Rewards Page

**Purpose**: Spend earned XP on real-life rewards you have set for yourself.

#### How to create a reward

**Step 1 — Name the exact real-life thing you will do.**
Bad: `"fun time"` | Good: `"Watch one full movie (no phone)"`
Bad: `"treat myself"` | Good: `"Order from my favourite restaurant"`

The specificity is the point. Vague rewards are not rewards — they're excuses to do anything and call it earned.

**Step 2 — Assign a tier honestly.**
Tiers are based on real-life cost: time, money, indulgence, and how much you'd normally feel guilty about it. See Section 3.3 for full tier definitions and examples.

**Step 3 — Set the XP cost.**
You set this yourself. The floor is enforced by the system (you cannot go below the tier minimum). You cannot lower a cost after creation — only raise it. Ask yourself: "Does this XP cost represent approximately how much this reward genuinely costs me to earn in real life?"

**Step 4 — Select a trigger gate (Tier 2 and above).**
Tier 2+ rewards must be linked to a completed gate. You select this at claim time, not creation time. The trigger gate must have been completed within the last 48 hours.

#### How to claim a reward
1. Confirm your streak and rank meet the tier's unlock conditions.
2. Confirm you have no Dark Mana blocking the tier (Tier 3+ is blocked if Dark Mana > 0).
3. Select a trigger gate (Tier 2+).
4. Confirm the XP deduction — the system shows your rank before and after.
5. The reward enters a **72-hour claim window**. You must actually do the reward in real life and mark it as completed within 72 hours. If you let it expire, the XP is refunded but your streak loses 1 day.

#### What the claim window forces
The 72-hour window exists because rewards that are "earned but pending forever" are not rewards — they're just numbers. The system requires you to actually rest, actually enjoy the thing, and mark it done. This is how the pleasure actually gets wired to the effort in your brain.

---

### 2.4 Punishments / Penalty Registry

**Purpose**: Define consequences for Gate failures and Dark Mana redemption.

#### Two types of punishments

**Type A — Automatic System Penalties** (triggered by the engine, non-negotiable):
- Gate failure → +10 Dark Mana, -100% of gate's XP
- Postponing a deadline → +5 Dark Mana, -5 XP
- Red Gate failure → +25 Dark Mana, -50% of total XP at rank level
- Weekly STAGNANT → 2x decay rate for 7 days

**Type B — User-Defined Penalty Registry** (your personal discipline contracts):
These are physical or mental tasks you assign to yourself as consequences when you fail. They are redeemed to clear Dark Mana debt. See Section 4 for design rules.

#### How to create a punishment

**Step 1 — Name the exact physical or mental action.**
Bad: `"do something hard"` | Good: `"100 pushups (can be broken into sets, must be done same day)"`
Bad: `"study more"` | Good: `"2-hour deep work session on the subject I failed"`

**Step 2 — Set the Dark Mana redemption value.**
Each punishment redeems a set amount of Dark Mana when completed. The value must reflect the genuine difficulty of the punishment. The system will warn you if a punishment redeems more than 15 Dark Mana (it's probably too easy).

**Step 3 — Understand the dual cost.**
Completing a punishment removes Dark Mana AND costs an equal amount of XP. This is permanent. Failure has a permanent price. The XP cost is the system's way of ensuring you can never fully "undo" a failure — you can only recover from it.

**Step 4 — Set a completion window.**
Every punishment must be completable within 24 hours of being triggered. If it takes more than a day, it's either too large (split it) or it's a lifestyle change (which belongs in your gate system, not your punishment registry).

---

### 2.5 Profile Page

**Purpose**: View your full stats, category breakdown, streak history, and shadow roster.

#### What to pay attention to
- **Category breakdown**: Where are you actually putting effort? If Fitness is 90% of your XP and Learning is 2%, your stats are telling you something real about your habits.
- **Streak history**: Look for the patterns in where you break. That's where your system needs improvement, not more tasks.
- **Shadow roster**: Shadows provide passive XP multipliers. They're earned from high-rank task completions and represent your compounding advantage.

#### What you cannot edit
- XP history. All transactions are logged.
- Completed gate records. You cannot delete completed tasks.
- Dark Mana history.

This is intentional. The profile is a truth record, not a highlight reel.

---

### 2.6 Arsenal (Item Shop)

**Purpose**: Spend XP on system utility items (not personal rewards — those go on the Rewards page).

Arsenal items are system mechanics: XP shields, decay protection, streak restorers, etc. These are different from personal rewards because they affect the game state, not your real life.

#### Key rule
Arsenal items are rented, not owned. They expire. A "Decay Shield" lasts 48 hours. Don't buy one and forget about it.

---

## 3. Reward Design Rules

### 3.1 What Good Rewards Look Like

A good reward has all of the following:

- **It is specific.** You can describe exactly what you will do and for how long.
- **It is real.** You would actually enjoy this, and you'd normally feel slightly guilty doing it without having earned it.
- **It costs real time, money, or guilt.** If doing it doesn't cost you anything in the real world, it's not a reward — it's just a normal thing you do.
- **It is proportional.** A 30-minute gaming session is not a Tier 4 reward. A weekend trip is not a Tier 1 reward.
- **It is something you genuinely look forward to.** Not something you added because you thought it sounded reasonable. If you don't actually want it, it has no motivational power.

**Good reward examples:**
```
Tier 1: "Watch 1 episode of any show (not while working)" — 50 XP
Tier 1: "Order dessert with dinner" — 30 XP
Tier 2: "Full rest Sunday — no productivity, no guilt" — 200 XP
Tier 2: "Buy the book I've been eyeing" — 175 XP
Tier 3: "Day trip to [specific place]" — 500 XP
Tier 3: "Buy new running shoes" — 450 XP
Tier 4: "Weekend stay at a hotel" — 900 XP
Tier 4: "Buy the course / tool I've been delaying" — 1000 XP
Tier 5: "International trip" — 5000 XP
Tier 5: "Major purchase I've been saving toward" — 3500 XP
```

### 3.2 What Bad Rewards Look Like

**Do not create rewards that:**

- Are already part of your daily routine. (`"Sleep 8 hours"` is not a reward. That is baseline functioning.)
- Are vague or undefined. (`"Relax"`, `"Have fun"`, `"Be lazy"` — these have no completion condition.)
- Are actually productive activities disguised as rewards. (`"Read a self-improvement book"` = learning task, not reward.)
- Are free of any real-life cost. (`"Sit outside for 10 minutes"` — this costs you nothing. It's not a reward.)
- Are designed to be claimed immediately after creation. If you set a 25 XP reward and you currently have 300 XP, that reward has zero psychological weight.
- Involve harming yourself in any form. No restriction, deprivation, or self-punishment framed as a reward.
- Are things you need to survive. Food, water, sleep, medication — these are never rewards.

**Bad reward examples with explanations:**
```
❌ "Drink water" — Basic survival, not a reward.
❌ "Take a walk" — If this is already your habit, it's not a reward.
❌ "Read for 10 minutes" — Too small, already part of a routine.
❌ "Relax" — Undefined. When you sit down to claim this, what exactly are you doing?
❌ "Be kind to myself" — Not a real-world action. Cannot be completed or claimed.
❌ "Skip the gym once" — This is not a reward. This is a punishment disguised as a reward. Never add "skipping" or "avoiding" as rewards.
❌ "Eat under 1000 calories" — This is dangerous. The system does not support restriction-based rewards.
```

### 3.3 Reward Tiers & Unlock Conditions

| Tier | Name | XP Floor | Min Streak | Min Rank | Dark Mana Condition | Description |
|------|------|----------|-----------|---------|---------------------|-------------|
| 1 | Indulgence | 25 XP | 3 days | Any | No restriction | Small pleasures. Under 1 hour, low cost. |
| 2 | Comfort | 150 XP | 7 days | C-Rank+ | No restriction | Half-day pleasures. Moderate spend. Requires trigger gate. |
| 3 | Leisure | 400 XP | 14 days | B-Rank+ | Must be 0 | Full-day experiences. Meaningful spend. Requires trigger gate. |
| 4 | Splurge | 800 XP | 21 days | A-Rank+ | Must be 0 | Major purchases or multi-day experiences. Requires trigger gate. |
| 5 | Legendary | 3000 XP | 60 days | S-Rank | Must be 0 | Life-scale rewards. Things you plan months in advance. |

**The streak condition is non-negotiable.** You cannot bypass it with extra XP. The streak gate exists because a user who binge-completes tasks for 3 days to afford a big reward has not demonstrated the consistency that earns them that reward. The streak is the proof.

### 3.4 System-Provided Reward Templates

These are built-in starting templates. Users can adopt, modify costs, or ignore them. They cannot be deleted from the template library but must be added to the user's registry to be usable.

**Tier 1 Templates:**
- `One episode of any show (no multitasking)` — default 50 XP
- `Order one item from a craving menu (not a full meal)` — default 40 XP
- `30 minutes of a video game, guilt-free` — default 35 XP
- `Scroll social media for 20 minutes, timer set` — default 25 XP
- `Call a friend just to chat` — default 30 XP

**Tier 2 Templates:**
- `Full rest day (Sunday protocol) — no tasks, no guilt` — default 200 XP
- `Buy one item from your wishlist (under ₹500 / $10)` — default 175 XP
- `Movie night with full setup` — default 150 XP
- `Long lunch out at a restaurant (not fast food)` — default 160 XP

**Tier 3 Templates:**
- `Day trip to anywhere outside your city` — default 500 XP
- `Buy a piece of clothing or gear you've been delaying` — default 450 XP
- `Full spa or self-care day` — default 480 XP

**Tier 4 Templates:**
- `Weekend trip (2 days, planned destination)` — default 1000 XP
- `Buy the course, software, or tool you've been delaying` — default 900 XP
- `Concert, event, or experience ticket` — default 850 XP

**Tier 5 Templates:**
- `International trip` — default 5000 XP
- `Major gear or technology purchase` — default 3500 XP
- `Fund a personal milestone goal` — default 4000 XP

### 3.5 Anti-Abuse Rules for Rewards

1. **No XP cost reduction after creation.** You can raise the price. Never lower it.
2. **No stacking.** Only one reward per tier can be active (earned, awaiting claim) at a time.
3. **72-hour claim window.** Earn it, actually do it within 72 hours, mark it claimed. Let it expire = XP refunded, streak -1 day.
4. **Tier 2+ requires a trigger gate.** Select a gate completed within the last 48 hours at claim time.
5. **Tier 3+ requires zero Dark Mana.** No major rewards while you have outstanding debt.
6. **Rank gate cannot be bypassed.** Not by extra XP, not by streaks, not by any item.
7. **Rewards flagged as harmful are blocked.** Any reward containing restriction-based language (skip, avoid, eat less, miss, cancel) will be flagged for review and blocked from activation.

---

## 4. Punishment Design Rules

### 4.1 What Good Punishments Look Like

A good punishment has all of the following:

- **It is a concrete physical or mental action.** Something you do, not something you avoid.
- **It is unpleasant but not harmful.** It should feel like genuine effort. It should not damage your health, your relationships, or your mental state.
- **It is completable within 24 hours.** If it takes a week, it's not a punishment — it's a life change.
- **It is proportional to the failure.** Missing a small task should not trigger your hardest punishment.
- **It has a clear completion condition.** `"100 pushups"` is complete when done. `"Work harder"` has no completion condition.
- **It builds something.** The best punishments are things that, while unpleasant in the moment, leave you marginally better: physical fitness, knowledge, a difficult task completed.

**Good punishment examples:**
```
"100 pushups (can be broken into sets, must be completed same day)" — redeems 10 DM
"2-hour deep work session on the subject of the failed gate" — redeems 15 DM
"Wake up 1 hour earlier than normal for the next 3 days" — redeems 20 DM
"Cold shower (3 minutes)" — redeems 5 DM
"Write a 500-word reflection on why the gate failed and how to prevent recurrence" — redeems 10 DM
"Complete the failed gate first thing tomorrow morning before any other task" — redeems 8 DM
"No entertainment (shows, games, social media) for 24 hours" — redeems 12 DM
"3km run or 30-minute intense workout" — redeems 15 DM
```

### 4.2 What Bad Punishments Look Like

**Do not create punishments that:**

- Cause physical harm. (`"Burn my hand"`, `"Go without food"`, `"Sleep deprivation"` — these are never acceptable.)
- Have no completion condition. (`"Feel bad about it"`, `"Be more disciplined"` — these cannot be completed or marked done.)
- Last longer than 7 days. Punishments with indefinite duration become background noise and lose all impact.
- Are identical to your existing good habits. If you already run every morning, `"go for a run"` is not a punishment — it costs you nothing.
- Are humiliating in ways that involve other people without their consent.
- Are so extreme that you'll avoid doing them and accumulate debt instead. A punishment you'll never complete is worse than no punishment at all.
- Target your identity rather than your behaviour. `"You're lazy, sit and think about it"` — the punishment must be an action, not a label.
- Are about restriction of food, water, sleep, or medication. These are never punishments.

**Bad punishment examples with explanations:**
```
❌ "Skip meals for a day" — Dangerous. Restriction of necessities is never permitted.
❌ "Regret it" — Not an action. Cannot be completed.
❌ "Work all night" — Sleep deprivation is physical harm.
❌ "Tell my friends I failed" — Involves others without clear consent and causes shame, not correction.
❌ "Delete all my rewards" — This punishes your future self for your past self's failure. Disproportionate and demotivating.
❌ "Never watch TV again" — Indefinite duration, no completion condition.
❌ "Hurt myself" — Absolute ban. Any self-harm framing triggers a system block.
```

### 4.3 Punishment Severity Tiers

Punishments are matched to failure severity. The system will suggest a tier when a gate fails based on its rank.

| Tier | Dark Mana Redeemed | Triggered by | Duration | Difficulty description |
|------|--------------------|-------------|---------|------------------------|
| Minor | 5 DM | E or C Gate failure | Same day | Uncomfortable but quick. Cold shower, 50 pushups, 30-min extra work. |
| Moderate | 10–15 DM | B Gate failure / 1st postponement | 24 hours | Genuinely hard. 100 pushups, 2-hour deep work, early wake-up protocol. |
| Major | 20–25 DM | A Gate failure / Red Gate | 48 hours | Demanding and meaningful. Multi-session physical challenge, extended deep work, a difficult task you've been avoiding. |
| Critical | 30+ DM | S Gate failure / repeated Red Gate | Up to 7 days | Reserved for catastrophic failures only. A structured re-commitment protocol. Must be designed carefully. |

### 4.4 System-Provided Punishment Templates

These are built-in templates. The system will suggest one from the appropriate tier when a gate fails. Users can accept the suggestion, pick a different one from their registry, or add a new one.

**Minor Tier (5 DM):**
- `Cold shower — 3 full minutes` — 5 DM
- `50 pushups (sets allowed, same day)` — 5 DM
- `30-minute no-phone, no-entertainment block` — 5 DM
- `Handwrite a 1-paragraph failure log` — 5 DM

**Moderate Tier (10–15 DM):**
- `100 pushups (sets allowed, same day)` — 10 DM
- `3km run or 30-minute intense workout` — 15 DM
- `2-hour deep work session (no breaks, phone away)` — 15 DM
- `Write a 500-word reflection: what failed and why` — 10 DM
- `Wake 1 hour earlier tomorrow` — 10 DM

**Major Tier (20–25 DM):**
- `Complete the failed gate before starting anything else tomorrow` — 20 DM
- `4-hour focused work block (2×2h with 10-min break)` — 25 DM
- `Full physical session: run 5km or 200 pushups + 100 squats` — 25 DM
- `24-hour entertainment blackout (no shows, no games, no social media)` — 20 DM

**Critical Tier (30+ DM):**
- `7-day ARISE protocol: complete 1 B-Rank task every day for 7 consecutive days` — 35 DM
- `Design and commit to a restructured schedule for the coming week (written, specific)` — 30 DM

### 4.5 Anti-Abuse Rules for Punishments

1. **Minimum redemption value per tier is enforced.** You cannot create a Minor punishment that redeems 30 DM. The system caps redemption per tier.
2. **Dual cost is always applied.** Completing a punishment removes Dark Mana AND costs equal XP. This is permanent and cannot be waived.
3. **Redemption cost multiplier.** Dark Mana redemption via punishment costs `Dark Mana value × 1.5 XP` (not 1:1). Carrying debt is always net negative.
4. **Corruption multiplier.** Each day you carry unredeemed Dark Mana, your next failure's penalty increases by 10%. Debt that sits grows.
5. **Harm detection.** Punishments containing keywords related to food restriction, sleep deprivation, self-harm, or indefinite duration are blocked at creation.
6. **No retroactive reduction.** Once a punishment is created, its difficulty and redemption value cannot be lowered. Only raised.
7. **Completion is verified by self-report.** The system trusts you. If you lie to the system about completing a punishment, you are only sabotaging yourself.

---

## 5. XP & Progression Rules (V5 Fixes)

### Changes from V4

| Rule | V4 | V5 |
|------|----|----|
| E-Rank daily XP cap | None | Max 15 XP/day from E-Rank tasks |
| Weekly threshold counting | All tasks | Only C-Rank and above count toward 300 XP |
| Task diversity check | None | At least 3 categories must contribute to weekly XP |
| Flow State trigger | Any 3 tasks in 2h | 3 tasks of C-Rank or above in 2h |
| Deadline creation | Any time | Must be ≥ current time + (rank × 30 mins) |
| No-deadline tasks | Default rank | Auto-assigned E-Rank regardless of selection |
| Active gate limit | Unlimited | Max 20 simultaneous active gates |
| Decay measurement | Daily (1%/day) | Weekly rolling window: no decay if ≥ 300 XP in last 7 days |
| XP decay trigger | 1 day inactivity | Full 7-day window below threshold |
| DECEASED ARISE reward | XP lost permanently | ARISE restores 50% of decayed XP as Return Bonus |

### Progression formula (unchanged)
- **Level**: `floor(Total XP / 500) + 1`
- **Rank**: E (L1–2), D (L3–4), C (L5–7), B (L8–11), A (L12–16), S (L17+)
- **BID**: `(Level × 1,000,000) + (Total XP × 10,000) + (Streak × 500,000)`
- **Diminishing returns above 50 XP base**: `Effective XP = 50 + log10(Base - 49) × 10`

---

## 6. Dark Mana & Redemption Rules (V5 Fixes)

### Changes from V4

| Rule | V4 | V5 |
|------|----|----|
| Redemption XP cost | 1:1 (DM = XP cost) | 1.5:1 (10 DM = 15 XP cost) |
| Corruption multiplier | None | +10% to next penalty per day of unredeemed debt |
| Tier 3+ reward block | None | Hard block if Dark Mana > 0 |
| Tier 1–2 reward access | Unrestricted | Unrestricted (small rewards allowed during debt) |

### Dark Mana accumulation (unchanged)
- Gate failure: **+10 DM**
- Postponement: **+5 DM**, immediate **-5 XP**
- Red Gate failure: **+25 DM**, **-50% of rank-level XP**
- STAGNANT week: **2x decay rate** (not DM, but functionally equivalent)

---

## 7. UI Instruction Copy — Ready to Implement

This section contains finalized instruction text for each page. Copy these directly into the UI as tooltips, onboarding modals, empty-state text, or contextual help panels.

### 7.1 Dungeon Gates Page — Instruction Panel

**Header**: `How to create a gate that actually means something`

```
A gate is a contract. When you create it, you're committing to complete a specific action 
by a specific time. Here's how to make it real:

RANK HONESTLY
E-Rank = 15 minutes or less. C-Rank = 30–60 minutes of focus. B-Rank = 90+ minutes. 
A-Rank = several hours of hard work. S-Rank = something you've been avoiding for weeks.
If you inflate ranks, your XP means nothing and your rewards feel hollow.

SET A REAL DEADLINE
No backdating. If you're not willing to set a deadline, set the rank to E and move on.
A task without a deadline is a wish, not a gate.

E-RANK DAILY CAP
You can only earn 15 XP from E-Rank tasks per day. Small tasks don't maintain your 
ACTIVE status — only C-Rank and above count toward your weekly 300 XP threshold.

THE BOSS SHIELD
Gates with subtasks cannot be completed until every subtask is cleared. 
Don't add fake subtasks to make a small task look bigger.
```

### 7.2 Rewards Page — Instruction Panel

**Header**: `Rewards you actually feel`

```
XP is power. Spending it should feel like something.

HOW TO BUILD A REWARD THAT WORKS
Name the exact thing you will do. Not "relax" — "watch one movie, phone off, snacks ready."
Assign a tier based on how indulgent this genuinely is for you, not what sounds reasonable.
Set a price that reflects the real cost in effort to earn it.

THE TWO LOCKS
Every reward has two keys: XP cost and streak/rank condition. 
You cannot skip the streak condition with extra XP. 
Consistency is the second currency.

THE 72-HOUR RULE
Once you buy a reward, you have 72 hours to actually do it and mark it claimed.
A reward that sits in "earned" forever is not a reward. Take it. You earned it.

WHAT NOT TO ADD
— Daily habits (sleep, walks, meals) — these are not rewards
— Skipping or avoiding things — not a reward
— Anything vague with no completion condition
— Anything that would feel fine without earning it first
```

### 7.3 Punishments Page — Instruction Panel

**Header**: `Punishments that correct, not destroy`

```
Dark Mana is debt. Punishments are how you pay it back — but paying it back costs 
both effort and XP. Failure always has a permanent price.

HOW TO BUILD A PUNISHMENT THAT WORKS
Make it a concrete physical or mental action. Something you DO.
Make it unpleasant but achievable within 24 hours.
Make it build something — fitness, focus, or the completion of what you failed.
Make sure the difficulty matches the failure tier.

THE DUAL COST RULE
Completing a punishment removes your Dark Mana debt AND costs the same amount in XP.
This is permanent. You cannot fully undo a failure. You can only recover from it.

WHAT NOT TO ADD
— Anything involving restriction of food, water, or sleep
— Self-harm of any kind
— Punishments with no completion condition ("be better")
— Anything so extreme you'll never actually do it
— Punishments that punish other people or involve others without consent

THE CORRUPTION MULTIPLIER
Every day you leave Dark Mana unredeemed, your next failure's penalty grows by 10%.
Debt that sits gets expensive. Clear it early.
```

### 7.4 Dashboard — Status Tooltips

**ACTIVE**: `You're in good standing. Keep earning. Don't get comfortable.`

**STAGNANT**: `You've earned less than 300 XP this week. Decay is doubled. Complete at least one B-Rank task today to reverse this.`

**PENALTY**: `Your total XP has gone negative. The shop and shadow extraction are locked. Your only path forward is clearing Dark Mana debt.`

**DECEASED**: `You've been absent for 7+ days. Your power has decayed. Complete one B-Rank task to trigger ARISE and recover 50% of what you lost. The system waited.`

---

*End of Document — Shadow Monarch System V5 Design Bible*
*Authored by: The System Architect*
*This document is the single source of truth. All feature implementations must reference it.*
