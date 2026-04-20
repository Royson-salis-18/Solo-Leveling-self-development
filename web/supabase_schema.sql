-- ============================================================
-- SOLO LEVELING — DEEP RPG SYSTEM V3 (REPAIR)
-- ============================================================

-- 1. CLEAN SLATE: Remove all old tables and functions
-- Note: Dropping the table CASCADE automatically removes its triggers and policies.
DROP TRIGGER IF EXISTS trg_new_user ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user CASCADE;
DROP FUNCTION IF EXISTS set_updated_at CASCADE;
DROP FUNCTION IF EXISTS check_clan_member_limit CASCADE;
DROP FUNCTION IF EXISTS get_user_id_by_email CASCADE;

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

-- 2. BIG GUILDS (5–20 members)
CREATE TABLE guilds (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL UNIQUE,
  description  TEXT NOT NULL DEFAULT '',
  leader_id    UUID NOT NULL REFERENCES auth.users(id),
  banner_url   TEXT,
  min_rank     TEXT DEFAULT 'E',
  member_count INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. CLANS (3–5 members)
CREATE TABLE clans (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL UNIQUE,
  description  TEXT NOT NULL DEFAULT '',
  leader_id    UUID NOT NULL REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. USER PROFILES
CREATE TABLE user_profiles (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL DEFAULT 'Hunter',
  bio          TEXT NOT NULL DEFAULT 'E-Rank Hunter',
  player_class TEXT NOT NULL DEFAULT 'None',
  player_rank  TEXT NOT NULL DEFAULT 'E',
  player_title TEXT NOT NULL DEFAULT 'Rookie',
  level        INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  total_points INTEGER NOT NULL DEFAULT 0 CHECK (total_points >= 0),
  guild_id     UUID REFERENCES guilds(id) ON DELETE SET NULL,
  clan_id      UUID REFERENCES clans(id) ON DELETE SET NULL,
  is_boosted   BOOLEAN NOT NULL DEFAULT FALSE,
  boost_expires TIMESTAMPTZ,
  age          INTEGER,
  weapon_of_choice TEXT DEFAULT 'None',
  gear_style   TEXT DEFAULT 'Hybrid',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. CLAN MEMBERS (explicit membership + role)
CREATE TABLE clan_members (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clan_id   UUID NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(clan_id, user_id)
);

-- 6. CLAN INVITES
CREATE TABLE clan_invites (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clan_id       UUID NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
  inviter_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_email TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. CORE TABLES
CREATE TABLE tasks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id    UUID REFERENCES tasks(id) ON DELETE CASCADE,
  assigned_to  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  category     TEXT NOT NULL DEFAULT 'General',
  points       INTEGER NOT NULL DEFAULT 10 CHECK (points > 0),
  priority     TEXT NOT NULL DEFAULT 'Normal',
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  deadline     DATE,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_points (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  daily_points INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, date)
);

CREATE TABLE rewards (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  xp_cost    INTEGER NOT NULL DEFAULT 100,
  tier       TEXT NOT NULL DEFAULT 'instant',
  is_claimed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE punishments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  xp_penalty INTEGER NOT NULL DEFAULT 25,
  triggered  INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. SOCIAL FRIENDSHIP
CREATE TABLE friendship (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(requester_id, receiver_id)
);

-- 9. INVENTORY (special items)
CREATE TABLE inventory (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type  TEXT NOT NULL,
  name       TEXT NOT NULL,
  quantity   INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. COMPETITIVE CHALLENGES
CREATE TABLE challenges (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_points     INTEGER NOT NULL DEFAULT 100,
  creator_start_pts INTEGER NOT NULL DEFAULT 0,
  opponent_start_pts INTEGER NOT NULL DEFAULT 0,
  start_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ NOT NULL,
  status            TEXT NOT NULL DEFAULT 'active',
  winner_id         UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE guilds        ENABLE ROW LEVEL SECURITY;
ALTER TABLE clans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clan_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE clan_invites  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_points   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards       ENABLE ROW LEVEL SECURITY;
ALTER TABLE punishments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendship    ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory     ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges    ENABLE ROW LEVEL SECURITY;

-- Guilds & Clans: public read, leader write
DROP POLICY IF EXISTS "everyone_view_guilds" ON guilds;
CREATE POLICY "everyone_view_guilds" ON guilds FOR SELECT USING (true);
DROP POLICY IF EXISTS "leaders_edit_guilds" ON guilds;
CREATE POLICY "leaders_edit_guilds"  ON guilds FOR ALL   USING (auth.uid() = leader_id);
DROP POLICY IF EXISTS "everyone_view_clans" ON clans;
CREATE POLICY "everyone_view_clans"  ON clans  FOR SELECT USING (true);
DROP POLICY IF EXISTS "leaders_edit_clans" ON clans;
CREATE POLICY "leaders_edit_clans"   ON clans  FOR ALL   USING (auth.uid() = leader_id);

-- Profiles: own profile full access, everyone can read
DROP POLICY IF EXISTS "own_profile" ON user_profiles;
CREATE POLICY "own_profile"    ON user_profiles FOR ALL    USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "public_profiles" ON user_profiles;
CREATE POLICY "public_profiles" ON user_profiles FOR SELECT USING (true);

-- Clan members: everyone reads, inclusive insert
DROP POLICY IF EXISTS "view_all_clan_members" ON clan_members;
CREATE POLICY "view_all_clan_members"  ON clan_members FOR SELECT USING (true);
DROP POLICY IF EXISTS "insert_clan_members" ON clan_members;
CREATE POLICY "insert_clan_members"    ON clan_members FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "delete_clan_members" ON clan_members;
CREATE POLICY "delete_clan_members"    ON clan_members FOR DELETE USING (auth.uid() = user_id);

-- Clan invites: leaders manage
DROP POLICY IF EXISTS "manage_clan_invites" ON clan_invites;
CREATE POLICY "manage_clan_invites" ON clan_invites FOR ALL USING (auth.uid() = inviter_id);

-- Tasks: own + assigned-to-me readable
DROP POLICY IF EXISTS "own_tasks" ON tasks;
CREATE POLICY "own_tasks"      ON tasks FOR ALL    USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "assigned_tasks" ON tasks;
CREATE POLICY "assigned_tasks" ON tasks FOR SELECT USING (auth.uid() = assigned_to);
DROP POLICY IF EXISTS "complete_assigned_tasks" ON tasks;
CREATE POLICY "complete_assigned_tasks" ON tasks FOR UPDATE USING (auth.uid() = assigned_to);

-- Other tables: own rows only
DROP POLICY IF EXISTS "own_points" ON user_points;
CREATE POLICY "own_points"      ON user_points  FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own_rewards" ON rewards;
CREATE POLICY "own_rewards"     ON rewards      FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own_punishments" ON punishments;
CREATE POLICY "own_punishments" ON punishments  FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own_inventory" ON inventory;
CREATE POLICY "own_inventory"   ON inventory    FOR ALL USING (auth.uid() = user_id);

-- Friendship: both parties can see, requester can manage
DROP POLICY IF EXISTS "own_friendships" ON friendship;
CREATE POLICY "own_friendships" ON friendship FOR ALL USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

-- Challenges: both participants can see
DROP POLICY IF EXISTS "own_challenges" ON challenges;
CREATE POLICY "own_challenges" ON challenges FOR ALL USING (auth.uid() = creator_id OR auth.uid() = opponent_id);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tasks_user_id     ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_cm_clan_id        ON clan_members(clan_id);
CREATE INDEX IF NOT EXISTS idx_cm_user_id        ON clan_members(user_id);

-- ============================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================

-- Auto-create profile on sign-up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, name, player_class)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'player_class', 'Warrior')
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_new_user ON auth.users;
CREATE TRIGGER trg_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_up_updated_at ON user_profiles;
CREATE TRIGGER trg_up_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Clan max 5 members
CREATE OR REPLACE FUNCTION check_clan_member_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM clan_members WHERE clan_id = NEW.clan_id) >= 5 THEN
    RAISE EXCEPTION 'Clan is at maximum capacity (5 members).';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clan_limit ON clan_members;
CREATE TRIGGER trg_clan_limit
  BEFORE INSERT ON clan_members
  FOR EACH ROW EXECUTE FUNCTION check_clan_member_limit();

-- RPC: find user ID by email (SECURITY DEFINER to access auth.users)
CREATE OR REPLACE FUNCTION get_user_id_by_email(email_input TEXT)
RETURNS UUID AS $$
  SELECT id FROM auth.users WHERE email = email_input LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================
-- BACKFILL: create profiles for existing users
-- ============================================================
INSERT INTO public.user_profiles (user_id, name)
SELECT id, COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1))
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
