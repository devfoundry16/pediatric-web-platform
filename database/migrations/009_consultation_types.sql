-- Migration 009: Consultation types table
-- Moves hardcoded consultation config from the API into the database so admins can manage it.

CREATE TABLE IF NOT EXISTS public.consultation_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL,
  price_aed NUMERIC(10, 2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.consultation_types ENABLE ROW LEVEL SECURITY;

-- Public read (booking flow needs this without auth)
CREATE POLICY "consultation_types_public_read"
  ON public.consultation_types FOR SELECT
  USING (true);

-- Admin write
CREATE POLICY "consultation_types_admin_write"
  ON public.consultation_types FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Seed the three existing types to match the hardcoded CONSULTATION_CONFIG
INSERT INTO public.consultation_types (slug, name, description, duration_minutes, price_aed)
VALUES
  ('quick',    'Quick Consult',     'A 15-minute focused consultation.',          15, 150),
  ('standard', 'Standard',          'A 30-minute thorough consultation.',          30, 250),
  ('extended', 'Extended',          'A 45-minute comprehensive consultation.',     45, 350)
ON CONFLICT (slug) DO NOTHING;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER consultation_types_updated_at
  BEFORE UPDATE ON public.consultation_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
