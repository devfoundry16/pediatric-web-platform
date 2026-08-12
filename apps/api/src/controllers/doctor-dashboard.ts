import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { createRoom, createMeetingToken } from "../lib/daily";
import {
  DEFAULT_TIMEZONE,
  hhmmToMinutes,
  isValidTimezone,
  todayInTimezone,
  wallClockToInstant,
} from "../lib/timezone";

// ─── Doctor identity resolution ───────────────────────────────────────────────

async function resolveDoctor(
  userId: string
): Promise<{ id: string; timezone: string } | null> {
  if (!supabaseAdmin) return null;

  // Return only the doctors row explicitly linked to this auth user.
  //
  // Previously this auto-claimed "the first unlinked active doctor" for any
  // user with role='doctor'. That let a newly-provisioned doctor silently take
  // over an unrelated doctor's row (and their appointments/patients/PHI). The
  // profile_id link must be set explicitly at provisioning time instead.
  const { data: linked } = await supabaseAdmin
    .from("doctors")
    .select("id, timezone")
    .eq("profile_id", userId)
    .maybeSingle();

  if (!linked) return null;
  return { id: linked.id, timezone: linked.timezone || DEFAULT_TIMEZONE };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchParentNames(
  parentIds: string[]
): Promise<Map<string, string>> {
  if (!supabaseAdmin || parentIds.length === 0) return new Map();
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name")
    .in("id", parentIds);
  return new Map((data ?? []).map((p) => [p.id, p.full_name ?? ""]));
}

// ─── Controllers ──────────────────────────────────────────────────────────────

export async function getDoctorMe(
  req: Request,
  res: Response
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const doctor = await resolveDoctor(req.userId!);
  if (!doctor) {
    res.status(404).json({ error: "No doctor profile found for this account" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("doctors")
    .select("id, full_name, specialty, bio, avatar_url, is_active, profile_id")
    .eq("id", doctor.id)
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ doctor: data });
}

export async function getDoctorStats(
  req: Request,
  res: Response
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const doctor = await resolveDoctor(req.userId!);
  if (!doctor) {
    res.status(404).json({ error: "No doctor profile found" });
    return;
  }

  // The doctor's calendar day, not the server's. toISOString() gives the UTC
  // day, so on a UTC host the doctor's "Today" list stayed on yesterday for the
  // first four hours of every Dubai day.
  const today = todayInTimezone(doctor.timezone);

  // Current calendar month bounds (YYYY-MM-01 → YYYY-MM-last)
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;

  const [{ count: todayCount }, { data: allAppts }, { data: monthlyAppts }] = await Promise.all([
    supabaseAdmin
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("doctor_id", doctor.id)
      .eq("scheduled_date", today)
      .not("status", "in", '("cancelled","rescheduled")'),
    supabaseAdmin
      .from("appointments")
      .select("child_id")
      .eq("doctor_id", doctor.id)
      .not("status", "in", '("cancelled","rescheduled")'),
    supabaseAdmin
      .from("appointments")
      .select("price_aed")
      .eq("doctor_id", doctor.id)
      .eq("status", "completed")
      .gte("scheduled_date", monthStart)
      .lt("scheduled_date", monthEnd),
  ]);

  const uniquePatients = new Set((allAppts ?? []).map((r) => r.child_id)).size;
  const monthlyRevenue = (monthlyAppts ?? []).reduce(
    (sum, r) => sum + (Number(r.price_aed) || 0),
    0
  );

  res.json({
    todayAppointments: todayCount ?? 0,
    totalPatients: uniquePatients,
    pendingNotes: 0,
    monthlyRevenue,
  });
}

export async function getDoctorAppointments(
  req: Request,
  res: Response
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const doctor = await resolveDoctor(req.userId!);
  if (!doctor) {
    res.status(404).json({ error: "No doctor profile found" });
    return;
  }

  const { date } = req.query;

  let query = supabaseAdmin
    .from("appointments")
    .select(
      `
      id,
      parent_id,
      consultation_type,
      scheduled_date,
      scheduled_time,
      duration_minutes,
      price_aed,
      symptoms,
      status,
      payment_status,
      meeting_url,
      created_at,
      child_profiles!appointments_child_id_fkey (
        id,
        first_name,
        last_name,
        date_of_birth
      )
    `
    )
    .eq("doctor_id", doctor.id)
    .order("scheduled_date", { ascending: false })
    .order("scheduled_time", { ascending: false });

  if (date && typeof date === "string") {
    // "today" is resolved here rather than by the client: only the server knows
    // the doctor's timezone, and the client would otherwise have to guess the
    // calendar day before the first response tells it which zone to use.
    query = query.eq(
      "scheduled_date",
      date === "today" ? todayInTimezone(doctor.timezone) : date
    );
  }

  const { data, error } = await query;
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const parentIds = [...new Set((data ?? []).map((r) => r.parent_id))];
  const nameMap = await fetchParentNames(parentIds);

  const appointments = (data ?? []).map((r) => ({
    ...r,
    parent_name: nameMap.get(r.parent_id) ?? null,
  }));

  // scheduled_time is a bare TIME in the doctor's own zone; ship the zone so
  // the dashboard can label it instead of asserting GST.
  res.json({ appointments, timezone: doctor.timezone });
}

export async function startSession(
  req: Request,
  res: Response
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const doctor = await resolveDoctor(req.userId!);
  if (!doctor) {
    res.status(404).json({ error: "No doctor profile found" });
    return;
  }

  const { id } = req.params;

  const { data: existing } = await supabaseAdmin
    .from("appointments")
    .select("id, status, scheduled_date, scheduled_time, timezone, duration_minutes, meeting_url")
    .eq("id", id)
    .eq("doctor_id", doctor.id)
    .single();

  if (!existing) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  if (!["pending", "confirmed"].includes(existing.status)) {
    res
      .status(400)
      .json({ error: `Cannot start a session with status: ${existing.status}` });
    return;
  }

  // If the room was already created (idempotent restart), reuse existing URL
  let meetingUrl = existing.meeting_url as string | null;

  if (!meetingUrl) {
    // Calculate room expiry: scheduled end + 30 min buffer.
    // `new Date("YYYY-MM-DDTHH:MM")` parses in the Node PROCESS's zone, which
    // skews the expiry by the process/appointment offset (4h under TZ=UTC).
    const scheduledStart = wallClockToInstant(
      existing.scheduled_date as string,
      existing.scheduled_time as string,
      (existing.timezone as string) || DEFAULT_TIMEZONE
    );
    const durationMs = ((existing.duration_minutes as number) + 30) * 60 * 1000;
    const expiryEpoch = Math.floor((scheduledStart.getTime() + durationMs) / 1000);

    try {
      const room = await createRoom(`appt-${id}`, expiryEpoch);
      meetingUrl = room.url;
    } catch (dailyErr) {
      res.status(502).json({ error: "Failed to create video room", detail: String(dailyErr) });
      return;
    }
  }

  const { data: updated, error } = await supabaseAdmin
    .from("appointments")
    .update({ status: "confirmed", meeting_url: meetingUrl })
    .eq("id", id)
    .eq("doctor_id", doctor.id)
    .select("id, status, meeting_url")
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Generate a host token for the doctor so they can join immediately
  const expiryEpoch = Math.floor(Date.now() / 1000) + 4 * 60 * 60; // 4h from now
  let doctorToken: string | null = null;
  try {
    const roomName = `appt-${id}`;
    doctorToken = await createMeetingToken(roomName, req.userId!, true, expiryEpoch);
  } catch {
    // Non-fatal: doctor can still use the base URL
  }

  res.json({
    appointment: updated,
    tokenUrl: doctorToken ? `${meetingUrl}?t=${doctorToken}` : meetingUrl,
  });
}

export async function completeAppointment(
  req: Request,
  res: Response
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const doctor = await resolveDoctor(req.userId!);
  if (!doctor) {
    res.status(404).json({ error: "No doctor profile found" });
    return;
  }

  const { id } = req.params;

  const { data: existing } = await supabaseAdmin
    .from("appointments")
    .select("id, status")
    .eq("id", id)
    .eq("doctor_id", doctor.id)
    .single();

  if (!existing) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  if (existing.status === "completed") {
    res.status(400).json({ error: "Appointment is already completed" });
    return;
  }

  const { data: updated, error } = await supabaseAdmin
    .from("appointments")
    .update({ status: "completed" })
    .eq("id", id)
    .eq("doctor_id", doctor.id)
    .select("id, status")
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ appointment: updated });
}

