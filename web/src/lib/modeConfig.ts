export type ModeType = 'Easy' | 'Normal' | 'Hard' | 'Hell';

export interface ModeConfig {
  name: ModeType;
  xpMultiplier: number;
  decayRate: number;           // Daily XP decay as a fraction of total_points
  softDecayCapXp: number;      // Max XP removed per decay cycle (prevents wipeouts)
  gracePeriod: number;         // Days of inactivity before any decay kicks in
  streakGraceDays: number;     // Days you can miss WITHOUT breaking your streak (1 = skip 1 day freely)
  dmOnFail: number;            // Dark Mana gained on task failure
  failXpPenaltyRate: number;   // Fraction of task XP lost on failure (not total XP)
  dmCap: number;               // Max Dark Mana before auto-consequences
  deceasedThreshold: number;   // Days of no heartbeat before DECEASED status
  postponeEnabled: boolean;
  rankDownEnabled: boolean;
  partialCreditEnabled: boolean;
  compoundingDecay: boolean;
  permadeathChance: number;
  // Psychology
  resonanceBurstChance: number; // Probability of bonus XP "burst" after 3+ consecutive completions
  description: string;
  riskReward: string;
}

export const MODE_CONFIGS: Record<ModeType, ModeConfig> = {
  Easy: {
    name: 'Easy',
    xpMultiplier: 0.8,
    decayRate: 0,
    softDecayCapXp: 0,
    gracePeriod: 14,
    streakGraceDays: 2,     // Miss up to 2 days — streak survives
    dmOnFail: 3,
    failXpPenaltyRate: 0.1, // Lose only 10% of the gate's XP on failure
    dmCap: 50,
    deceasedThreshold: 14,
    postponeEnabled: true,
    rankDownEnabled: false,
    partialCreditEnabled: true,
    compoundingDecay: false,
    permadeathChance: 0,
    resonanceBurstChance: 0.15,
    description: "For hunters who prefer a steady, low-stress climb. No rank-down or XP decay. Ideal for building the habit first.",
    riskReward: "Low Risk / Low Reward"
  },
  Normal: {
    name: 'Normal',
    xpMultiplier: 1.0,
    decayRate: 0.01,
    softDecayCapXp: 30,     // Never lose more than 30 XP per day from decay
    gracePeriod: 5,
    streakGraceDays: 1,     // Miss 1 day — streak shows warning, not reset
    dmOnFail: 7,
    failXpPenaltyRate: 0.2, // Lose 20% of the task's XP on failure
    dmCap: 80,
    deceasedThreshold: 10,
    postponeEnabled: true,
    rankDownEnabled: false,
    partialCreditEnabled: false,
    compoundingDecay: false,
    permadeathChance: 0,
    resonanceBurstChance: 0.25, // 25% chance of Resonance Burst after flow streak
    description: "The standard system experience. Balanced growth with moderate discipline. Recommended for most hunters.",
    riskReward: "Standard Risk / Standard Reward"
  },
  Hard: {
    name: 'Hard',
    xpMultiplier: 1.5,
    decayRate: 0.02,
    softDecayCapXp: 60,     // Hard decay is real but capped
    gracePeriod: 2,
    streakGraceDays: 0,     // No grace — every day counts
    dmOnFail: 15,
    failXpPenaltyRate: 0.35, // 35% of gate XP lost on failure
    dmCap: 100,
    deceasedThreshold: 5,
    postponeEnabled: false,
    rankDownEnabled: true,
    partialCreditEnabled: false,
    compoundingDecay: false,
    permadeathChance: 0.05,
    resonanceBurstChance: 0.35, // Higher burst chance rewards the grind
    description: "For the elite. High stakes, no postponements, and real consequences. The rewards justify the discipline.",
    riskReward: "High Risk / High Reward"
  },
  Hell: {
    name: 'Hell',
    xpMultiplier: 2.5,
    decayRate: 0.03,
    softDecayCapXp: 100,    // Even Hell is capped — catastrophic wipeouts are not motivating
    gracePeriod: 1,
    streakGraceDays: 0,
    dmOnFail: 25,
    failXpPenaltyRate: 0.5, // 50% of the GATE's XP (not total) lost on failure
    dmCap: 100,
    deceasedThreshold: 3,
    postponeEnabled: false,
    rankDownEnabled: true,
    partialCreditEnabled: false,
    compoundingDecay: true,
    permadeathChance: 0.15, // Reduced from 0.3 — permadeath is a dramatic story beat, not routine loss
    resonanceBurstChance: 0.4,
    description: "The Shadow Monarch's domain. Compounding decay. Every missed day costs you. But the gains are unmatched.",
    riskReward: "Extreme Risk / Extreme Reward"
  }
};
