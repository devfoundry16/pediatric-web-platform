import axios from "axios";
import { createClient } from "@/lib/supabase/client";
import type { MedicalRecord } from "@/types/medical-record";

function getBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
  return base.replace(/\/$/, "");
}

async function authHeaders(): Promise<Record<string, string>> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

export interface CreateMedicalRecordPayload {
  childId: string;
  appointmentId?: string;
  recordType: string;
  title: string;
  notes?: string;
  diagnosis?: string;
  prescription?: string;
  vitals?: {
    weight_kg?: number;
    height_cm?: number;
    temp_c?: number;
    heart_rate?: number;
    oxygen_saturation?: number;
  };
}

export const medicalRecordsApi = {
  async list(childId?: string): Promise<MedicalRecord[]> {
    const { data } = await axios.get<{ records: MedicalRecord[] }>(
      `${getBaseUrl()}/medical-records`,
      {
        headers: await authHeaders(),
        params: childId ? { childId } : {},
      }
    );
    return data.records;
  },

  async getById(id: string): Promise<MedicalRecord> {
    const { data } = await axios.get<{ record: MedicalRecord }>(
      `${getBaseUrl()}/medical-records/${id}`,
      { headers: await authHeaders() }
    );
    return data.record;
  },

  async create(payload: CreateMedicalRecordPayload): Promise<MedicalRecord> {
    const { data } = await axios.post<{ record: MedicalRecord }>(
      `${getBaseUrl()}/medical-records`,
      payload,
      { headers: await authHeaders() }
    );
    return data.record;
  },

  async update(
    id: string,
    payload: Partial<Omit<CreateMedicalRecordPayload, "childId" | "appointmentId">>
  ): Promise<MedicalRecord> {
    const { data } = await axios.patch<{ record: MedicalRecord }>(
      `${getBaseUrl()}/medical-records/${id}`,
      payload,
      { headers: await authHeaders() }
    );
    return data.record;
  },

  async delete(id: string): Promise<void> {
    await axios.delete(`${getBaseUrl()}/medical-records/${id}`, {
      headers: await authHeaders(),
    });
  },
};
