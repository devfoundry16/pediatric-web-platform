-- Migration 016: Repricing + single doctor (Dr Sahar)
--
-- 1. Reprice the one-time consultation to 350 AED / 30 minutes.
-- 2. Reprice the Priority (emergency_priority) package to 450 AED, valid 3 days.
-- 3. Make Dr Sahar the single active doctor: seed her record + schedule and
--    deactivate the three mock doctors from migration 002.
--
-- UPDATE / INSERT only — no RLS policy changes.

-- ============================================================
-- 1. One-time consultation → 350 AED / 30 min
-- ============================================================
UPDATE public.consultation_types
  SET price_aed = 350,
      duration_minutes = 30,
      description = 'A single 30-minute video consultation.'
  WHERE slug = 'consultation';

-- ============================================================
-- 2. Priority package → 450 AED / 1 session / valid 3 days
-- ============================================================
UPDATE public.consultation_packages
  SET price_aed = 450,
      validity_days = 3,
      description = 'Priority access within 2 hours.'
  WHERE slug = 'emergency_priority';

-- ============================================================
-- 3. Single doctor: Dr Sahar
-- ============================================================
-- Seed Dr Sahar (profile_id stays NULL — no auth account needed to be bookable).
INSERT INTO public.doctors (id, full_name, specialty, bio, avatar_url, is_active)
VALUES (
  'f1e2d3c4-b5a6-4789-9abc-def012345678',
  'Dr. Sahar',
  'General Pediatrics',
  'Board-certified pediatrician dedicated to compassionate, accessible care for children of all ages.',
  '/dr-sahar.png',
  true
)
ON CONFLICT (id) DO NOTHING;

-- Availability: Sunday–Thursday, 09:00–18:00 (0=Sun … 4=Thu).
INSERT INTO public.doctor_schedules (doctor_id, day_of_week, start_time, end_time)
VALUES
  ('f1e2d3c4-b5a6-4789-9abc-def012345678', 0, '09:00', '18:00'),
  ('f1e2d3c4-b5a6-4789-9abc-def012345678', 1, '09:00', '18:00'),
  ('f1e2d3c4-b5a6-4789-9abc-def012345678', 2, '09:00', '18:00'),
  ('f1e2d3c4-b5a6-4789-9abc-def012345678', 3, '09:00', '18:00'),
  ('f1e2d3c4-b5a6-4789-9abc-def012345678', 4, '09:00', '18:00')
ON CONFLICT (doctor_id, day_of_week) DO NOTHING;

-- Deactivate the three mock doctors so Dr Sahar is the only bookable doctor.
-- Deactivate (not delete) — appointments.doctor_id is ON DELETE RESTRICT and may
-- reference these rows.
UPDATE public.doctors
  SET is_active = false
  WHERE id IN (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    'c3d4e5f6-a7b8-9012-cdef-123456789012'
  );
