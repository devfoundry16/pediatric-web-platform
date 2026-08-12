-- =============================================
-- Pediatric Telemedicine Platform - Backfill missing doctor records
--
-- Migration 012 stopped auto-creating the doctors row at signup and left
-- provisioning to an admin step that did not exist, so any account promoted to
-- role='doctor' in the meantime has a login but no doctors row. Those users can
-- sign in and are routed to the doctor dashboard, where every endpoint returns
-- 404 "No doctor profile found" because resolveDoctor() matches on
-- doctors.profile_id. From the outside that looks like a broken login.
--
-- The application now creates this row when a role changes, but that only
-- covers changes made from here on. This repairs the accounts already in that
-- state.
--
-- INSERT + INDEX only -- no RLS policy changes.
-- =============================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Give every doctor-role account a record, if it hasn't got one.
--
-- Created INACTIVE, matching what the app does on promotion: there is no
-- specialty, no working hours and no notification address yet, so appearing in
-- the booking flow immediately would be wrong. The doctor dashboard does not
-- filter on is_active, so access is restored regardless — an admin marks them
-- bookable from Admin → Doctors once the details are filled in.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.doctors (profile_id, full_name, timezone, is_active)
SELECT
  p.id,
  COALESCE(NULLIF(TRIM(p.full_name), ''), 'Doctor'),
  'Asia/Dubai',
  false
FROM public.profiles p
WHERE p.role = 'doctor'
  AND NOT EXISTS (
    SELECT 1 FROM public.doctors d WHERE d.profile_id = p.id
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- One account, one doctor.
--
-- resolveDoctor() uses .maybeSingle() on profile_id and throws outright if two
-- rows ever match, and a shared link would hand one doctor another's patients
-- and PHI. The application already refuses this when linking an account; this
-- makes the database agree. Partial, because profile_id is intentionally
-- nullable — a doctor can be bookable without a login.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_doctors_profile_id
  ON public.doctors (profile_id)
  WHERE profile_id IS NOT NULL;
