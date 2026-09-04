-- =============================================
-- Pediatric Telemedicine Platform - Sweep completed appointments too
--
-- Migration 028 indexed the attendance sweep's candidate set as
--
--   WHERE attendance_outcome IS NULL AND status = 'confirmed'
--
-- because the sweep only looked at confirmed rows. That exclusion turned out to
-- be a hole rather than an optimisation: the doctor is one of the two parties a
-- missed-consultation claim can be made against, and pressing "Complete
-- Session" moved the row to 'completed', where the sweep never looked again.
-- attendance_outcome stayed NULL forever and the parent's claim button never
-- appeared -- so the doctor's own button silently voided every claim against
-- them, whether or not anyone meant it to.
--
-- The sweep now reads both statuses, which leaves the old partial index
-- unusable for the query it was built for. Postgres cannot use a partial index
-- whose predicate is narrower than the query's.
--
-- Index swap only -- no data changes, no RLS policy changes.
-- =============================================

DROP INDEX IF EXISTS public.appointments_unclassified_idx;

CREATE INDEX IF NOT EXISTS appointments_unclassified_idx
  ON public.appointments (scheduled_date)
  WHERE attendance_outcome IS NULL AND status IN ('confirmed', 'completed');

COMMENT ON INDEX public.appointments_unclassified_idx IS
  'Candidate set for the attendance sweep: bookings that ran (or were declared '
  'over) and have not been judged yet. Cancelled and rescheduled rows were '
  'never owed a call, so they are excluded.';
