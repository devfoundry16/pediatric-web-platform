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

export const profileApi = {
  /**
   * Syncs `profiles` and (for doctors) `doctors.full_name` after auth metadata is updated.
   */
  async syncPersonalInfo(full_name: string, phone: string): Promise<void> {
    await axios.patch(
      `${getBaseUrl()}/profile`,
      { full_name, phone },
      { headers: await authHeaders() }
    );
  },
};
