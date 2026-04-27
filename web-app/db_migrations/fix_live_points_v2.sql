-- fix_live_points_v2.sql
-- ============================================================================
-- Botola Fantasy — Live Points Schema Fixes (v2)
-- Run this AFTER the base schema and fix_event_type_constraint.sql
-- ============================================================================

-- 1. Add match_side column to player_live_points
--    Stores 'home' or 'away' to fix score calculation on the live page.
--    NULL is allowed for legacy rows or events where side can't be determined.
ALTER TABLE public.player_live_points 
ADD COLUMN IF NOT EXISTS match_side TEXT CHECK (match_side IN ('home', 'away'));

-- 2. Update event_type CHECK constraint
--    Ensure all event types used by the scraper are allowed, including:
--    own_goal, penalty_save, penalty_miss (added in live.py scoring updates)
ALTER TABLE public.player_live_points DROP CONSTRAINT IF EXISTS player_live_points_event_type_check;
ALTER TABLE public.player_live_points ADD CONSTRAINT player_live_points_event_type_check
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
  'own_goal',
  'substitution'
));

-- 3. Fix unique index for deduplication
--    The old index used (player_id, event_type, minute, match_date) but
--    player_id can be NULL when fuzzy matching fails. In SQL, NULL != NULL
--    so duplicate null-id events bypass the constraint.
--    Solution: partial unique index that only applies when player_id IS NOT NULL.
DROP INDEX IF EXISTS player_live_points_unique_event_idx;
CREATE UNIQUE INDEX player_live_points_unique_event_idx 
ON public.player_live_points (player_id, event_type, minute, match_date) 
WHERE player_id IS NOT NULL;

-- 4. Add index on match_side for faster filtering on live score queries
CREATE INDEX IF NOT EXISTS idx_player_live_points_match_side
ON public.player_live_points (match_side)
WHERE match_side IS NOT NULL;
