# Shadow Monarch System: GAME LOGIC V5 (Hard Mode)

This document serves as the primary source of truth for the system's gamification mechanics. Use these rules to calibrate future updates.

## 1. XP Calibration (Hard Mode)
XP rewards are strictly tiered to ensure every gain is earned through significant effort.

| Rank | Tier Name | Reward (XP) | Description |
| :--- | :--- | :--- | :--- |
| **S** | Legendary | 50 XP | Life-altering milestones or massive projects. |
| **A** | Super | 35 XP | High-intensity tasks requiring several hours. |
| **B** | High | 25 XP | Standard productivity blocks (90+ mins). |
| **C** | Mid | 15 XP | Routine tasks requiring focus. |
| **E** | Low | 5 XP | Basic maintenance and quick errands. |

### 1.1 Diminishing Returns (Logarithmic Dampening)
To prevent "Power Creep," any task with a base value > 50 XP is dampened:
`Effective XP = 50 + log10(Base XP - 49) * 10`

---

## 2. Status & Activity Thresholds
The System monitors weekly performance to determine the user's standing.

### 2.1 Weekly Activity Check
*   **ACTIVE**: Earn 300+ XP in the last 7 days.
*   **STAGNANT**: Earn < 300 XP in the last 7 days.
    *   *Effect*: 2x XP Decay rate and Oracle "Judgment" missions triggered.
*   **PENALTY**: Total XP < 0.
    *   *Effect*: Shadow extraction disabled, shop locked, mandatory Penalty Quests.
*   **DECEASED**: Inactive for > 7 days.
    *   *Effect*: Requires "ARISE" ritual (Redemption task) to restore account.

### 2.2 XP Decay
*   **Grace Period**: 1 day.
*   **Normal Decay**: 1% of total XP lost per day of inactivity.
*   **Nightmare Mode**: Compounding decay (3% per day).

---

## 3. Mission Architecture (Dungeon Gates)
### 3.1 Weekly Trials (S-Rank)
*   **Manifestation**: Every Sunday (or upon first login of the week).
*   **Requirement**: At least 3 "Nested Objectives" must be manifested and completed.
*   **Structure**:
    *   **Phase 1**: Identify the Challenge (15 XP).
    *   **Phase 2**: Execution (25 XP).
    *   **Phase 3**: Limit Break (50 XP).
    *   **Final Conquest**: Boss Elimination (100 XP).
*   **Total Max Yield**: 190 XP.

### 3.2 Penalty Protocols
*   Triggered by **Gate Failure** or **Deadline Postponement**.
*   Requires immediate physical or mental labor (e.g., "100 Pushups" or "4 Hour Deep Work").
*   Redeems "Dark Mana" debt but costs a matching amount of XP.

---

## 4. Item & Shadow Mechanics
### 4.1 Shadow Extraction (RNG)
*   Probability of successful extraction:
    *   **S-Rank Quest**: 100%
    *   **A-Rank Quest**: 40%
    *   **B-Rank Quest**: 15%
    *   **C/E-Rank Quest**: 2-5%
*   Shadows provide passive "Mana Resonance" (XP Multipliers).

### 4.2 Absolute Authority (Flow State)
*   **Trigger**: Complete 3 tasks within a 120-minute window.
*   **Buff**: +1.5x XP multiplier for the next 60 minutes.

---

**Last Updated**: 2026-05-08
**Mode**: SUPER HARD
**Status**: ACTIVE
