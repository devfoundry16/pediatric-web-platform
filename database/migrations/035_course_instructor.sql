-- =============================================
-- Pediatric Telemedicine Platform - Admin-authored courses
--
-- Until now a course could only be created by a doctor, and its instructor was
-- always the doctor's row in courses.doctor_id. Admins build courses too, and an
-- admin has no doctors row, so there was nowhere to record them as instructor.
--
-- This adds instructor_profile_id: the account teaching a course that has no
-- doctor. It is the course counterpart of group_sessions.host_profile_id
-- (migration 034). Doctor-created courses keep using doctor_id and leave this
-- column NULL, so existing rows need no backfill. An admin-created course has
-- doctor_id NULL and instructor_profile_id set to the admin's profile.
--
-- There is deliberately no CHECK that one of the two is set: doctor_id is
-- already ON DELETE SET NULL, so instructor-less rows are a reachable state.
--
-- The API reads this column through the PostgREST embed
-- instructor:profiles!courses_instructor_profile_id_fkey, so this migration
-- must be applied BEFORE the API that uses it is deployed.
--
-- One column + one index -- no RLS policy changes (the API uses the
-- service-role client).
-- =============================================

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS instructor_profile_id UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_courses_instructor_profile_id
  ON public.courses (instructor_profile_id)
  WHERE instructor_profile_id IS NOT NULL;

COMMENT ON COLUMN public.courses.instructor_profile_id IS
  'Instructor of a course that has no doctor (an admin). NULL for doctor-taught '
  'courses, whose instructor is doctor_id.';
