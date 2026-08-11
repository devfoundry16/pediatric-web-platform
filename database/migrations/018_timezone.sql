-- =============================================
-- Pediatric Telemedicine Platform - Per-doctor timezones
--
-- Until now the platform assumed every participant was in Asia/Dubai: the zone
-- was hardcoded in one client constant and as the literal string "GST (UTC+4)"
-- in the i18n dictionaries. Times were stored as bare DATE + TIME and rendered
-- verbatim, so a visitor abroad saw Dubai times labelled as their own.
--
-- Rather than migrate to TIMESTAMPTZ (which needs a backfill and rewrites every
-- query, conflict check and slot calculation), this makes the existing contract
-- explicit and attaches the zone to the rows that need it.
--
-- ADD COLUMN only — no RLS policy changes, no data migration. Existing rows are
-- Dubai, which is exactly what the defaults say.
-- =============================================

-- ─────────────────────────────────────────────────────────────────────────────
-- The zone a doctor's working hours are expressed in. Governs slot generation
-- for FUTURE bookings.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Dubai';

COMMENT ON COLUMN public.doctors.timezone IS
  'IANA timezone (e.g. Asia/Dubai) that this doctor''s doctor_schedules '
  'start_time/end_time are expressed in. Those columns are bare TIME: they are '
  'wall-clock in THIS zone, not UTC.';

-- ─────────────────────────────────────────────────────────────────────────────
-- The zone an appointment was booked in, snapshotted at booking time.
--
-- Without this, a doctor changing their timezone would silently reinterpret
-- every appointment already on the books — 09:00 Dubai would become 09:00 in
-- the new zone, landing outside the doctor's working hours and possibly on a
-- different day_of_week. Snapshotting keeps historical rows self-describing and
-- limits doctors.timezone to governing new bookings only.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Dubai';

COMMENT ON COLUMN public.appointments.timezone IS
  'IANA timezone this appointment''s scheduled_date/scheduled_time are '
  'wall-clock in, snapshotted from doctors.timezone at booking time. Read this '
  'rather than doctors.timezone when displaying an existing appointment.';
