-- ==========================================
-- SOLO LEVELING - COMPREHENSIVE SUPABASE SCHEMA
-- Run this ONCE in the Supabase SQL Editor.
-- ==========================================

-- 1. Ensure UUID extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- CORE TABLES
-- ==========================================

-- 2. User Profiles (links to Supabase Auth)
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email          TEXT UNIQUE,
    name           TEXT NOT NULL DEFAULT 'Hunter',
    avatar_url     TEXT,
    bio            TEXT DEFAULT '',
    level          INTEGER DEFAULT 1,
    total_points   INTEGER DEFAULT 0,
    player_class   TEXT DEFAULT 'Warrior',
    player_rank    TEXT DEFAULT 'E',
    player_title   TEXT DEFAULT 'Newcomer',
    guild_id       UUID,                          -- FK added below after guilds table
    clan_id        UUID,                          -- FK added below after clans table
    is_boosted     BOOLEAN DEFAULT FALSE,
    age            INTEGER DEFAULT 18,
    weapon_of_choice TEXT DEFAULT 'Starter Blade',
    gear_style     TEXT DEFAULT 'Hybrid',
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tasks / Quests (self-referencing for unlimited subtask nesting)
CREATE TABLE IF NOT EXISTS tasks (
    id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    email          TEXT,
    title          TEXT NOT NULL,
    description    TEXT DEFAULT '',
    category       TEXT DEFAULT 'General',
    points         INTEGER DEFAULT 10,
    is_completed   BOOLEAN DEFAULT FALSE,
    priority       TEXT DEFAULT 'Normal',
    area           TEXT,
    deadline       DATE,
    time           TEXT,
    completed_at   TIMESTAMP WITH TIME ZONE,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Subtask / quest hierarchy (unlimited depth)
    parent_id      UUID REFERENCES tasks(id) ON DELETE CASCADE,
    -- Leader-assigned quests
    assigned_to    UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 4. User Points (daily XP log for charts & graphs)
CREATE TABLE IF NOT EXISTS user_points (
    id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    email          TEXT,
    date           DATE NOT NULL,
    daily_points   INTEGER DEFAULT 0,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, date)
);

-- ==========================================
-- SOCIAL FEATURES
-- ==========================================

-- 5. Friendship / Friend Requests
CREATE TABLE IF NOT EXISTS friendship (
    id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    requester_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    receiver_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    status         TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(requester_id, receiver_id)
);

-- ==========================================
-- REWARDS & PUNISHMENTS
-- ==========================================