export async function getDoctorPatients(
  req: Request,
  res: Response
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const doctor = await resolveDoctor(req.userId!);
  if (!doctor) {
    res.status(404).json({ error: "No doctor profile found" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select(
      `
      child_id,
      parent_id,
      scheduled_date,
      child_profiles!appointments_child_id_fkey (
        id,
        first_name,
        last_name,
        date_of_birth
      )
    `
    )
    .eq("doctor_id", doctor.id)
    .not("status", "in", '("cancelled","rescheduled")')
    .order("scheduled_date", { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const parentIds = [...new Set((data ?? []).map((r) => r.parent_id))];
  const nameMap = await fetchParentNames(parentIds);

  // Aggregate: one entry per child with count + most recent date
  const patientMap = new Map<
    string,
    {
      child_id: string;
      child: { id: string; first_name: string; last_name: string; date_of_birth: string } | null;
      guardian_name: string;
      last_visit: string;
      total_appointments: number;
    }
  >();

  for (const row of data ?? []) {
    if (!patientMap.has(row.child_id)) {
      patientMap.set(row.child_id, {
        child_id: row.child_id,
        child: (row.child_profiles as unknown) as { id: string; first_name: string; last_name: string; date_of_birth: string } | null,
        guardian_name: nameMap.get(row.parent_id) ?? "Unknown",
        last_visit: row.scheduled_date,
        total_appointments: 1,
      });
    } else {
      patientMap.get(row.child_id)!.total_appointments++;
    }
  }

  res.json({ patients: [...patientMap.values()] });
}

export async function getDoctorSchedule(
  req: Request,
  res: Response
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const doctor = await resolveDoctor(req.userId!);
  if (!doctor) {
    res.status(404).json({ error: "No doctor profile found" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("doctor_schedules")
    .select("id, day_of_week, start_time, end_time, is_active")
    .eq("doctor_id", doctor.id)
    .order("day_of_week");

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // start_time/end_time are bare TIME — meaningless without the zone they are
  // wall-clock in, so it ships alongside them.
  res.json({ schedule: data, timezone: doctor.timezone });
}

export async function updateDoctorSchedule(
  req: Request,
  res: Response
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const doctor = await resolveDoctor(req.userId!);
  if (!doctor) {
    res.status(404).json({ error: "No doctor profile found" });
    return;
  }

  const { rows } = req.body as {
    rows: { day_of_week: number; start_time: string; end_time: string; is_active?: boolean }[];
  };

  if (!Array.isArray(rows)) {
    res.status(400).json({ error: "rows must be an array" });
    return;
  }

  const invalid = rows.find(
    (r) => !(hhmmToMinutes(r.start_time) < hhmmToMinutes(r.end_time))
  );
  if (invalid) {
    // Slot generation walks start→end in one direction, so an overnight or
    // inverted range silently produces zero slots instead of an error.
    res.status(400).json({ error: "End time must be after start time" });
    return;
  }

  await supabaseAdmin
    .from("doctor_schedules")
    .delete()
    .eq("doctor_id", doctor.id);

  if (rows.length === 0) {
    res.json({ schedule: [] });
    return;
  }

  const insertRows = rows.map((r) => ({
    doctor_id: doctor.id,
    day_of_week: r.day_of_week,
    start_time: r.start_time,
    end_time: r.end_time,
    is_active: r.is_active ?? true,
  }));

  const { data, error } = await supabaseAdmin
    .from("doctor_schedules")
    .insert(insertRows)
    .select("id, day_of_week, start_time, end_time, is_active");

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ schedule: data });
}

// ─── Profile update ───────────────────────────────────────────────────────────

export async function updateDoctorProfile(
  req: Request,
  res: Response
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const doctor = await resolveDoctor(req.userId!);
  if (!doctor) {
    res.status(404).json({ error: "No doctor profile found" });
    return;
  }

  const { full_name, specialty, bio, avatar_url, timezone, email } = req.body as {
    full_name?: string;
    specialty?: string;
    bio?: string;
    avatar_url?: string;
    timezone?: string;
    email?: string;
  };

  const updates: Record<string, string> = {};
  if (full_name !== undefined) updates.full_name = full_name;
  if (specialty !== undefined) updates.specialty = specialty;
  if (bio !== undefined) updates.bio = bio;
  if (avatar_url !== undefined) updates.avatar_url = avatar_url;
  // Notification address only — this is not a login, and does not touch
  // auth.users. Empty clears it, which disables the doctor's booking emails.
  if (email !== undefined) updates.email = email.trim();
  if (timezone !== undefined) {
    // The zone the doctor's working hours are expressed in — it belongs to the
    // doctor, not to the schedule rows, so it is set here rather than being
    // bundled into the delete-then-insert schedule PUT.
    if (!isValidTimezone(timezone)) {
      res.status(400).json({ error: "Invalid timezone" });
      return;
    }
    updates.timezone = timezone;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("doctors")
    .update(updates)
    .eq("id", doctor.id)
    .select("id, full_name, specialty, bio, avatar_url, timezone, email")
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Keep profiles.full_name in sync when name changes
  if (full_name !== undefined) {
    await supabaseAdmin
      .from("profiles")
      .update({ full_name })
      .eq("id", req.userId!);
  }

  res.json({ doctor: data });
}

// ─── Holidays ─────────────────────────────────────────────────────────────────

export async function getDoctorHolidays(
  req: Request,
  res: Response
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const doctor = await resolveDoctor(req.userId!);
  if (!doctor) {
    res.status(404).json({ error: "No doctor profile found" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("doctor_holidays")
    .select("id, holiday_date, reason, created_at")
    .eq("doctor_id", doctor.id)
    .order("holiday_date", { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ holidays: data });
}

export async function addDoctorHoliday(
  req: Request,
  res: Response
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const doctor = await resolveDoctor(req.userId!);
  if (!doctor) {
    res.status(404).json({ error: "No doctor profile found" });
    return;
  }

  const { holiday_date, reason } = req.body as {
    holiday_date: string;
    reason?: string;
  };

  if (!holiday_date) {
    res.status(400).json({ error: "holiday_date is required (YYYY-MM-DD)" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("doctor_holidays")
    .insert({ doctor_id: doctor.id, holiday_date, reason: reason ?? null })
    .select("id, holiday_date, reason, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      res.status(409).json({ error: "This date is already blocked" });
    } else {
      res.status(500).json({ error: error.message });
    }
    return;
  }

  res.status(201).json({ holiday: data });
}

export async function deleteDoctorHoliday(
  req: Request,
  res: Response
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const doctor = await resolveDoctor(req.userId!);
  if (!doctor) {
    res.status(404).json({ error: "No doctor profile found" });
    return;
  }

  const { id } = req.params;

  const { error } = await supabaseAdmin
    .from("doctor_holidays")
    .delete()
    .eq("id", id)
    .eq("doctor_id", doctor.id);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ message: "Holiday removed" });
}
