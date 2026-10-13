-- Kin — pending migration, 2026-10-13
--
-- Paste the whole thing into the Supabase SQL editor and run it once.
-- Safe to re-run: every statement is IF NOT EXISTS.
--
-- Until this runs, the app degrades rather than breaking — recurrence columns
-- are written only when present, and the queries read "*" rather than naming
-- them. Running it switches series grouping on and removes the sequential
-- scans.

-- ─── 1. Repeating events as a series ──────────────────────────────────────────
-- Every occurrence of one request shares a recurrence_id, so a run can be
-- cancelled or edited as a unit and topped up before it runs out.

ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence_id UUID;
ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence_rule TEXT;

-- ─── 2. Indexes ───────────────────────────────────────────────────────────────
-- Before this, only the primary keys and the family_preferences UNIQUE were
-- indexed, so everything else was a sequential scan.

-- The most valuable one. Five tables carry an RLS policy of the form
--   family_id IN (SELECT id FROM families WHERE user_id = auth.uid())
-- so this lookup runs on every read and write in the app.
CREATE INDEX IF NOT EXISTS idx_families_user
  ON families (user_id);

-- Dashboard, calendar, and the chat's calendar answers: one family, a date
-- range, ordered by date.
CREATE INDEX IF NOT EXISTS idx_events_family_start
  ON events (family_id, start_time);

-- The reminder cron sweeps every family at once and has no family_id to narrow
-- on. This is the query that degrades first as signups grow.
CREATE INDEX IF NOT EXISTS idx_events_start
  ON events (start_time);

-- Acting on a repeating run. Partial, because one-off events are the norm.
CREATE INDEX IF NOT EXISTS idx_events_recurrence
  ON events (recurrence_id) WHERE recurrence_id IS NOT NULL;

-- Chat history and the activity feed, both scoped to a family and ordered by time.
CREATE INDEX IF NOT EXISTS idx_messages_family_created
  ON messages (family_id, created_at);

CREATE INDEX IF NOT EXISTS idx_activities_family_created
  ON activities (family_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_family_members_family
  ON family_members (family_id, created_at);

-- Postgres does not index foreign keys automatically, and deleting an activity
-- does ON DELETE SET NULL across events.
CREATE INDEX IF NOT EXISTS idx_events_activity
  ON events (activity_id) WHERE activity_id IS NOT NULL;

-- family_preferences.family_id is already UNIQUE, which indexes it.

-- ─── 3. Check it worked ───────────────────────────────────────────────────────
-- Should list eight idx_* rows.

SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public' AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
