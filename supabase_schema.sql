-- ==========================================
-- SOLO LEVELING - FINAL SUPABASE SCHEMA
-- ==========================================

-- 1. Drop old/unnecessary tables to start fresh
DROP TABLE IF EXISTS user_points CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- 2. Ensure UUID extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. Create user_profiles table (Links to Supabase Auth)
CREATE TABLE user_profiles (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    level INTEGER DEFAULT 1,
    total_points INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create tasks table
CREATE TABLE tasks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'General',
    points INTEGER DEFAULT 50,
    is_completed BOOLEAN DEFAULT FALSE,
    priority TEXT DEFAULT 'Medium',
    area TEXT,
    deadline DATE,
    time TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create user_points table (for graphing XP over time)
CREATE TABLE user_points (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    date DATE NOT NULL,
    daily_points INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, date)
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read/insert/update/delete their own data
CREATE POLICY "Users can manage own profile" 
    ON user_profiles FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own tasks" 
    ON tasks FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own points" 
    ON user_points FOR ALL USING (auth.uid() = user_id);

-- Setup a trigger to create a default profile when a user signs up (optional but good idea)
-- Note: authContext.tsx already does this, but keeping it simple without triggers.
