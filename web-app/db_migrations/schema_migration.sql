-- ============================================================
-- Botola Fantasy — Full Schema Migration
-- Paste into Supabase SQL Editor and run section by section.
--
-- Sections:
--   1. FIXTURES table (new)
--   2. USER_SQUADS table (create or alter)
--   3. SQUAD_PLAYERS table (create or alter)
--   4. Indexes & RLS policies
--   5. Sample fixture data
-- ============================================================


-- ══════════════════════════════════════════════════════════════
-- 1. FIXTURES
--    One row per match in the Botola season calendar.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.fixtures (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    home_team_id  UUID         NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    away_team_id  UUID         NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    match_date    TIMESTAMPTZ  NOT NULL,
    gameweek      INTEGER      NOT NULL CHECK (gameweek >= 1),

    -- 'Upcoming' → match not yet started
    -- 'Live'     → match in progress (drives the LIVE status bar)
    -- 'Finished' → final result confirmed
    status        TEXT         NOT NULL DEFAULT 'Upcoming'
                               CHECK (status IN ('Upcoming', 'Live', 'Finished')),

    -- Optional scored result (NULL until Finished)
    home_score    INTEGER,
    away_score    INTEGER,

    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    -- A team can only appear once per gameweek (home or away)
    CONSTRAINT no_duplicate_home UNIQUE (home_team_id, gameweek),
    CONSTRAINT no_duplicate_away UNIQUE (away_team_id, gameweek),
    CONSTRAINT different_teams   CHECK  (home_team_id <> away_team_id)
);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fixtures_updated_at ON public.fixtures;
CREATE TRIGGER fixtures_updated_at
  BEFORE UPDATE ON public.fixtures
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Useful indexes
CREATE INDEX IF NOT EXISTS fixtures_gameweek_idx    ON public.fixtures(gameweek);
CREATE INDEX IF NOT EXISTS fixtures_status_idx      ON public.fixtures(status);
CREATE INDEX IF NOT EXISTS fixtures_home_team_idx   ON public.fixtures(home_team_id);
CREATE INDEX IF NOT EXISTS fixtures_away_team_idx   ON public.fixtures(away_team_id);
CREATE INDEX IF NOT EXISTS fixtures_match_date_idx  ON public.fixtures(match_date);

-- Also backfill the optional match_id on live_events
-- (run AFTER live_events table already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'live_events'
      AND column_name  = 'fixture_id'
  ) THEN
    ALTER TABLE public.live_events
      ADD COLUMN fixture_id UUID REFERENCES public.fixtures(id) ON DELETE SET NULL;
  END IF;
END $$;

-- RLS
ALTER TABLE public.fixtures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read of fixtures"
  ON public.fixtures FOR SELECT USING (true);

-- Only service_role / admin can write fixtures
-- (no INSERT/UPDATE/DELETE policy = only service_role bypasses RLS)


-- ══════════════════════════════════════════════════════════════
-- 2. USER_SQUADS
--    One row per user per gameweek — tracks the squad metadata.
--
--    If the table already exists, the ALTER TABLE blocks below
--    add the columns that may be missing (formation + budget).
--    Safe to run multiple times.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_squads (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID         NOT NULL,   -- references auth.users(id) when Auth is enabled
    gameweek        INTEGER      NOT NULL CHECK (gameweek >= 1),

    -- Squad-level metadata
    team_name       TEXT,
    total_points    INTEGER      NOT NULL DEFAULT 0,
    overall_rank    INTEGER,
    budget_remaining NUMERIC(5,1) NOT NULL DEFAULT 100.0,  -- millions (e.g. 65.5)

    -- ── Formation & captain ────────────────────────────────────
    -- Stored as a string: '4-4-2', '4-3-3', '3-5-2', '5-3-2', etc.
    -- Validated to ensure exactly 10 outfield players + 1 GK.
    formation       TEXT         NOT NULL DEFAULT '4-4-2'
                                 CHECK (formation IN (
                                   '4-4-2', '4-3-3', '4-5-1',
                                   '3-5-2', '3-4-3',
                                   '5-3-2', '5-4-1', '5-2-3'
                                 )),
    captain_player_id       UUID,   -- FK set below (circular dep avoidance)
    vice_captain_player_id  UUID,   -- FK set below

    -- Free transfers remaining this gameweek
    free_transfers  INTEGER      NOT NULL DEFAULT 1 CHECK (free_transfers >= 0),

    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, gameweek)
);

