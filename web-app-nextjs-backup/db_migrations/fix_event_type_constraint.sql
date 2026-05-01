-- ============================================================
-- Migration: Fix Event Type Constraint & De-duplication
-- ============================================================
-- This script updates the player_live_points table to support advanced
-- scoring events (appearance, played_60_mins, etc.) and prevents
-- duplicate events via a unique index.
--
-- IMPORTANT: Run this in your Supabase SQL Editor BEFORE running the 
-- latest version of Scrapper/live.py.
-- ============================================================

-- 1. Ensure all columns used by the scraper exist
DO $$
BEGIN
    -- match_date (Required for unique constraint)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'player_live_points' AND column_name = 'match_date') THEN
        ALTER TABLE public.player_live_points ADD COLUMN match_date DATE;
    END IF;

    -- Additional metadata columns sent by live.py
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'player_live_points' AND column_name = 'player_name') THEN
        ALTER TABLE public.player_live_points ADD COLUMN player_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'player_live_points' AND column_name = 'team_name') THEN
        ALTER TABLE public.player_live_points ADD COLUMN team_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'player_live_points' AND column_name = 'match_home_team') THEN
        ALTER TABLE public.player_live_points ADD COLUMN match_home_team TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'player_live_points' AND column_name = 'match_away_team') THEN
        ALTER TABLE public.player_live_points ADD COLUMN match_away_team TEXT;
    END IF;
END $$;


-- 2. Drop the existing event_type CHECK constraint
-- We use a dynamic block to find and drop any constraint containing 'event_type' on this table.
DO $$
DECLARE
    const_name TEXT;
BEGIN
    FOR const_name IN
        SELECT conname
        FROM pg_constraint
        JOIN pg_class ON pg_class.oid = pg_constraint.conrelid
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_class.relname = 'player_live_points'
          AND pg_namespace.nspname = 'public'
          AND pg_constraint.contype = 'c'
          AND pg_constraint.conname LIKE '%event_type%'
    LOOP
        EXECUTE 'ALTER TABLE public.player_live_points DROP CONSTRAINT IF EXISTS ' || const_name;
    END LOOP;
END $$;


-- 3. Add the new expanded event_type CHECK constraint
ALTER TABLE public.player_live_points
ADD CONSTRAINT player_live_points_event_type_check
CHECK (event_type IN (
    'goal', 
    'assist', 
    'yellow_card', 
    'red_card', 
    'appearance', 
    'played_60_mins', 
    'clean_sheet', 
    'save', 
    'penalty_save', 
    'penalty_miss', 
    'own_goal'
));


-- 4. Add unique index to prevent duplicate events
-- Prevents the scraper from pushing the same goal/card multiple times if it restarts.
-- SCOPE: A specific player, for a specific event type, at a specific minute on a specific match date.
CREATE UNIQUE INDEX IF NOT EXISTS player_live_points_unique_event_idx 
ON public.player_live_points (player_id, event_type, minute, match_date);

-- Comment for metadata
COMMENT ON TABLE public.player_live_points IS 'Stores real-time fantasy performance events; must be run BEFORE Scrapper/live.py';
