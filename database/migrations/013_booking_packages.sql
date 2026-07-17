-- Migration 013: Booking redesign — single consultation + repriced packages
--
-- 1. Adds a new `consultation` consultation type (45 min / 399 AED) as the single
--    bookable consult. Old ids (quick/standard/extended) stay valid so historical
--    appointments still satisfy the CHECK constraint.
-- 2. Adds Stripe reference columns to appointments so a one-time consult can be
--    paid through Stripe and matched on refund/dispute.
-- 3. Reprices the two headline packages and makes every package's credits
--    applicable to the new `consultation` type.
--
-- UPDATE/ALTER only — no RLS policy changes.

-- ============================================================
-- 1. Consultation type: allow 'consultation'
-- ============================================================
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_consultation_type_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_consultation_type_check
    CHECK (consultation_type IN ('quick', 'standard', 'extended', 'consultation'));

-- ============================================================
-- 2. Stripe references on appointments (one-time consult payment)
-- ============================================================
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent TEXT;

-- Idempotent fulfillment: a redelivered checkout.session.completed webhook must
-- not double-confirm. Unique on the checkout session id (nullable → many NULLs
-- allowed for credit/legacy appointments).
CREATE UNIQUE INDEX IF NOT EXISTS appointments_stripe_checkout_session_id_key
  ON public.appointments (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

-- Refund/dispute lookups match on the stored payment intent.
CREATE INDEX IF NOT EXISTS appointments_stripe_payment_intent_idx
  ON public.appointments (stripe_payment_intent)
  WHERE stripe_payment_intent IS NOT NULL;

-- ============================================================
-- 3. Reprice packages + make credits apply to 'consultation'
-- ============================================================
UPDATE public.consultation_packages
  SET price_aed = 1400,
      applicable_consultation_types = ARRAY['consultation']
  WHERE slug = 'monthly_followup';

UPDATE public.consultation_packages
  SET price_aed = 1200,
      applicable_consultation_types = ARRAY['consultation']
  WHERE slug = 'newborn_care';

-- Emergency Priority keeps its price; just make its credit usable for the single
-- consultation type.
UPDATE public.consultation_packages
  SET applicable_consultation_types = ARRAY['consultation']
  WHERE slug = 'emergency_priority';

-- ============================================================
-- 4. Keep the admin-managed consultation_types table in sync
-- ============================================================
INSERT INTO public.consultation_types (slug, name, description, duration_minutes, price_aed)
VALUES
  ('consultation', 'Consultation', 'A 45-minute comprehensive consultation.', 45, 399)
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      duration_minutes = EXCLUDED.duration_minutes,
      price_aed = EXCLUDED.price_aed,
      is_active = true;

-- The old tiers are no longer offered for new bookings.
UPDATE public.consultation_types
  SET is_active = false
  WHERE slug IN ('quick', 'standard', 'extended');
