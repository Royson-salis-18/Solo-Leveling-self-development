# Solo-Leveling Authentication & Database Setup Guide

## 🚀 Quick Start

### 1. **Supabase Project Setup**

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Get your **Project URL** and **Anon Public Key** from Settings → API
3. Update `web/src/lib/supabase.ts` with your credentials

### 2. **Database Schema Setup**

**IMPORTANT: Backup your current database before running these steps!**

#### Option A: Full Reset (Recommended for Fresh Start)
```sql
-- Run this in Supabase SQL Editor to DELETE old schema
drop table if exists active_penalties cascade;
drop table if exists reward_grants cascade;
drop table if exists reward_redemptions cascade;
drop table if exists contracts cascade;
drop table if exists daily_contracts cascade;
drop table if exists penalties cascade;
drop table if exists rewards cascade;
drop table if exists activity_log cascade;
drop table if exists user_points cascade;
drop table if exists daily_points cascade;
drop table if exists tasks cascade;
drop table if exists quests cascade;
drop table if exists users cascade;
drop table if exists user_profiles cascade;
drop table if exists leaderboard_cache cascade;
```

#### Option B: Keep Existing Data
- Skip the DROP commands above
- Run only the CREATE TABLE commands from `supabase_schema.sql`

#### Install New Schema
1. Open Supabase SQL Editor
2. Copy entire content of `supabase_schema.sql`
3. Paste and run (this creates all tables with proper relationships)
4. Run refresh function: `select refresh_leaderboard();`

### 3. **Enable Supabase Auth**

1. Go to **Authentication → Providers**
2. Click **Email** (should be enabled by default)
3. Configure:
   - ✅ Email Confirmations (can disable for testing)
   - ✅ Double Confirm Email Change (optional)

### 4. **Environment Variables**

Create `.env.local` in `web/` folder:

```env
VITE_SUPABASE_URL=your_project_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### 5. **Test the App**

```bash
cd web
npm install
npm run dev
```

Visit `http://localhost:5174` and you should see the **Cyberpunk Login Page**! 🤖

---

## 📊 Database Schema Overview

### **user_profiles** (Extends Supabase Auth)
```sql
user_id (UUID)      -- Links to auth.users
email (TEXT)        -- User email
name (TEXT)         -- Character name
level (INTEGER)     -- Current level (starts at 1)
total_points (INT)  -- Lifetime XP (starts at 0)
```

### **quests** (Hard Mode - Reduced XP)
```sql
Points reduced by ~65% for difficulty:
- Urgent task: 35 XP (was 100)
- Meeting/Deploy: 28 XP (was 80)
- Code Review: 21 XP (was 60)
- Exercise: 18 XP (was 50)
```

### **rewards** (Cheaper in Hard Mode)
```sql
Coffee Break:    50 XP  (was 100)
Gaming Session:  100 XP (was 200)
Movie Night:     150 XP (was 300)
Weekend Trip:    250 XP (was 1200)
```

### Other Tables
- `daily_points` - Track daily progress
- `activity_log` - User action history
- `reward_redemptions` - Purchase history
- `daily_contracts` - Daily challenges
- `penalties` - (Optional) Advanced penalty system
- `leaderboard_cache` - Top 100 users ranking

---

## 🔐 Authentication Flow

### Registration
1. User clicks "REGISTER"
2. Fills Name, Email, Password
3. System creates:
   - Supabase Auth user (`auth.users`)
   - User profile with Level 1, 0 XP
4. Auto-login after registration

### Login
1. User enters Email + Password
2. Verifies with Supabase Auth
3. Fetches user profile
4. Redirects to Dashboard

### Logout
- Clears session
- Redirects to Login page

---

## 🛡️ RLS Policies (Production Security)

To enable Row Level Security (protect user data), uncomment the RLS section in `supabase_schema.sql`:

```sql
alter table user_profiles enable row level security;
alter table quests enable row level security;
-- ... etc

create policy "Users can view own profile" on user_profiles
  for select using (auth.uid() = user_id);
```

**Current Status:** RLS disabled for development (anon key can access all data)
**When to enable:** Before deploying to production!

---

## 🎮 Feature Breakdown

### Pages
- **Dashboard** - Overview with stats & charts
- **Quests** - Create/complete quests + NLP import
- **Rewards** - Redeem rewards with XP
- **Leaderboard** - Top 100 players ranking
- **Profile** - Edit user info + stats

### Technical Stack
- **Frontend:** React 18 + TypeScript + Vite
- **Database:** PostgreSQL (Supabase)
- **Auth:** Supabase Auth (built on GoTrue)
- **Charts:** Recharts (RadarChart, BarChart, PieChart)
- **Styling:** Custom CSS with cyberpunk neon theme

---

## 🚨 Troubleshooting

### "Supabase not initialized"
→ Check `.env.local` has correct URL and API key

### Can't login after registration
→ Check email confirmation required setting in Auth → Providers

### Leaderboard cache outdated
→ Run: `select refresh_leaderboard();` in SQL Editor

### Points not calculating correctly
→ All values reduced 65% for hard mode - check `detectPoints()` in `nlpParser.ts`

---

## 📝 API Endpoints (Examples)

```typescript
// Fetch user profile
const { data } = await supabase
  .from("user_profiles")
  .select("*")
  .eq("user_id", userId)
  .single();

// Create quest
await supabase.from("quests").insert({
  user_id: userId,
  title: "Task name",
  points: 25,
  category: "Work"
});

// Redeem reward
await supabase.from("reward_redemptions").insert({
  user_id: userId,
  reward_id: rewardId
});

// Update leaderboard cache
select refresh_leaderboard();
```

---

## 🎯 Next Steps

1. ✅ Deploy Supabase schema via SQL Editor
2. ✅ Add `.env.local` with API credentials
3. ✅ Test Registration → Dashboard flow
4. ✅ Verify NLP quest import works
5. 🔄 Enable RLS for production
6. 🔄 Wire up real quest/reward data from Supabase

---

**Version:** 2.0 (Cyberpunk Auth Edition)
**Last Updated:** April 15, 2026
