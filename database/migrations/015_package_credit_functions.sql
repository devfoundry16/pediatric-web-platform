-- Migration 015: Packages-critical subset of 012 (for environments that ran
-- 013/014 but not 012 yet).
--
-- Contains ONLY the pieces the packages/booking-credit feature depends on — the
-- atomic credit consume/restore functions, the Stripe idempotency index, and the
-- 'refunded' status. It deliberately OMITS 012's signup/role-escalation triggers
-- so you can unblock bookings without changing signup behaviour yet.
--
-- Idempotent and safe to run alongside a later full 012. No RLS policy changes.
-- NOTE: running the full 012 is still recommended for the signup hardening and
-- group-session refund support.

-- Atomic package-credit consumption (guarded single-row UPDATE; prevents two
-- concurrent bookings from spending the same credit). Returns TRUE if consumed.
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

-- Restore a reserved credit when the follow-up booking insert fails.
CREATE OR REPLACE FUNCTION public.restore_package_credit(p_user_package_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.user_packages
  SET credits_remaining = credits_remaining + 1,
      status = CASE WHEN status = 'exhausted' THEN 'active' ELSE status END
  WHERE id = p_user_package_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Idempotent Stripe fulfillment guard (backs the 23505 dedupe in the webhook).
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_packages_stripe_session
  ON public.user_packages (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

-- Allow the 'refunded' status so refund/dispute revocation doesn't violate CHECK.
ALTER TABLE public.user_packages
  DROP CONSTRAINT IF EXISTS user_packages_status_check;
ALTER TABLE public.user_packages
  ADD CONSTRAINT user_packages_status_check
  CHECK (status IN ('active', 'expired', 'exhausted', 'cancelled', 'refunded'));

NOTIFY pgrst, 'reload schema';
