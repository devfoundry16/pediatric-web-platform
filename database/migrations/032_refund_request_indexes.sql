-- =============================================
-- Pediatric Telemedicine Platform - One refund request per consultation
--
-- The product rule: a consultation yields ONE refund request. Whatever the
-- doctor decides is final, a decline included -- resubmitting would turn a
-- decision into a negotiation. The API enforces that: any existing request,
-- whatever its status, refuses a new one.
--
-- What this index enforces is narrower on purpose. It is unique over rows that
-- are NOT declined, so the database's own guarantee is the one that has to hold
-- even if the application is bypassed: a consultation can never be paid out
-- twice. Declined rows are exempt because they settled nothing and cost
-- nothing, and because history already contains a legitimate pair.
--
-- That history is why this is not a plain UNIQUE. An earlier iteration briefly
-- allowed a declined parent to ask again, and one consultation was resolved
-- through exactly that path: a replacement session was declined, then a refund
-- was asked for and approved, moving 350 AED back to a real card. Both rows
-- record decisions a doctor actually made. A plain unique index cannot be
-- created over them, and deleting one to make the schema tidier would falsify
-- the record of a financial decision -- so the constraint bends and the audit
-- trail stands.
--
-- The trade-off in the product rule is deliberate and worth naming: a parent
-- who asks for the wrong thing -- a replacement session when they wanted their
-- money -- has spent their one request. The doctor's note carries the recourse,
-- and an admin can still act out of band.
--
-- Index work only -- no data changes, no RLS policy changes.
-- =============================================

-- Drop whichever shape this database currently carries: the original UNIQUE
-- constraint from migration 029, or the open-status index from this file's
-- first iteration.
ALTER TABLE public.refund_requests
  DROP CONSTRAINT IF EXISTS refund_requests_appointment_id_key;

DROP INDEX IF EXISTS public.refund_requests_one_open_per_appointment;

CREATE UNIQUE INDEX IF NOT EXISTS refund_requests_one_settled_per_appointment
  ON public.refund_requests (appointment_id)
  WHERE status <> 'declined';

COMMENT ON INDEX public.refund_requests_one_settled_per_appointment IS
  'A consultation can be paid out at most once. Declined rows are exempt: they '
  'settle nothing, and history contains a legitimate decline-then-approve pair '
  'from an earlier iteration of the retry rule. The API is what enforces the '
  'stricter product rule of one request per consultation, declines included.';

-- The parent's appointment list embeds these and the doctor's queue reads them
-- per appointment; both look them up by appointment, newest first.
CREATE INDEX IF NOT EXISTS refund_requests_appointment_created_idx
  ON public.refund_requests (appointment_id, created_at DESC);