-- Add ALL potentially missing columns (idempotent — checks before each ALTER)
DO $$
BEGIN
  -- gameweek (may be missing if table was created without it)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_squads' AND column_name='gameweek') THEN
    ALTER TABLE public.user_squads ADD COLUMN gameweek INTEGER NOT NULL DEFAULT 1 CHECK (gameweek >= 1);
  END IF;

  -- total_points
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_squads' AND column_name='total_points') THEN
    ALTER TABLE public.user_squads ADD COLUMN total_points INTEGER NOT NULL DEFAULT 0;
  END IF;

  -- overall_rank
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_squads' AND column_name='overall_rank') THEN
    ALTER TABLE public.user_squads ADD COLUMN overall_rank INTEGER;
  END IF;

  -- team_name
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_squads' AND column_name='team_name') THEN
    ALTER TABLE public.user_squads ADD COLUMN team_name TEXT;
  END IF;

  -- formation
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_squads' AND column_name='formation') THEN
    ALTER TABLE public.user_squads ADD COLUMN formation TEXT NOT NULL DEFAULT '4-4-2'
      CHECK (formation IN ('4-4-2','4-3-3','4-5-1','3-5-2','3-4-3','5-3-2','5-4-1','5-2-3'));
  END IF;

  -- budget_remaining
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_squads' AND column_name='budget_remaining') THEN
    ALTER TABLE public.user_squads ADD COLUMN budget_remaining NUMERIC(5,1) NOT NULL DEFAULT 100.0;
  END IF;

  -- captain_player_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_squads' AND column_name='captain_player_id') THEN
    ALTER TABLE public.user_squads ADD COLUMN captain_player_id UUID;
  END IF;

  -- vice_captain_player_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_squads' AND column_name='vice_captain_player_id') THEN
    ALTER TABLE public.user_squads ADD COLUMN vice_captain_player_id UUID;
  END IF;

  -- free_transfers
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_squads' AND column_name='free_transfers') THEN
    ALTER TABLE public.user_squads ADD COLUMN free_transfers INTEGER NOT NULL DEFAULT 1;
  END IF;

  -- updated_at (needed for the trigger)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_squads' AND column_name='updated_at') THEN
    ALTER TABLE public.user_squads ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

DROP TRIGGER IF EXISTS user_squads_updated_at ON public.user_squads;
CREATE TRIGGER user_squads_updated_at
  BEFORE UPDATE ON public.user_squads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS user_squads_user_id_idx   ON public.user_squads(user_id);
CREATE INDEX IF NOT EXISTS user_squads_gameweek_idx  ON public.user_squads(gameweek);

ALTER TABLE public.user_squads ENABLE ROW LEVEL SECURITY;

-- Users can only see/edit their own squad
DROP POLICY IF EXISTS "Users manage own squad" ON public.user_squads;
CREATE POLICY "Users manage own squad"
  ON public.user_squads
  USING      (auth.uid() = user_id)    -- SELECT / UPDATE / DELETE
  WITH CHECK (auth.uid() = user_id);   -- INSERT


-- ══════════════════════════════════════════════════════════════
-- 3. SQUAD_PLAYERS
--    One row per player in a user's squad (15 total: 11 + 4).
--    is_starter and bench_order distinguish the XI from the bench.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.squad_players (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    squad_id        UUID        NOT NULL REFERENCES public.user_squads(id) ON DELETE CASCADE,
    player_id       UUID        NOT NULL REFERENCES public.players(id)     ON DELETE CASCADE,

    -- ── Starter / bench distinction ────────────────────────────
    -- TRUE  → player is in the Starting XI (exactly 11 must be true)
    -- FALSE → player is on the bench (exactly 4 must be false)
    is_starter      BOOLEAN     NOT NULL DEFAULT FALSE,

    -- Bench priority order: 1 (first sub) → 4 (last sub).
    -- NULL for starters; 1–4 for bench players.
    -- Bench player #1 is your automatic substitute.
    bench_order     INTEGER     CHECK (
                      (is_starter = FALSE AND bench_order BETWEEN 1 AND 4)
                      OR
                      (is_starter = TRUE  AND bench_order IS NULL)
                    ),

    -- Position in the formation layout (for the pitch view).
    -- Stored as slot index within the formation, e.g. 0–3 for defenders
    -- in a 4-back. NULL for bench players.
    formation_slot  INTEGER,

    -- Multiplier: 1 = normal, 2 = captain, 3 = triple captain
    points_multiplier INTEGER   NOT NULL DEFAULT 1
                                CHECK (points_multiplier IN (1, 2, 3)),

    -- Cached points from the last scoring run (updated by the backend)
    gameweek_points INTEGER     NOT NULL DEFAULT 0,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (squad_id, player_id)  -- a player can only appear once per squad
);

