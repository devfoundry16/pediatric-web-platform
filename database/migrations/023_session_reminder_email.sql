-- =============================================
-- Pediatric Telemedicine Platform - Session reminder emails
--
-- Nobody was reminded of anything. A parent booked a consultation or registered
-- for a live session and heard nothing more until it was over.
--
-- 'appointment_reminder' has been allowed here since migration 010 and was
-- never sent by anything; group sessions need a type of their own alongside it.
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
      'session_reminder',
      'cancellation',
      'reschedule',
      'other'
    )
  );

-- Reminders are deduped by looking for an existing 'sent' row for the same
-- record and recipient, once a minute per pending session. That read needs to
-- be cheap and is not covered by the existing single-column indexes.
CREATE INDEX IF NOT EXISTS email_logs_related_type_recipient_idx
  ON public.email_logs (related_id, email_type, recipient_email)
  WHERE status = 'sent';
