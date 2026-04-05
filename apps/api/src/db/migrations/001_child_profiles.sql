-- Run this in Supabase SQL Editor (Dashboard > SQL Editor).
-- Creates child_profiles with RLS so direct client access is scoped to the parent.

CREATE TABLE IF NOT EXISTS public.child_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,

  -- Personal
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date NOT NULL,
  gender text NOT NULL CHECK (gender IN ('male', 'female', 'prefer_not_to_say')),
  nationality text,
  emirates_id_passport text,

  -- Physical
  weight_kg numeric(6, 2),
  height_cm numeric(6, 2),
  head_circumference_cm numeric(6, 2),
  blood_type text,

  -- Birth & early history
  place_of_birth text,
  premature_birth boolean,
  birth_weight_kg numeric(6, 2),
  delivery_type text CHECK (delivery_type IS NULL OR delivery_type IN ('normal', 'c_section')),
  nicu_stay boolean,
  nicu_duration text,

  -- Health (yes/no + details)
  allergies_present boolean NOT NULL DEFAULT false,
  allergies_details text,
  chronic_conditions_present boolean NOT NULL DEFAULT false,
  chronic_conditions_details text,
  surgeries_present boolean NOT NULL DEFAULT false,
  surgeries_details text,
  medications_present boolean NOT NULL DEFAULT false,
  medications_details text,
  vaccination_status text CHECK (
    vaccination_status IS NULL
    OR vaccination_status IN ('up_to_date', 'partial', 'not_sure')
  ),
  family_medical_history text,

  -- Lifestyle
  school_nursery_name text,
  grade_age_group text,
  smoking_exposure_home boolean,
  screen_time_hours_per_day numeric(4, 2),
  physical_activity_level text CHECK (
    physical_activity_level IS NULL
    OR physical_activity_level IN ('low', 'moderate', 'high')
  ),

  -- Guardian
  guardian_name text NOT NULL,
  guardian_relationship text NOT NULL CHECK (
    guardian_relationship IN ('mother', 'father', 'guardian')
  ),
  guardian_mobile text NOT NULL,
  guardian_email text NOT NULL,
  secondary_contact_phone text,
  emergency_contact_name text,
  emergency_contact_phone text,

  -- Consent
  consent_legal_guardian boolean NOT NULL DEFAULT false,
  consent_data_storage boolean NOT NULL DEFAULT false,
  consent_terms boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS child_profiles_parent_id_idx ON public.child_profiles (parent_id);

ALTER TABLE public.child_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can manage own children"
  ON public.child_profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = parent_id)
  WITH CHECK (auth.uid() = parent_id);

-- Service role (Express API) bypasses RLS; this policy protects direct PostgREST access.

CREATE OR REPLACE FUNCTION public.set_child_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS child_profiles_set_updated_at ON public.child_profiles;
CREATE TRIGGER child_profiles_set_updated_at
  BEFORE UPDATE ON public.child_profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_child_profiles_updated_at();
