import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { ensureAppointmentRoom } from "../lib/appointment-room";
import { fetchParentNames } from "../lib/parents";
import { getStripe } from "../lib/stripe";
import { syncAppointmentCalendarEvent } from "../lib/google-calendar";
import { notifyRemedyResolved } from "../lib/remedy-notifications";
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
      attendance_outcome,
      meeting_url,
      created_at,
      refund_requests (
        id,
        requested_remedy,
        status
      ),
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

  // The room is provisioned when the booking is confirmed, so the link can go
  // out with the confirmation email. Starting a session is now a status change,
  // not a provisioning step — this only makes sure the room exists and its
  // joinable window matches the schedule.
  const meetingUrl =
    (existing.meeting_url as string | null) ?? (await ensureAppointmentRoom(id as string));

  if (!meetingUrl) {
    res.status(502).json({ error: "Failed to prepare the video room" });
    return;
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

  // No token here: the doctor opens the call at /appointments/<id>/room, which
  // mints one scoped to the join window and passes it to daily-js join().
  res.json({ appointment: updated });
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

// ─── Missed-consultation remedies ─────────────────────────────────────────────

/**
 * The claims waiting on this doctor.
 *
 * GET /api/doctor/refund-requests?status=pending
 *
 * Scoped with .eq("doctor_id", doctor.id) like every other read here: the
 * service-role key bypasses RLS, so ownership is enforced in the query or not
 * at all.
 */
export async function listRemedyRequests(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const doctor = await resolveDoctor(req.userId!);
  if (!doctor) {
    res.status(404).json({ error: "No doctor profile found" });
    return;
  }

  const { status } = req.query;

  let query = supabaseAdmin
    .from("refund_requests")
    .select(
      `id, appointment_id, parent_id, requested_remedy, reason, status,
       resolution_note, resolved_at, refund_amount_aed, created_at,
       appointments!refund_requests_appointment_id_fkey (
         scheduled_date, scheduled_time, timezone, consultation_type,
         price_aed, payment_status, attendance_outcome,
         child_profiles!appointments_child_id_fkey ( first_name, last_name )
       )`
    )
    .eq("doctor_id", doctor.id)
    // Pending first, then most recent — the queue is a to-do list.
    .order("status", { ascending: true })
    .order("created_at", { ascending: false });

  if (typeof status === "string" && status) query = query.eq("status", status);

  const { data, error } = await query;

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const parentIds = [...new Set((data ?? []).map((r) => r.parent_id).filter(Boolean))];
  const names = parentIds.length ? await fetchParentNames(parentIds as string[]) : new Map();

  res.json({
    requests: (data ?? []).map((r) => ({
      ...r,
      parent_name: names.get(r.parent_id as string) ?? null,
    })),
  });
}

/**
 * Grant one complimentary consultation credit.
 *
 * Reuses the credit wallet rather than inventing a parallel notion of a free
 * session, so the booking flow needs no changes at all: createAppointment
 * already finds an active credit, consumes it and books at price_aed 0.
 *
 * Returns the new user_packages id, or null if the catalogue row is missing
 * (migration 029 seeds it).
 */
async function grantReplacementCredit(
  parentUserId: string,
  appointmentId: string,
  grantedByProfileId: string
): Promise<string | null> {
  if (!supabaseAdmin) return null;

  const { data: pkg } = await supabaseAdmin
    .from("consultation_packages")
    .select("id, validity_days")
    .eq("slug", "replacement_session")
    .maybeSingle();

  if (!pkg) {
    console.error("[remedy] consultation_packages row 'replacement_session' is missing");
    return null;
  }

  const expiresAt = new Date(Date.now() + pkg.validity_days * 24 * 60 * 60 * 1000);

  const { data, error } = await supabaseAdmin
    .from("user_packages")
    .insert({
      user_id: parentUserId,
      package_id: pkg.id,
      credits_total: 1,
      credits_remaining: 1,
      // Left NULL: this credit was never bought. The unique index on that
      // column is partial (WHERE NOT NULL), so NULL rows never collide.
      stripe_checkout_session_id: null,
      expires_at: expiresAt.toISOString(),
      status: "active",
      granted_by_appointment_id: appointmentId,
      granted_by_profile_id: grantedByProfileId,
    })
    .select("id")
    .single();

  if (error) {
    console.error(`[remedy] Could not grant replacement credit: ${error.message}`);
    return null;
  }

  return data.id as string;
}

/**
 * The doctor answers a claim.
 *
 * PATCH /api/doctor/refund-requests/:id  { action: "approve" | "decline", note? }
 *
 * The remedy is applied BEFORE the request is marked approved, so a failed
 * Stripe call leaves the request pending and retryable rather than closed with
 * nothing handed over. There is no path here that marks a request approved
 * without having moved something.
 */
export async function resolveRemedyRequest(req: Request, res: Response): Promise<void> {
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
  const { action, note } = req.body ?? {};

  if (action !== "approve" && action !== "decline") {
    res.status(400).json({ error: "action must be 'approve' or 'decline'" });
    return;
  }

  const { data: request } = await supabaseAdmin
    .from("refund_requests")
    .select("id, appointment_id, parent_id, requested_remedy, status")
    .eq("id", id)
    .eq("doctor_id", doctor.id)
    .maybeSingle();

  if (!request) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  if (request.status !== "pending") {
    res.status(400).json({ error: `This request is already ${request.status}` });
    return;
  }

  const resolution: Record<string, unknown> = {
    resolved_by: req.userId,
    resolved_at: new Date().toISOString(),
    resolution_note: typeof note === "string" && note.trim() ? note.trim() : null,
  };

  if (action === "decline") {
    const { data: declined, error } = await supabaseAdmin
      .from("refund_requests")
      .update({ ...resolution, status: "declined" })
      .eq("id", id)
      .eq("status", "pending")
      .select("id, status, resolution_note, resolved_at")
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    await notifyRemedyResolved(id as string);
    res.json({ request: declined });
    return;
  }

  // ── Approve: apply the remedy first ────────────────────────────────────────

  const { data: appt } = await supabaseAdmin
    .from("appointments")
    .select("id, payment_status, price_aed, payment_reference, stripe_payment_intent")
    .eq("id", request.appointment_id)
    .eq("doctor_id", doctor.id)
    .maybeSingle();

  if (!appt) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  const applied: Record<string, unknown> = {};
  let outcomeLabel: string;

  if (request.requested_remedy === "free_session") {
    const grantedId = await grantReplacementCredit(
      request.parent_id as string,
      appt.id as string,
      req.userId!
    );
    if (!grantedId) {
      res.status(500).json({ error: "Could not grant the replacement session" });
      return;
    }
    applied.granted_user_package_id = grantedId;
    outcomeLabel =
      "A complimentary consultation has been added to your account — book it from your dashboard whenever suits you.";
  } else if (appt.payment_status === "package_credit") {
    // Booked with a credit, so there is no charge to reverse. Returning the
    // credit is what makes the parent whole, and it is what restore_package_credit
    // exists for — cancelAppointment has never called it, which is why a
    // cancelled credit booking silently burns the credit today.
    const userPackageId = String(appt.payment_reference ?? "").startsWith("PKG-")
      ? String(appt.payment_reference).slice(4)
      : null;

    if (!userPackageId) {
      res.status(400).json({
        error: "This booking has no package reference; resolve it manually",
      });
      return;
    }

    const { error: rpcError } = await supabaseAdmin.rpc("restore_package_credit", {
      p_user_package_id: userPackageId,
    });

    if (rpcError) {
      res.status(500).json({ error: `Could not restore the credit: ${rpcError.message}` });
      return;
    }

    // Keep the audit trail honest: the credit was handed back, so it was not
    // spent on this consultation after all.
    await supabaseAdmin
      .from("package_usage_logs")
      .delete()
      .eq("appointment_id", appt.id)
      .eq("user_package_id", userPackageId);

    await supabaseAdmin
      .from("appointments")
      .update({ status: "cancelled", cancellation_reason: "Missed — credit returned" })
      .eq("id", appt.id)
      .eq("doctor_id", doctor.id);

    void syncAppointmentCalendarEvent(appt.id as string);

    outcomeLabel = "Your consultation credit has been returned and is ready to use again.";
  } else if (appt.payment_status === "paid") {
    const stripe = getStripe();
    if (!stripe) {
      res.status(500).json({ error: "Payments are not configured" });
      return;
    }

    if (!appt.stripe_payment_intent) {
      res.status(400).json({
        error: "This booking has no payment on file; resolve it manually",
      });
      return;
    }

    let refund;
    try {
      refund = await stripe.refunds.create({
        payment_intent: appt.stripe_payment_intent as string,
        metadata: { refundRequestId: String(id), appointmentId: String(appt.id) },
      });
    } catch (err) {
      // Left pending on purpose: the doctor can try again, and nothing claims
      // the parent was paid when they were not.
      console.error(`[remedy] Stripe refund failed for request ${id}:`, err);
      res.status(502).json({ error: "The refund could not be processed, please try again" });
      return;
    }

    applied.stripe_refund_id = refund.id;
    applied.refund_amount_aed = refund.amount / 100;

    // payment_status is deliberately NOT written here. Stripe will deliver
    // charge.refunded, and that webhook already flips the appointment to
    // refunded/cancelled and re-syncs the calendar. One writer, one story.
    outcomeLabel = `A refund of ${(refund.amount / 100).toFixed(0)} AED is on its way back to your card. It can take a few days to appear.`;
  } else {
    res.status(400).json({ error: "This appointment was never paid for" });
    return;
  }

  const { data: approved, error } = await supabaseAdmin
    .from("refund_requests")
    .update({ ...resolution, ...applied, status: "approved" })
    .eq("id", id)
    .eq("status", "pending")
    .select(
      "id, status, resolution_note, resolved_at, refund_amount_aed, stripe_refund_id, granted_user_package_id"
    )
    .single();

  if (error) {
    // The remedy landed but the row did not. Loud, because the parent has been
    // given something the request no longer records.
    console.error(
      `[remedy] Remedy applied but request ${id} could not be marked approved: ${error.message}`
    );
    res.status(500).json({ error: error.message });
    return;
  }

  await notifyRemedyResolved(id as string, outcomeLabel);

  res.json({ request: approved });
}
