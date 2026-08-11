import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { CONSULTATION_CONFIG } from "../lib/consultation";
import { generateSlots, isValidYMD } from "../lib/slots";

export async function listDoctors(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("doctors")
    .select("id, full_name, specialty, bio, avatar_url, timezone")
    .eq("is_active", true)
    .order("full_name");

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ doctors: data });
}

export async function getDoctorSlots(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const { id } = req.params;
  const { date, type } = req.query;

  if (!date || !type) {
    res.status(400).json({ error: "date and type query parameters are required" });
    return;
  }

  if (!CONSULTATION_CONFIG[type as string]) {
    res.status(400).json({ error: "Invalid consultation type" });
    return;
  }

  // `date` is a calendar day (YYYY-MM-DD) in the DOCTOR's timezone, matching
  // stored scheduled_date and doctor_schedules.day_of_week — not a UTC instant.
  if (!isValidYMD(date)) {
    res.status(400).json({ error: "Invalid date format" });
    return;
  }

  // Each slot carries both the canonical doctor-local wall clock (what gets
  // booked) and an absolute instant (what gets displayed), so the client never
  // has to do timezone arithmetic of its own.
  const { timezone, slots } = await generateSlots(
    id as string,
    String(date).trim(),
    type as string
  );

  res.json({ timezone, slots });
}
