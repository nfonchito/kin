-- Run this in your Supabase SQL editor to set up the database schema
-- Safe to re-run: uses IF NOT EXISTS and drops policies before recreating

-- ─── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS families (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'My Family',
  -- No location defaults. These used to default to Northwest Hills / Austin /
  -- TX / 78731, so every family that never touched Profile was recorded as
  -- living there and told so when they asked. Unknown must stay unknown.
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  -- IANA zone name, e.g. 'America/Chicago'. Captured from the browser at
  -- signup and refreshed opportunistically from chat. Reminder emails render
  -- in this zone; NULL falls back to KIN_DEFAULT_TZ.
  timezone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS family_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID REFERENCES families(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  age INTEGER,
  avatar_color TEXT DEFAULT '#15c489',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS family_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID REFERENCES families(id) ON DELETE CASCADE NOT NULL UNIQUE,
  home_size TEXT,
  yard_type TEXT,
  pets JSONB DEFAULT '[]',
  dietary_notes TEXT,
  service_preferences JSONB DEFAULT '{}',
  reminders_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID REFERENCES families(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID REFERENCES families(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done', 'cancelled')),
  category TEXT NOT NULL DEFAULT 'general',
  scheduled_for TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID REFERENCES families(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  all_day BOOLEAN DEFAULT FALSE,
  category TEXT DEFAULT 'general',
  color TEXT DEFAULT '#15c489',
  created_by TEXT DEFAULT 'user',
  -- A repeating request ("every Thursday") is still written as one row per
  -- occurrence, but every row in the run shares a recurrence_id and carries
  -- the phrase it came from, so a series can be edited or cancelled as a unit
  -- and topped up before it runs out.
  recurrence_id UUID,
  recurrence_rule TEXT,
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies so we can safely recreate them
DROP POLICY IF EXISTS "Users can manage their own family" ON families;
DROP POLICY IF EXISTS "Users can manage their family members" ON family_members;
DROP POLICY IF EXISTS "Users can manage their family preferences" ON family_preferences;
DROP POLICY IF EXISTS "Users can manage their family messages" ON messages;
DROP POLICY IF EXISTS "Users can manage their family activities" ON activities;
DROP POLICY IF EXISTS "Users can manage their family events" ON events;

-- Recreate policies
CREATE POLICY "Users can manage their own family" ON families
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their family members" ON family_members
  FOR ALL USING (
    family_id IN (SELECT id FROM families WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage their family preferences" ON family_preferences
  FOR ALL USING (
    family_id IN (SELECT id FROM families WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage their family messages" ON messages
  FOR ALL USING (
    family_id IN (SELECT id FROM families WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage their family activities" ON activities
  FOR ALL USING (
    family_id IN (SELECT id FROM families WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage their family events" ON events
  FOR ALL USING (
    family_id IN (SELECT id FROM families WHERE user_id = auth.uid())
  );

-- ─── Indexes ──────────────────────────────────────────────────────────────────
--
-- Only the primary keys and the family_preferences UNIQUE were indexed, so
-- every one of these was a sequential scan.
--
-- The most valuable one is families(user_id): five tables carry an RLS policy
-- of the form "family_id IN (SELECT id FROM families WHERE user_id = auth.uid())",
-- so that lookup runs on every read and write in the app, not just on the
-- fourteen places that filter on user_id directly.

CREATE INDEX IF NOT EXISTS idx_families_user ON families (user_id);

-- Dashboard, calendar and the chat's calendar answers: filter by family,
-- bounded by a date range, ordered by date.
CREATE INDEX IF NOT EXISTS idx_events_family_start ON events (family_id, start_time);

-- The reminder cron sweeps every family at once, so it has no family_id to
-- narrow on — this is the one that degrades first as signups grow.
CREATE INDEX IF NOT EXISTS idx_events_start ON events (start_time);

-- Acting on a repeating run as a unit. Partial: one-off events are the norm.
CREATE INDEX IF NOT EXISTS idx_events_recurrence ON events (recurrence_id) WHERE recurrence_id IS NOT NULL;

-- Chat history and the activity feed, both newest-first within a family.
CREATE INDEX IF NOT EXISTS idx_messages_family_created ON messages (family_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activities_family_created ON activities (family_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_family_members_family ON family_members (family_id, created_at);

-- Postgres does not index foreign keys automatically, and deleting an activity
-- does ON DELETE SET NULL across events. Partial: almost every event is null here.
CREATE INDEX IF NOT EXISTS idx_events_activity ON events (activity_id) WHERE activity_id IS NOT NULL;

-- family_preferences.family_id is already UNIQUE, which indexes it.

-- ─── Trigger: auto-create family on signup ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.families (user_id, name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'family_name', 'My Family'));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
