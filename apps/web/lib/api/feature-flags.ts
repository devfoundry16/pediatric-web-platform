import axios from "axios";
import { createClient } from "@/lib/supabase/client";
import { getApiBaseUrl } from "./config";

/** Sections an admin can mark as "coming soon". Mirrors FEATURE_FLAG_KEYS in the API. */
export type FeatureFlagKey = "courses";

export type FeatureFlags = Partial<Record<FeatureFlagKey, boolean>>;

async function authHeaders(): Promise<Record<string, string>> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

export const featureFlagsApi = {
  /** Public — no auth, so the marketing site can read it too. */
  async list(): Promise<FeatureFlags> {
    const { data } = await axios.get<{ flags: FeatureFlags }>(
      `${getApiBaseUrl()}/feature-flags`
    );
    return data.flags;
  },

  /** Admin only. */
  async update(key: FeatureFlagKey, enabled: boolean): Promise<void> {
    await axios.patch(
      `${getApiBaseUrl()}/admin/feature-flags/${key}`,
      { enabled },
      { headers: await authHeaders() }
    );
  },
};
