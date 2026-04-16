# Life RPG (Vite Migration)

This repository has been migrated from Streamlit to a Vite + React frontend.

## Stack

- Vite + React + TypeScript
- Recharts for dashboard visualizations
- Supabase (Postgres + API)

## Run locally

```bash
cd web
npm install
npm run dev
```

Open `http://localhost:5173`.

## Environment

Create `web/.env`:

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

If env vars are missing, dashboard loads mock preview data.

## Database setup

Run `supabase_schema.sql` in Supabase SQL Editor.

## Features

### Pages

- **Dashboard** - Overview with level, XP, stats, weekly trends, and activity feed
- **Quests** - Create, manage, and track tasks with categories and points
- **Rewards** - Claim rewards with XP costs (3-tier system)
- **Leaderboard** - Ranked users with filtering
- **Profile** - User profile with stats, streaks, and category breakdown

### NLP Schedule Import 🧠

On the **Quests** page, click **📋 Import Schedule** to paste text from ChatGPT, Claude, or your calendar:

**What it does:**
- Parses natural language schedules and extracts tasks
- Auto-detects categories: Work, Health, Learning, Personal
- Assigns XP points based on task importance/keywords
- Extracts deadlines (today, tomorrow, next week, specific dates)
- Identifies subtasks from bullet points/indentation
- Suggests rewards based on content

**Example input:**

```
Monday Schedule:
1. Morning meeting (urgent, 10am) - 80 XP
2. Code review - 3 pull requests
3. Gym session (90 mins) - 50 XP
4. Read 30 pages of Clean Code book - 40 XP
5. Relax and gaming break
```

**What gets created:**
- "Morning meeting" - Work category, 100 XP, Today
- "Code review" - Work, 60 XP, with 3 subtasks
- "Gym session" - Health, 50 XP, specific time detected
- "Read 30 pages of Clean Code book" - Learning, 40 XP
- "Relax and gaming break" - Personal, 10 XP, Gaming reward suggested

**Parsing Rules:**
- **Categories**: Auto-detected from keywords (Work, Health, Learning, Personal)
- **Points**: 10-100 XP based on priority keywords (urgent/important = higher)
- **Timing**: Recognizes "today", "tomorrow", "this week", "next week", or specific dates
- **Subtasks**: Indented lines or bullet points become subtasks
- **Priorities**: high/medium/low based on keywords

## Current migrated pages

- Dashboard (clean layout + charts)
- Quests (full CRUD + NLP import 🆕)
- Rewards (interactive claim system)
- Leaderboard (with filters)
- Profile (editable with stats)

Next iteration is to wire all features to live Supabase backend.

