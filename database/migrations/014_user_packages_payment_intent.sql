-- Migration 014: Ensure user_packages.stripe_payment_intent exists + refresh the
-- PostgREST schema cache.
--
-- The Stripe webhook writes stripe_payment_intent when provisioning a package
-- (used to revoke credits on refund/dispute). Migration 012 added this column,
-- but environments that missed it — or whose PostgREST schema cache is stale —
-- fail provisioning with:
--   "Could not find the 'stripe_payment_intent' column of 'user_packages' in
--    the schema cache"
-- This migration is idempotent and safe to run anywhere. No RLS changes.

ALTER TABLE public.user_packages
  ADD COLUMN IF NOT EXISTS stripe_payment_intent TEXT;

CREATE INDEX IF NOT EXISTS idx_user_packages_payment_intent
  ON public.user_packages (stripe_payment_intent)
  WHERE stripe_payment_intent IS NOT NULL;

-- Ask PostgREST (the Supabase data API) to reload its schema cache so the column
-- is visible to the webhook immediately.
NOTIFY pgrst, 'reload schema';
