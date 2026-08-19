import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import {
  DEFAULT_TIMEZONE,
  hhmmToMinutes,
  isValidTimezone,
  todayInTimezone,
} from "../lib/timezone";
import { syncAppointmentCalendarEvent } from "../lib/google-calendar";

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
  res.json({ appointments: data, total: count ?? 0, page: pageNum, limit: limitNum });
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

// ─── Payments ─────────────────────────────────────────────────────────────────

export async function listPayments(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) { res.status(500).json({ error: "Server misconfigured" }); return; }

  const { page = "1", limit = "50", status } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  let query = supabaseAdmin
    .from("appointments")
    .select(`
      id, price_aed, payment_status, payment_reference, created_at, scheduled_date,
      parent_id,
      doctors!appointments_doctor_id_fkey(full_name),
      child_profiles!appointments_child_id_fkey(first_name, last_name)
    `, { count: "exact" })
    .gt("price_aed", 0)
    .order("created_at", { ascending: false })
    .range(offset, offset + limitNum - 1);

  if (status) query = query.eq("payment_status", status);

  const { data, error, count } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ payments: data, total: count ?? 0, page: pageNum, limit: limitNum });
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
