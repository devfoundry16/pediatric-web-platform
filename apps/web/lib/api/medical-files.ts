import axios from "axios";
import { createClient } from "@/lib/supabase/client";
import { getApiBaseUrl } from "./config";
import type { MedicalFile } from "@/types/medical-record";

const STORAGE_BUCKET = "medical-files";

function getBaseUrl(): string {
  return getApiBaseUrl();
}

async function authHeaders(): Promise<Record<string, string>> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

export const medicalFilesApi = {
  async list(childId?: string, recordId?: string): Promise<MedicalFile[]> {
    const params: Record<string, string> = {};
    if (childId) params.childId = childId;
    if (recordId) params.recordId = recordId;
    const { data } = await axios.get<{ files: MedicalFile[] }>(
      `${getBaseUrl()}/medical-files`,
      { headers: await authHeaders(), params }
    );
    return data.files;
  },

  /**
   * Upload a file to Supabase Storage then persist the metadata via the API.
   * Returns the saved MedicalFile record.
   */
  async upload(
    file: File,
    childId: string,
    opts?: { recordId?: string; appointmentId?: string }
  ): Promise<MedicalFile> {
    const supabase = createClient();

    // Build a unique storage path: {childId}/{timestamp}-{filename}
    const ext = file.name.split(".").pop() ?? "bin";
    const storagePath = `${childId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    console.log("storagePath", storagePath);
    console.log("file", ext);
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file, { upsert: false });
    if (uploadError) {
      console.log("uploadError", uploadError.message);
      throw new Error(uploadError.message);
    }

    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    const fileUrl = urlData.publicUrl;

    const { data } = await axios.post<{ file: MedicalFile }>(
      `${getBaseUrl()}/medical-files`,
      {
        childId,
        recordId: opts?.recordId ?? null,
        appointmentId: opts?.appointmentId ?? null,
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileUrl,
        fileSizeBytes: file.size,
      },
      { headers: await authHeaders() }
    );

    return data.file;
  },

  async delete(id: string): Promise<void> {
    await axios.delete(`${getBaseUrl()}/medical-files/${id}`, {
      headers: await authHeaders(),
    });
  },
};
