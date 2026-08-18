import { supabaseAdmin } from "./supabase";

/**
 * Display names for the parents who booked a set of appointments, keyed by id.
 *
 * appointments.parent_id references auth.users, not public.profiles, so there is
 * no foreign key for PostgREST to embed across — the names have to be fetched in
 * a second query and joined in memory.
 *
 * Ids with no profile, or a profile with a blank name, are simply absent from
 * the map: callers render their own placeholder, and an empty string would slip
 * past a `?? "—"` fallback and show nothing at all.
 */
export async function fetchParentNames(
  parentIds: string[]
): Promise<Map<string, string>> {
  if (!supabaseAdmin || parentIds.length === 0) return new Map();

  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name")
    .in("id", parentIds);

  const names = new Map<string, string>();
  for (const profile of data ?? []) {
    const name = profile.full_name?.trim();
    if (name) names.set(profile.id, name);
  }
  return names;
}
