-- =============================================
-- Pediatric Telemedicine Platform - Personal calendars only
--
-- Migration 025 allowed a shared "clinic" calendar, stored as the row with
-- user_id IS NULL. That introduced a fourth actor the rest of the platform does
-- not have — the roles are Admin, Parent and Doctor — and it meant whoever
-- connected it received every booking on a personal Google account.
--
-- Every connected calendar now belongs to exactly one user, and what lands on
-- it is decided by that user's role:
--   Admin  — every booking on the platform.
--   Doctor — the appointments and sessions they host.
--   Parent — the appointments they booked and the sessions they registered for.
--
-- Bookings are no longer mirrored to anyone who has not connected a calendar
-- (they continue to receive the booking emails), so events carry no attendees
-- and no address is ever shared between families.
--
-- The clinic row is removed here. Its calendar_event_mirrors rows cascade with
-- it, but the Google events it already created stay on that account — disconnect
-- it from Admin → Integrations BEFORE running this to have them cleaned up,
-- otherwise remove them by hand in Google Calendar.
--
-- No changes to any EXISTING RLS policies.
-- =============================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Drop the shared clinic account.
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM public.google_calendar_accounts
WHERE user_id IS NULL;

DROP INDEX IF EXISTS public.google_calendar_accounts_clinic_idx;

-- Every account now belongs to a user, so the partial index that excluded NULLs
-- can become a plain unique constraint on the column.
DROP INDEX IF EXISTS public.google_calendar_accounts_user_idx;

ALTER TABLE public.google_calendar_accounts
  ALTER COLUMN user_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS google_calendar_accounts_user_idx
  ON public.google_calendar_accounts (user_id);

COMMENT ON COLUMN public.google_calendar_accounts.user_id IS
  'Owner of this connected calendar. What gets mirrored onto it depends on the '
  'owner''s role: admins receive every booking, doctors the ones they host, '
  'parents the ones they booked or registered for.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Record who connected each calendar again (025 dropped 024''s connected_by).
-- Same as user_id today, but kept explicit so the admin overview stays
-- answerable if an account is ever connected on someone else''s behalf.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.google_calendar_accounts
  ADD COLUMN IF NOT EXISTS connected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.google_calendar_accounts
SET connected_by = user_id
WHERE connected_by IS NULL;

-- Ask PostgREST (the Supabase data API) to reload its schema cache.
NOTIFY pgrst, 'reload schema';
