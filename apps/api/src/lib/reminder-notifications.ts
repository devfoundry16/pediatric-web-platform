import { supabaseAdmin } from "./supabase";
import { alreadySent, recordEmailFailure, sendSessionReminder } from "./resend";
import type { Recipient } from "./recipients";
import {
  DEFAULT_TIMEZONE,
  formatDateInTimezone,
  formatTimeInTimezone,
  wallClockToInstant,
} from "./timezone";

/** How far ahead of the start a reminder goes out. */
export const LEAD_MINUTES = 10;

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export interface ReminderRun {
  considered: number;
  sent: number;
  failed: number;
}

function frontendUrl(): string {
  return process.env.FRONTEND_URL ?? "http://localhost:3333";
}

/**
 * Where the recipient opens it — the app, never a Daily room URL.
 *
 * Same reasoning as the booking notifications: rooms are private and entry
 * needs a per-user token minted for an authenticated request, so a room link in
 * an inbox either does nothing or, if rooms were opened up to make it work,
 * lets anyone holding the mail walk into a consultation.
 */
function sessionUrl(sessionId: string): string {
  return `${frontendUrl()}/live-sessions/${sessionId}`;
}

function appointmentUrl(audience: "parent" | "doctor", appointmentId: string): string {
  return `${frontendUrl()}/dashboard/${audience}/appointments?appointment=${appointmentId}`;
}

