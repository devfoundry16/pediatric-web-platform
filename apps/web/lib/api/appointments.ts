import axios from "axios";
import { createClient } from "@/lib/supabase/client";
import type {
  Appointment,
  CreateAppointmentPayload,
  Doctor,
  RemedyKind,
  RemedyRequest,
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

export interface AppointmentFile {
  id: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number | null;
  /** Short-lived signed URL; the bucket is private so there is no public link. */
  signed_url: string | null;
  created_at: string;
}

export type JoinResult =
  | { ok: true; roomUrl: string; token: string }
  | { ok: false; error: string; opensAt?: string };

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

  // Claim a remedy for a consultation the attendance sweep recorded as missed.
  // The API decides eligibility; this only carries the ask.
  async requestRemedy(
    id: string,
    remedy: RemedyKind,
    reason?: string
  ): Promise<RemedyRequest> {
    const { data } = await axios.post<{ request: RemedyRequest }>(
      `${getBaseUrl()}/appointments/${id}/refund-request`,
      { remedy, reason },
      { headers: await authHeaders() }
    );
    return data.request;
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
  // The token is returned separately from the room URL because daily-js takes
  // it in join() — putting it in the URL is what breaks Daily's leave flow.
  // Outside the appointment's join window the API refuses and says when it
  // opens, which the room page shows instead of a connection error.
  /** Documents the parent attached when booking. Parent, treating doctor or admin only. */
  async listFiles(id: string): Promise<AppointmentFile[]> {
    const { data } = await axios.get<{ files: AppointmentFile[] }>(
      `${getBaseUrl()}/appointments/${id}/files`,
      { headers: await authHeaders() }
    );
    return data.files;
  },

  async join(id: string): Promise<JoinResult> {
    try {
      const { data } = await axios.get<{ roomUrl: string; token: string }>(
        `${getBaseUrl()}/appointments/${id}/join`,
        { headers: await authHeaders() }
      );
      return { ok: true, roomUrl: data.roomUrl, token: data.token };
    } catch (err) {
      const body = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string; opensAt?: string } | undefined)
        : undefined;
      return {
        ok: false,
        error: body?.error ?? "Could not join the consultation",
        opensAt: body?.opensAt,
      };
    }
  },
};
