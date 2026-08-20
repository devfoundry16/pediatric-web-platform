-- =============================================
-- Pediatric Telemedicine Platform - Private medical file storage
--
-- The `medical-files` storage bucket is PUBLIC, and uploads store the result of
-- getPublicUrl() in medical_files.file_url. Anyone holding that URL can read a
-- patient's documents: no authentication, no expiry, no way to revoke. This is
-- about to matter more, because parents can now attach documents while booking.
--
-- Serving files through short-lived signed URLs needs the object's PATH inside
-- the bucket, which the public URL only carries incidentally. This adds that
-- column and backfills it from the existing URLs.
--
-- ⚠️ CODE + CONFIG CHANGE REQUIRED ALONGSIDE THIS MIGRATION:
--    In Supabase → Storage → medical-files → Settings, turn OFF "Public bucket".
--    Existing public URLs stop working at that moment, which is the point; the
--    API serves signed URLs from storage_path instead (see lib/medical-storage.ts).
--
-- ADD COLUMN only — no changes to any EXISTING RLS policies.
-- =============================================

ALTER TABLE public.medical_files
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

COMMENT ON COLUMN public.medical_files.storage_path IS
  'Object path inside the medical-files bucket, e.g. "<childId>/169...-ab12.pdf". '
  'The API mints a short-lived signed URL from this on demand. file_url is kept '
  'for older rows but must not be handed to a client — the bucket is private.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill from the public URLs already stored.
--
-- A public URL looks like:
--   https://<ref>.supabase.co/storage/v1/object/public/medical-files/<path>
-- so everything after the bucket segment is the path. Rows whose URL does not
-- match that shape are left NULL and simply have no downloadable link, which is
-- the safe failure: better a missing file than a public one.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.medical_files
SET storage_path = split_part(file_url, '/object/public/medical-files/', 2)
WHERE storage_path IS NULL
  AND file_url LIKE '%/object/public/medical-files/%';

CREATE INDEX IF NOT EXISTS medical_files_appointment_idx
  ON public.medical_files (appointment_id)
  WHERE appointment_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
