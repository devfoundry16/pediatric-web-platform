-- =============================================
-- Pediatric Telemedicine Platform - Security Hardening
-- Closes two critical privilege-escalation holes:
--   C1: client-controlled role at signup (self-register as admin/doctor)
--   C2: self-promotion via direct UPDATE on profiles.role
--
-- Both are enforced with TRIGGERS (not RLS), so they hold even against
-- direct PostgREST calls made with the public anon key.
-- =============================================

-- ─────────────────────────────────────────────────────────────────────────────
-- C1: New users are ALWAYS created as 'parent'.
--
-- The previous handle_new_user() copied raw_user_meta_data->>'role' straight
-- into profiles.role. That metadata is fully client-controlled via
-- supabase.auth.signUp({ options: { data: { role: 'admin' } } }), so anyone
-- with the public anon key could mint an admin. We now ignore any client-
-- supplied role. Doctors/admins must be promoted server-side (service role)
-- or via SQL — see promote flow below.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    'parent'  -- hard-coded; client-supplied role is intentionally ignored
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: the doctors row is no longer auto-created at signup (it depended on the
-- client-supplied 'doctor' role). Doctors are provisioned by an admin after a
-- profile is promoted to role='doctor'. If you rely on migration 004's behavior,
-- provision the doctors row in the same server-side/admin step that promotes the
-- profile to 'doctor'.

-- ─────────────────────────────────────────────────────────────────────────────
-- C2: Block role changes coming from end users (anon / authenticated).
--
-- The RLS UPDATE policy on profiles has no WITH CHECK, so an authenticated user
-- can `UPDATE profiles SET role='admin' WHERE id = <self>` via PostgREST with
-- the anon key. This trigger rejects any role change performed as the `anon` or
-- `authenticated` DB role. The Express API (service_role) and SQL admins
-- (postgres/supabase_admin) can still change roles.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Changing profile role is not permitted';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_role_escalation ON public.profiles;
CREATE TRIGGER prevent_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_escalation();

-- ─────────────────────────────────────────────────────────────────────────────
-- C5: Idempotent Stripe webhook fulfillment.
--
-- Stripe delivers events at-least-once; the checkout.session.completed handler
-- INSERTs into user_packages with no dedupe, so a redelivery/retry double-
-- credits the buyer. A unique index on the Stripe session id lets the handler
-- use ON CONFLICT DO NOTHING so re-processing the same payment is a no-op.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_packages_stripe_session
  ON public.user_packages (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- HIGH: Atomic package-credit consumption (double-spend race).
--
-- Booking consumed credits with a read-modify-write in application code
-- (read credits_remaining, compute N-1 in JS, write back). Two concurrent
-- bookings could both read 1 and both write 0 → two consultations for one
-- credit. This function performs a single guarded UPDATE so only one caller
-- can win. Returns TRUE if a credit was consumed, FALSE otherwise (exhausted,
-- expired, inactive, or lost the race — caller should fall back to paid).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.consume_package_credit(p_user_package_id uuid)
RETURNS boolean AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE public.user_packages
  SET credits_remaining = credits_remaining - 1,
      status = CASE WHEN credits_remaining - 1 <= 0 THEN 'exhausted' ELSE status END
  WHERE id = p_user_package_id
    AND status = 'active'
    AND credits_remaining > 0
    AND expires_at > now();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Restore a credit reserved by consume_package_credit when the follow-up work
-- (e.g. inserting the appointment) fails, so a reserved credit is never lost.
CREATE OR REPLACE FUNCTION public.restore_package_credit(p_user_package_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.user_packages
  SET credits_remaining = credits_remaining + 1,
      status = CASE WHEN status = 'exhausted' THEN 'active' ELSE status END
  WHERE id = p_user_package_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- HIGH: Refund / dispute revocation support.
--
-- Only checkout.session.completed was handled, so a buyer could pay, receive
-- credits/session access, then refund or charge back and keep everything.
-- The webhook now also handles charge.refunded / charge.dispute.created and
-- revokes access. To match a Stripe charge (which carries a payment_intent,
-- not a checkout-session id) back to what was fulfilled, we persist the
-- payment_intent at fulfillment time, and add a 'refunded' state.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_packages
  ADD COLUMN IF NOT EXISTS stripe_payment_intent TEXT;

ALTER TABLE public.session_registrations
  ADD COLUMN IF NOT EXISTS stripe_payment_intent TEXT;

ALTER TABLE public.user_packages
  DROP CONSTRAINT IF EXISTS user_packages_status_check;
ALTER TABLE public.user_packages
  ADD CONSTRAINT user_packages_status_check
  CHECK (status IN ('active', 'expired', 'exhausted', 'cancelled', 'refunded'));

ALTER TABLE public.session_registrations
  DROP CONSTRAINT IF EXISTS session_registrations_payment_status_check;
ALTER TABLE public.session_registrations
  ADD CONSTRAINT session_registrations_payment_status_check
  CHECK (payment_status IN ('free', 'pending', 'paid', 'refunded'));

CREATE INDEX IF NOT EXISTS idx_user_packages_payment_intent
  ON public.user_packages (stripe_payment_intent)
  WHERE stripe_payment_intent IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_session_registrations_payment_intent
  ON public.session_registrations (stripe_payment_intent)
  WHERE stripe_payment_intent IS NOT NULL;
