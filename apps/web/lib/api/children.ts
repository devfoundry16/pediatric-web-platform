import axios from "axios";
import { createClient } from "@/lib/supabase/client";
import type { ChildProfile, CreateChildInput } from "@/types/child";

function getBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
  return base.replace(/\/$/, "");
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

export const childrenApi = {
  async list(): Promise<ChildProfile[]> {
    const { data } = await axios.get<ChildProfile[]>(
      `${getBaseUrl()}/children`,
      { headers: await authHeaders() }
    );
    return data;
  },

  async create(body: CreateChildInput): Promise<ChildProfile> {
    const { data } = await axios.post<ChildProfile>(
      `${getBaseUrl()}/children`,
      body,
      { headers: await authHeaders() }
    );
    return data;
  },

  async getById(id: string): Promise<ChildProfile> {
    const { data } = await axios.get<ChildProfile>(
      `${getBaseUrl()}/children/${id}`,
      { headers: await authHeaders() }
    );
    return data;
  },

  async update(id: string, body: CreateChildInput): Promise<ChildProfile> {
    const { data } = await axios.put<ChildProfile>(
      `${getBaseUrl()}/children/${id}`,
      body,
      { headers: await authHeaders() }
    );
    return data;
  },

  async remove(id: string): Promise<void> {
    await axios.delete(`${getBaseUrl()}/children/${id}`, {
      headers: await authHeaders(),
    });
  },
};
