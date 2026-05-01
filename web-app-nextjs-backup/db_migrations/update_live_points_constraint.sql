-- Update player_live_points table to allow appearance and 60-minute played events
-- Run this in your Supabase SQL Editor

-- 1. Drop existing constraint (name might vary, typically includes 'check' or the columns)
-- If you used my previous script, it's an inline check. We need to drop and recreate.
ALTER TABLE public.player_live_points DROP CONSTRAINT IF EXISTS player_live_points_event_type_check;

-- 2. Add updated constraint
ALTER TABLE public.player_live_points ADD CONSTRAINT player_live_points_event_type_check 
    CHECK (event_type IN ('goal', 'assist', 'yellow_card', 'red_card', 'appearance', 'played_60_mins'));
