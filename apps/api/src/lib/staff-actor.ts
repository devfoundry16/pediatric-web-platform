import { supabaseAdmin } from "./supabase";

/** The caller's doctors row, if they have one. */
export async function resolveDoctor(
  userId: string
): Promise<{ id: string } | null> {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from("doctors")
    .select("id")
    .eq("profile_id", userId)
    .single();
  return data ?? null;
}

/**
 * Who may manage doctor-owned content (live sessions, courses), and how far
 * that reaches.
 *
 * A doctor manages only what they own. An admin manages everything — their
 * own, every doctor's, drafts included — and needs no doctors row to do it;
 * doctorId is set only for an admin who also has one, so what they create is
 * still owned by that doctor record.
 */
export type StaffActor =
  | { kind: "admin"; userId: string; doctorId: string | null }
  | { kind: "doctor"; userId: string; doctorId: string };

export async function resolveActor(userId: string): Promise<StaffActor | null> {
  if (!supabaseAdmin) return null;
  const [doctor, { data: profile }] = await Promise.all([
    resolveDoctor(userId),
    supabaseAdmin.from("profiles").select("role").eq("id", userId).maybeSingle(),
  ]);
  if (profile?.role === "admin") {
    return { kind: "admin", userId, doctorId: doctor?.id ?? null };
  }
  if (doctor) return { kind: "doctor", userId, doctorId: doctor.id };
  return null;
}

/**
 * Filter for the doctor-owned rows this actor may touch, for `.match()`.
 * Empty for an admin, so the id filter alone decides.
 */
export function actorScope(actor: StaffActor): Record<string, string> {
  return actor.kind === "doctor" ? { doctor_id: actor.doctorId } : {};
}
