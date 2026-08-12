-- =============================================
-- Pediatric Telemedicine Platform - Package purchase receipts
--
-- Buying a package credited the account and sent nothing: no receipt to the
-- buyer, no notice to the clinic. Only the booking that later consumed a
-- credit produced any mail.
--
-- CHECK relaxation only -- no RLS policy changes.
-- =============================================

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
      'cancellation',
      'reschedule',
      'other'
    )
  );
