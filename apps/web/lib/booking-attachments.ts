import { createClient } from "@/lib/supabase/client";

/**
 * Documents a parent attaches while booking.
 *
 * The file goes browser → Supabase Storage directly (so a large upload never
 * passes through the API), and only its metadata travels with the booking
 * request. The bucket is PRIVATE: nothing here produces a readable URL, and
 * the API mints a short-lived signed one for whoever is entitled to see it.
 */

const STORAGE_BUCKET = "medical-files";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES = 5;

/** Mirrors ALLOWED_FILE_TYPES in apps/api/src/lib/medical-storage.ts. */
export const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

/** For the file picker's `accept` attribute. */
export const ACCEPT_ATTRIBUTE = ".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,.doc,.docx";

export interface BookingAttachment {
  fileName: string;
  fileType: string;
  storagePath: string;
  fileSizeBytes: number;
}

export function describeFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Why this file cannot be attached, or null when it is fine. */
export function rejectionReason(file: File): "type" | "size" | null {
  // Some browsers report an empty type for .heic and .doc; fall back to the
  // extension so a legitimate file is not rejected for lack of a MIME type.
  const byExtension = /\.(jpe?g|png|webp|heic|heif|pdf|docx?)$/i.test(file.name);
  if (!ACCEPTED_TYPES.includes(file.type) && !byExtension) return "type";
  if (file.size > MAX_FILE_BYTES) return "size";
  return null;
}

/**
 * Upload one file and return what the booking request needs.
 *
 * The path is namespaced by child so the API can verify an attachment belongs
 * to the child being booked for, rather than trusting the client's word.
 */
export async function uploadBookingAttachment(
  file: File,
  childId: string
): Promise<BookingAttachment> {
  const supabase = createClient();

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const storagePath = `${childId}/${unique}.${extension}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, { upsert: false, contentType: file.type || undefined });

  if (error) throw new Error(error.message);

  return {
    fileName: file.name,
    fileType: file.type || "application/octet-stream",
    storagePath,
    fileSizeBytes: file.size,
  };
}

/** Drop an object the parent removed before submitting, so it is not orphaned. */
export async function discardBookingAttachment(storagePath: string): Promise<void> {
  const supabase = createClient();
  await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
}