/** The parent's address lives in auth.users, which needs the admin API. */
async function parentRecipient(
  userId: string
): Promise<{ recipient: Recipient | null; name: string; reason?: string }> {
  if (!supabaseAdmin) return { recipient: null, name: "Parent", reason: "No database client" };

  const { data: authUser, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

  const name = profile?.full_name ?? "there";

  if (error || !authUser?.user?.email) {
    return {
      recipient: null,
      name,
      reason: error
        ? `Could not resolve parent address: ${error.message}`
        : "Parent auth user has no email address",
    };
  }

  return { recipient: { email: authUser.user.email, userId }, name };
}

/**
 * Send one reminder unless this recipient already had it for this record.
 *
 * The caller re-evaluates the same session every minute for the whole lead
 * window, so this check — not the schedule — is what makes it one email.
 */
async function sendOnce(
  params: Parameters<typeof sendSessionReminder>[0]
): Promise<boolean> {
  if (await alreadySent(params.relatedId, params.emailType, params.recipient.email)) {
    return false;
  }
  await sendSessionReminder(params);
  return true;
}

async function remindGroupSessions(now: Date, windowEnd: Date): Promise<ReminderRun> {
  const run: ReminderRun = { considered: 0, sent: 0, failed: 0 };
  if (!supabaseAdmin) return run;

  const { data: sessions, error } = await supabaseAdmin
    .from("group_sessions")
    .select(
      `id, title, scheduled_at, duration_minutes,
       doctors ( full_name, email ),
       session_registrations ( id, user_id, payment_status )`
    )
    .eq("status", "scheduled")
    .eq("is_published", true)
    .gte("scheduled_at", now.toISOString())
    .lte("scheduled_at", windowEnd.toISOString());

  if (error || !sessions) return run;

  for (const session of sessions) {
    run.considered += 1;

    const doctor = session.doctors as unknown as
      | { full_name: string; email: string | null }
      | null;
    const startsAt = new Date(session.scheduled_at);

    // group_sessions has no timezone column — scheduled_at is a real instant, so
    // it is rendered in the clinic's zone and labelled as such in the template.
    const shared = {
      emailType: "session_reminder" as const,
      relatedId: session.id,
      sessionTitle: session.title,
      scheduledDate: formatDateInTimezone(startsAt, DEFAULT_TIMEZONE),
      scheduledTime: formatTimeInTimezone(startsAt, DEFAULT_TIMEZONE),
      timezone: DEFAULT_TIMEZONE,
      durationMinutes: session.duration_minutes,
      startsIn: `in ${LEAD_MINUTES} minutes`,
      sessionUrl: sessionUrl(session.id),
    };

    const registrations = (session.session_registrations ?? []) as Array<{
      id: string;
      user_id: string;
      payment_status: string;
    }>;

    // Pending and refunded registrations hold no place — the join endpoint
    // refuses them, so reminding them would be an invitation to a 403.
    const confirmed = registrations.filter(
      (r) => r.payment_status === "free" || r.payment_status === "paid"
    );

    for (const registration of confirmed) {
      const { recipient, name, reason } = await parentRecipient(registration.user_id);

      if (!recipient) {
        run.failed += 1;
        await recordEmailFailure({
          emailType: "session_reminder",
          relatedId: session.id,
          recipientUserId: registration.user_id,
          reason: reason ?? "Parent address unavailable",
        });
        continue;
      }

      const sent = await sendOnce({
        ...shared,
        recipient,
        audience: "parent",
        recipientName: name,
        counterpartName: doctor?.full_name ?? "your doctor",
      });
      if (sent) run.sent += 1;
    }

    if (doctor?.email) {
      const sent = await sendOnce({
        ...shared,
        recipient: { email: doctor.email },
        audience: "doctor",
        recipientName: doctor.full_name,
        counterpartName: `${confirmed.length} registered participant(s)`,
      });
      if (sent) run.sent += 1;
    }
  }

  return run;
}

async function remindAppointments(now: Date, windowEnd: Date): Promise<ReminderRun> {
  const run: ReminderRun = { considered: 0, sent: 0, failed: 0 };
  if (!supabaseAdmin) return run;

  // scheduled_date/scheduled_time are a bare wall clock with a per-row zone, so
  // the instant cannot be compared in SQL. Narrow to the days the window could
  // possibly fall on — a day either side covers every zone from UTC-12 to
  // UTC+14 — and resolve each candidate below.
  const days = [now.getTime() - DAY_MS, now.getTime(), now.getTime() + DAY_MS].map(
    (ms) => new Date(ms).toISOString().slice(0, 10)
  );

  const { data: appointments, error } = await supabaseAdmin
    .from("appointments")
    .select(
      `id, parent_id, scheduled_date, scheduled_time, timezone, duration_minutes,
       consultation_type,
       child_profiles!appointments_child_id_fkey ( first_name, last_name ),
       doctors!appointments_doctor_id_fkey ( full_name, email )`
    )
    .eq("status", "confirmed")
    .in("scheduled_date", Array.from(new Set(days)));

  if (error || !appointments) return run;

  for (const appointment of appointments) {
    const timezone = appointment.timezone ?? DEFAULT_TIMEZONE;
    const startsAt = wallClockToInstant(
      appointment.scheduled_date,
      appointment.scheduled_time,
      timezone
    );

    if (isNaN(startsAt.getTime())) continue;
    if (startsAt < now || startsAt > windowEnd) continue;

    run.considered += 1;

    const doctor = appointment.doctors as unknown as
      | { full_name: string; email: string | null }
      | null;
    const child = appointment.child_profiles as unknown as
      | { first_name: string; last_name: string }
      | null;
    const childName = child ? `${child.first_name} ${child.last_name}` : "the patient";

    const shared = {
      emailType: "appointment_reminder" as const,
      relatedId: appointment.id,
      sessionTitle: `Your ${appointment.consultation_type} consultation`,
      // Echoed as stored, the way the confirmation email does, with the zone
      // they are wall-clock in stated beside them.
      scheduledDate: appointment.scheduled_date,
      scheduledTime: String(appointment.scheduled_time).slice(0, 5),
      timezone,
      durationMinutes: appointment.duration_minutes,
      startsIn: `in ${LEAD_MINUTES} minutes`,
    };

    const { recipient, name, reason } = await parentRecipient(appointment.parent_id);

    if (!recipient) {
      run.failed += 1;
      await recordEmailFailure({
        emailType: "appointment_reminder",
        relatedId: appointment.id,
        recipientUserId: appointment.parent_id,
        reason: reason ?? "Parent address unavailable",
      });
    } else {
      const sent = await sendOnce({
        ...shared,
        recipient,
        audience: "parent",
        recipientName: name,
        counterpartName: doctor?.full_name ?? "your doctor",
        sessionUrl: appointmentUrl("parent", appointment.id),
      });
      if (sent) run.sent += 1;
    }

    if (doctor?.email) {
      const sent = await sendOnce({
        ...shared,
        sessionTitle: `${appointment.consultation_type} consultation`,
        recipient: { email: doctor.email },
        audience: "doctor",
        recipientName: doctor.full_name,
        counterpartName: childName,
        sessionUrl: appointmentUrl("doctor", appointment.id),
      });
      if (sent) run.sent += 1;
    }
  }

  return run;
}

/**
 * Everything starting within the lead window that has not been reminded yet.
 *
 * The window is a range rather than one exact minute on purpose: a tick that is
 * late, or a process that restarts mid-window, still finds the session, and the
 * per-recipient dedupe keeps it to one email. Anything already under way is
 * skipped — a reminder that arrives after the start is worse than none.
 *
 * Never throws: this runs on a timer with nobody to catch it.
 */
export async function sendDueReminders(now: Date = new Date()): Promise<ReminderRun> {
  const total: ReminderRun = { considered: 0, sent: 0, failed: 0 };
  if (!supabaseAdmin) return total;

  const windowEnd = new Date(now.getTime() + LEAD_MINUTES * MINUTE_MS);

  for (const task of [remindGroupSessions, remindAppointments]) {
    try {
      const run = await task(now, windowEnd);
      total.considered += run.considered;
      total.sent += run.sent;
      total.failed += run.failed;
    } catch (err) {
      console.error(`[reminders] ${task.name} failed:`, String(err));
      total.failed += 1;
    }
  }

  return total;
}
