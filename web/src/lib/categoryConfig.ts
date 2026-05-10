/**
 * CATEGORY CONFIG — Canonical Registry
 *
 * Every task category in the system is defined here.
 * This is the single source of truth for:
 *   - Task creation dropdowns
 *   - NLP parser category detection
 *   - CATEGORY_STAT_MAP (which stat a task builds)
 *   - Domain grouping for the Domain Radar
 *   - Colors and icons in UI
 *
 * ═══════════════════════════════════════════════════════
 * THE 5 CORE STATS (modern life, gamified):
 *
 *  STR — Strength   → Physical discipline, body sovereignty
 *  INT — Intelligence → Mental output, knowledge, money, systems
 *  VIT — Vitality    → Health, longevity, energy management
 *  AGI — Agility     → Speed, execution, practical throughput
 *  SNS — Sense       → Emotional depth, creativity, connection
 *
 * THE 5 LIFE DOMAINS (modern world mapping):
 *
 *  ⚔️  PHYSICAL   — Body, movement, discipline   → STR + VIT
 *  🧠  MIND       — Intellect, finance, career    → INT
 *  🌊  SOUL       — Emotion, spirit, creativity   → SNS
 *  ⚡  EXECUTION  — Practical life management     → AGI
 *  🏗️  BUILDER    — Building, projects, wealth    → INT + AGI
 * ═══════════════════════════════════════════════════════
 */

export type StatKey = 'domain_physical' | 'domain_mind' | 'domain_soul' | 'domain_execution' | 'domain_builder';

export type DomainKey = 'Physical' | 'Mind' | 'Soul' | 'Execution' | 'Builder';

export interface CategoryDef {
  name: string;
  domain: DomainKey;
  stat: StatKey;
  color: string;        // Hex for UI
  icon: string;         // Emoji for display
  description: string;  // Shown in task creation to help users categorize correctly
  examples: string[];   // Example tasks
  isCustom?: boolean;   // True for user-defined categories
}

// ── DOMAIN METADATA ──────────────────────────────────────────────────────────

export const DOMAINS: Record<DomainKey, { label: string; stat: StatKey; color: string; icon: string; desc: string }> = {
  Physical: {
    label: 'Physical',
    stat: 'domain_physical',
    color: '#ff6b6b',
    icon: 'Sword',
    desc: 'Body, movement, physical discipline. Builds Strength & Vitality.'
  },
  Mind: {
    label: 'Mind',
    stat: 'domain_mind',
    color: '#a78bfa',
    icon: 'Brain',
    desc: 'Intellectual work, career, finance, and strategic thinking. Builds Intelligence.'
  },
  Soul: {
    label: 'Soul',
    stat: 'domain_soul',
    color: '#60a5fa',
    icon: 'Sparkles',
    desc: 'Emotional intelligence, relationships, creativity, and spiritual growth. Builds Sense.'
  },
  Execution: {
    label: 'Execution',
    stat: 'domain_execution',
    color: '#38bdf8',
    icon: 'Zap',
    desc: 'Practical life management, speed, and throughput. Builds Agility.'
  },
  Builder: {
    label: 'Builder',
    stat: 'domain_builder',
    color: '#ffd700',
    icon: 'Hammer',
    desc: 'Systems, projects, wealth building, and creation. Builds Intelligence & Agility.'
  },
};

// ── SYSTEM CATEGORIES (built-in) ─────────────────────────────────────────────

