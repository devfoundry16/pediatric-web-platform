-- =============================================
-- Pediatric Telemedicine Platform - Database Schema
-- Phase 5: Medical Records & Files
-- =============================================

-- =============================================
-- 1. Medical Records Table
-- =============================================
CREATE TABLE IF NOT EXISTS public.medical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  child_id UUID NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,

  -- Record classification
  record_type TEXT NOT NULL CHECK (
    record_type IN ('consultation_note', 'prescription', 'diagnosis', 'vitals', 'other')
  ),
  title TEXT NOT NULL,

  -- Clinical content (all optional; relevant fields filled based on record_type)
  notes TEXT,
  diagnosis TEXT,
  prescription TEXT,
  vitals JSONB, -- { weight_kg, height_cm, temp_c, heart_rate, oxygen_saturation }

  -- Audit
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;

-- Parents can view records for their own children
CREATE POLICY "Parents can view own children records"
  ON public.medical_records
  FOR SELECT
  USING (
    child_id IN (
      SELECT id FROM public.child_profiles WHERE parent_id = auth.uid()
    )
  );

-- Doctors can view records they created
CREATE POLICY "Doctors can view own records"
  ON public.medical_records
  FOR SELECT
  USING (
    doctor_id = public.get_doctor_id_for_user(auth.uid())
  );

-- Doctors can create records
CREATE POLICY "Doctors can create records"
  ON public.medical_records
  FOR INSERT
  WITH CHECK (
    public.get_doctor_id_for_user(auth.uid()) IS NOT NULL
  );

-- Doctors can update their own records
CREATE POLICY "Doctors can update own records"
  ON public.medical_records
  FOR UPDATE
  USING (
    doctor_id = public.get_doctor_id_for_user(auth.uid())
  );

-- Doctors can delete their own records
CREATE POLICY "Doctors can delete own records"
  ON public.medical_records
  FOR DELETE
  USING (
    doctor_id = public.get_doctor_id_for_user(auth.uid())
  );

-- =============================================
-- 2. Medical Files Table
-- =============================================
CREATE TABLE IF NOT EXISTS public.medical_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  child_id UUID NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  record_id UUID REFERENCES public.medical_records(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,

  -- File metadata
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size_bytes BIGINT,

  -- Audit
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.medical_files ENABLE ROW LEVEL SECURITY;

-- Parents can manage files for their own children
CREATE POLICY "Parents can manage own children files"
  ON public.medical_files
  FOR ALL
  TO authenticated
  USING (
    child_id IN (
      SELECT id FROM public.child_profiles WHERE parent_id = auth.uid()
    )
  )
  WITH CHECK (
    child_id IN (
      SELECT id FROM public.child_profiles WHERE parent_id = auth.uid()
    )
  );

-- Doctors can view and upload files for patients they have records for
CREATE POLICY "Doctors can view patient files"
  ON public.medical_files
  FOR SELECT
  USING (
    child_id IN (
      SELECT child_id FROM public.medical_records
      WHERE doctor_id = public.get_doctor_id_for_user(auth.uid())
    )
  );

CREATE POLICY "Doctors can upload patient files"
  ON public.medical_files
  FOR INSERT
  WITH CHECK (
    public.get_doctor_id_for_user(auth.uid()) IS NOT NULL
  );

-- =============================================
-- 3. Updated-at trigger for medical_records
-- =============================================
CREATE OR REPLACE FUNCTION public.set_medical_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS medical_records_set_updated_at ON public.medical_records;
CREATE TRIGGER medical_records_set_updated_at
  BEFORE UPDATE ON public.medical_records
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_medical_records_updated_at();

-- =============================================
-- 4. Indexes
-- =============================================
CREATE INDEX IF NOT EXISTS idx_medical_records_child_id ON public.medical_records(child_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_doctor_id ON public.medical_records(doctor_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_appointment_id ON public.medical_records(appointment_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_created_at ON public.medical_records(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_medical_files_child_id ON public.medical_files(child_id);
CREATE INDEX IF NOT EXISTS idx_medical_files_record_id ON public.medical_files(record_id);
CREATE INDEX IF NOT EXISTS idx_medical_files_uploaded_by ON public.medical_files(uploaded_by);
