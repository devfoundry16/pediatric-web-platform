-- =============================================
-- Pediatric Telemedicine Platform - Database Schema
-- Phase 3: Doctor Dashboard Access
-- =============================================

-- =============================================
-- 1. Link profile_id on doctors table
-- =============================================

-- Make sure profile_id has an index for fast look-ups
CREATE INDEX IF NOT EXISTS idx_doctors_profile_id ON public.doctors(profile_id);

-- =============================================
-- 2. Helper function: resolve doctor id by auth user
-- =============================================

CREATE OR REPLACE FUNCTION public.get_doctor_id_for_user(user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM public.doctors WHERE profile_id = user_id LIMIT 1;
$$;

-- =============================================
-- 3. RLS policies: doctors can access their own appointments
-- =============================================

CREATE POLICY "Doctors can view own appointments"
  ON public.appointments
  FOR SELECT
  USING (
    doctor_id = public.get_doctor_id_for_user(auth.uid())
  );

CREATE POLICY "Doctors can update own appointments"
  ON public.appointments
  FOR UPDATE
  USING (
    doctor_id = public.get_doctor_id_for_user(auth.uid())
  );

-- =============================================
-- 4. RLS policies: doctors can manage their own schedules
-- =============================================

CREATE POLICY "Doctors can view own schedule"
  ON public.doctor_schedules
  FOR SELECT
  USING (
    doctor_id = public.get_doctor_id_for_user(auth.uid())
  );

CREATE POLICY "Doctors can manage own schedule"
  ON public.doctor_schedules
  FOR ALL
  USING (
    doctor_id = public.get_doctor_id_for_user(auth.uid())
  );
