-- ============================================================
-- Migration 006: Consultation Packages
-- ============================================================

-- Package catalog
CREATE TABLE IF NOT EXISTS public.consultation_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  sessions INTEGER NOT NULL CHECK (sessions > 0),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  price_aed NUMERIC(10, 2) NOT NULL CHECK (price_aed > 0),
  validity_days INTEGER NOT NULL CHECK (validity_days > 0),
  applicable_consultation_types TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-user purchased package instances
CREATE TABLE IF NOT EXISTS public.user_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.consultation_packages(id) ON DELETE RESTRICT,
  credits_total INTEGER NOT NULL CHECK (credits_total > 0),
  credits_remaining INTEGER NOT NULL CHECK (credits_remaining >= 0),
  stripe_checkout_session_id TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'exhausted', 'cancelled')),
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT credits_remaining_lte_total CHECK (credits_remaining <= credits_total)
);

-- Credit usage audit log
CREATE TABLE IF NOT EXISTS public.package_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_package_id UUID NOT NULL REFERENCES public.user_packages(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  credits_used INTEGER NOT NULL DEFAULT 1 CHECK (credits_used > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_packages_user_id ON public.user_packages(user_id);
CREATE INDEX IF NOT EXISTS idx_user_packages_status ON public.user_packages(status);
CREATE INDEX IF NOT EXISTS idx_user_packages_expires_at ON public.user_packages(expires_at);
CREATE INDEX IF NOT EXISTS idx_package_usage_logs_user_package_id ON public.package_usage_logs(user_package_id);
CREATE INDEX IF NOT EXISTS idx_package_usage_logs_appointment_id ON public.package_usage_logs(appointment_id);

-- Auto-update updated_at on user_packages
CREATE OR REPLACE FUNCTION public.handle_user_packages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_packages_updated_at
  BEFORE UPDATE ON public.user_packages
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_packages_updated_at();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.consultation_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_usage_logs ENABLE ROW LEVEL SECURITY;

-- consultation_packages: anyone can read, only service role can write
CREATE POLICY "consultation_packages_public_read"
  ON public.consultation_packages FOR SELECT
  USING (true);

-- user_packages: users can only see their own
CREATE POLICY "user_packages_owner_select"
  ON public.user_packages FOR SELECT
  USING (auth.uid() = user_id);

-- package_usage_logs: users can only see their own (via join)
CREATE POLICY "package_usage_logs_owner_select"
  ON public.package_usage_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_packages up
      WHERE up.id = package_usage_logs.user_package_id
        AND up.user_id = auth.uid()
    )
  );

-- ============================================================
-- Extend appointments.payment_status to allow package_credit
-- ============================================================

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_payment_status_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_payment_status_check
    CHECK (payment_status IN ('pending', 'paid', 'refunded', 'package_credit'));

-- Allow price_aed = 0 (package-covered appointments)
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_price_aed_check;

-- ============================================================
-- Seed data — 3 packages
-- ============================================================

INSERT INTO public.consultation_packages
  (slug, name, description, sessions, duration_minutes, price_aed, validity_days, applicable_consultation_types)
VALUES
  (
    'monthly_followup',
    'Monthly Follow-up',
    '4 standard 30-minute sessions for ongoing care and regular follow-ups.',
    4, 30, 750, 30,
    ARRAY['standard']
  ),
  (
    'newborn_care',
    'Newborn Care',
    '3 dedicated 30-minute sessions for new parents and newborn health guidance.',
    3, 30, 600, 30,
    ARRAY['standard']
  ),
  (
    'emergency_priority',
    'Emergency Priority',
    'Priority access — 1 session guaranteed within 2 hours.',
    1, 30, 350, 7,
    ARRAY['quick', 'standard']
  )
ON CONFLICT (slug) DO NOTHING;
