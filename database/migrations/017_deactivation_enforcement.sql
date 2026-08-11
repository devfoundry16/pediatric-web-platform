-- =============================================
-- Pediatric Telemedicine Platform - Deactivation Enforcement
--
-- Migration 011 added profiles.is_active and declared it "Enforced by API
-- middleware" — that enforcement was never written. Nothing in any auth path
-- read the flag, so a deactivated user could still log in and keep using the
-- platform indefinitely.
--
-- Enforcement now lives in four places:
--   1. this trigger (blocks end users flipping their own flag)
--   2. auth.users ban_duration, set by the admin API alongside the flag
--   3. the Express authMiddleware (403 on every authenticated route)
--   4. the Next.js middleware (kills a live session on the next navigation)
--
-- As with migration 012, the DB half is a TRIGGER (not RLS), so it holds even
-- against direct PostgREST calls made with the public anon key.
-- =============================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Block is_active changes coming from end users (anon / authenticated).
--
-- The RLS UPDATE policy on profiles ("Users can update own profile", schema.sql)
-- has USING but no WITH CHECK, so an authenticated user can
-- `UPDATE profiles SET is_active = true WHERE id = <self>` via PostgREST with
-- the anon key and undo their own deactivation. This is the same hole migration
-- 012 closed for `role`, and it is closed the same way: reject the change when
-- performed as the `anon` or `authenticated` DB role. The Express API
-- (service_role) and SQL admins (postgres/supabase_admin) are unaffected.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.prevent_active_self_toggle()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active IS DISTINCT FROM OLD.is_active
     AND current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Changing account active status is not permitted';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_active_self_toggle ON public.profiles;
CREATE TRIGGER prevent_active_self_toggle
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_active_self_toggle();

-- Correct the claim made in migration 011.
COMMENT ON COLUMN public.profiles.is_active IS
  'Set to false to soft-disable a user account. Only the service role may change '
  'it (see prevent_active_self_toggle). The admin API mirrors it onto '
  'auth.users.banned_until so Supabase itself rejects login and token refresh; '
  'the Express and Next.js middleware also gate on it.';
