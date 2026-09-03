-- =============================================
-- Pediatric Telemedicine Platform - Appointment attendance
--
-- Nothing records who turned up to a consultation. joinAppointment() mints a
-- Daily meeting token and writes nothing, there are no Daily webhooks (Stripe's
-- is the only webhook in the app), and no appointment ever transitions on its
-- own -- a call nobody attended sits at status = 'confirmed' forever.
--
-- That gap blocks the missed-meeting remedies in migration 029: a parent may
-- only claim a refund or a replacement session when a call was actually missed,
-- and today "missed" is unknowable.
--
-- Two pieces:
--   1. appointment_join_events -- one row each time someone is authorised to
--      enter the room. This is INTENT TO JOIN, not proven presence: it records
--      that a participant asked for a token, not that they stayed. That is the
--      honest reading of what the API can observe without Daily webhooks, and
--      it answers the question the remedy flow actually asks -- did this side
--      show up at all?
--   2. appointments.attendance_outcome -- the classification, written by the
--      cron sweep once the join window has closed.
--
-- Deliberately NOT a new appointments.status value. `status` is load-bearing in
-- slot generation (lib/slots.ts), the Google Calendar reconciler, doctor
-- patient lists and the i18n label maps; the reconciler in particular falls
-- through on an unrecognised status and would strand stale calendar events. An
-- additive column is read by nothing that already exists.
--
-- New tables + ADD COLUMN only -- no changes to any EXISTING RLS policies.
-- =============================================

CREATE TABLE IF NOT EXISTS public.appointment_join_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('parent', 'doctor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.appointment_join_events IS
  'One row per authorised entry into a consultation room. Records intent to '
  'join (a meeting token was issued), not proven presence -- someone who opens '
  'the room and walks away still counts as having shown up.';

-- The sweep reads every event for a candidate appointment, and the remedy
-- endpoints re-read them per appointment. Both are lookups by appointment.
CREATE INDEX IF NOT EXISTS appointment_join_events_appointment_idx
  ON public.appointment_join_events (appointment_id);

-- Service-role access only: RLS on, deliberately NO policies. Attendance
-- decides who is owed money, so it must not be writable by the party it
-- judges -- and both parties hold an authenticated key.
ALTER TABLE public.appointment_join_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS attendance_outcome TEXT;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_attendance_outcome_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_attendance_outcome_check
  CHECK (
    attendance_outcome IS NULL
    OR attendance_outcome IN ('both_joined', 'parent_only', 'doctor_only', 'neither')
  );

COMMENT ON COLUMN public.appointments.attendance_outcome IS
  'Who joined, classified by the cron sweep once the join window closed. NULL '
  'means not yet swept (or the window is still open) and must be treated as '
  '"unknown", never as "nobody came".';

-- The sweep looks for confirmed appointments in a date window that have not
-- been classified yet. Partial, because classified rows are the vast majority
-- once the backlog is drained.
CREATE INDEX IF NOT EXISTS appointments_unclassified_idx
  ON public.appointments (scheduled_date)
  WHERE attendance_outcome IS NULL AND status = 'confirmed';
