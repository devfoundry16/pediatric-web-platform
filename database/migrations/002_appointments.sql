-- =============================================
-- Pediatric Telemedicine Platform - Database Schema
-- Phase 2: Appointments & Consultation System
-- =============================================

-- =============================================
-- 1. Doctors Table
-- =============================================
CREATE TABLE IF NOT EXISTS public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  specialty TEXT NOT NULL DEFAULT 'General Pediatrics',
  bio TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active doctors"
  ON public.doctors
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage doctors"
  ON public.doctors
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- 2. Doctor Schedules Table
-- =============================================
CREATE TABLE IF NOT EXISTS public.doctor_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (doctor_id, day_of_week)
);

ALTER TABLE public.doctor_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view doctor schedules"
  ON public.doctor_schedules
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage schedules"
  ON public.doctor_schedules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- 3. Doctor Holidays Table
-- =============================================
CREATE TABLE IF NOT EXISTS public.doctor_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  holiday_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (doctor_id, holiday_date)
);

ALTER TABLE public.doctor_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view doctor holidays"
  ON public.doctor_holidays
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage holidays"
  ON public.doctor_holidays
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- 4. Appointments Table
-- =============================================
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE RESTRICT,
  consultation_type TEXT NOT NULL CHECK (consultation_type IN ('quick', 'standard', 'extended')),
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  duration_minutes INT NOT NULL CHECK (duration_minutes IN (15, 30, 45)),
  price_aed NUMERIC(10, 2) NOT NULL,
  symptoms TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'rescheduled')),
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  payment_reference TEXT,
  meeting_url TEXT,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view own appointments"
  ON public.appointments
  FOR SELECT
  USING (auth.uid() = parent_id);

CREATE POLICY "Parents can create own appointments"
  ON public.appointments
  FOR INSERT
  WITH CHECK (auth.uid() = parent_id);

CREATE POLICY "Parents can update own appointments"
  ON public.appointments
  FOR UPDATE
  USING (auth.uid() = parent_id);

CREATE POLICY "Admins can manage all appointments"
  ON public.appointments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =============================================
-- 5. Triggers
-- =============================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_doctors_updated_at
  BEFORE UPDATE ON public.doctors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================
-- 6. Indexes
-- =============================================

CREATE INDEX IF NOT EXISTS idx_appointments_parent_id ON public.appointments(parent_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON public.appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_date ON public.appointments(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);
CREATE INDEX IF NOT EXISTS idx_doctor_schedules_doctor_id ON public.doctor_schedules(doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_holidays_doctor_date ON public.doctor_holidays(doctor_id, holiday_date);

-- =============================================
-- 7. Mock Doctor Seed Data
-- =============================================

-- Insert 3 mock pediatric doctors
INSERT INTO public.doctors (id, full_name, specialty, bio, is_active) VALUES
(
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Dr. Sara Al-Mansoori',
  'General Pediatrics',
  'Board-certified pediatrician with 10+ years of experience specializing in child wellness, vaccinations, and developmental assessments. Fluent in Arabic and English.',
  true
),
(
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'Dr. Khalid Ibrahim',
  'Pediatric Pulmonology',
  'Specialist in pediatric respiratory conditions including asthma, allergies, and chronic lung disease. Over 8 years of clinical experience in UAE.',
  true
),
(
  'c3d4e5f6-a7b8-9012-cdef-123456789012',
  'Dr. Nadia Haddad',
  'Developmental Pediatrics',
  'Expert in child development, behavioral issues, and neurodevelopmental disorders. Dedicated to helping children reach their full potential.',
  true
)
ON CONFLICT (id) DO NOTHING;

-- Doctor schedules: Sun–Thu (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu), 9 AM – 6 PM
INSERT INTO public.doctor_schedules (doctor_id, day_of_week, start_time, end_time) VALUES
-- Dr. Sara Al-Mansoori
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 0, '09:00', '18:00'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 1, '09:00', '18:00'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 2, '09:00', '18:00'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 3, '09:00', '18:00'),
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 4, '09:00', '18:00'),
-- Dr. Khalid Ibrahim
('b2c3d4e5-f6a7-8901-bcde-f12345678901', 0, '09:00', '17:00'),
('b2c3d4e5-f6a7-8901-bcde-f12345678901', 1, '09:00', '17:00'),
('b2c3d4e5-f6a7-8901-bcde-f12345678901', 2, '09:00', '17:00'),
('b2c3d4e5-f6a7-8901-bcde-f12345678901', 3, '09:00', '17:00'),
('b2c3d4e5-f6a7-8901-bcde-f12345678901', 4, '09:00', '17:00'),
-- Dr. Nadia Haddad
('c3d4e5f6-a7b8-9012-cdef-123456789012', 1, '10:00', '18:00'),
('c3d4e5f6-a7b8-9012-cdef-123456789012', 2, '10:00', '18:00'),
('c3d4e5f6-a7b8-9012-cdef-123456789012', 3, '10:00', '18:00'),
('c3d4e5f6-a7b8-9012-cdef-123456789012', 4, '10:00', '18:00'),
('c3d4e5f6-a7b8-9012-cdef-123456789012', 6, '10:00', '14:00')
ON CONFLICT (doctor_id, day_of_week) DO NOTHING;
