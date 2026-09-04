import axios from "axios";
import { createClient } from "@/lib/supabase/client";
import { getApiBaseUrl } from "./config";

/** Sections an admin can mark as "coming soon". Mirrors SECTION_FLAG_KEYS. */
export type SectionFlagKey = "courses";

/** Operational settings. Mirrors ADMIN_SETTING_KEYS — never in the public read. */
export type AdminSettingKey = "admin_email_notifications";

/** Anything writable through the admin PATCH. */
export type FeatureFlagKey = SectionFlagKey | AdminSettingKey;

export type FeatureFlags = Partial<Record<SectionFlagKey, boolean>>;

export type AdminSettings = Partial<Record<AdminSettingKey, boolean>>;

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

  /**
   * Admin only. Settings are read separately from the public flags because the
   * public endpoint deliberately withholds them.
   */
  async listAdminSettings(): Promise<AdminSettings> {
    const { data } = await axios.get<{ settings: AdminSettings }>(
      `${getApiBaseUrl()}/admin/settings`,
      { headers: await authHeaders() }
    );
    return data.settings;
  },

  /** Admin only. Writes either kind of switch. */
  async update(key: FeatureFlagKey, enabled: boolean): Promise<void> {
    await axios.patch(
      `${getApiBaseUrl()}/admin/feature-flags/${key}`,
      { enabled },
      { headers: await authHeaders() }
    );
  },
};
