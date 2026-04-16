// Simple NLP parser for extracting tasks from text schedules
// Handles common patterns from ChatGPT/Claude outputs

export interface ParsedTask {
  title: string;
  description?: string;
  category: string;
  points: number;
  deadline?: string;
  subtasks?: string[];
  priority?: "high" | "medium" | "low";
}

export interface ParsedReward {
  name: string;
  category?: string;
  points?: number;
}

const PRIORITY_KEYWORDS = {
  high: ["urgent", "asap", "priority", "important", "critical", "must", "high priority"],
  medium: ["medium", "moderate", "normal"],
  low: ["low", "optional", "nice-to-have", "whenever"],
};

const TIMING_PATTERNS = {
  today: /today|this morning|this afternoon|this evening/i,
  tomorrow: /tomorrow|next morning|next afternoon/i,
  thisWeek: /this week|within a week|by friday|by end of week/i,
  nextWeek: /next week|following week/i,
  specific: /(\d{1,2}\/\d{1,2}|january|february|march|april|may|june|july|august|september|october|november|december)/i,
};

export function parseScheduleText(text: string): ParsedTask[] {
  const tasks: ParsedTask[] = [];
  const lines = text.split("\n").filter((line) => line.trim());

  let currentTask: Partial<ParsedTask> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect task headers (lines with numbers/bullets)
    const isTaskHeader = /^[\d\-\*\•\.][\s\)]|^#{1,3}\s|^\[\s*\]|\(\s*\)/.test(trimmed);

    if (isTaskHeader || (currentTask && isNewTask(trimmed))) {
      // Save previous task
      if (currentTask && currentTask.title) {
        tasks.push(normalizeTask(currentTask as ParsedTask));
      }

      // Start new task
      const taskTitle = cleanTaskText(trimmed);
      currentTask = {
        title: taskTitle,
        category: detectCategory(taskTitle),
        points: detectPoints(taskTitle),
        priority: detectPriority(taskTitle),
        deadline: detectTiming(taskTitle),
        subtasks: [],
      };
    } else if (currentTask) {
      // This is a subtask or additional detail
      if (isSubtaskLine(trimmed)) {
        const subtaskText = cleanTaskText(trimmed);
        if (!currentTask.subtasks) currentTask.subtasks = [];
        currentTask.subtasks.push(subtaskText);
      } else if (trimmed.length > 10 && !currentTask.description) {
        // Could be a description
        currentTask.description = trimmed;
      }
    }
  }

  // Save last task
  if (currentTask && currentTask.title) {
    tasks.push(normalizeTask(currentTask as ParsedTask));
  }

  return tasks.filter((t) => t.title.length > 2);
}

function isNewTask(line: string): boolean {
  // Check if this looks like a new task (capitalized, longer, no indent)
  return /^[A-Z]/.test(line) && line.length > 8 && !line.startsWith("  ");
}

function isSubtaskLine(line: string): boolean {
  // Subtasks are typically indented or have bullets/checkboxes
  return /^\s{2,}[\-\*\•]|^\s{2,}\d\.|^\s{2,}\[\s*\]|\(\s*\)/.test(line);
}

function cleanTaskText(text: string): string {
  return text
    .replace(/^[\d\-\*\•\.\(\)\[\]]+[\s\)]*/, "")
    .replace(/^#+\s+/, "")
    .trim();
}

function detectCategory(text: string): string {
  const lower = text.toLowerCase();

  if (/work|meeting|project|code|development|deploy|review|email|report/i.test(lower)) {
    return "Work";
  }
  if (/exercise|gym|run|walk|yoga|meditation|sleep|eat|health|fitness|sport/i.test(lower)) {
    return "Health";
  }
  if (/read|learn|study|course|tutorial|book|python|javascript|programming/i.test(lower)) {
    return "Learning";
  }
  if (/personal|home|hobby|shopping|clean|organize|call|relax|fun/i.test(lower)) {
    return "Personal";
  }

  return "General";
}

function detectPoints(text: string): number {
  const lower = text.toLowerCase();

  // Check for explicit point values
  const pointMatch = text.match(/(\d+)\s*(points?|xp|hp)/i);
  if (pointMatch) {
    return Math.min(Math.floor(parseInt(pointMatch[1]) * 0.35), 175);
  }

  // Estimate based on keywords (hard mode - 65% reduction)
  if (/urgent|critical|important|priority/.test(lower)) return 35;
  if (/meeting|presentation|deploy|complete project/.test(lower)) return 28;
  if (/code review|bug fix/.test(lower)) return 21;
  if (/exercise|gym|yoga/.test(lower)) return 18;
  if (/read|learn|tutorial/.test(lower)) return 14;
  if (/email|reply|message/.test(lower)) return 7;
  if (/relax|break|rest/.test(lower)) return 3;

  return 10; // Default
}

function detectTiming(text: string): string | undefined {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  if (TIMING_PATTERNS.today.test(text)) {
    return formatDate(today);
  }
  if (TIMING_PATTERNS.tomorrow.test(text)) {
    return formatDate(tomorrow);
  }
  if (TIMING_PATTERNS.thisWeek.test(text)) {
    return formatDate(new Date(today.setDate(today.getDate() + 3)));
  }
  if (TIMING_PATTERNS.nextWeek.test(text)) {
    return formatDate(nextWeek);
  }

  // Try to extract specific dates
  const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})/);
  if (dateMatch) {
    const month = parseInt(dateMatch[1]);
    const day = parseInt(dateMatch[2]);
    const year = new Date().getFullYear();
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return undefined;
}

function detectPriority(text: string): "high" | "medium" | "low" {
  const lower = text.toLowerCase();
  if (PRIORITY_KEYWORDS.high.some((kw) => lower.includes(kw))) return "high";
  if (PRIORITY_KEYWORDS.low.some((kw) => lower.includes(kw))) return "low";
  return "medium";
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function normalizeTask(task: ParsedTask): ParsedTask {
  return {
    ...task,
    title: task.title.substring(0, 100),
    description: task.description?.substring(0, 500),
    subtasks: task.subtasks?.filter((s) => s.length > 2).slice(0, 10),
  };
}

// Extract suggested rewards from text
export function parsePotentialRewards(text: string): ParsedReward[] {
  const rewards: ParsedReward[] = [];
  const lower = text.toLowerCase();

  // Common reward patterns
  const rewardPatterns = [
    { keyword: /coffee|break|relax/, reward: "Coffee break" },
    { keyword: /movie|netflix|entertainment/, reward: "Movie/Entertainment" },
    { keyword: /workout|gym|exercise/, reward: "Gym session" },
    { keyword: /meal|food|eat/, reward: "Favorite meal" },
    { keyword: /rest|sleep|nap/, reward: "Rest day" },
    { keyword: /fun|game|play/, reward: "Gaming session" },
    { keyword: /walk|park|nature/, reward: "Nature walk" },
    { keyword: /music|podcast/, reward: "Music/Podcast time" },
  ];

  const foundRewards = new Set<string>();
  for (const pattern of rewardPatterns) {
    if (pattern.keyword.test(lower) && !foundRewards.has(pattern.reward)) {
      rewards.push({ name: pattern.reward, category: "Instant" });
      foundRewards.add(pattern.reward);
    }
  }

  // If no rewards found, suggest defaults
  if (rewards.length === 0) {
    rewards.push({ name: "Coffee break", category: "Instant" });
    rewards.push({ name: "Gaming session", category: "Medium" });
  }

  return rewards.slice(0, 5);
}
