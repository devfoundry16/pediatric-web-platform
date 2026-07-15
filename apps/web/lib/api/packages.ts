import axios from "axios";
import { createClient } from "@/lib/supabase/client";
import { getApiBaseUrl } from "./config";
import type { ConsultationPackage, UserPackage, PackageUsageLog } from "@/types/packages";

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

export const packagesApi = {
  async list(): Promise<ConsultationPackage[]> {
    const { data } = await axios.get<{ packages: ConsultationPackage[] }>(
      `${getBaseUrl()}/packages`
    );
    return data.packages;
  },

  async createCheckoutSession(packageId: string): Promise<string> {
    const { data } = await axios.post<{ url: string }>(
      `${getBaseUrl()}/packages/checkout`,
      { packageId },
      { headers: await authHeaders() }
    );
    return data.url;
  },

  async getMyPackages(): Promise<UserPackage[]> {
    const { data } = await axios.get<{ userPackages: UserPackage[] }>(
      `${getBaseUrl()}/packages/my`,
      { headers: await authHeaders() }
    );
    return data.userPackages;
  },

  async getUsageLogs(): Promise<PackageUsageLog[]> {
    const { data } = await axios.get<{ usageLogs: PackageUsageLog[] }>(
      `${getBaseUrl()}/packages/usage`,
      { headers: await authHeaders() }
    );
    return data.usageLogs;
  },
};
