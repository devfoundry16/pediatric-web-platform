-- =============================================
-- Pediatric Telemedicine Platform - Feature flags
--
-- Lets an admin mark a section of the product as "coming soon". While a flag is
-- off, the section disappears for parents and doctors (no navigation entry, and
-- the routes render a coming-soon panel instead of the feature).
--
-- Courses ship disabled: the content is not ready yet.
--
-- No RLS policies here — reads and writes both go through the Express API with
-- the service role key, and the anon/authenticated roles are revoked below, so
-- the table is never reachable from the browser's Supabase client.
-- =============================================

CREATE TABLE IF NOT EXISTS public.feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.feature_flags IS
  'Admin-controlled switches for user-facing sections. A row with enabled = '
  'false hides that section from parents and doctors.';

REVOKE ALL ON public.feature_flags FROM anon, authenticated;

-- Courses are not ready for release yet.
INSERT INTO public.feature_flags (key, enabled)
VALUES ('courses', false)
ON CONFLICT (key) DO NOTHING;

-- set_updated_at() is created in migration 009.
DROP TRIGGER IF EXISTS feature_flags_updated_at ON public.feature_flags;
CREATE TRIGGER feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
