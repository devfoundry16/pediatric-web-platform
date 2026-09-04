import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { fetchParentNames } from "../lib/parents";
import {
  DEFAULT_TIMEZONE,
  hhmmToMinutes,
  isValidTimezone,
  todayInTimezone,
} from "../lib/timezone";
import { syncAppointmentCalendarEvent } from "../lib/google-calendar";
import { classifyAppointment } from "../lib/attendance";

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getAdminStats(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) { res.status(500).json({ error: "Server misconfigured" }); return; }

  // Clinic-local day, not the server's UTC day — otherwise "today's
  // appointments" lags by the UTC offset for the first hours of each day.
  const today = todayInTimezone(DEFAULT_TIMEZONE);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalBookings },
    { count: todayAppointments },
    { data: recentPayments },
    { count: newUsers },
    { data: recentAppointments },
  ] = await Promise.all([
    supabaseAdmin.from("appointments").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("appointments").select("*", { count: "exact", head: true }).eq("scheduled_date", today),
    supabaseAdmin.from("appointments")
      .select("id, price_aed, payment_status, payment_reference, scheduled_date, scheduled_time, created_at")
      .not("payment_status", "in", '("refunded")')
      .gt("price_aed", 0)
      .order("created_at", { ascending: false })
      .limit(5),
    supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
    supabaseAdmin.from("appointments")
      .select("id, status, scheduled_date, scheduled_time, consultation_type, price_aed, parent_id")
      .eq("scheduled_date", today)
      .order("scheduled_time", { ascending: true })
      .limit(10),
  ]);

  res.json({ totalBookings, todayAppointments, recentPayments, newUsers, recentAppointments });
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function listUsers(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) { res.status(500).json({ error: "Server misconfigured" }); return; }

  const { role, search, page = "1", limit = "50" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  let query = supabaseAdmin
    .from("profiles")
    .select("id, full_name, phone, role, is_active, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limitNum - 1);

  if (role && ["parent", "doctor", "admin"].includes(role)) {
    query = query.eq("role", role);
  }
  if (search) {
    query = query.ilike("full_name", `%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }

  // Fetch emails from auth (batch)
  const ids = (data ?? []).map((u) => u.id);
  const emailMap = new Map<string, string>();
  if (ids.length > 0) {
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    (users ?? []).forEach((u) => { if (u.email) emailMap.set(u.id, u.email); });
  }

  const enriched = (data ?? []).map((u) => ({ ...u, email: emailMap.get(u.id) ?? null }));
  res.json({ users: enriched, total: count ?? 0, page: pageNum, limit: limitNum });
}

export async function getUser(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) { res.status(500).json({ error: "Server misconfigured" }); return; }

  const { id } = req.params;
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, phone, role, is_active, created_at")
    .eq("id", id)
    .single();

  if (error || !profile) { res.status(404).json({ error: "User not found" }); return; }

  const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(id as string);

  // If doctor, get doctor row
  const { data: doctorRow } = await supabaseAdmin
    .from("doctors")
    .select("id, specialty, bio, is_active, avatar_url")
    .eq("profile_id", id)
    .maybeSingle();

  res.json({ user: { ...profile, email: authUser?.email ?? null, doctor: doctorRow ?? null } });
}

const VALID_ROLES = ["parent", "doctor", "admin"] as const;

// Supabase expects a Go duration string; there is no "forever", so use ~100
// years. Reversed with "none" when the account is reactivated.
const BAN_DURATION = "876000h";

// Guard: block an operation that would leave the platform with no active admin.
// Returns true when the operation is safe to proceed.
async function activeAdminsAboveOne(): Promise<boolean> {
  const { count } = await supabaseAdmin!
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("is_active", true);
  return (count ?? 0) > 1;
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) { res.status(500).json({ error: "Server misconfigured" }); return; }

  const { id } = req.params;
  const { full_name, phone, is_active, role } = req.body;

  const updates: Record<string, unknown> = {};
  if (full_name !== undefined) updates.full_name = full_name;
  if (phone !== undefined) updates.phone = phone;
  if (is_active !== undefined) updates.is_active = is_active;
  if (role !== undefined) {
    if (!VALID_ROLES.includes(role)) { res.status(400).json({ error: "Invalid role" }); return; }
    updates.role = role;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No updatable fields provided" });
    return;
  }

  // Load the target to enforce admin-safety guards.
  const { data: target } = await supabaseAdmin
    .from("profiles")
    .select("id, role, is_active, full_name")
    .eq("id", id)
    .single();

  if (!target) { res.status(404).json({ error: "User not found" }); return; }

  const demotingRole = role !== undefined && target.role === "admin" && role !== "admin";
  const deactivatingAdmin = is_active === false && target.role === "admin";

  // An admin can't lock themselves out.
  if (id === req.userId) {
    if (demotingRole) { res.status(400).json({ error: "You cannot remove your own admin role." }); return; }
    if (is_active === false) { res.status(400).json({ error: "You cannot deactivate your own account." }); return; }
  }

  // Never leave the platform without an active admin.
  if ((demotingRole || deactivatingAdmin) && !(await activeAdminsAboveOne())) {
    res.status(400).json({ error: "At least one active admin must remain." });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update(updates)
    .eq("id", id)
    .select("id, full_name, phone, role, is_active")
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  // Mirror the flag onto auth.users. Without this, deactivation only stops the
  // app's own middleware: the existing refresh token keeps minting new access
  // tokens and a fresh signInWithPassword still succeeds. Banning makes Supabase
  // itself reject both, which is what actually ends the session.
  if (is_active !== undefined && is_active !== target.is_active) {
    const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(id as string, {
      ban_duration: is_active ? "none" : BAN_DURATION,
    });

    if (banErr) {
      // Don't leave profiles and auth.users disagreeing — a profile flagged
      // inactive while the account is still usable is the exact bug this fixes.
      await supabaseAdmin
        .from("profiles")
        .update({ is_active: target.is_active })
        .eq("id", id);
      res.status(500).json({ error: `Failed to update account access: ${banErr.message}` });
      return;
    }
  }

  // Keep the doctors table in step with the role.
  //
  // role='doctor' on its own only makes a login: the doctor dashboard resolves
  // through doctors.profile_id and booking lists from `doctors`, so without a
  // row the promoted user hits "No doctor profile found" everywhere. Demoting
  // has the mirror problem — they lose the dashboard but stay bookable.
  let doctorNotice: DoctorSyncNotice | null = null;
  if (role !== undefined && role !== target.role) {
    doctorNotice = await syncDoctorRecordWithRole(
      id as string,
      role,
      target.role,
      (data?.full_name as string) || target.full_name || "Doctor"
    );
  }

  res.json({ user: data, notice: doctorNotice });
}

/**
 * Outcome of keeping the doctors table in step with a role change.
 *
 * `ok: false` means the role changed but the doctor record did not follow, so
 * the UI can show it as a warning instead of losing it next to a success
 * toast — that state leaves a user who can sign in but has no working doctor
 * dashboard, which is not something to report quietly.
 */
interface DoctorSyncNotice {
  ok: boolean;
  text: string;
}

/**
 * Create or remove the doctors row behind a role change.
 *
 * Promotion creates the record INACTIVE: it has no specialty, no working hours
 * and no notification address yet, and making someone bookable the instant
 * their role changes is not what an admin is asking for. The returned notice
 * points them at Doctors to finish.
 *
 * Demotion deletes it, taking their working hours and blocked dates with it
 * (both ON DELETE CASCADE). A doctor who has ever been booked cannot be
 * deleted — appointments.doctor_id is ON DELETE RESTRICT precisely so that
 * history cannot be destroyed — so those are retired instead, and the notice
 * says which happened.
 */
async function syncDoctorRecordWithRole(
  userId: string,
  nextRole: string,
  previousRole: string,
  fullName: string
): Promise<DoctorSyncNotice | null> {
  const { data: existing } = await supabaseAdmin!
    .from("doctors")
    .select("id, is_active")
    .eq("profile_id", userId)
    .maybeSingle();

  if (nextRole === "doctor") {
    // Re-promoting someone whose record was retired rather than deleted: the
    // row is still there but not bookable, and re-enabling that is a decision
    // for the admin, not a side effect of the role change.
    if (existing) {
      return existing.is_active
        ? null
        : { ok: true, text: "They already have a doctor record, which is not bookable. Enable it under Doctors." };
    }
    const { error } = await supabaseAdmin!
      .from("doctors")
      .insert({
        profile_id: userId,
        full_name: fullName,
        // timezone and specialty are left to their column defaults rather than
        // restated here: naming a column that a pending migration has not added
        // yet fails the whole insert, and the default is the value we'd send.
        is_active: false,
      });
    if (error) {
      console.error(
        `[admin] Could not create doctor record for ${userId}: ${error.message}` +
          (error.code ? ` (${error.code})` : "")
      );
      return {
        ok: false,
        text: `The doctor record could not be created: ${error.message}. They can sign in but the doctor dashboard will not work until it exists.`,
      };
    }
    return { ok: true, text: "Doctor record created. Set their specialty, hours and timezone under Doctors, then mark them bookable." };
  }

  if (previousRole === "doctor" && existing) {
    const { error } = await supabaseAdmin!.from("doctors").delete().eq("id", existing.id);

    if (!error) {
      // doctor_schedules and doctor_holidays cascade away with it, which is
      // what removing a doctor should mean. Anything they authored --
      // medical_records, courses, group_sessions -- is ON DELETE SET NULL, so
      // the content survives but loses its attribution.
      return { ok: true, text: "Their doctor record and working hours have been deleted." };
    }

    // 23503 = foreign key violation. appointments.doctor_id is ON DELETE
    // RESTRICT, so a doctor with any booking -- including cancelled or
    // completed history -- cannot be deleted without destroying that history.
    // Retire the record instead of failing the role change.
    if (error.code === "23503") {
      const { error: retireErr } = await supabaseAdmin!
        .from("doctors")
        .update({ is_active: false })
        .eq("id", existing.id);
      if (retireErr) {
        console.error(`[admin] Could not retire doctor record for ${userId}:`, retireErr.message);
        return { ok: false, text: `Their doctor record could not be removed: ${retireErr.message}` };
      }
      return {
        ok: true,
        text: "They have appointment history, so their doctor record was retired rather than deleted. It is no longer bookable.",
      };
    }

    console.error(`[admin] Could not delete doctor record for ${userId}:`, error.message);
    return { ok: false, text: `Their doctor record could not be removed: ${error.message}` };
  }

  return null;
}

export async function createUser(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) { res.status(500).json({ error: "Server misconfigured" }); return; }

  const { email, password, full_name, phone, role } = req.body;

  if (!email || !password || !role) {
    res.status(400).json({ error: "email, password, and role are required" });
    return;
  }
  if (!VALID_ROLES.includes(role)) { res.status(400).json({ error: "Invalid role" }); return; }
  if (String(password).length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  // Admin-provisioned accounts skip email confirmation.
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name ?? "", phone: phone ?? "", role },
  });

  if (createErr || !created?.user) {
    res.status(400).json({ error: createErr?.message ?? "Failed to create user" });
    return;
  }

  // The handle_new_user trigger inserts the profile as 'parent'; upsert the
  // intended role (permitted here because the API runs as service_role).
  const { error: upsertErr } = await supabaseAdmin
    .from("profiles")
    .upsert(
      { id: created.user.id, full_name: full_name ?? null, phone: phone ?? null, role, is_active: true },
      { onConflict: "id" }
    );

  if (upsertErr) { res.status(500).json({ error: upsertErr.message }); return; }

  // Same reason as the role-change path: role='doctor' alone is only a login.
  const notice =
    role === "doctor"
      ? await syncDoctorRecordWithRole(created.user.id, role, "parent", full_name ?? "Doctor")
      : null;

  res.status(201).json({
    notice,
    user: {
      id: created.user.id,
      email,
      full_name: full_name ?? null,
      phone: phone ?? null,
      role,
      is_active: true,
      created_at: created.user.created_at,
    },
  });
}

export async function deleteUser(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) { res.status(500).json({ error: "Server misconfigured" }); return; }

  const { id } = req.params;

  if (id === req.userId) {
    res.status(400).json({ error: "You cannot delete your own account." });
    return;
  }

  const { data: target } = await supabaseAdmin
    .from("profiles")
    .select("id, role")
    .eq("id", id)
    .single();

  if (!target) { res.status(404).json({ error: "User not found" }); return; }

  // Never delete the last active admin.
  if (target.role === "admin" && !(await activeAdminsAboveOne())) {
    res.status(400).json({ error: "At least one active admin must remain." });
    return;
  }

  // Deleting the auth user cascades to public.profiles (and the parent's
  // appointments via ON DELETE CASCADE).
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id as string);
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json({ message: "User deleted" });
}

// ─── Appointments ─────────────────────────────────────────────────────────────

export async function listAllAppointments(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) { res.status(500).json({ error: "Server misconfigured" }); return; }

  const { date, doctorId, status, page = "1", limit = "50" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  let query = supabaseAdmin
    .from("appointments")
    .select(`
      id, consultation_type, scheduled_date, scheduled_time, duration_minutes,
      price_aed, symptoms, status, payment_status, payment_reference, meeting_url,
      cancellation_reason, created_at, parent_id, child_id, doctor_id,
      child_profiles!appointments_child_id_fkey(id, first_name, last_name),
      doctors!appointments_doctor_id_fkey(id, full_name, specialty)
    `, { count: "exact" })
    .order("scheduled_date", { ascending: false })
    .order("scheduled_time", { ascending: false })
    .range(offset, offset + limitNum - 1);

  if (date) query = query.eq("scheduled_date", date);
  if (doctorId) query = query.eq("doctor_id", doctorId);
  if (status) query = query.eq("status", status);

  const { data, error, count } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }

  // Who booked the appointment, not just who it is for: the child is the
  // patient, but every call, cancellation and refund goes through the parent.
  const names = await fetchParentNames([...new Set((data ?? []).map((a) => a.parent_id))]);
  const appointments = (data ?? []).map((a) => ({
    ...a,
    parent_name: names.get(a.parent_id) ?? null,
  }));

  res.json({ appointments, total: count ?? 0, page: pageNum, limit: limitNum });
}

export async function updateAppointmentAdmin(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) { res.status(500).json({ error: "Server misconfigured" }); return; }

  const { id } = req.params;
  const { action, newDate, newTime, cancellationReason } = req.body;

  const { data: existing } = await supabaseAdmin
    .from("appointments")
    .select("id, status, doctor_id")
    .eq("id", id)
    .single();

  if (!existing) { res.status(404).json({ error: "Appointment not found" }); return; }

  let updates: Record<string, unknown> = {};

  switch (action) {
    case "cancel":
      updates = { status: "cancelled", cancellation_reason: cancellationReason ?? null };
      break;
    case "complete":
      updates = { status: "completed" };
      break;
    case "no_show":
      updates = { status: "cancelled", cancellation_reason: "No-show" };
      break;
    case "reschedule": {
      if (!newDate || !newTime) {
        res.status(400).json({ error: "newDate and newTime are required for reschedule" });
        return;
      }
      // An admin types the new time in the doctor's CURRENT zone, so re-snapshot
      // it — the row may still carry the zone the doctor used at booking time.
      const { data: doctor } = await supabaseAdmin
        .from("doctors")
        .select("timezone")
        .eq("id", existing.doctor_id)
        .maybeSingle();
      updates = {
        scheduled_date: newDate,
        scheduled_time: newTime,
        timezone: doctor?.timezone || DEFAULT_TIMEZONE,
        status: "confirmed",
      };
      break;
    }
    default:
      res.status(400).json({ error: "Invalid action. Use: cancel, complete, no_show, reschedule" });
      return;
  }

  const { data, error } = await supabaseAdmin
    .from("appointments")
    .update(updates)
    .eq("id", id)
    .select("id, status, scheduled_date, scheduled_time, cancellation_reason")
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  // Converge the mirrored Google Calendar event: cancel/no_show delete it,
  // reschedule moves it, complete leaves it as history (non-blocking).
  void syncAppointmentCalendarEvent(id as string);

  // complete and no_show both end the consultation, so settle its attendance
  // now. This matters most for no_show, which writes status 'cancelled' -- a
  // status the sweep never revisits, so without this the very case the refund
  // flow exists for would never be classified at all.
  if (action === "complete" || action === "no_show") {
    await classifyAppointment(id as string);
  }

  res.json({ appointment: data });
}

// ─── Doctor availability ──────────────────────────────────────────────────────

export async function getDoctorScheduleAdmin(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) { res.status(500).json({ error: "Server misconfigured" }); return; }

  const { doctorId } = req.params;
  const { data, error } = await supabaseAdmin
    .from("doctor_schedules")
    .select("*")
    .eq("doctor_id", doctorId)
    .order("day_of_week");

  if (error) { res.status(500).json({ error: error.message }); return; }

  // start_time/end_time are bare TIME — meaningless without the zone they are
  // wall-clock in, so it ships alongside them.
  const { data: doctor } = await supabaseAdmin
    .from("doctors")
    .select("timezone")
    .eq("id", doctorId)
    .maybeSingle();

  res.json({ schedule: data, timezone: doctor?.timezone || DEFAULT_TIMEZONE });
}

export async function updateDoctorScheduleAdmin(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) { res.status(500).json({ error: "Server misconfigured" }); return; }

  const { doctorId } = req.params;
  const { slots } = req.body as { slots: Array<{ day_of_week: number; start_time: string; end_time: string; is_active: boolean }> };

  if (!Array.isArray(slots)) {
    res.status(400).json({ error: "slots must be an array" });
    return;
  }

  const invalid = slots.find(
    (s) => !(hhmmToMinutes(s.start_time) < hhmmToMinutes(s.end_time))
  );
  if (invalid) {
    // Slot generation walks start→end in one direction, so an overnight or
    // inverted range silently produces zero slots instead of an error.
    res.status(400).json({ error: "End time must be after start time" });
    return;
  }

  // Delete existing and replace
  await supabaseAdmin.from("doctor_schedules").delete().eq("doctor_id", doctorId);

  const rows = slots.map((s) => ({ doctor_id: doctorId, ...s }));
  const { error } = await supabaseAdmin.from("doctor_schedules").insert(rows);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
}

/**
 * Update doctor attributes that aren't part of the schedule collection.
 *
 * `timezone` lives here rather than on the schedule PUT because it belongs to
 * the doctor: bundling it into a delete-then-insert of all schedule rows makes
 * it possible to write one doctor's zone onto another when the admin page's
 * doctor dropdown changes while a load is in flight.
 */
export async function updateDoctorAdmin(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) { res.status(500).json({ error: "Server misconfigured" }); return; }

  const { doctorId } = req.params;
  const { timezone, email, full_name, specialty, bio, avatar_url, is_active } =
    req.body as Partial<DoctorInput> & { is_active?: boolean };

  const updates: Record<string, unknown> = {};
  if (timezone !== undefined) {
    if (!isValidTimezone(timezone)) { res.status(400).json({ error: "Invalid timezone" }); return; }
    updates.timezone = timezone;
  }
  // Notification address only — not a login, and independent of profile_id.
  if (email !== undefined) updates.email = email.trim() || null;
  if (full_name !== undefined) {
    if (!full_name.trim()) { res.status(400).json({ error: "Name is required" }); return; }
    updates.full_name = full_name.trim();
  }
  // specialty is NOT NULL with a default, so a blank field means "leave it"
  // rather than "clear it" — writing null would just error.
  if (specialty !== undefined && specialty.trim()) updates.specialty = specialty.trim();
  if (bio !== undefined) updates.bio = bio.trim() || null;
  if (avatar_url !== undefined) updates.avatar_url = avatar_url.trim() || null;
  // Controls bookability, not login — a deactivated doctor disappears from the
  // booking flow but any account they hold still works (see profiles.is_active
  // for that).
  if (is_active !== undefined) updates.is_active = !!is_active;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No updatable fields provided" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("doctors")
    .update(updates)
    .eq("id", doctorId)
    .select(DOCTOR_FIELDS)
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ doctor: data });
}

const DOCTOR_FIELDS =
  "id, full_name, specialty, bio, avatar_url, email, timezone, is_active, profile_id";

interface DoctorInput {
  full_name: string;
  specialty?: string;
  bio?: string;
  avatar_url?: string;
  email?: string;
  timezone?: string;
}

/**
 * Create a bookable doctor.
 *
 * Creating a user with role='doctor' is NOT enough on its own: the doctor
 * dashboard resolves through doctors.profile_id, and the booking flow lists
 * from `doctors`. Migration 012 stopped auto-creating this row at signup and
 * left provisioning to "an admin step" that was never built — this is it.
 *
 * A login is optional. Doctors can be bookable without an account (that is why
 * doctors.profile_id is nullable, and how Dr Sahar is seeded), so the account
 * is provisioned only when credentials are supplied.
 */
export async function createDoctorAdmin(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) { res.status(500).json({ error: "Server misconfigured" }); return; }

  const { full_name, specialty, bio, avatar_url, email, timezone } = req.body as DoctorInput;
  const { account_email, account_password } = req.body as {
    account_email?: string;
    account_password?: string;
  };

  if (!full_name?.trim()) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  if (timezone !== undefined && !isValidTimezone(timezone)) {
    res.status(400).json({ error: "Invalid timezone" });
    return;
  }

  let profileId: string | null = null;
  if (account_email?.trim()) {
    const account = await provisionDoctorAccount(
      account_email.trim(),
      account_password,
      full_name.trim()
    );
    if ("error" in account) {
      res.status(account.status).json({ error: account.error });
      return;
    }
    profileId = account.userId;
  }

  const { data, error } = await supabaseAdmin
    .from("doctors")
    .insert({
      full_name: full_name.trim(),
      // Omitted when blank so the column default applies — it is NOT NULL.
      ...(specialty?.trim() ? { specialty: specialty.trim() } : {}),
      bio: bio?.trim() || null,
      avatar_url: avatar_url?.trim() || null,
      email: email?.trim() || null,
      timezone: timezone || DEFAULT_TIMEZONE,
      profile_id: profileId,
      is_active: true,
    })
    .select(DOCTOR_FIELDS)
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json({ doctor: data });
}

/**
 * Give an existing doctors row a login, creating the account if needed.
 *
 * Seeded doctors have profile_id NULL and so cannot sign in at all; this is the
 * only way to attach an account to them without SQL. An address that already
 * has an account is linked rather than rejected, which is the common case when
 * the admin created the user first via Users.
 */
export async function linkDoctorAccountAdmin(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) { res.status(500).json({ error: "Server misconfigured" }); return; }

  const { doctorId } = req.params;
  const { account_email, account_password } = req.body as {
    account_email?: string;
    account_password?: string;
  };

  if (!account_email?.trim()) {
    res.status(400).json({ error: "account_email is required" });
    return;
  }

  const { data: doctor } = await supabaseAdmin
    .from("doctors")
    .select("id, full_name, profile_id")
    .eq("id", doctorId)
    .single();

  if (!doctor) { res.status(404).json({ error: "Doctor not found" }); return; }

  const account = await provisionDoctorAccount(
    account_email.trim(),
    account_password,
    doctor.full_name
  );
  if ("error" in account) {
    res.status(account.status).json({ error: account.error });
    return;
  }

  // One account, one doctor: linking a user already attached elsewhere would
  // hand them that doctor's patients and PHI.
  const { data: clash } = await supabaseAdmin
    .from("doctors")
    .select("id")
    .eq("profile_id", account.userId)
    .neq("id", doctorId)
    .maybeSingle();

  if (clash) {
    res.status(409).json({ error: "That account is already linked to another doctor." });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("doctors")
    .update({ profile_id: account.userId })
    .eq("id", doctorId)
    .select(DOCTOR_FIELDS)
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ doctor: data, created: account.created });
}

/**
 * Find or create the auth user behind a doctor login, and make sure their
 * profile carries role='doctor' so middleware routes them to the doctor
 * dashboard.
 */
async function provisionDoctorAccount(
  email: string,
  password: string | undefined,
  fullName: string
): Promise<{ userId: string; created: boolean } | { error: string; status: number }> {
  const { data: existing } = await supabaseAdmin!.auth.admin.listUsers({ perPage: 1000 });
  const match = (existing?.users ?? []).find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  let userId: string;
  let created = false;

  if (match) {
    userId = match.id;
  } else {
    if (!password || String(password).length < 6) {
      return {
        error: "A password of at least 6 characters is required to create a new account.",
        status: 400,
      };
    }
    const { data: createdUser, error: createErr } = await supabaseAdmin!.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: "doctor" },
    });
    if (createErr || !createdUser?.user) {
      return { error: createErr?.message ?? "Failed to create account", status: 400 };
    }
    userId = createdUser.user.id;
    created = true;
  }

  // handle_new_user inserts the profile as 'parent' (migration 012); promote it
  // here, which is permitted because the API runs as service_role.
  const { error: profileErr } = await supabaseAdmin!
    .from("profiles")
    .upsert({ id: userId, full_name: fullName, role: "doctor", is_active: true }, { onConflict: "id" });

  if (profileErr) return { error: profileErr.message, status: 500 };

  return { userId, created };
}

export async function getDoctorHolidaysAdmin(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) { res.status(500).json({ error: "Server misconfigured" }); return; }

  const { doctorId } = req.params;
  const { data, error } = await supabaseAdmin
    .from("doctor_holidays")
    .select("*")
    .eq("doctor_id", doctorId)
    .order("holiday_date");

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ holidays: data });
}

export async function addDoctorHolidayAdmin(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) { res.status(500).json({ error: "Server misconfigured" }); return; }

  const { doctorId } = req.params;
  const { holiday_date, reason } = req.body;

  if (!holiday_date) { res.status(400).json({ error: "holiday_date is required" }); return; }

  const { data, error } = await supabaseAdmin
    .from("doctor_holidays")
    .insert({ doctor_id: doctorId, holiday_date, reason: reason ?? null })
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json({ holiday: data });
}

export async function deleteDoctorHolidayAdmin(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) { res.status(500).json({ error: "Server misconfigured" }); return; }

  const { holidayId } = req.params;
  const { error } = await supabaseAdmin.from("doctor_holidays").delete().eq("id", holidayId);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
}

// ─── Consultation types ───────────────────────────────────────────────────────

export async function listConsultationTypes(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) { res.status(500).json({ error: "Server misconfigured" }); return; }

  const { data, error } = await supabaseAdmin
    .from("consultation_types")
    .select("*")
    .order("price_aed");

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ consultationTypes: data });
}

export async function createConsultationType(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) { res.status(500).json({ error: "Server misconfigured" }); return; }

  const { slug, name, description, duration_minutes, price_aed } = req.body;
  if (!slug || !name || !duration_minutes || price_aed === undefined) {
    res.status(400).json({ error: "slug, name, duration_minutes, and price_aed are required" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("consultation_types")
    .insert({ slug, name, description: description ?? null, duration_minutes, price_aed })
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json({ consultationType: data });
}

export async function updateConsultationType(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) { res.status(500).json({ error: "Server misconfigured" }); return; }

  const { id } = req.params;
  const { name, description, duration_minutes, price_aed, is_active } = req.body;

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (duration_minutes !== undefined) updates.duration_minutes = duration_minutes;
  if (price_aed !== undefined) updates.price_aed = price_aed;
  if (is_active !== undefined) updates.is_active = is_active;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No updatable fields provided" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("consultation_types")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ consultationType: data });
}

// ─── Packages ─────────────────────────────────────────────────────────────────

const USER_PACKAGE_STATUSES = ["active", "expired", "exhausted", "cancelled", "refunded"];

/** The catalogue columns needed to name a purchase and price it. */
const USER_PACKAGE_SELECT = `
  id, user_id, credits_total, credits_remaining, expires_at, status, purchased_at,
  stripe_checkout_session_id,
  consultation_packages (id, slug, name, sessions, price_aed)
`;

interface UserPackageRow {
  id: string;
  user_id: string;
  credits_total: number;
  credits_remaining: number;
  expires_at: string;
  status: string;
  purchased_at: string;
  stripe_checkout_session_id: string | null;
  consultation_packages: {
    id: string;
    slug: string;
    name: string;
    sessions: number;
    price_aed: number;
  } | null;
}

/**
 * What the buyer actually paid.
 *
 * user_packages stores no price, so it has to be derived from the catalogue.
 * Checkout grants N × the package's sessions (see the webhook in
 * controllers/packages.ts), so the quantity bought is credits_total / sessions.
 *
 * This reads the CURRENT catalogue price: editing a package's price shifts the
 * amounts shown for past purchases. Snapshotting the price at purchase time is
 * the real fix, but that needs a schema change.
 */
function packageAmountAed(row: UserPackageRow): number {
  const pkg = row.consultation_packages;
  if (!pkg || !pkg.sessions) return 0;
  return Number(pkg.price_aed) * (row.credits_total / pkg.sessions);
}

/**
 * Flip packages whose validity has lapsed over to `expired`.
 *
 * Expiry is lazy — nothing sweeps these in the background — so the parent-facing
 * getMyPackages does the same write before reading. Without it the admin list
 * shows packages as `active` weeks after they stopped being usable.
 */
async function expireLapsedPackages(): Promise<void> {
  if (!supabaseAdmin) return;
  await supabaseAdmin
    .from("user_packages")
    .update({ status: "expired" })
    .eq("status", "active")
    .lt("expires_at", new Date().toISOString());
}

export async function listUserPackages(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) { res.status(500).json({ error: "Server misconfigured" }); return; }

  const { page = "1", limit = "50", status } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  await expireLapsedPackages();

  let query = supabaseAdmin
    .from("user_packages")
    .select(USER_PACKAGE_SELECT, { count: "exact" })
    .order("purchased_at", { ascending: false })
    .range(offset, offset + limitNum - 1);

  if (status && USER_PACKAGE_STATUSES.includes(status)) query = query.eq("status", status);

  const { data, error, count } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }

  const rows = (data ?? []) as unknown as UserPackageRow[];
  const names = await fetchParentNames([...new Set(rows.map((r) => r.user_id))]);
  const packages = rows.map((row) => ({
    ...row,
    amount_aed: packageAmountAed(row),
    buyer_name: names.get(row.user_id) ?? null,
  }));

  res.json({ packages, total: count ?? 0, page: pageNum, limit: limitNum });
}

// ─── Payments ─────────────────────────────────────────────────────────────────

/**
 * A live group-session ticket, with the session it bought.
 *
 * What the registrant paid has to come off the session: `session_registrations`
 * stores no amount. Like `packageAmountAed`, that means the CURRENT price is
 * reported — a doctor can still rewrite `price_aed` on a scheduled session (see
 * updateSession in controllers/group-sessions.ts), which shifts the amount shown
 * for tickets already sold. Snapshotting the price at checkout is the real fix,
 * but that needs a schema change.
 */
interface SessionRegistrationRow {
  id: string;
  user_id: string;
  payment_status: string;
  registered_at: string;
  stripe_session_id: string | null;
  group_sessions: {
    id: string;
    title: string;
    scheduled_at: string;
    price_aed: number;
    doctors: { full_name: string } | null;
  } | null;
}

/**
 * A consultation booking, a package sale or a live-session ticket, flattened
 * into one transaction.
 *
 * Fields that only describe one kind are null on the others: the admin table
 * shows a different column set per kind, so each stream fills in its own and
 * blanks the rest. `buyer_name` covers both the package buyer and the session
 * registrant; `doctors` covers both the consulting doctor and the session host.
 */
interface PaymentTransaction {
  id: string;
  kind: "consultation" | "package" | "live_session";
  created_at: string;
  amount_aed: number;
  payment_status: string;
  payment_reference: string | null;
  doctors: { full_name: string } | null;
  child_profiles: { first_name: string; last_name: string } | null;
  scheduled_date: string | null;
  package_name: string | null;
  credits_total: number | null;
  credits_remaining: number | null;
  expires_at: string | null;
  session_title: string | null;
  scheduled_at: string | null;
  buyer_name: string | null;
}

/**
 * Money taken, across all three things the clinic sells.
 *
 * Consultations live in `appointments`, package sales in `user_packages`, and
 * live group-session tickets in `session_registrations`; there is no table
 * holding them all. Rather than add a union view (this codebase has no views),
 * the streams are merged here.
 *
 * Pagination is exact without fetching everything: to build page N of a set of
 * date-descending streams, no row past the (offset + limit)th of any one stream
 * can appear on that page, so that prefix is all we need to read.
 */
export async function listPayments(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) { res.status(500).json({ error: "Server misconfigured" }); return; }

  // Captured so the per-stream closures below keep the non-null narrowing.
  const db = supabaseAdmin;

  const { page = "1", limit = "50", status, type } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;
  const prefix = offset + limitNum;

  // Tested positively rather than by exclusion: with three kinds, `type !==
  // "package"` would let a live-session filter through the consultation stream.
  const wantConsultations = !type || type === "consultation";
  const wantPackages = !type || type === "package";
  const wantSessions = !type || type === "live_session";

  // A package sale is only ever money in or money back — it has no equivalent of
  // an appointment's `pending`/`package_credit`, so those filters exclude it.
  const packageStatusMatches = !status || status === "paid" || status === "refunded";

  // A ticket can sit unpaid in checkout, so unlike a package it does have a
  // `pending`; only `package_credit` has no meaning for one.
  const sessionStatusMatches =
    !status || status === "paid" || status === "pending" || status === "refunded";

  const appointmentsQuery = async () => {
    if (!wantConsultations) return { rows: [] as PaymentTransaction[], count: 0 };
    let query = db
      .from("appointments")
      .select(`
        id, price_aed, payment_status, payment_reference, created_at, scheduled_date,
        parent_id,
        doctors!appointments_doctor_id_fkey(full_name),
        child_profiles!appointments_child_id_fkey(first_name, last_name)
      `, { count: "exact" })
      .gt("price_aed", 0)
      .order("created_at", { ascending: false })
      .limit(prefix);

    if (status) query = query.eq("payment_status", status);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    const rows = (data ?? []).map((a): PaymentTransaction => ({
      id: a.id as string,
      kind: "consultation",
      created_at: a.created_at as string,
      amount_aed: Number(a.price_aed),
      payment_status: a.payment_status as string,
      payment_reference: (a.payment_reference as string | null) ?? null,
      doctors: (a.doctors as unknown as { full_name: string } | null) ?? null,
      child_profiles:
        (a.child_profiles as unknown as { first_name: string; last_name: string } | null) ?? null,
      scheduled_date: (a.scheduled_date as string | null) ?? null,
      package_name: null,
      credits_total: null,
      credits_remaining: null,
      expires_at: null,
      session_title: null,
      scheduled_at: null,
      buyer_name: null,
    }));
    return { rows, count: count ?? 0 };
  };

  const packagesQuery = async () => {
    if (!wantPackages || !packageStatusMatches) return { rows: [] as PaymentTransaction[], count: 0 };
    let query = db
      .from("user_packages")
      .select(USER_PACKAGE_SELECT, { count: "exact" })
      .order("purchased_at", { ascending: false })
      .limit(prefix);

    // Refunds are the one package status that maps onto a payment status; every
    // other state (active, expired, exhausted, cancelled) was still paid for.
    if (status === "refunded") query = query.eq("status", "refunded");
    else if (status === "paid") query = query.neq("status", "refunded");

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    const packageRows = (data ?? []) as unknown as UserPackageRow[];
    const names = await fetchParentNames([...new Set(packageRows.map((r) => r.user_id))]);
    const rows = packageRows.map((row): PaymentTransaction => ({
      id: row.id,
      kind: "package",
      created_at: row.purchased_at,
      amount_aed: packageAmountAed(row),
      payment_status: row.status === "refunded" ? "refunded" : "paid",
      payment_reference: row.stripe_checkout_session_id,
      doctors: null,
      child_profiles: null,
      scheduled_date: null,
      package_name: row.consultation_packages?.name ?? null,
      credits_total: row.credits_total,
      credits_remaining: row.credits_remaining,
      expires_at: row.expires_at,
      session_title: null,
      scheduled_at: null,
      buyer_name: names.get(row.user_id) ?? null,
    }));
    return { rows, count: count ?? 0 };
  };

  const sessionRegistrationsQuery = async () => {
    if (!wantSessions || !sessionStatusMatches) return { rows: [] as PaymentTransaction[], count: 0 };
    let query = db
      .from("session_registrations")
      .select(`
        id, user_id, payment_status, registered_at, stripe_session_id,
        group_sessions (id, title, scheduled_at, price_aed, doctors (full_name))
      `, { count: "exact" })
      // A free seat is not a transaction — the same reason the consultation
      // stream above only reads rows with a price on them.
      .neq("payment_status", "free")
      .order("registered_at", { ascending: false })
      .limit(prefix);

    // paid / pending / refunded already ARE the registration vocabulary, so
    // unlike a package this needs no translation.
    if (status) query = query.eq("payment_status", status);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    const registrationRows = (data ?? []) as unknown as SessionRegistrationRow[];
    const names = await fetchParentNames([...new Set(registrationRows.map((r) => r.user_id))]);
    const rows = registrationRows.map((row): PaymentTransaction => {
      // `session_id` is NOT NULL ON DELETE CASCADE and this client is
      // service-role, so a registration without its session is not a reachable
      // state — an absent embed means the select did not resolve the way the
      // cast above claims. Pricing that at 0 would put a whole revenue stream
      // on screen as legitimately free; fail the request the way a query error
      // does instead. `doctors` is genuinely nullable (ON DELETE SET NULL).
      const session = row.group_sessions;
      if (!session) throw new Error(`Registration ${row.id} is missing its session`);
      return {
        id: row.id,
        kind: "live_session",
        created_at: row.registered_at,
        amount_aed: Number(session.price_aed),
        payment_status: row.payment_status,
        payment_reference: row.stripe_session_id,
        doctors: session.doctors ?? null,
        child_profiles: null,
        scheduled_date: null,
        package_name: null,
        credits_total: null,
        credits_remaining: null,
        expires_at: null,
        session_title: session.title,
        scheduled_at: session.scheduled_at,
        buyer_name: names.get(row.user_id) ?? null,
      };
    });
    return { rows, count: count ?? 0 };
  };

  try {
    const [appointments, packages, registrations] = await Promise.all([
      appointmentsQuery(),
      packagesQuery(),
      sessionRegistrationsQuery(),
    ]);

    const payments = [...appointments.rows, ...packages.rows, ...registrations.rows]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(offset, offset + limitNum);

    res.json({
      payments,
      total: appointments.count + packages.count + registrations.count,
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to list payments" });
  }
}

// ─── Patients ─────────────────────────────────────────────────────────────────

export async function listPatients(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) { res.status(500).json({ error: "Server misconfigured" }); return; }

  const { search, page = "1", limit = "50" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  let query = supabaseAdmin
    .from("child_profiles")
    .select("id, first_name, last_name, date_of_birth, gender, parent_id, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limitNum - 1);

  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ patients: data, total: count ?? 0, page: pageNum, limit: limitNum });
}

export async function getPatient(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) { res.status(500).json({ error: "Server misconfigured" }); return; }

  const { id } = req.params;

  const [
    { data: child },
    { data: files },
    { data: records },
    { data: appts },
  ] = await Promise.all([
    supabaseAdmin.from("child_profiles").select("*").eq("id", id).single(),
    supabaseAdmin.from("medical_files")
      .select("id, file_name, file_type, file_url, file_size_bytes, created_at")
      .eq("child_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabaseAdmin.from("medical_records")
      .select("id, record_type, title, created_at, doctors!medical_records_doctor_id_fkey(full_name)")
      .eq("child_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabaseAdmin.from("appointments")
      .select("id, scheduled_date, scheduled_time, status, consultation_type")
      .eq("child_id", id)
      .order("scheduled_date", { ascending: false })
      .limit(10),
  ]);

  if (!child) { res.status(404).json({ error: "Patient not found" }); return; }

  // Get parent info
  const { data: parentProfile } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, phone")
    .eq("id", child.parent_id)
    .single();
  const { data: { user: parentAuth } } = await supabaseAdmin.auth.admin.getUserById(child.parent_id);

  res.json({
    child,
    parent: { ...parentProfile, email: parentAuth?.email ?? null },
    files: files ?? [],
    records: records ?? [],
    appointments: appts ?? [],
  });
}

// ─── Medical notes ────────────────────────────────────────────────────────────

export async function listNotes(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) { res.status(500).json({ error: "Server misconfigured" }); return; }

  const { doctorId, childId, page = "1", limit = "50" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  let query = supabaseAdmin
    .from("medical_records")
    .select(`
      id, record_type, title, chief_complaint, diagnosis, treatment_plan,
      follow_up_date, follow_up_notes, outcome, created_at,
      doctors!medical_records_doctor_id_fkey(id, full_name),
      child_profiles!medical_records_child_id_fkey(id, first_name, last_name)
    `, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limitNum - 1);

  if (doctorId) query = query.eq("doctor_id", doctorId);
  if (childId) query = query.eq("child_id", childId);

  const { data, error, count } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ notes: data, total: count ?? 0, page: pageNum, limit: limitNum });
}

// ─── Email logs ───────────────────────────────────────────────────────────────

export async function listEmailLogs(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) { res.status(500).json({ error: "Server misconfigured" }); return; }

  const { status, email_type, page = "1", limit = "50" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  let query = supabaseAdmin
    .from("email_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limitNum - 1);

  if (status) query = query.eq("status", status);
  if (email_type) query = query.eq("email_type", email_type);

  const { data, error, count } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ emailLogs: data, total: count ?? 0, page: pageNum, limit: limitNum });
}

// ─── List all doctors (for dropdowns) ────────────────────────────────────────

export async function listDoctors(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) { res.status(500).json({ error: "Server misconfigured" }); return; }

  const { data, error } = await supabaseAdmin
    .from("doctors")
    .select(DOCTOR_FIELDS)
    .order("full_name");

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ doctors: data });
}
