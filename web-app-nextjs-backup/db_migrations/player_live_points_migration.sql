-- ============================================================
-- player_live_points table for Botola Fantasy
-- Run this in your Supabase SQL Editor (one time only)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.player_live_points (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id        UUID        REFERENCES public.players(id) ON DELETE SET NULL,
    player_name      TEXT        NOT NULL,
    team_name        TEXT,
    event_type       TEXT        NOT NULL
                     CHECK (event_type IN ('goal','assist','yellow_card','red_card')),
    points           INTEGER     NOT NULL DEFAULT 0,
    minute           TEXT,
    match_home_team  TEXT,
    match_away_team  TEXT,
    match_date       DATE        NOT NULL DEFAULT CURRENT_DATE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS plp_player_idx ON public.player_live_points(player_id);
CREATE INDEX IF NOT EXISTS plp_date_idx   ON public.player_live_points(match_date);

-- Enable Realtime so the frontend Live Points page auto-updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.player_live_points;

-- RLS: anyone can read, only service-role can write
ALTER TABLE public.player_live_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read live points"
  ON public.player_live_points FOR SELECT USING (true);
