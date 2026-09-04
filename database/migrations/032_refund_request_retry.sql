-- =============================================
-- Pediatric Telemedicine Platform - Let a declined refund request be retried
--
-- Migration 029 put a plain UNIQUE on refund_requests.appointment_id, so one
-- missed consultation could ever produce one row. That was meant to stop a
-- parent claiming twice for the same call. It also did something nobody
-- intended: a DECLINED request locked the appointment permanently.
--
-- Seen in practice on the first real use. A parent asked for a replacement
-- session, the doctor declined it, and the parent then had no way to ask for
-- their money back instead -- the API answered 409 and the request was
-- unwinnable. The parent had made one bad guess about which remedy to ask for
-- and lost the claim entirely.
--
-- The invariant that was actually wanted is "at most one OPEN claim", not "at
-- most one claim ever": a pending request is awaiting a decision and an
-- approved one has already paid out, but a declined one settled nothing and
-- should leave the parent free to ask differently.
--
-- Index swap only -- no data changes, no RLS policy changes.
-- =============================================

ALTER TABLE public.refund_requests
  DROP CONSTRAINT IF EXISTS refund_requests_appointment_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS refund_requests_one_open_per_appointment
  ON public.refund_requests (appointment_id)
  WHERE status IN ('pending', 'approved');

COMMENT ON INDEX public.refund_requests_one_open_per_appointment IS
  'At most one live claim per consultation: a pending one is awaiting a '
  'decision and an approved one already paid out. Declined rows are '
  'deliberately unconstrained so a parent can ask again, differently.';

-- The parent's appointment list embeds these and shows the latest, and the
-- doctor's queue reads them per appointment; both now have to pick among
-- several rows rather than assuming one.
CREATE INDEX IF NOT EXISTS refund_requests_appointment_created_idx
  ON public.refund_requests (appointment_id, created_at DESC);
