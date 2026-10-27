/**
 * The five life domains, what feeds them, and the System's prescribed directives for each.
 * Shared by the web dashboard ("Core Calibration") and the mobile home so both give the same advice.
 */
export type DomainName = "Physical" | "Mind" | "Soul" | "Execution" | "Builder";

export type Directive = { title: string; category: string; xp_tier: string; points: number; priority: string; description: string };

export const DOMAINS: Array<{ name: DomainName; key: "domain_physical" | "domain_mind" | "domain_soul" | "domain_execution" | "domain_builder"; color: string; blurb: string; categories: string[] }> = [
  { name: "Physical", key: "domain_physical", color: "#ff6b6b", blurb: "Strength & vitality", categories: ["Fitness", "Health", "Wellness", "Personal Development"] },
  { name: "Mind", key: "domain_mind", color: "#a78bfa", blurb: "Learning, work & money", categories: ["Work", "Learning", "Academics", "Finance"] },
  { name: "Soul", key: "domain_soul", color: "#60a5fa", blurb: "Emotion & connection", categories: ["Mindfulness", "Spirituality", "Social", "Family"] },
  { name: "Execution", key: "domain_execution", color: "#38bdf8", blurb: "Getting things done", categories: ["Errands", "General"] },
  { name: "Builder", key: "domain_builder", color: "#ffd700", blurb: "Projects & creation", categories: ["Side Projects", "Creative"] },
];

export function domainOfCategory(category: string | undefined | null): DomainName | null {
  return DOMAINS.find((d) => d.categories.includes(category ?? ""))?.name ?? null;
}

type Standings = Partial<Record<(typeof DOMAINS)[number]["key"], number | null>>;

/** Every domain with its current value, plus the weakest and strongest. */
export function domainStandings(s: Standings) {
  const all = DOMAINS.map((d) => ({ ...d, value: s[d.key] ?? 10 }));
  const lowest = [...all].sort((a, b) => a.value - b.value)[0];
  const highest = [...all].sort((a, b) => b.value - a.value)[0];
  return { all, lowest, highest, gap: highest.value - lowest.value };
}

export const stripEmoji = (t: string) => t.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "").trim();

/** Gate payload for "Arise": the directive, due tomorrow. */
export function directivePayload(d: Directive, domain: DomainName, due: string) {
  return {
    title: `[DIRECTIVE] ${stripEmoji(d.title)}`,
    category: d.category, xp_tier: d.xp_tier, priority: d.priority, deadline: due,
    description: `SYSTEM INSTRUCTION: ${d.description}. Complete this directive to align your ${domain} domain standing.`,
  };
}

/** One stable pick per day so the advice doesn't change on every refresh. */
export function directiveOfTheDay(domain: DomainName, day = new Date()): Directive {
  const list = SYSTEM_DIRECTIVES[domain];
  const n = Math.floor(day.getTime() / 86400000);
  return list[n % list.length];
}

