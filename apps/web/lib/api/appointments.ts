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

export interface Slot {
  /** Doctor-local calendar day, YYYY-MM-DD. */
  date: string;
  /** Doctor-local wall clock, "HH:MM". This is what gets booked. */
  time: string;
  /** The same moment as an absolute instant, for display in any timezone. */
  startsAt: string;
}

export interface SlotsResponse {
  /** The doctor's IANA zone — the one `date`/`time` above are expressed in. */
  timezone: string;
  slots: Slot[];
}

export const doctorsApi = {
  async list(): Promise<Doctor[]> {
    const { data } = await axios.get<{ doctors: Doctor[] }>(
      `${getBaseUrl()}/doctors`
    );
    return data.doctors;
  },

  /**
   * Bookable slots for a doctor-local calendar day.
   *
   * `date`/`time` on each slot are the canonical doctor-local values and are
   * what must be submitted when booking. `startsAt` is the same moment as an
   * absolute instant, for rendering in whatever timezone the viewer wants.
   * Never submit anything derived from `startsAt`.
   */
  async getSlots(
    doctorId: string,
    date: string,
    type: string
  ): Promise<SlotsResponse> {
    const { data } = await axios.get<SlotsResponse>(
      `${getBaseUrl()}/doctors/${doctorId}/slots`,
      { params: { date, type } }
    );
    return { timezone: data.timezone, slots: data.slots ?? [] };
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

  async create(
    payload: CreateAppointmentPayload
  ): Promise<{ appointment: Appointment; requiresPayment: boolean; usedPackageCredit: boolean }> {
    const { data } = await axios.post<{
      appointment: Appointment;
      requiresPayment: boolean;
      usedPackageCredit: boolean;
    }>(`${getBaseUrl()}/appointments`, payload, {
      headers: await authHeaders(),
    });
    return {
      appointment: data.appointment,
      requiresPayment: data.requiresPayment,
      usedPackageCredit: data.usedPackageCredit,
    };
  },

  // Mint a Stripe Checkout URL to pay for a pending one-time consultation.
  async checkout(id: string): Promise<string> {
    const { data } = await axios.post<{ url: string }>(
      `${getBaseUrl()}/appointments/${id}/checkout`,
      {},
      { headers: await authHeaders() }
    );
    return data.url;
  },

  // Confirm a one-time consult straight from Stripe on the return page, as a
  // fallback when the webhook is delayed/unreachable. Idempotent.
  async verifyPayment(
    id: string,
    sessionId: string
  ): Promise<{ paymentStatus: string; status: string }> {
    const { data } = await axios.post<{ paymentStatus: string; status: string }>(
      `${getBaseUrl()}/appointments/${id}/verify`,
      { sessionId },
      { headers: await authHeaders() }
    );
    return data;
  },

  // Release a pending, unpaid appointment (e.g. the parent cancelled checkout).
  async abandon(id: string): Promise<void> {
    await axios.delete(`${getBaseUrl()}/appointments/${id}`, {
      headers: await authHeaders(),
    });
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
