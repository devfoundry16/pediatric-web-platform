import axios from "axios";
import { createClient } from "@/lib/supabase/client";
import { getApiBaseUrl } from "./config";

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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionDoctor {
  id: string;
  full_name: string;
  specialty: string;
  avatar_url: string | null;
}

export interface GroupSession {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number;
  max_participants: number;
  price_aed: number;
  is_free: boolean;
  status: "scheduled" | "live" | "ended" | "cancelled";
  daily_room_url: string | null;
  recording_url: string | null;
  is_published: boolean;
  created_at: string;
  participant_count: number;
  doctors: SessionDoctor | null;
}

/** 'refunded' was added by migration 012 when refund/chargeback revocation landed. */
export type RegistrationPaymentStatus = "free" | "pending" | "paid" | "refunded";

/** A registration only grants access in these states — the join endpoint agrees. */
export function isConfirmedRegistration(
  status: RegistrationPaymentStatus | undefined
): boolean {
  return status === "free" || status === "paid";
}

export interface SessionRegistration {
  id: string;
  payment_status: RegistrationPaymentStatus;
  registered_at: string;
  group_sessions: GroupSession | null;
}

export interface CreateSessionPayload {
  title: string;
  description?: string;
  scheduled_at: string;
  duration_minutes?: number;
  max_participants?: number;
  price_aed?: number;
  is_published?: boolean;
}

export type UpdateSessionPayload = Partial<CreateSessionPayload>;

// ─── API client ───────────────────────────────────────────────────────────────

export const liveSessionsApi = {
  // Public
  async listSessions(filter?: "upcoming" | "past"): Promise<GroupSession[]> {
    const { data } = await axios.get<{ sessions: GroupSession[] }>(
      `${getBaseUrl()}/live-sessions`,
      { params: filter ? { filter } : {} }
    );
    return data.sessions;
  },

  async getSession(id: string): Promise<GroupSession> {
    const { data } = await axios.get<{ session: GroupSession }>(
      `${getBaseUrl()}/live-sessions/${id}`
    );
    return data.session;
  },

  // Authenticated — parent
  async getMyRegistrations(): Promise<SessionRegistration[]> {
    const { data } = await axios.get<{ registrations: SessionRegistration[] }>(
      `${getBaseUrl()}/live-sessions/user/registered`,
      { headers: await authHeaders() }
    );
    return data.registrations;
  },

  async register(
    sessionId: string
  ): Promise<{ registration?: SessionRegistration; checkoutUrl?: string }> {
    const { data } = await axios.post(
      `${getBaseUrl()}/live-sessions/${sessionId}/register`,
      {},
      { headers: await authHeaders() }
    );
    return data as { registration?: SessionRegistration; checkoutUrl?: string };
  },

  async joinSession(
    sessionId: string
  ): Promise<{ token: string; roomUrl: string }> {
    const { data } = await axios.get<{ token: string; roomUrl: string }>(
      `${getBaseUrl()}/live-sessions/${sessionId}/join`,
      { headers: await authHeaders() }
    );
    return data;
  },

  async verifyPayment(
    stripeSessionId: string
  ): Promise<{ success: boolean; sessionId: string }> {
    const { data } = await axios.get<{ success: boolean; sessionId: string }>(
      `${getBaseUrl()}/live-sessions/user/verify-payment`,
      {
        headers: await authHeaders(),
        params: { stripe_session_id: stripeSessionId },
      }
    );
    return data;
  },

  // Doctor
  async getDoctorSessions(): Promise<GroupSession[]> {
    const { data } = await axios.get<{ sessions: GroupSession[] }>(
      `${getBaseUrl()}/live-sessions/doctor/mine`,
      { headers: await authHeaders() }
    );
    return data.sessions;
  },

  async createSession(payload: CreateSessionPayload): Promise<GroupSession> {
    const { data } = await axios.post<{ session: GroupSession }>(
      `${getBaseUrl()}/live-sessions`,
      payload,
      { headers: await authHeaders() }
    );
    return data.session;
  },

  async updateSession(
    id: string,
    payload: UpdateSessionPayload
  ): Promise<GroupSession> {
    const { data } = await axios.patch<{ session: GroupSession }>(
      `${getBaseUrl()}/live-sessions/${id}`,
      payload,
      { headers: await authHeaders() }
    );
    return data.session;
  },

  async cancelSession(id: string): Promise<void> {
    await axios.delete(`${getBaseUrl()}/live-sessions/${id}`, {
      headers: await authHeaders(),
    });
  },

  async goLive(
    id: string
  ): Promise<{ session: GroupSession; doctorToken: string | null }> {
    const { data } = await axios.patch<{
      session: GroupSession;
      doctorToken: string | null;
    }>(
      `${getBaseUrl()}/live-sessions/${id}/go-live`,
      {},
      { headers: await authHeaders() }
    );
    return data;
  },

  async endSession(
    id: string,
    recording_url?: string
  ): Promise<GroupSession> {
    const { data } = await axios.patch<{ session: GroupSession }>(
      `${getBaseUrl()}/live-sessions/${id}/end`,
      { recording_url },
      { headers: await authHeaders() }
    );
    return data.session;
  },
};