export const SYSTEM_DIRECTIVES: Record<DomainName, Directive[]> = {
      Physical: [
        {
          title: "🏋️ Gravity Chamber: High-Intensity Interval Training",
          category: "Fitness",
          xp_tier: "Mid",
          points: 15,
          priority: "High",
          description: "Perform a 20-minute bodyweight circuit (pushups, squats, planks) to forge your vessel's strength."
        },
        {
          title: "🥗 Elixir of Life: Metabolic Restoration",
          category: "Health",
          xp_tier: "Low",
          points: 10,
          priority: "Normal",
          description: "Prep a nutrient-dense, high-protein meal and hydrate with 1L of water. Stabilize your cellular integrity."
        },
        {
          title: "❄️ Monarch's Vigil: Awakening Habit",
          category: "Personal Development",
          xp_tier: "Mid",
          points: 20,
          priority: "High",
          description: "Commit to a cold exposure challenge or complete a crucial difficult task early tomorrow."
        }
      ],
      Mind: [
        {
          title: "📖 Arcane Archives: Deep Study Phase",
          category: "Learning",
          xp_tier: "Mid",
          points: 20,
          priority: "High",
          description: "Dedicate 45 minutes of uninterrupted focus to learning a complex skill, programming concept, or research paper."
        },
        {
          title: "💰 Tactical Assessment: Financial Ledger Audit",
          category: "Finance",
          xp_tier: "Low",
          points: 10,
          priority: "Normal",
          description: "Map out your monthly budget, audit recent expenses, and check long-term investment resonance."
        },
        {
          title: "💼 Monarch's Strategy: High-Priority Sprint",
          category: "Work",
          xp_tier: "Mid",
          points: 15,
          priority: "High",
          description: "Execute a 60-minute deep-work session focusing solely on your highest-impact professional task."
        }
      ],
      Soul: [
        {
          title: "🧘 Cartenon Meditation: Inner Mana Stabilization",
          category: "Mindfulness",
          xp_tier: "Low",
          points: 10,
          priority: "Normal",
          description: "Unplug from all devices for 15 minutes. Practice deep rhythmic breathing and write in your journal."
        },
        {
          title: "🤝 Diplomatic Alliance: Connection Protocol",
          category: "Social",
          xp_tier: "Low",
          points: 10,
          priority: "Normal",
          description: "Initiate a meaningful conversation or call a key ally, friend, or mentor to align your frequencies."
        },
        {
          title: "🏠 Monarch's Hearth: Kinship Ritual",
          category: "Family",
          xp_tier: "Low",
          points: 10,
          priority: "Normal",
          description: "Spend 30 minutes of fully present, screen-free quality time with family or a loved one."
        }
      ],
      Execution: [
        {
          title: "🧹 Clearing the Perimeter: Environmental Cleanse",
          category: "General",
          xp_tier: "Low",
          points: 10,
          priority: "Normal",
          description: "Declutter and sanitize your immediate workspace or room. A clear environment accelerates execution speed."
        },
        {
          title: "📨 Settle the Ledger: Administrative Strike",
          category: "Errands",
          xp_tier: "Low",
          points: 10,
          priority: "Normal",
          description: "Clear 3 overdue micro-tasks, respond to outstanding emails, or pay pending utility bills immediately."
        },
        {
          title: "⚡ Monarch's Quick-Step: Task Blitz",
          category: "General",
          xp_tier: "Low",
          points: 10,
          priority: "Normal",
          description: "Complete one annoying chore you've been putting off for more than 48 hours."
        }
      ],
      Builder: [
        {
          title: "🚀 Construct Chimera: Side Project Sprint",
          category: "Side Projects",
          xp_tier: "Mid",
          points: 20,
          priority: "High",
          description: "Code a new feature, draft a system design, or ship a crucial update for your independent product/business."
        },
        {
          title: "🎨 Forge Soul-Weapon: Creative Outpouring",
          category: "Creative",
          xp_tier: "Mid",
          points: 15,
          priority: "Normal",
          description: "Spend 45 minutes on creative output (writing, design, UI prototyping, music, drawing) with zero constraints."
        },
        {
          title: "📐 Monarch's Blueprint: Launch Architecture",
          category: "Side Projects",
          xp_tier: "Mid",
          points: 15,
          priority: "High",
          description: "Outline the launch strategy, draft copy, or detail the MVP features of your next great venture."
        }
      ]
    };

/** Mastery word for a domain value (same bands as the web profile). */
export function masteryTier(value: number): { label: "DORMANT" | "INITIATED" | "AWAKENED" | "SOVEREIGN"; tone: "dim" | "good" | "accent" | "gold" } {
  if (value >= 80) return { label: "SOVEREIGN", tone: "gold" };
  if (value >= 55) return { label: "AWAKENED", tone: "accent" };
  if (value >= 30) return { label: "INITIATED", tone: "good" };
  return { label: "DORMANT", tone: "dim" };
}

/** 0–100: how evenly the five domains are developed, plus the web's label for it. */
export function developmentBalance(values: number[]): { score: number; label: string } {
  if (!values.length) return { score: 0, label: "—" };
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.abs(v - avg), 0) / values.length;
  const score = Math.max(0, Math.min(100, Math.round(100 - (variance / Math.max(avg, 1)) * 50)));
  return { score, label: score >= 85 ? "Sovereign sync" : score >= 65 ? "Balanced" : score >= 40 ? "Lopsided" : "Critical imbalance" };
}

/** Domain blurbs shown under each name on the mastery panel. */
export const DOMAIN_DESC: Record<DomainName, string> = {
  Physical: "Fitness and vitality", Mind: "Work and learning", Soul: "Emotion and connection", Execution: "Daily task agility", Builder: "Projects and creation",
};
