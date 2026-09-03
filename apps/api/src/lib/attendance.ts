import { supabaseAdmin } from "./supabase";
import { appointmentJoinWindow } from "./appointment-room";
import { DEFAULT_TIMEZONE, wallClockToInstant } from "./timezone";

/**
 * Who turned up to a consultation.
 *
 * Nothing else in the product observes attendance: joinAppointment hands out a
 * Daily token and there are no Daily webhooks, so the only signal available is
 * that someone asked to be let in. That is what this records — intent to join,
 * not proven presence. Someone who opens the room and walks away counts as
 * having shown up, which is the right bias for a remedy flow: it never accuses
 * a participant of missing a call they demonstrably tried to attend.
 *
 * The classification exists so a refund request can be gated on a call that was
 * actually missed, rather than on the claimant's say-so.
 */

export type JoinRole = "parent" | "doctor";

export type AttendanceOutcome =
  | "both_joined"
  | "parent_only"
  | "doctor_only"
  | "neither";

/** How far back the sweep will reach to classify a backlog. */
const LOOKBACK_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Candidates examined per run, so one sweep cannot run unboundedly long. */
const BATCH_LIMIT = 200;

export interface AttendanceRun {
  considered: number;
  classified: number;
}

/**
 * Record that someone was authorised to enter a consultation room.
 *
 * Never throws: being unable to log attendance must not stop a patient or a
 * doctor from joining their call. A dropped row degrades to "did not join",
 * which the sweep may then read as a no-show — so this is awaited by its
 * caller rather than fired and forgotten, and failures are logged loudly.
 */
export async function recordJoinEvent(
  appointmentId: string,
  userId: string,
  role: JoinRole
): Promise<void> {
  if (!supabaseAdmin) return;

  const { error } = await supabaseAdmin.from("appointment_join_events").insert({
    appointment_id: appointmentId,
    user_id: userId,
    role,
  });

  if (error) {
    console.error(
      `[attendance] failed to record ${role} join for appointment ${appointmentId}:`,
      error.message
    );
  }
}

/** Reduce a set of join events to the outcome for one appointment. */
export function classifyAttendance(
  events: Array<{ role: string }>
): AttendanceOutcome {
  const parent = events.some((e) => e.role === "parent");
  const doctor = events.some((e) => e.role === "doctor");

  if (parent && doctor) return "both_joined";
  if (parent) return "parent_only";
  if (doctor) return "doctor_only";
  return "neither";
}

/**
 * Classify every appointment whose join window has closed.
 *
 * Runs on the same cron harness as the reminder and calendar sweeps, and is
 * safe to run more often than needed: it only ever fills in a NULL outcome, so
 * a re-run over the same rows is a no-op.
 *
 * Only `confirmed` appointments are considered. A booking the doctor marked
 * `completed` plainly happened, and `cancelled`/`rescheduled` rows were never
 * owed a call at all.
 */
export async function sweepAttendance(now: Date = new Date()): Promise<AttendanceRun> {
  const run: AttendanceRun = { considered: 0, classified: 0 };
  if (!supabaseAdmin) return run;

  // scheduled_date/scheduled_time are a bare wall clock with a per-row zone, so
  // "the window has closed" cannot be expressed in SQL. Narrow by date to a
  // range wide enough to drain a backlog, then resolve each candidate below.
  // A day into the future covers zones ahead of UTC whose "today" has not
  // started here yet.
  const from = new Date(now.getTime() - LOOKBACK_DAYS * DAY_MS)
    .toISOString()
    .slice(0, 10);
  const to = new Date(now.getTime() + DAY_MS).toISOString().slice(0, 10);

  const { data: appointments, error } = await supabaseAdmin
    .from("appointments")
    .select("id, scheduled_date, scheduled_time, timezone, duration_minutes")
    .eq("status", "confirmed")
    .is("attendance_outcome", null)
    .gte("scheduled_date", from)
    .lte("scheduled_date", to)
    .order("scheduled_date", { ascending: true })
    .limit(BATCH_LIMIT);

  if (error || !appointments) return run;

  for (const appointment of appointments) {
    const window = appointmentJoinWindow({
      scheduled_date: appointment.scheduled_date,
      scheduled_time: appointment.scheduled_time,
      timezone: appointment.timezone ?? DEFAULT_TIMEZONE,
      duration_minutes: appointment.duration_minutes,
    });

    // Unreadable schedule, or the call can still be joined: not yet decidable.
    if (!window) continue;
    if (window.closesAt.getTime() > now.getTime()) continue;

    run.considered += 1;

    const { data: events } = await supabaseAdmin
      .from("appointment_join_events")
      .select("role")
      .eq("appointment_id", appointment.id);

    const outcome = classifyAttendance(events ?? []);

    // Guarded on attendance_outcome still being NULL so two overlapping runs
    // cannot both claim the same row.
    const { data: updated } = await supabaseAdmin
      .from("appointments")
      .update({ attendance_outcome: outcome })
      .eq("id", appointment.id)
      .is("attendance_outcome", null)
      .select("id");

    if (updated && updated.length > 0) run.classified += 1;
  }

  return run;
}

/**
 * Whether an outcome means someone missed the call.
 *
 * NULL is not a miss — it means the window has not been swept yet, and must
 * never be read as "nobody came".
 */
export function isMissedOutcome(outcome: string | null | undefined): boolean {
  return (
    outcome === "parent_only" || outcome === "doctor_only" || outcome === "neither"
  );
}

/** Re-resolve an appointment's start instant. Exported for the remedy flow. */
export function appointmentStartsAt(appt: {
  scheduled_date: string;
  scheduled_time: string;
  timezone: string | null;
}): Date {
  return wallClockToInstant(
    appt.scheduled_date,
    appt.scheduled_time,
    appt.timezone || DEFAULT_TIMEZONE
  );
}
