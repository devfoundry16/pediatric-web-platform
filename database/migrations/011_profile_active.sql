-- Migration 011: Add is_active flag to profiles
-- Allows admins to deactivate parent (and doctor) accounts without deleting them.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Update RLS: block inactive users from reading their own profile if needed.
-- Active check is handled at the application layer (API middleware).

COMMENT ON COLUMN public.profiles.is_active IS
  'Set to false to soft-disable a user account. Enforced by API middleware.';
