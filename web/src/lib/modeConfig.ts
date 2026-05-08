export type ModeType = 'Easy' | 'Normal' | 'Hard' | 'Nightmare';

export interface ModeConfig {
  name: ModeType;
  xpMultiplier: number;
  decayRate: number; // Daily decay percentage
  gracePeriod: number; // Days before decay kicks in
  dmOnFail: number;
  dmCap: number;
  deceasedThreshold: number; // Days of inactivity
  postponeEnabled: boolean;
  rankDownEnabled: boolean;
  partialCreditEnabled: boolean;
  compoundingDecay: boolean;
  permadeathChance: number;
  description: string;
  riskReward: string;
}

export const MODE_CONFIGS: Record<ModeType, ModeConfig> = {
  Easy: {
    name: 'Easy',
    xpMultiplier: 0.8,
    decayRate: 0,
    gracePeriod: 14,
    dmOnFail: 5,
    dmCap: 100,
    deceasedThreshold: 14,
    postponeEnabled: true,
    rankDownEnabled: false,
    partialCreditEnabled: true,
    compoundingDecay: false,
    permadeathChance: 0,
    description: "For hunters who prefer a steady, low-stress climb. No rank-down or XP decay.",
    riskReward: "Low Risk / Low Reward"
  },
  Normal: {
    name: 'Normal',
    xpMultiplier: 1.0,
    decayRate: 0.01,
    gracePeriod: 7,
    dmOnFail: 10,
    dmCap: 100,
    deceasedThreshold: 7,
    postponeEnabled: true,
    rankDownEnabled: false,
    partialCreditEnabled: false,
    compoundingDecay: false,
    permadeathChance: 0,
    description: "The standard system experience. Balanced growth with moderate discipline.",
    riskReward: "Standard Risk / Standard Reward"
  },
  Hard: {
    name: 'Hard',
    xpMultiplier: 1.5,
    decayRate: 0.03,
    gracePeriod: 3,
    dmOnFail: 20,
    dmCap: 100,
    deceasedThreshold: 5,
    postponeEnabled: false,
    rankDownEnabled: true,
    partialCreditEnabled: false,
    compoundingDecay: false,
    permadeathChance: 0.1,
    description: "For the elite. High stakes, no postponements, and real consequences.",
    riskReward: "High Risk / High Reward"
  },
  Nightmare: {
    name: 'Nightmare',
    xpMultiplier: 2.5,
    decayRate: 0.03, // Compounding 0.97 multiplier
    gracePeriod: 1,
    dmOnFail: 40,
    dmCap: 100,
    deceasedThreshold: 3,
    postponeEnabled: false,
    rankDownEnabled: true,
    partialCreditEnabled: false,
    compoundingDecay: true,
    permadeathChance: 0.3,
    description: "The Shadow Monarch's domain. 30-day lock-in. Compounding decay. Shadow permadeath.",
    riskReward: "Extreme Risk / Extreme Reward"
  }
};
