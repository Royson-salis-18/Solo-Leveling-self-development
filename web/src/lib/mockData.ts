export type Quest = {
  id: string;
  title: string;
  points: number;
  category: string;
  completed_at?: string | null;
  deadline?: string;
  description?: string;
};

export type DailyPoint = {
  date: string;
  daily_points: number;
};

export type Reward = {
  id: string;
  name: string;
  xp_cost: number;
  type: "instant" | "medium" | "major";
};

export type LeaderboardUser = {
  rank: number;
  email: string;
  name: string;
  level: number;
  total_points: number;
};

export type User = {
  email: string;
  name: string;
  level: number;
  total_points: number;
  avatar_url?: string;
  bio?: string;
};

export const mockQuests: Quest[] = [
  {
    id: "q1",
    title: "Finish sprint planning",
    points: 24,
    category: "Work",
    deadline: "2026-04-16",
    description: "Complete the team sprint planning for next iteration",
  },
  {
    id: "q2",
    title: "45 min workout",
    points: 15,
    category: "Health",
    deadline: "2026-04-15",
    description: "Complete a 45-minute cardio workout",
  },
  {
    id: "q3",
    title: "Read 20 pages",
    points: 9,
    category: "Learning",
    deadline: "2026-04-17",
    description: "Read at least 20 pages of a technical book",
  },
  {
    id: "q4",
    title: "Code review 2 PRs",
    points: 12,
    category: "Work",
    deadline: "2026-04-15",
    description: "Review and provide feedback on 2 pull requests",
  },
  {
    id: "q5",
    title: "Meditation session",
    points: 8,
    category: "Health",
    deadline: "2026-04-15",
    description: "Complete a 15-minute meditation session",
  },
];

export const mockCompletedQuests: Quest[] = [
  {
    id: "c1",
    title: "Morning jog",
    points: 10,
    category: "Health",
    completed_at: "2026-04-14T07:30:00",
  },
  {
    id: "c2",
    title: "Write blog post",
    points: 18,
    category: "Work",
    completed_at: "2026-04-14T15:00:00",
  },
  {
    id: "c3",
    title: "Learn TypeScript basics",
    points: 13,
    category: "Learning",
    completed_at: "2026-04-13T18:30:00",
  },
];

export const mockHistory: DailyPoint[] = [
  { date: "Mon", daily_points: 24 },
  { date: "Tue", daily_points: 36 },
  { date: "Wed", daily_points: 19 },
  { date: "Thu", daily_points: 45 },
  { date: "Fri", daily_points: 28 },
  { date: "Sat", daily_points: 12 },
  { date: "Sun", daily_points: 33 },
];

export const mockRewards: Reward[] = [
  {
    id: "r1",
    name: "Netflix Premium (1 month)",
    xp_cost: 250,
    type: "major",
  },
  {
    id: "r2",
    name: "Coffee from favorite shop",
    xp_cost: 50,
    type: "instant",
  },
  {
    id: "r3",
    name: "Gaming session (2 hours)",
    xp_cost: 100,
    type: "medium",
  },
  {
    id: "r4",
    name: "Favorite meal delivery",
    xp_cost: 125,
    type: "medium",
  },
  {
    id: "r5",
    name: "Rest day (no tasks)",
    xp_cost: 75,
    type: "instant",
  },
  {
    id: "r6",
    name: "Weekend getaway",
    xp_cost: 400,
    type: "major",
  },
];

export const mockLeaderboard: LeaderboardUser[] = [
  {
    rank: 1,
    email: "alex@example.com",
    name: "Alex Chen",
    level: 18,
    total_points: 1455,
  },
  {
    rank: 2,
    email: "jordan@example.com",
    name: "Jordan Smith",
    level: 16,
    total_points: 1296,
  },
  {
    rank: 3,
    email: "taylor@example.com",
    name: "Taylor Davis",
    level: 15,
    total_points: 1167,
  },
  {
    rank: 4,
    email: "casey@example.com",
    name: "Casey Johnson",
    level: 13,
    total_points: 1035,
  },
  {
    rank: 5,
    email: "morgan@example.com",
    name: "Morgan Lee",
    level: 12,
    total_points: 936,
  },
  {
    rank: 6,
    email: "current@example.com",
    name: "You",
    level: 11,
    total_points: 852,
  },
];

export const mockCurrentUser: User = {
  email: "current@example.com",
  name: "You",
  level: 16,
  total_points: 2840,
  bio: "Always pushing to level up 🚀",
};
