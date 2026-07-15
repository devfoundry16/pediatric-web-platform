import axios from "axios";
import { createClient } from "@/lib/supabase/client";
import type {
  Appointment,
  CreateAppointmentPayload,
  Doctor,
} from "@/types/appointment";
import { getApiBaseUrl } from "./config";

function getBaseUrl(): string {
  return getApiBaseUrl();
}

async function authHeaders(): Promise<Record<string, string>> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return {};
  }
  return { Authorization: `Bearer ${session.access_token}` };
}

export const doctorsApi = {
  async list(): Promise<Doctor[]> {
    const { data } = await axios.get<{ doctors: Doctor[] }>(
      `${getBaseUrl()}/doctors`
    );
    return data.doctors;
  },

  async getSlots(
    doctorId: string,
    date: string,
    type: string
  ): Promise<string[]> {
    const { data } = await axios.get<{ slots: string[] }>(
      `${getBaseUrl()}/doctors/${doctorId}/slots`,
      { params: { date, type } }
    );
    return data.slots;
  },
};

export const appointmentsApi = {
  async list(): Promise<Appointment[]> {
    const { data } = await axios.get<{ appointments: Appointment[] }>(
      `${getBaseUrl()}/appointments`,
      { headers: await authHeaders() }
    );
    return data.appointments;
  },

  async getById(id: string): Promise<Appointment> {
    const { data } = await axios.get<{ appointment: Appointment }>(
      `${getBaseUrl()}/appointments/${id}`,
      { headers: await authHeaders() }
    );
    return data.appointment;
  },

  async create(payload: CreateAppointmentPayload): Promise<Appointment> {
    const { data } = await axios.post<{ appointment: Appointment }>(
      `${getBaseUrl()}/appointments`,
      payload,
      { headers: await authHeaders() }
    );
    return data.appointment;
  },

  async cancel(id: string, reason?: string): Promise<void> {
    await axios.patch(
      `${getBaseUrl()}/appointments/${id}/cancel`,
      { reason },
      { headers: await authHeaders() }
    );
  },

  async reschedule(
    id: string,
    newDate: string,
    newTime: string
  ): Promise<Appointment> {
    const { data } = await axios.patch<{ appointment: Appointment }>(
      `${getBaseUrl()}/appointments/${id}/reschedule`,
      { newDate, newTime },
      { headers: await authHeaders() }
    );
    return data.appointment;
  },

  // Video rooms are private; joining requires a server-minted meeting token.
  // This returns the room URL with the token appended (?t=...). Never link to
  // the bare meeting_url — a private room rejects entry without a token.
  async join(id: string): Promise<string | null> {
    try {
      const { data } = await axios.get<{ tokenUrl: string }>(
        `${getBaseUrl()}/appointments/${id}/join`,
        { headers: await authHeaders() }
      );
      return data.tokenUrl ?? null;
    } catch {
      return null;
    }
  },
};
