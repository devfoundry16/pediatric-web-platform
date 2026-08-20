import { supabaseAdmin } from "./supabase";

/**
 * Access to the `medical-files` bucket.
 *
 * The bucket is private: possession of a path grants nothing, and every link a
 * client receives is a short-lived signed URL minted here for a request we have
 * already authorised. Files used to be served from getPublicUrl(), which meant
 * a patient's documents were readable by anyone who ever saw the URL, forever.
 *
 * Signed URLs are generated per request rather than stored, so revoking access
 * is a matter of not minting another one.
 */

export const MEDICAL_FILES_BUCKET = "medical-files";

/** Long enough to open or download a file, short enough that a leaked link dies. */
const SIGNED_URL_TTL_SECONDS = 5 * 60;

/** What a parent may attach to a booking. Keep in step with the web validator. */
export const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_BOOKING = 5;

export function isAllowedFileType(type: string): boolean {
  return (ALLOWED_FILE_TYPES as readonly string[]).includes(type);
}

/**
 * A time-limited URL for one object, or null when it cannot be signed.
 *
 * Never throws: a missing attachment should degrade to "no link" in a list,
 * not fail the whole request.
 */
export async function signMedicalFile(storagePath: string | null): Promise<string | null> {
  if (!supabaseAdmin || !storagePath) return null;
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(MEDICAL_FILES_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
    if (error) {
      console.error(`[files] Could not sign ${storagePath}: ${error.message}`);
      return null;
    }
    return data?.signedUrl ?? null;
  } catch (err) {
    console.error(`[files] Could not sign ${storagePath}:`, String(err));
    return null;
  }
}

/** Sign a batch, preserving order. */
export async function signMedicalFiles<T extends { storage_path: string | null }>(
  rows: T[]
): Promise<Array<T & { signed_url: string | null }>> {
  return Promise.all(
    rows.map(async (row) => ({ ...row, signed_url: await signMedicalFile(row.storage_path) }))
  );
}

/** Remove the object itself; the row is deleted separately by the caller. */
export async function removeMedicalFile(storagePath: string | null): Promise<void> {
  if (!supabaseAdmin || !storagePath) return;
  const { error } = await supabaseAdmin.storage.from(MEDICAL_FILES_BUCKET).remove([storagePath]);
  if (error) console.error(`[files] Could not remove ${storagePath}: ${error.message}`);
}

export interface BookingAttachment {
  fileName: string;
  fileType: string;
  storagePath: string;
  fileSizeBytes?: number | null;
}

/**
 * Validate what the client says it uploaded.
 *
 * The upload itself goes browser → Storage, so these values arrive from the
 * client and cannot be trusted. The path check is the important one: it pins
 * every attachment under the child's own folder, so a crafted request cannot
 * attach another patient's document to this booking.
 */
export function validateAttachments(
  raw: unknown,
  childId: string
): { ok: true; attachments: BookingAttachment[] } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, attachments: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "attachments must be an array" };
  if (raw.length > MAX_FILES_PER_BOOKING) {
    return { ok: false, error: `At most ${MAX_FILES_PER_BOOKING} files can be attached` };
  }

  const attachments: BookingAttachment[] = [];
  for (const item of raw) {
    const a = item as Partial<BookingAttachment>;
    if (!a || typeof a.storagePath !== "string" || typeof a.fileName !== "string") {
      return { ok: false, error: "Each attachment needs a storagePath and fileName" };
    }
    if (!a.storagePath.startsWith(`${childId}/`) || a.storagePath.includes("..")) {
      return { ok: false, error: "Attachment does not belong to this child" };
    }
    if (typeof a.fileType !== "string" || !isAllowedFileType(a.fileType)) {
      return { ok: false, error: `Unsupported file type: ${a.fileType ?? "unknown"}` };
    }
    if (typeof a.fileSizeBytes === "number" && a.fileSizeBytes > MAX_FILE_BYTES) {
      return { ok: false, error: "Each file must be 10 MB or smaller" };
    }
    attachments.push({
      fileName: a.fileName.slice(0, 255),
      fileType: a.fileType,
      storagePath: a.storagePath,
      fileSizeBytes: typeof a.fileSizeBytes === "number" ? a.fileSizeBytes : null,
    });
  }
  return { ok: true, attachments };
}

/**
 * Attach uploaded documents to a freshly created booking.
 *
 * Never throws — the appointment is already committed, and losing an
 * attachment must not turn a successful booking into an error. Failures are
 * logged so a missing document is diagnosable.
 */
export async function saveBookingAttachments(params: {
  attachments: BookingAttachment[];
  childId: string;
  appointmentId: string;
  uploadedBy: string;
}): Promise<void> {
  if (!supabaseAdmin || params.attachments.length === 0) return;
  const { error } = await supabaseAdmin.from("medical_files").insert(
    params.attachments.map((a) => ({
      child_id: params.childId,
      appointment_id: params.appointmentId,
      file_name: a.fileName,
      file_type: a.fileType,
      // Kept for the legacy column's NOT NULL constraint; the path is what the
      // API actually reads, because the bucket is private.
      file_url: a.storagePath,
      storage_path: a.storagePath,
      file_size_bytes: a.fileSizeBytes,
      uploaded_by: params.uploadedBy,
    }))
  );
  if (error) {
    console.error(
      `[files] Could not attach ${params.attachments.length} file(s) to appointment ${params.appointmentId}: ${error.message}`
    );
  }
}
