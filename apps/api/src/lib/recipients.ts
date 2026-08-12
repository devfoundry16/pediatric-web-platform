import { supabaseAdmin } from "./supabase";

export interface Recipient {
  email: string;
  userId?: string | null;
}

/**
 * Every admin who should receive clinic notifications.
 *
 * Resolved from profiles rather than configuration so the list follows
 * role changes and deactivation automatically. Addresses live in auth.users,
 * so this needs the admin API and a genuine service role key.
 */
export async function activeAdminRecipients(): Promise<Recipient[]> {
  if (!supabaseAdmin) return [];

  const { data: admins } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("is_active", true);

  if (!admins || admins.length === 0) return [];

  const wanted = new Set(admins.map((a) => a.id));
  const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

  return (data?.users ?? [])
    .filter((u) => wanted.has(u.id) && !!u.email)
    .map((u) => ({ email: u.email as string, userId: u.id }));
}
