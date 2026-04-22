-- ============================================================
-- SOLO LEVELING — COMPREHENSIVE SCHEMA WITH PUNISHMENT LOGIC
-- AND EXISTING USER SUPPORT
-- ============================================================

-- 1. CLEAN SLATE: Remove all old tables and functions
-- Note: Dropping the table CASCADE automatically removes its triggers and policies.
DROP TRIGGER IF EXISTS trg_new_user ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user CASCADE;

DROP TABLE IF EXISTS clan_invites  CASCADE;
DROP TABLE IF EXISTS clan_members  CASCADE;
DROP TABLE IF EXISTS challenges    CASCADE;
DROP TABLE IF EXISTS inventory     CASCADE;
DROP TABLE IF EXISTS friendship    CASCADE;
DROP TABLE IF EXISTS punishments   CASCADE;
DROP TABLE IF EXISTS rewards       CASCADE;
DROP TABLE IF EXISTS user_points   CASCADE;
DROP TABLE IF EXISTS tasks         CASCADE;
DROP TABLE IF EXISTS clans         CASCADE;
DROP TABLE IF EXISTS guilds        CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- GUILDS & CLANS
-- ==========================================
CREATE TABLE guilds (
    id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name           TEXT NOT NULL,
    description    TEXT DEFAULT '',
    leader_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    member_count   INTEGER DEFAULT 1,
    min_rank       TEXT DEFAULT 'E',
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE clans (
    id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name           TEXT NOT NULL,
    description    TEXT DEFAULT '',
    leader_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- USER PROFILES
-- ==========================================
CREATE TABLE user_profiles (
    user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email          TEXT UNIQUE,
    hunter_code    TEXT UNIQUE,
    name           TEXT NOT NULL DEFAULT 'Hunter',
    avatar_url     TEXT,
    bio            TEXT DEFAULT '',
    level          INTEGER DEFAULT 1,
    total_points   INTEGER DEFAULT 0,
    player_class   TEXT DEFAULT 'Warrior',
    player_rank    TEXT DEFAULT 'E',
    player_title   TEXT DEFAULT 'Newcomer',
    guild_id       UUID REFERENCES guilds(id) ON DELETE SET NULL,
    clan_id        UUID REFERENCES clans(id) ON DELETE SET NULL,
    is_boosted     BOOLEAN DEFAULT FALSE,
    age            INTEGER DEFAULT 18,
    weapon_of_choice TEXT DEFAULT 'Starter Blade',
    gear_style     TEXT DEFAULT 'Hybrid',
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- TASKS / QUESTS
-- ==========================================
CREATE TABLE tasks (
    id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    email          TEXT,
    title          TEXT NOT NULL,
    description    TEXT DEFAULT '',
    category       TEXT DEFAULT 'General',
    points         INTEGER DEFAULT 10,
    is_completed   BOOLEAN DEFAULT FALSE,
    is_failed      BOOLEAN DEFAULT FALSE, -- <-- Determines if deadline was missed!
    priority       TEXT DEFAULT 'Normal',
    area           TEXT,
    deadline       DATE,
    time           TEXT,
    completed_at   TIMESTAMP WITH TIME ZONE,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    parent_id      UUID REFERENCES tasks(id) ON DELETE CASCADE,
    assigned_to    UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ==========================================
-- SOCIAL / FRIENDSHIP
-- ==========================================
CREATE TABLE friendship (
    id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    requester_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    receiver_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    status         TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(requester_id, receiver_id)
);

-- ==========================================
-- TAVERN (GLOBAL CHAT)
-- ==========================================
CREATE TABLE global_chat (
    id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    message        TEXT NOT NULL,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- POINTS, PUNISHMENTS & REWARDS
-- ==========================================
CREATE TABLE user_points (
    id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    email          TEXT,
    date           DATE NOT NULL,
    daily_points   INTEGER DEFAULT 0,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, date)
);

CREATE TABLE rewards (
    id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name           TEXT NOT NULL,
    xp_cost        INTEGER DEFAULT 100,
    tier           TEXT DEFAULT 'instant' CHECK (tier IN ('instant', 'medium', 'major')),
    is_claimed     BOOLEAN DEFAULT FALSE,
    claimed_at     TIMESTAMP WITH TIME ZONE,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE punishments (
    id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name           TEXT NOT NULL,
    xp_penalty     INTEGER DEFAULT 25,
    triggered      INTEGER DEFAULT 0,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- CLAN & GUILD MEMBERS
-- ==========================================
CREATE TABLE clan_members (
    id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    clan_id        UUID REFERENCES clans(id) ON DELETE CASCADE NOT NULL,
    user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role           TEXT DEFAULT 'member' CHECK (role IN ('leader', 'officer', 'member')),
    joined_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(clan_id, user_id)
);

CREATE TABLE clan_invites (
    id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    clan_id        UUID REFERENCES clans(id) ON DELETE CASCADE NOT NULL,
    inviter_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    invitee_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status         TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- CHALLENGES / DUELS
-- ==========================================
CREATE TABLE challenges (
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
-- INVENTORY
-- ==========================================
CREATE TABLE inventory (
    id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    item_type      TEXT NOT NULL CHECK (item_type IN ('TASK_SKIP', 'XP_BOOST', 'CHALLENGE_KEY', 'REVIVE_TOKEN')),
    quantity       INTEGER DEFAULT 1,
    acquired_at    TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, item_type)
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

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
ALTER TABLE global_chat    ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can manage own profile" ON user_profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can read all profiles" ON user_profiles FOR SELECT USING (auth.uid() IS NOT NULL);

-- Tasks
CREATE POLICY "Users can manage own tasks" ON tasks FOR ALL USING (auth.uid() = user_id OR auth.uid() = assigned_to);

-- Points, Rewards, Punishments, Inventory
CREATE POLICY "Users can manage own points" ON user_points FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own rewards" ON rewards FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own punishments" ON punishments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own inventory" ON inventory FOR ALL USING (auth.uid() = user_id);

-- Friendships & Chat
CREATE POLICY "Users can manage own friendships" ON friendship FOR ALL USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

CREATE POLICY "Authenticated read chat" ON global_chat FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated post chat" ON global_chat FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Clans & Guilds
CREATE POLICY "Authenticated read clans" ON clans FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Leaders can manage clans" ON clans FOR ALL USING (auth.uid() = leader_id);
CREATE POLICY "Users can create clans" ON clans FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated read clan members" ON clan_members FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Clan members can manage membership" ON clan_members FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage clan invites" ON clan_invites FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated read guilds" ON guilds FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Leaders can manage guilds" ON guilds FOR ALL USING (auth.uid() = leader_id);
CREATE POLICY "Users can create guilds" ON guilds FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Challenges
CREATE POLICY "Users can see own challenges" ON challenges FOR SELECT USING (auth.uid() = creator_id OR auth.uid() = opponent_id);
CREATE POLICY "Users can create challenges" ON challenges FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Users can update own challenges" ON challenges FOR UPDATE USING (auth.uid() = creator_id OR auth.uid() = opponent_id);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Auto-create profile on sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (user_id, email, hunter_code, name, player_class, player_rank, player_title)
    VALUES (
        NEW.id,
        NEW.email,
        UPPER(SUBSTRING(NEW.id::text FROM 1 FOR 8)),
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'player_class', 'Warrior'),
        'E',
        'Newcomer'
    )
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_new_user
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Look up user profile by Hunter Code (first N chars of UUID)
CREATE OR REPLACE FUNCTION get_profile_by_hunter_code(hunter_code_input TEXT)
RETURNS TABLE(user_id UUID, name TEXT, player_class TEXT, player_rank TEXT, level INTEGER)
LANGUAGE sql SECURITY DEFINER
AS $$
    SELECT user_id, name, player_class, player_rank, level
    FROM user_profiles
    WHERE hunter_code = UPPER(hunter_code_input)
    LIMIT 1;
$$;

-- ============================================================
-- BACKFILL: RE-CREATE PROFILES FOR EXISTING AUTH USERS
-- (Crucial since tables were dropped but auth.users still exist)
-- ============================================================
INSERT INTO public.user_profiles (user_id, email, hunter_code, name, player_class, player_rank, player_title)
SELECT 
    id, 
    email,
    UPPER(SUBSTRING(id::text FROM 1 FOR 8)),
    COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1)),
    COALESCE(raw_user_meta_data->>'player_class', 'Warrior'),
    'E',
    'Newcomer'
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
