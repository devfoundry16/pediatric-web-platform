-- =============================================
-- Pediatric Telemedicine Platform - Protect appointment money columns
--
-- Migration 003 gave doctors UPDATE on appointments with a USING clause and no
-- WITH CHECK:
--
--   CREATE POLICY "Doctors can update own appointments"
--     ON public.appointments FOR UPDATE
--     USING (doctor_id = public.get_doctor_id_for_user(auth.uid()));
--
-- USING decides which rows may be targeted; without WITH CHECK, nothing
-- constrains what the updated row may contain. A doctor holding the anon key
-- can therefore `UPDATE appointments SET payment_status = 'refunded'` on their
-- own bookings through PostgREST, never touching the API.
--
-- That was largely theoretical while 'refunded' was a cosmetic string. It stops
-- being theoretical in migration 029, where a doctor decides refunds and the
-- Stripe webhook trusts payment_status to reconcile against.
--
-- Same shape as prevent_role_escalation() in migration 012: reject the write at
-- the DB role level, so the Express API (service_role) is unaffected and only
-- browser-key callers are constrained.
--
-- New trigger only -- no changes to any EXISTING RLS policies.
-- =============================================

CREATE OR REPLACE FUNCTION public.prevent_appointment_money_tampering()
RETURNS TRIGGER AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated')
     AND (
       NEW.payment_status IS DISTINCT FROM OLD.payment_status
       OR NEW.price_aed IS DISTINCT FROM OLD.price_aed
       OR NEW.stripe_payment_intent IS DISTINCT FROM OLD.stripe_payment_intent
       OR NEW.stripe_checkout_session_id IS DISTINCT FROM OLD.stripe_checkout_session_id
       OR NEW.attendance_outcome IS DISTINCT FROM OLD.attendance_outcome
     ) THEN
    RAISE EXCEPTION 'Changing appointment payment or attendance fields is not permitted';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.prevent_appointment_money_tampering() IS
  'Blocks browser-key writes to the columns that decide who is owed money. '
  'attendance_outcome is included because it gates refund eligibility, and the '
  'doctor it judges holds an authenticated key.';

DROP TRIGGER IF EXISTS prevent_appointment_money_tampering ON public.appointments;
CREATE TRIGGER prevent_appointment_money_tampering
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_appointment_money_tampering();
