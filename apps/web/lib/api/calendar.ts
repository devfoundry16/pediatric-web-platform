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

export interface CalendarConnectionStatus {
  /** False when the server has no Google OAuth credentials configured. */
  configured: boolean;
  connected: boolean;
  email?: string;
  status?: "connected" | "error";
  lastError?: string | null;
  connectedAt?: string;
}

/** The signed-in user's own Google Calendar connection. */
export const calendarApi = {
  getStatus: async (): Promise<CalendarConnectionStatus> => {
    const { data } = await axios.get<CalendarConnectionStatus>(
      `${getBaseUrl()}/google-calendar/status`,
      { headers: await authHeaders() }
    );
    return data;
  },

  /** Returns the Google consent URL to send the browser to. */
  connect: async (): Promise<string> => {
    const { data } = await axios.post<{ url: string }>(
      `${getBaseUrl()}/google-calendar/connect`,
      {},
      { headers: await authHeaders() }
    );
    return data.url;
  },

  disconnect: async (): Promise<void> => {
    await axios.delete(`${getBaseUrl()}/google-calendar`, { headers: await authHeaders() });
  },
};