-- 6. Rewards (claimable with XP)
CREATE TABLE IF NOT EXISTS rewards (
    id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name           TEXT NOT NULL,
    xp_cost        INTEGER DEFAULT 100,
    tier           TEXT DEFAULT 'instant' CHECK (tier IN ('instant', 'medium', 'major')),
    is_claimed     BOOLEAN DEFAULT FALSE,
    claimed_at     TIMESTAMP WITH TIME ZONE,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Punishments (XP deductions)
CREATE TABLE IF NOT EXISTS punishments (
    id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name           TEXT NOT NULL,
    xp_penalty     INTEGER DEFAULT 25,
    triggered      INTEGER DEFAULT 0,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- CLAN SYSTEM (3-5 member squads)
-- ==========================================

-- 8. Clans
CREATE TABLE IF NOT EXISTS clans (
    id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name           TEXT NOT NULL,
    description    TEXT DEFAULT '',
    leader_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Clan Members (junction table)
CREATE TABLE IF NOT EXISTS clan_members (
    id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    clan_id        UUID REFERENCES clans(id) ON DELETE CASCADE NOT NULL,
    user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role           TEXT DEFAULT 'member' CHECK (role IN ('leader', 'officer', 'member')),
    joined_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(clan_id, user_id)
);

-- 10. Clan Invites (audit trail)
CREATE TABLE IF NOT EXISTS clan_invites (
    id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    clan_id        UUID REFERENCES clans(id) ON DELETE CASCADE NOT NULL,
    inviter_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    invitee_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    invitee_email  TEXT,
    status         TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- GUILD SYSTEM (5-20 member organizations)
-- ==========================================

-- 11. Guilds
CREATE TABLE IF NOT EXISTS guilds (
    id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name           TEXT NOT NULL,
    description    TEXT DEFAULT '',
    leader_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    member_count   INTEGER DEFAULT 1,
    min_rank       TEXT DEFAULT 'E',
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add FK from user_profiles → clans/guilds (deferred so tables can be created in any order)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_profile_guild') THEN
        ALTER TABLE user_profiles ADD CONSTRAINT fk_profile_guild FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_profile_clan') THEN
        ALTER TABLE user_profiles ADD CONSTRAINT fk_profile_clan FOREIGN KEY (clan_id) REFERENCES clans(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ==========================================
-- COMPETITIVE / CHALLENGES
-- ==========================================

-- 12. 1v1 Challenges (Duels)
CREATE TABLE IF NOT EXISTS challenges (
    id                 UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    creator_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    opponent_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    target_points      INTEGER DEFAULT 50,
    creator_start_pts  INTEGER DEFAULT 0,
    opponent_start_pts INTEGER DEFAULT 0,
    expires_at         TIMESTAMP WITH TIME ZONE NOT NULL,
    status             TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
    winner_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- INVENTORY SYSTEM
-- ==========================================

-- 13. Inventory items (power-ups, skip tokens, etc.)
CREATE TABLE IF NOT EXISTS inventory (
    id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    item_type      TEXT NOT NULL CHECK (item_type IN ('TASK_SKIP', 'XP_BOOST', 'CHALLENGE_KEY', 'REVIVE_TOKEN')),
    quantity       INTEGER DEFAULT 1,
    acquired_at    TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, item_type)
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_points    ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendship     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards        ENABLE ROW LEVEL SECURITY;
ALTER TABLE punishments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE clans          ENABLE ROW LEVEL SECURITY;
ALTER TABLE clan_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE clan_invites   ENABLE ROW LEVEL SECURITY;
ALTER TABLE guilds         ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges     ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory      ENABLE ROW LEVEL SECURITY;

-- ── User Profiles ──
-- Users can manage their own profile
DROP POLICY IF EXISTS "Users can manage own profile"           ON user_profiles;
CREATE POLICY "Users can manage own profile"
    ON user_profiles FOR ALL USING (auth.uid() = user_id);

-- All authenticated users can READ any profile (needed for Social, Leaderboard, Arena)
DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON user_profiles;
CREATE POLICY "Authenticated users can read all profiles"
    ON user_profiles FOR SELECT USING (auth.uid() IS NOT NULL);

-- ── Tasks ──
-- Users can manage tasks they own OR that are assigned to them
DROP POLICY IF EXISTS "Users can manage own tasks" ON tasks;
CREATE POLICY "Users can manage own tasks"
    ON tasks FOR ALL USING (auth.uid() = user_id OR auth.uid() = assigned_to);

-- ── User Points ──
DROP POLICY IF EXISTS "Users can manage own points" ON user_points;
CREATE POLICY "Users can manage own points"
    ON user_points FOR ALL USING (auth.uid() = user_id);

-- ── Friendship ──
DROP POLICY IF EXISTS "Users can manage own friendships" ON friendship;
CREATE POLICY "Users can manage own friendships"
    ON friendship FOR ALL USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

-- ── Rewards ──
DROP POLICY IF EXISTS "Users can manage own rewards" ON rewards;
CREATE POLICY "Users can manage own rewards"
    ON rewards FOR ALL USING (auth.uid() = user_id);

-- ── Punishments ──
DROP POLICY IF EXISTS "Users can manage own punishments" ON punishments;
CREATE POLICY "Users can manage own punishments"
    ON punishments FOR ALL USING (auth.uid() = user_id);

-- ── Clans ──
DROP POLICY IF EXISTS "Authenticated read clans" ON clans;
CREATE POLICY "Authenticated read clans"
    ON clans FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Leaders can manage clans" ON clans;
CREATE POLICY "Leaders can manage clans"
    ON clans FOR ALL USING (auth.uid() = leader_id);

-- Allow any authenticated user to INSERT a new clan (they become the leader)
DROP POLICY IF EXISTS "Users can create clans" ON clans;
CREATE POLICY "Users can create clans"
    ON clans FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── Clan Members ──
DROP POLICY IF EXISTS "Authenticated read clan members" ON clan_members;
CREATE POLICY "Authenticated read clan members"
    ON clan_members FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Clan members can manage membership" ON clan_members;
CREATE POLICY "Clan members can manage membership"
    ON clan_members FOR ALL USING (auth.uid() IS NOT NULL);

-- ── Clan Invites ──
DROP POLICY IF EXISTS "Users can manage clan invites" ON clan_invites;
CREATE POLICY "Users can manage clan invites"
    ON clan_invites FOR ALL USING (auth.uid() IS NOT NULL);

-- ── Guilds ──
DROP POLICY IF EXISTS "Authenticated read guilds" ON guilds;
CREATE POLICY "Authenticated read guilds"
    ON guilds FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Leaders can manage guilds" ON guilds;
CREATE POLICY "Leaders can manage guilds"
    ON guilds FOR ALL USING (auth.uid() = leader_id);

DROP POLICY IF EXISTS "Users can create guilds" ON guilds;
CREATE POLICY "Users can create guilds"
    ON guilds FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── Challenges ──
DROP POLICY IF EXISTS "Users can see own challenges" ON challenges;
CREATE POLICY "Users can see own challenges"
    ON challenges FOR SELECT USING (auth.uid() = creator_id OR auth.uid() = opponent_id);

DROP POLICY IF EXISTS "Users can create challenges" ON challenges;
CREATE POLICY "Users can create challenges"
    ON challenges FOR INSERT WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Users can update own challenges" ON challenges;
CREATE POLICY "Users can update own challenges"
    ON challenges FOR UPDATE USING (auth.uid() = creator_id OR auth.uid() = opponent_id);

-- ── Inventory ──
DROP POLICY IF EXISTS "Users can manage own inventory" ON inventory;
CREATE POLICY "Users can manage own inventory"
    ON inventory FOR ALL USING (auth.uid() = user_id);

-- ==========================================
-- HELPER FUNCTIONS
-- ==========================================

-- Look up a user by email (used by legacy invite flows)
CREATE OR REPLACE FUNCTION get_user_id_by_email(email_input TEXT)
RETURNS UUID
LANGUAGE sql SECURITY DEFINER
AS $$
    SELECT id FROM auth.users WHERE email = email_input LIMIT 1;
$$;

-- Look up user profile by Hunter Code (first N chars of UUID)
CREATE OR REPLACE FUNCTION get_profile_by_hunter_code(hunter_code TEXT)
RETURNS TABLE(user_id UUID, name TEXT, player_class TEXT, player_rank TEXT, level INTEGER)
LANGUAGE sql SECURITY DEFINER
AS $$
    SELECT user_id, name, player_class, player_rank, level
    FROM user_profiles
    WHERE user_id::text ILIKE hunter_code || '%'
    LIMIT 1;
$$;

-- ==========================================
-- AUTO PROFILE CREATION TRIGGER
-- Creates a user_profiles row whenever a new auth.users row is inserted.
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_profiles (user_id, email, name, player_class, player_rank, player_title)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'player_class', 'Warrior'),
        'E',
        'Newcomer'
    )
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS trg_new_user ON auth.users;
CREATE TRIGGER trg_new_user
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_tasks_user_id        ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id      ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to    ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_user_points_user     ON user_points(user_id, date);
CREATE INDEX IF NOT EXISTS idx_friendship_users     ON friendship(requester_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_clan_members_clan    ON clan_members(clan_id);
CREATE INDEX IF NOT EXISTS idx_clan_members_user    ON clan_members(user_id);
CREATE INDEX IF NOT EXISTS idx_challenges_users     ON challenges(creator_id, opponent_id);
CREATE INDEX IF NOT EXISTS idx_inventory_user       ON inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_guild       ON user_profiles(guild_id);
