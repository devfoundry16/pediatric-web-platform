-- =============================================
-- Pediatric Telemedicine Platform - Admin email notification switch
--
-- Every confirmed booking and every package purchase mails a copy to all active
-- admins. On a busy clinic that is a lot of mail nobody asked for, and there
-- was no way to stop it short of demoting the admin or pulling their address.
--
-- This adds one switch. It gates activeAdminRecipients(), which is the single
-- place admin addresses are resolved, so turning it off silences the admin copy
-- of every notification at once without touching who is an admin or what
-- parents and doctors receive.
--
-- Stored in feature_flags because it is exactly what that table is: a keyed
-- boolean an admin flips, with an audit of who changed it last. Its original
-- comment described only user-facing sections, which is no longer the whole
-- story, so the comment is widened below.
--
-- IMPORTANT: this key must never appear in the PUBLIC feature-flags response.
-- GET /api/feature-flags is unauthenticated because the web app needs section
-- visibility before anyone signs in; an operational setting has no business
-- being readable by every visitor. The controller keeps two separate key lists
-- for that reason.
--
-- Seeded TRUE so behaviour is unchanged until an admin decides otherwise.
--
-- One seed row + a comment change -- no schema changes, no RLS policy changes.
-- =============================================

INSERT INTO public.feature_flags (key, enabled)
VALUES ('admin_email_notifications', true)
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.feature_flags IS
  'Admin-controlled switches. Two kinds live here: user-facing section flags '
  '(a row with enabled = false hides that section from parents and doctors), '
  'and operational settings such as admin_email_notifications. Only section '
  'flags are exposed by the public GET /api/feature-flags.';
