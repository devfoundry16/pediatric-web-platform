-- =============================================
-- Pediatric Telemedicine Platform - Admin-hosted live sessions
--
-- Until now a live session could only be created by a doctor, and its host was
-- always the doctor's row in group_sessions.doctor_id. Admins run sessions too,
-- and an admin has no doctors row, so there was nowhere to record them as host.
--
-- This adds host_profile_id: the account hosting a session that has no doctor.
-- Doctor-created sessions keep using doctor_id and leave this column NULL, so
-- existing rows need no backfill. An admin-created session has doctor_id NULL
-- and host_profile_id set to the admin's profile.
--
-- There is deliberately no CHECK that one of the two is set: doctor_id is
-- already ON DELETE SET NULL, so host-less rows are a reachable state today.
--
-- The API reads this column through the PostgREST embed
-- host:profiles!group_sessions_host_profile_id_fkey, so this migration must be
-- applied BEFORE the API that uses it is deployed.
--
-- One column + one index -- no RLS policy changes (the API uses the
-- service-role client).
-- =============================================

ALTER TABLE public.group_sessions
  ADD COLUMN IF NOT EXISTS host_profile_id UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_group_sessions_host_profile_id
  ON public.group_sessions (host_profile_id)
  WHERE host_profile_id IS NOT NULL;

COMMENT ON COLUMN public.group_sessions.host_profile_id IS
  'Host of a session that has no doctor (an admin). NULL for doctor-hosted '
  'sessions, whose host is doctor_id.';
