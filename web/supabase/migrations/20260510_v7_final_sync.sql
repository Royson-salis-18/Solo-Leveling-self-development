-- V7: MONARCH SYSTEM FINAL SYNC
-- Consolidates all domain changes and cleans up legacy statistics.
-- This script is idempotent and safe to run on existing databases.

-- 1. Ensure Domain Columns Exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='domain_physical') THEN
        ALTER TABLE user_profiles ADD COLUMN domain_physical INTEGER DEFAULT 10;
        ALTER TABLE user_profiles ADD COLUMN domain_mind INTEGER DEFAULT 14;
        ALTER TABLE user_profiles ADD COLUMN domain_soul INTEGER DEFAULT 10;
        ALTER TABLE user_profiles ADD COLUMN domain_execution INTEGER DEFAULT 12;
        ALTER TABLE user_profiles ADD COLUMN domain_builder INTEGER DEFAULT 13;
    END IF;
END $$;

-- 2. Migrate Data from Legacy Columns (if they still exist)
-- Mapping:
-- Physical -> Strength
-- Mind -> Intelligence
-- Soul -> Sense
-- Execution -> Agility
-- Builder -> Vitality (Fallback)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='stat_strength') THEN
        UPDATE user_profiles SET 
            domain_physical = COALESCE(stat_strength, domain_physical),
            domain_mind = COALESCE(stat_intelligence, domain_mind),
            domain_soul = COALESCE(stat_sense, domain_soul),
            domain_execution = COALESCE(stat_agility, domain_execution),
            domain_builder = COALESCE(stat_vitality, domain_builder);
    END IF;
END $$;

-- 3. Drop Legacy Columns
ALTER TABLE user_profiles DROP COLUMN IF EXISTS stat_strength;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS stat_agility;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS stat_intelligence;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS stat_vitality;
ALTER TABLE user_profiles DROP COLUMN IF EXISTS stat_sense;

-- 4. Ensure Other System Columns
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS dark_mana INTEGER DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS ego_score INTEGER DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMPTZ DEFAULT NOW();

-- 5. Ensure Task Schema Integrity
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_gauntlet BOOLEAN DEFAULT false;

-- 6. Cleanup Duplicate Profiles
-- Ensures exactly one profile per user_id
DELETE FROM user_profiles a USING user_profiles b 
WHERE a.ctid < b.ctid AND a.user_id = b.user_id;
