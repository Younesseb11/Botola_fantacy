-- ============================================================
-- Live Events Table for Botola Fantasy
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Drop table if you need to recreate it cleanly
-- DROP TABLE IF EXISTS public.player_live_points;

CREATE TABLE IF NOT EXISTS public.player_live_points (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id   UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    match_id    UUID,                          -- optional: link to a matches table
    event_type  TEXT NOT NULL CHECK (event_type IN (
                  'goal', 'assist', 'yellow_card', 'red_card',
                  'clean_sheet', 'save', 'own_goal'
                )),
    points      INTEGER NOT NULL DEFAULT 0,   -- can pre-compute or use client-side constants
    minute      INTEGER,                       -- match minute (e.g. 74)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by player
CREATE INDEX IF NOT EXISTS player_live_points_player_id_idx ON public.player_live_points(player_id);

-- ── Enable Supabase Realtime ─────────────────────────────────────────────────
-- This adds the table to the publication so realtime subscriptions work.
ALTER PUBLICATION supabase_realtime ADD TABLE public.player_live_points;

-- ── Row Level Security ───────────────────────────────────────────────────────
-- Enable RLS but allow public reads (so the client-side subscription works
-- without authentication). Writes should be restricted to service-role only.

ALTER TABLE public.player_live_points ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read events (for the live scores feed)
CREATE POLICY "Allow public read of player_live_points"
  ON public.player_live_points
  FOR SELECT
  USING (true);

-- Only service_role (your Python scraper / backend) can insert/update/delete
-- No INSERT policy = only service_role (bypasses RLS) can write.


-- ── Sample test data ─────────────────────────────────────────────────────────
-- Replace the UUIDs with real player IDs from your players table.
-- Uncomment and run to verify the live feed is working.

/*
INSERT INTO public.player_live_points (player_id, event_type, points, minute)
VALUES
  -- Replace 'YOUR_PLAYER_ID_HERE' with a real player UUID from public.players
  ('YOUR_PLAYER_ID_HERE', 'goal',        5, 22),
  ('YOUR_PLAYER_ID_HERE', 'yellow_card', -1, 67),
  ('YOUR_PLAYER_ID_HERE', 'assist',      3, 55);
*/
