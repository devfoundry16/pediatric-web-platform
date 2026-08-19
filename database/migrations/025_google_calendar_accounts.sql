-- =============================================
-- Pediatric Telemedicine Platform - Per-user Google Calendar accounts
--
-- Migration 024 mirrored every booking onto ONE admin-connected clinic
-- calendar, with parents and doctors invited as email attendees. This
-- generalises that to the Calendly-style model: any signed-in user (parent or
-- doctor) can connect their OWN Google account, and their events are written
-- straight into their personal calendar instead of arriving as an invite.
--
-- 1. google_calendar_accounts — one connected Google account per user.
--    user_id IS NULL marks the clinic-wide account (what 024 called
--    google_calendar_integration), so both kinds share one code path.
-- 2. calendar_event_mirrors — which Google event id represents a booking in
--    WHICH calendar. Replaces the single google_event_id column, because a
--    booking now maps to one event per connected calendar.
-- 3. calendar_event_logs.account_id — so a failure says whose calendar broke.
--
-- Existing 024 data is copied forward; the old table and columns are left in
-- place (unused) so this migration can be rolled back without data loss.
--
-- CREATE TABLE / ADD COLUMN only — no changes to any EXISTING RLS policies.
-- =============================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Connected Google accounts.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.google_calendar_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = the clinic-wide account connected by an admin. Non-NULL = a parent
  -- or doctor who connected their own calendar. ON DELETE CASCADE so deleting
  -- a user takes their stored refresh token with it.
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  google_email TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'error')),
  last_error TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Service-role access only: RLS on, deliberately NO policies. A refresh token
-- grants write access to someone's personal calendar and must never be
-- readable with the anon/authenticated keys.
ALTER TABLE public.google_calendar_accounts ENABLE ROW LEVEL SECURITY;

-- One account per user, and at most one clinic account. Two partial indexes,
-- because a plain UNIQUE(user_id) would allow unlimited NULL rows.
CREATE UNIQUE INDEX IF NOT EXISTS google_calendar_accounts_user_idx
  ON public.google_calendar_accounts (user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS google_calendar_accounts_clinic_idx
  ON public.google_calendar_accounts ((TRUE))
  WHERE user_id IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Which event id represents a booking in which calendar.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.calendar_event_mirrors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.google_calendar_accounts(id) ON DELETE CASCADE,
  related_type TEXT NOT NULL CHECK (related_type IN ('appointment', 'group_session')),
  related_id UUID NOT NULL,
  google_event_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, related_type, related_id)
);

ALTER TABLE public.calendar_event_mirrors ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS calendar_event_mirrors_related_idx
  ON public.calendar_event_mirrors (related_type, related_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Attribute each log line to a calendar.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.calendar_event_logs
  ADD COLUMN IF NOT EXISTS account_id UUID;

COMMENT ON COLUMN public.calendar_event_logs.account_id IS
  'Which google_calendar_accounts row this write targeted. NULL for failures '
  'raised before an account was resolved. Deliberately not a foreign key: log '
  'history must survive the account being disconnected.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Carry migration 024 forward.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  clinic_account_id UUID;
BEGIN
  IF to_regclass('public.google_calendar_integration') IS NULL THEN
    RETURN;
  END IF;

  -- The 024 singleton becomes the clinic account (user_id NULL).
  INSERT INTO public.google_calendar_accounts (user_id, google_email, refresh_token, status, last_error, connected_at)
  SELECT NULL, google_email, refresh_token, status, last_error, connected_at
  FROM public.google_calendar_integration
  LIMIT 1
  ON CONFLICT DO NOTHING;

  SELECT id INTO clinic_account_id
  FROM public.google_calendar_accounts
  WHERE user_id IS NULL;

  IF clinic_account_id IS NULL THEN
    RETURN;
  END IF;

  -- Events already mirrored onto the clinic calendar keep their ids.
  INSERT INTO public.calendar_event_mirrors (account_id, related_type, related_id, google_event_id)
  SELECT clinic_account_id, 'appointment', id, google_event_id
  FROM public.appointments
  WHERE google_event_id IS NOT NULL
  ON CONFLICT DO NOTHING;

  INSERT INTO public.calendar_event_mirrors (account_id, related_type, related_id, google_event_id)
  SELECT clinic_account_id, 'group_session', id, google_event_id
  FROM public.group_sessions
  WHERE google_event_id IS NOT NULL
  ON CONFLICT DO NOTHING;
END $$;

-- Ask PostgREST (the Supabase data API) to reload its schema cache so the new
-- tables and column are visible to the API immediately.
NOTIFY pgrst, 'reload schema';
