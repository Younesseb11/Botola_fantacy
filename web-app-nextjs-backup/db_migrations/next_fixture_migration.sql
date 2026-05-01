-- next_fixture — single-row table for the frontend to display the upcoming match
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.next_fixture (
    id            INTEGER      PRIMARY KEY DEFAULT 1,
    home_team     TEXT,
    away_team     TEXT,
    kickoff_time  TIMESTAMPTZ,

    -- Enforce only one row ever exists
    CONSTRAINT single_row CHECK (id = 1)
);

-- Insert the blank row
INSERT INTO public.next_fixture (id, home_team, away_team, kickoff_time)
VALUES (1, NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- RLS: public read, service-role-only write
ALTER TABLE public.next_fixture ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read next_fixture"
  ON public.next_fixture FOR SELECT USING (true);
