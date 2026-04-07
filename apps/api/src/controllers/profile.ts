import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";

/**
 * Syncs public.profiles (and public.doctors.full_name when applicable) after
 * the client updates Supabase Auth user_metadata for name/phone.
 */
export async function syncPersonalProfile(
  req: Request,
  res: Response
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const { full_name, phone } = req.body as {
    full_name?: string;
    phone?: string;
  };

  const profileUpdates: Record<string, string> = {};
  if (full_name !== undefined) profileUpdates.full_name = full_name;
  if (phone !== undefined) profileUpdates.phone = phone;

  if (Object.keys(profileUpdates).length === 0) {
    res.status(400).json({ error: "full_name or phone is required" });
    return;
  }

  const userId = req.userId!;

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update(profileUpdates)
    .eq("id", userId);

  if (profileError) {
    res.status(500).json({ error: profileError.message });
    return;
  }

  // Doctors table: keep display name in sync (only when this user already owns a doctor row)
  if (full_name !== undefined) {
    const { data: doctorRow } = await supabaseAdmin
      .from("doctors")
      .select("id")
      .eq("profile_id", userId)
      .maybeSingle();

    if (doctorRow) {
      const { error: doctorError } = await supabaseAdmin
        .from("doctors")
        .update({ full_name })
        .eq("id", doctorRow.id);

      if (doctorError) {
        res.status(500).json({ error: doctorError.message });
        return;
      }
    }
  }

  res.json({ ok: true });
}
