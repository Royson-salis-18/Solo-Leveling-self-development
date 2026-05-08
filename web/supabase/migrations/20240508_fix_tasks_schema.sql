-- ============================================================
-- MISSION STABILIZATION MIGRATION
-- Adds missing columns for Gauntlet, Weekly Trials, and Recurrence
-- ============================================================

-- 1. GAUNTLET & TRIAL FLAGS
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS is_gauntlet BOOLEAN DEFAULT FALSE;

ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS is_weekly_trial BOOLEAN DEFAULT FALSE;

-- 2. ENHANCED RECURRENCE SYSTEM
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS recurrence_type TEXT DEFAULT 'none';

ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS recurrence_interval INTEGER DEFAULT 1;

ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS recurrence_days TEXT; -- JSON string of day indices [0-6]

ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS recurrence_day_of_month INTEGER DEFAULT 1;

ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS recurrence_custom_label TEXT;

-- 3. RAID TRACKING (PAUSE/RESUME)
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT FALSE;

ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP WITH TIME ZONE;

-- 4. DOCUMENTATION
COMMENT ON COLUMN public.tasks.is_gauntlet IS 'If true, creates 5 sub-tasks automatically upon manifestation.';
COMMENT ON COLUMN public.tasks.is_weekly_trial IS 'Identifies S-Rank system-generated weekly trials.';
COMMENT ON COLUMN public.tasks.recurrence_type IS 'Type of recurrence: none, daily, interval, weekly, monthly, custom.';
