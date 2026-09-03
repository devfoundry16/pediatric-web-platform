-- =============================================
-- Pediatric Telemedicine Platform - Missed-meeting remedies
--
-- When a consultation is missed -- by the parent or by the doctor -- the parent
-- currently has no recourse inside the product. Cancelling writes
-- payment_status = 'refunded' without ever asking Stripe for a refund, and a
-- credit spent on a call nobody attended is simply burned. Money back means
-- someone opening the Stripe dashboard by hand.
--
-- This adds the request the parent raises and the doctor answers:
--
--   parent picks a remedy  ->  doctor approves or declines  ->  remedy applied
--
-- Eligibility is gated on appointments.attendance_outcome from migration 028;
-- a call both sides attended can never produce a request.
--
-- Two remedies, and they settle differently:
--   * money back -- only for a directly-paid consultation, refunded to the
--     original card through Stripe. The existing charge.refunded webhook then
--     flips the appointment, so nothing here writes payment_status.
--   * replacement session -- one credit, granted from the catalogue row seeded
--     below, spendable through the ordinary booking flow with no code changes.
--
-- refund_requests is also the product's first actor-attributed record: who
-- decided what, when, and why. Every other log here (email_logs,
-- calendar_event_logs, package_usage_logs) records an event, not an actor.
--
-- New table + ADD COLUMN + CHECK relaxation + one seed row.
-- No changes to any EXISTING RLS policies.
-- =============================================

CREATE TABLE IF NOT EXISTS public.refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE RESTRICT,
  requested_remedy TEXT NOT NULL CHECK (requested_remedy IN ('refund', 'free_session')),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'declined')),
  resolution_note TEXT,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  refund_amount_aed NUMERIC(10, 2),
  stripe_refund_id TEXT,
  granted_user_package_id UUID REFERENCES public.user_packages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- UNIQUE on appointment_id is the anti-abuse guarantee: one missed call yields
-- at most one remedy. Enforced here rather than by a check-then-insert in the
-- controller, which two concurrent submits would race straight through.
COMMENT ON TABLE public.refund_requests IS
  'A parent''s claim for a remedy after a missed consultation, and the doctor''s '
  'decision on it. One row per appointment, forever.';

CREATE INDEX IF NOT EXISTS refund_requests_doctor_status_idx
  ON public.refund_requests (doctor_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS refund_requests_parent_idx
  ON public.refund_requests (parent_id, created_at DESC);

-- Service-role access only: RLS on, deliberately NO policies. The doctor is
-- both a subject of these rows and the holder of an authenticated key, and the
-- doctor UPDATE policy on appointments already has USING with no WITH CHECK.
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

-- set_updated_at() is created in migration 009.
DROP TRIGGER IF EXISTS refund_requests_updated_at ON public.refund_requests;
CREATE TRIGGER refund_requests_updated_at
  BEFORE UPDATE ON public.refund_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Where a granted credit came from.
--
-- A comped credit must be distinguishable from a bought one: it was never paid
-- for, so it is not revenue and must not be refunded a second time.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_packages
  ADD COLUMN IF NOT EXISTS granted_by_appointment_id UUID
    REFERENCES public.appointments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS granted_by_profile_id UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.user_packages.granted_by_appointment_id IS
  'Set when this row is a replacement session comped for a missed appointment, '
  'rather than a Stripe purchase. Such rows carry no payment and must be '
  'excluded from revenue reporting.';

-- ─────────────────────────────────────────────────────────────────────────────
-- The catalogue row a replacement session is granted from.
--
-- Reusing the credit wallet means the booking flow needs no changes at all:
-- createAppointment already finds an active credit, consumes it and books at
-- price_aed 0.
--
-- price_aed must be > 0 per the CHECK in migration 006, so it carries the
-- current consultation price. Nothing ever charges it -- a granted row is
-- inserted directly and never passes through checkout. is_active = FALSE keeps
-- it out of the buyable list.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.consultation_packages
  (slug, name, description, sessions, duration_minutes, price_aed, validity_days,
   applicable_consultation_types, is_active)
VALUES
  ('replacement_session',
   'Replacement Session',
   'A complimentary consultation granted after a missed appointment.',
   1, 30, 350, 60,
   ARRAY['quick', 'standard', 'extended', 'consultation'],
   FALSE)
ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Email types for the two new notifications.
--
-- email_logs is the send-once dedupe key, so a type the CHECK rejects makes the
-- log insert fail, which makes the email look unsent -- and mails the recipient
-- again on the next attempt. Same drop-and-re-add shape as 019 / 020 / 023.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.email_logs
  DROP CONSTRAINT IF EXISTS email_logs_email_type_check;

ALTER TABLE public.email_logs
  ADD CONSTRAINT email_logs_email_type_check
  CHECK (
    email_type IN (
      'booking_confirmation',
      'booking_notification',
      'package_purchase',
      'appointment_reminder',
      'session_reminder',
      'cancellation',
      'reschedule',
      'refund_requested',
      'refund_resolved',
      'other'
    )
  );
