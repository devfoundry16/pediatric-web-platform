-- =============================================
-- Pediatric Telemedicine Platform - Google Calendar integration
--
-- An admin connects ONE clinic Google account (OAuth, offline access); the API
-- then mirrors confirmed appointments and published live sessions onto that
-- account's primary calendar, inviting the parent (and the doctor, when
-- doctors.email is set) as attendees.
--
-- 1. google_calendar_integration — the connected account and its refresh
--    token. Singleton. Service-role only: RLS is enabled with NO policies, so
--    the refresh token is never readable with the anon/authenticated keys.
-- 2. calendar_event_logs — one row per attempted calendar write, mirroring
--    email_logs so admins can audit failures the same way they audit email.
-- 3. google_event_id on appointments and group_sessions — the mirrored
--    Google event, used to update/delete instead of duplicating.
--
-- ADD COLUMN / CREATE TABLE only — no changes to any existing RLS policies.
-- =============================================

-- ─────────────────────────────────────────────────────────────────────────────
-- The connected clinic Google account.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.google_calendar_integration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_email TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  connected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'error')),
  last_error TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Service-role access only: RLS enabled, deliberately NO policies. The refresh
-- token grants write access to the clinic calendar and must never be readable
-- from the browser under any key except service_role (which bypasses RLS).
ALTER TABLE public.google_calendar_integration ENABLE ROW LEVEL SECURITY;

-- One connected account at a time. The API replaces the row on reconnect;
-- this index makes a concurrent double-connect a conflict instead of two rows.
CREATE UNIQUE INDEX IF NOT EXISTS google_calendar_integration_singleton
  ON public.google_calendar_integration ((TRUE));

-- ─────────────────────────────────────────────────────────────────────────────
-- Audit log of calendar writes, mirroring email_logs (migration 010).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.calendar_event_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  related_type TEXT NOT NULL CHECK (related_type IN ('appointment', 'group_session')),
  related_id UUID,
  google_event_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_event_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read calendar logs (same shape as email_logs_admin_read).
CREATE POLICY "calendar_event_logs_admin_read"
  ON public.calendar_event_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Service role (API) inserts via supabaseAdmin — bypasses RLS.

CREATE INDEX IF NOT EXISTS calendar_event_logs_created_at_idx ON public.calendar_event_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS calendar_event_logs_status_idx ON public.calendar_event_logs (status);
CREATE INDEX IF NOT EXISTS calendar_event_logs_related_type_idx ON public.calendar_event_logs (related_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- The mirrored Google event, per bookable row.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS google_event_id TEXT;

COMMENT ON COLUMN public.appointments.google_event_id IS
  'Google Calendar event mirroring this appointment on the connected clinic '
  'calendar. Deterministic ("appt" + id without hyphens); kept after the event '
  'is deleted so a cancelled booking can be resurrected by PATCH, not duplicated.';

ALTER TABLE public.group_sessions
  ADD COLUMN IF NOT EXISTS google_event_id TEXT;

COMMENT ON COLUMN public.group_sessions.google_event_id IS
  'Google Calendar event mirroring this live session on the connected clinic '
  'calendar. Deterministic ("gsess" + id without hyphens).';

-- Ask PostgREST (the Supabase data API) to reload its schema cache so the new
-- tables and columns are visible to the API immediately.
NOTIFY pgrst, 'reload schema';