export const SYSTEM_CATEGORIES: CategoryDef[] = [
  // ── PHYSICAL DOMAIN ─────────────────────────────────────────────
  {
    name: 'Fitness',
    domain: 'Physical',
    stat: 'domain_physical',
    color: '#ff6b6b',
    icon: 'Dumbbell',
    description: 'Physical training, exercise, sport. The foundation of discipline.',
    examples: ['Morning run', 'Gym session', '100 pushups', 'Boxing training'],
  },
  {
    name: 'Health',
    domain: 'Physical',
    stat: 'domain_physical',
    color: '#34d399',
    icon: 'Heart',
    description: 'Medical care, nutrition, sleep hygiene. Protecting your body long-term.',
    examples: ['Doctor appointment', 'Track sleep', 'Meal prep', 'Take vitamins'],
  },
  {
    name: 'Wellness',
    domain: 'Physical',
    stat: 'domain_physical',
    color: '#6ee7b7',
    icon: 'Leaf',
    description: 'Recovery, rest, and physical self-care. The body needs maintenance.',
    examples: ['Cold shower', 'Recovery day', 'Stretching', 'Massage'],
  },
  {
    name: 'Personal Development',
    domain: 'Physical',
    stat: 'domain_physical',
    color: '#fb923c',
    icon: 'TrendingUp',
    description: 'Building character, habits, and discipline. The warrior within.',
    examples: ['Wake up at 5AM', 'No social media for 24h', 'Cold exposure', 'Hard conversation'],
  },

  // ── MIND DOMAIN ─────────────────────────────────────────────────
  {
    name: 'Work',
    domain: 'Mind',
    stat: 'domain_mind',
    color: '#a78bfa',
    icon: 'Briefcase',
    description: 'Professional responsibilities, career tasks, and deep work.',
    examples: ['Write report', 'Client meeting', 'Code review', 'Strategy planning'],
  },
  {
    name: 'Learning',
    domain: 'Mind',
    stat: 'domain_mind',
    color: '#818cf8',
    icon: 'BookOpen',
    description: 'Self-education, courses, and skill acquisition outside formal schooling.',
    examples: ['Watch lecture', '1h ML study', 'Read textbook', 'Practice language'],
  },
  {
    name: 'Academics',
    domain: 'Mind',
    stat: 'domain_mind',
    color: '#6366f1',
    icon: 'GraduationCap',
    description: 'Formal education tasks. Assignments, exams, and coursework.',
    examples: ['Assignment submission', 'Exam revision', 'Research paper', 'Lab report'],
  },
  {
    name: 'Finance',
    domain: 'Mind',
    stat: 'domain_mind',
    color: '#ffd700',
    icon: 'DollarSign',
    description: 'Financial intelligence, investing, budgeting, and wealth strategy.',
    examples: ['Review budget', 'Study investing', 'Tax filing', 'Track expenses', 'Research stocks'],
  },

  // ── BUILDER DOMAIN ──────────────────────────────────────────────
  {
    name: 'Side Projects',
    domain: 'Builder',
    stat: 'domain_builder',
    color: '#f59e0b',
    icon: 'Rocket',
    description: 'Building products, tools, or businesses outside your main work.',
    examples: ['Code feature', 'Write blog post', 'Ship MVP', 'Client freelance work'],
  },
  {
    name: 'Creative',
    domain: 'Builder',
    stat: 'domain_builder',
    color: '#f472b6',
    icon: 'Palette',
    description: 'Art, music, writing, design. Expressive output that feeds the soul.',
    examples: ['Write chapter', 'Draw for 30m', 'Record music', 'Design UI'],
  },

  // ── SOUL DOMAIN ─────────────────────────────────────────────────
  {
    name: 'Mindfulness',
    domain: 'Soul',
    stat: 'domain_soul',
    color: '#60a5fa',
    icon: 'Target',
    description: 'Meditation, introspection, and emotional regulation practices.',
    examples: ['10m meditation', 'Journaling', 'Breathwork', 'Digital detox hour'],
  },
  {
    name: 'Spirituality',
    domain: 'Soul',
    stat: 'domain_soul',
    color: '#c084fc',
    icon: 'Sparkle',
    description: 'Meaning, purpose, faith, and connection to something greater than yourself.',
    examples: ['Prayer', 'Reading philosophy', 'Gratitude practice', 'Nature walk'],
  },
  {
    name: 'Social',
    domain: 'Soul',
    stat: 'domain_soul',
    color: '#fb923c',
    icon: 'Users',
    description: 'Relationships, networking, and human connection. You don\'t level up alone.',
    examples: ['Call a friend', 'Team lunch', 'Network event', 'Help someone'],
  },
  {
    name: 'Family',
    domain: 'Soul',
    stat: 'domain_soul',
    color: '#f87171',
    icon: 'Home',
    description: 'Family responsibilities and meaningful time with loved ones.',
    examples: ['Family dinner', 'Help parents', 'Quality time with partner', 'Child activity'],
  },

  // ── EXECUTION DOMAIN ─────────────────────────────────────────────
  {
    name: 'Errands',
    domain: 'Execution',
    stat: 'domain_execution',
    color: '#38bdf8',
    icon: 'Zap',
    description: 'Practical life tasks that keep your environment functional.',
    examples: ['Grocery run', 'Pay bills', 'Doctor booking', 'Car service'],
  },
  {
    name: 'General',
    domain: 'Execution',
    stat: 'domain_execution',
    color: '#64748b',
    icon: 'Settings',
    description: 'Miscellaneous tasks that don\'t fit elsewhere but need doing.',
    examples: ['Clean desk', 'Organize files', 'Reply emails', 'Backup phone'],
  },
];

// ── MERGED CATEGORY MAP (stat lookup) ────────────────────────────────────────
// This replaces and extends CATEGORY_STAT_MAP in levelEngine.ts

export const CATEGORY_STAT_LOOKUP: Record<string, StatKey> = Object.fromEntries(
  SYSTEM_CATEGORIES.map(c => [c.name, c.stat])
) as Record<string, StatKey>;

// ── HELPERS ──────────────────────────────────────────────────────────────────

export const getCategoryDef = (name: string, customCategories: CategoryDef[] = []): CategoryDef | undefined =>
  [...SYSTEM_CATEGORIES, ...customCategories].find(c => c.name === name);

export const getCategoryColor = (name: string, customCategories: CategoryDef[] = []): string =>
  getCategoryDef(name, customCategories)?.color ?? '#64748b';

export const getCategoryIcon = (name: string, customCategories: CategoryDef[] = []): string =>
  getCategoryDef(name, customCategories)?.icon ?? '🔧';

export const getCategoryStat = (name: string, customCategories: CategoryDef[] = []): StatKey =>
  getCategoryDef(name, customCategories)?.stat ?? 'stat_agility';

/** All category names for task creation dropdowns */
export const getCategoryNames = (customCategories: CategoryDef[] = []): string[] =>
  [...SYSTEM_CATEGORIES, ...customCategories].map(c => c.name);

/** Categories grouped by domain */
export const getCategoriesByDomain = (customCategories: CategoryDef[] = []): Record<DomainKey, CategoryDef[]> => {
  const all = [...SYSTEM_CATEGORIES, ...customCategories];
  return {
    Physical:  all.filter(c => c.domain === 'Physical'),
    Mind:      all.filter(c => c.domain === 'Mind'),
    Soul:      all.filter(c => c.domain === 'Soul'),
    Execution: all.filter(c => c.domain === 'Execution'),
    Builder:   all.filter(c => c.domain === 'Builder'),
  };
};
