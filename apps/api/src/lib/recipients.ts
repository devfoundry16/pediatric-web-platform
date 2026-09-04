import { supabaseAdmin } from "./supabase";
import { isFlagEnabled } from "../controllers/feature-flags";

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
 *
 * Gated here rather than at each call site: this is the one place admin
 * addresses are resolved, so a single check silences the admin copy of every
 * notification at once, and any future one is covered without being
 * remembered. Callers already treat an empty list as "no admin copy", so
 * nothing downstream needs to know the switch exists.
 */
export async function activeAdminRecipients(): Promise<Recipient[]> {
  if (!supabaseAdmin) return [];

  if (!(await isFlagEnabled("admin_email_notifications"))) return [];

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
