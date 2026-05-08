# Shadow Monarch System: Technical Architecture & Core Logic

## 1. Executive Summary
The **Shadow Monarch System** is a high-stakes productivity and gamification platform inspired by the *Solo Leveling* universe. It transforms task management into a "Hunter" progression experience, where every completed objective (Quest) contributes to the user's Mana (XP) and rank, while failure incurs tangible setbacks, including XP loss and the accumulation of "Dark Mana."

---

## 2. System Architecture Overview
The system is built as a React-based web application with a Supabase (PostgreSQL) backend. It operates through three primary layers:
1.  **UI/UX Layer**: Immersive "glassmorphic" interface providing real-time feedback on user status.
2.  **Service Layer (SystemAPI)**: Centralized logic for task completion, raid management, and AI interactions.
3.  **Engine Layer (Level Engine)**: The mathematical core that manages XP normalization, rank calculation, and progression synchronization.

---

## 3. The Level Engine: XP & Progression
The Level Engine (`levelEngine.ts`) is the system's "brain." It ensures that progression is meaningful and resistant to "grinding" low-effort tasks.

### 3.1 XP Normalization & Tiers
XP is not awarded linearly and has been recalibrated for **Super Hard Mode**:
-   **Base XP Tiers**:
    -   *E-Rank (Low)*: 5 XP
    -   *C-Rank (Mid)*: 15 XP
    -   *B-Rank (High)*: 25 XP
    -   *A-Rank (Super)*: 35 XP
    -   *S-Rank (Legendary)*: 50 XP
-   **Category Weights**: Different life areas have different multipliers:
    -   *Fitness*: 1.2 (High effort)
    -   *Learning/Academics*: 0.8 (Normalized for high volume)
    -   *Mindfulness/Social*: 1.1 (Mental well-being focus)
    -   *General/Errands*: 0.7 (Low complexity)
-   **Diminishing Returns**: Tasks with base XP > 50 are logarithmically dampened:
    `Effective XP = 50 + log10(Base - 49) * 10`. This enforces a hard ceiling on power gains.

### 3.2 Progression Synchronization (`syncProgression`)
This function is called after every XP-altering event. It performs:
1.  **Decay Calculation**: 1% XP deduction for every day of inactivity beyond a 1-day grace period.
2.  **Overdue Scans**: Cumulative penalties for overdue tasks (20% base, exponentially increasing with `daysLate`).
3.  **Weekly Activity Threshold**: Users must earn **300-500 XP per week** to maintain "ACTIVE" status. Falling below this threshold triggers "STAGNANT" or "DECAYING" status effects.
4.  **Rank Evaluation**: Assigns ranks (E to S) based on Level (calculated as `floor(XP / 500) + 1`).
5.  **Status Mapping**:
    -   `XP < 0`: **PENALTY MODE** (Restricted features).
    -   `Weekly XP < 300`: **STAGNANT** (Increased decay).
    -   `Inactivity > 7 Days`: **DECEASED** (Requires "ARISE" revival).

---

## 4. The Consequence Engine: Dark Mana & Punishments
The system implements a "hardcore" accountability model through Dark Mana and specialized redemption workflows.

### 4.1 Dark Mana Accumulation
Dark Mana is a "corruption" stat tracked in the database.
-   **Failure**: Failing a gate adds **+10 Dark Mana**.
-   **Postponement**: Postponing a deadline adds **+5 Dark Mana** and causes an immediate **-5 XP** drain.

### 4.2 Redemption Logic (Dual-Cost Penalty)
Located in the `RewardsPage.tsx` interface, the redemption system is split into two sections:
1.  **Active Mana Debt Redemption**: Only visible when `dark_mana > 0`.
2.  **Registry of Discipline**: A management area for all possible punishments.

**The "Dual-Cost" Rule**: When a punishment is triggered to redeem debt, the system performs an atomic update:
-   `dark_mana` is reduced by the punishment's value.
-   `total_points (XP)` is **also reduced** by the same amount.
*Rationale: Redemption requires both physical effort (doing the task) and a permanent sacrifice of power (XP), reinforcing the cost of failure.*

---

## 5. Task Management: Dungeon Gates
Missions are modeled as "Dungeon Gates" with complex lifecycles (`DungeonGatePage.tsx`).

### 5.1 Raid Mechanics
-   **Gate States**: Active, Pending (Overdue), Completed, Failed.
-   **Raid Control**: Users can Start, Pause, Resume, or Reset raid timers.
-   **Red Gates**: High-tier tasks (Legendary/Super) are designated as Red Gates. Failure results in a **50% XP deduction** and massive Dark Mana gain.

### 5.2 Recurrence & Subtasks
-   **Recurring Gates**: Managed via `taskUtils.ts`, using a "catch-up" sweep that ensures missed daily/weekly tasks reset to their next valid deadline without manual intervention.
-   **Boss Shield**: Gates with sub-objectives are locked until all subtasks are cleared, preventing users from claiming rewards before full completion.

---

## 6. Tactical Integrations
### 6.1 Shadow Extraction (RNG)
Upon completing high-tier quests, users have a probability-based chance to "Extract a Shadow":
-   **Legendary**: 100% chance (Guaranteed for peak performance).
-   **Super/High/Mid**: Sliding scale (40% down to 5%).
Shadows provide passive XP boosts (e.g., +10% XP resonance), which are calculated during quest completion.

### 6.2 Hunter Market Value (BID)
A dynamic algorithm calculates the user's "contract value":
`BID = (Level * 1,000,000) + (Total XP * 10,000) + (Streak * 500,000)`.
This acts as a high-level prestige metric shown on the Dashboard.

### 6.3 Absolute Authority (Flow State)
Triggered by completing **3 tasks within 2 hours**. While active, a **1.5x XP Resonance** multiplier is applied to all completions, rewarding momentum.

---

## 7. The Oracle AI (Gemini Integration)
The `OracleService.ts` provides AI-driven tactical advice using the Gemini 1.5 Flash API.
-   **Auditor Mode**: Concise, 1-2 sentence feedback based on debt and active gate count.
-   **Architect Mode**: Deep tactical analysis of the user's entire profile, history, and status.

---

## 8. System Maintenance Sweeps
The system maintains integrity through automated sweeps triggered during dashboard loads:
1.  **Heartbeat Sweep**: Updates `last_heartbeat` to prevent `DECEASED` status.
2.  **Overdue Sweep**: Converts expired active tasks to `PENDING` state.
3.  **Recurring Sweep**: Resets recurring tasks that were completed or failed in the past.
4.  **Gift Sweep**: Reclaims expired rental items in the Arsenal.

---

**Report Authored By**: The System Architect
**Version**: 4.2.0 (Redemption Update)
**Status**: STABLE