-- Add columns if table already exists (idempotent)
DO $$
BEGIN
  -- is_starter
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='squad_players' AND column_name='is_starter') THEN
    ALTER TABLE public.squad_players ADD COLUMN is_starter BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;

  -- bench_order
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='squad_players' AND column_name='bench_order') THEN
    ALTER TABLE public.squad_players ADD COLUMN bench_order INTEGER
      CHECK ((is_starter = FALSE AND bench_order BETWEEN 1 AND 4)
             OR (is_starter = TRUE AND bench_order IS NULL));
  END IF;

  -- formation_slot
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='squad_players' AND column_name='formation_slot') THEN
    ALTER TABLE public.squad_players ADD COLUMN formation_slot INTEGER;
  END IF;

  -- points_multiplier (captain support)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='squad_players' AND column_name='points_multiplier') THEN
    ALTER TABLE public.squad_players ADD COLUMN points_multiplier INTEGER NOT NULL DEFAULT 1
      CHECK (points_multiplier IN (1, 2, 3));
  END IF;

  -- gameweek_points
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='squad_players' AND column_name='gameweek_points') THEN
    ALTER TABLE public.squad_players ADD COLUMN gameweek_points INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS squad_players_squad_id_idx  ON public.squad_players(squad_id);
CREATE INDEX IF NOT EXISTS squad_players_player_id_idx ON public.squad_players(player_id);
CREATE INDEX IF NOT EXISTS squad_players_starter_idx   ON public.squad_players(squad_id, is_starter);

ALTER TABLE public.squad_players ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own squad's players
DROP POLICY IF EXISTS "Users manage own squad_players" ON public.squad_players;
CREATE POLICY "Users manage own squad_players"
  ON public.squad_players
  USING (
    EXISTS (
      SELECT 1 FROM public.user_squads us
      WHERE us.id = squad_players.squad_id
        AND us.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_squads us
      WHERE us.id = squad_players.squad_id
        AND us.user_id = auth.uid()
    )
  );


-- ══════════════════════════════════════════════════════════════
-- 4. DATABASE RULES / GUARDS
--    Enforce exactly 11 starters + 4 bench via a DB function
--    (optional integrity check — call from the backend).
-- ══════════════════════════════════════════════════════════════

-- Helper view: squad composition summary
-- DROP + CREATE so re-runs always succeed regardless of column changes
DROP VIEW IF EXISTS public.squad_composition;
CREATE VIEW public.squad_composition AS
SELECT
  sq.id              AS squad_id,
  sq.user_id,
  COUNT(*)                                                   AS total_players,
  COUNT(*) FILTER (WHERE sp.is_starter = TRUE)               AS starter_count,
  COUNT(*) FILTER (WHERE sp.is_starter = FALSE)              AS bench_count,
  COUNT(*) FILTER (WHERE sp.is_starter = TRUE
                     AND p.position = 'GK')                  AS gk_starters,
  COUNT(*) FILTER (WHERE sp.is_starter = TRUE
                     AND p.position = 'DEF')                 AS def_starters,
  COUNT(*) FILTER (WHERE sp.is_starter = TRUE
                     AND p.position = 'MID')                 AS mid_starters,
  COUNT(*) FILTER (WHERE sp.is_starter = TRUE
                     AND p.position = 'FWD')                 AS fwd_starters
FROM public.user_squads sq
JOIN public.squad_players sp ON sp.squad_id = sq.id
JOIN public.players        p  ON p.id        = sp.player_id
GROUP BY sq.id, sq.user_id;


-- ══════════════════════════════════════════════════════════════
-- 5. SAMPLE FIXTURE DATA
--    Uncomment and replace UUIDs with real team IDs from your
--    teams table (copy them from seed_botola.sql).
-- ══════════════════════════════════════════════════════════════

/*
-- Example: Gameweek 12 fixtures
INSERT INTO public.fixtures (home_team_id, away_team_id, match_date, gameweek, status)
VALUES
  -- FAR Rabat vs Wydad AC  →  replace UUIDs below
  ('03a8919d-c7e2-4de1-8a59-b3abdd3e31bb', '60ca6a7a-8531-4d9a-9878-4b50c395d796',
   '2026-04-12 15:00:00+01', 12, 'Upcoming'),

  -- Raja Casablanca vs Maghreb Fez
  ('9db765b8-752b-44c9-891b-8ddaa4bcb40c', 'e64e52fa-9caa-4cd0-80b9-8ed8b65a5d08',
   '2026-04-12 17:30:00+01', 12, 'Upcoming'),

  -- Berkane vs Difaa El Jadidi
  ('e737094c-7c39-4427-9529-d0c7917823ea', '6c9d4879-fa3e-4ff1-addd-6a40078aa89a',
   '2026-04-13 15:00:00+01', 12, 'Upcoming');
*/
