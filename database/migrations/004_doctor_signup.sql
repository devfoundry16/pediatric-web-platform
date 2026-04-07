-- =============================================
-- Pediatric Telemedicine Platform - Database Schema
-- Phase 4: Auto-provision doctors row on signup
-- =============================================

-- Replace handle_new_user to also insert a doctors row when role = 'doctor'.
-- This means every new doctor that registers gets their own doctors row
-- immediately — no more relying on the mock seed data.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Always create the profiles row
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'parent')
  );

  -- For doctors, also create the doctors row linked to this profile
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'parent') = 'doctor' THEN
    INSERT INTO public.doctors (profile_id, full_name, specialty, is_active)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      'General Pediatrics',
      true
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
