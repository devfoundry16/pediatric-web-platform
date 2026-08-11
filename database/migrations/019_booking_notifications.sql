-- =============================================
-- Pediatric Telemedicine Platform - Booking notifications
--
-- Booking confirmation went to the parent only, and only when a package credit
-- covered the consultation. Paid consultations were never emailed at all: the
-- Stripe webhook confirms the appointment but sends nothing, despite a comment
-- claiming otherwise. Doctors and admins were never notified.
--
-- ADD COLUMN / CHECK relaxation only -- no RLS policy changes.
-- =============================================

-- ─────────────────────────────────────────────────────────────────────────────
-- A notification address for the doctor.
--
-- doctors.profile_id is intentionally nullable (migration 016 seeds Dr Sahar
-- with no auth account so she is bookable without a login), so there is no
-- address to fall back on. This is a plain contact field, deliberately separate
-- from auth: setting it must not imply the doctor can sign in.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS email TEXT;

COMMENT ON COLUMN public.doctors.email IS
  'Where booking notifications for this doctor are sent. Independent of '
  'profile_id / auth.users -- a doctor can be notified without having a login. '
  'Notifications are skipped when NULL.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Allow logging the doctor/admin booking notifications.
--
-- email_logs.email_type is CHECK-constrained (migration 010) and rejects
-- anything unlisted, so the new type has to be added before it can be written.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.email_logs
  DROP CONSTRAINT IF EXISTS email_logs_email_type_check;

ALTER TABLE public.email_logs
  ADD CONSTRAINT email_logs_email_type_check
  CHECK (
    email_type IN (
      'booking_confirmation',
      'booking_notification',
      'appointment_reminder',
      'cancellation',
      'reschedule',
      'other'
    )
  );
