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
 * having shown up, which is the right bias for a refund flow: it never accuses
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
 * Decide and record one appointment's outcome from its join events.
 *
 * The write is guarded on attendance_outcome still being NULL, so whichever
 * caller gets there first wins and the rest are no-ops -- the sweep and the
 * completion transition race by design, and either answer is the same answer.
 *
 * Never throws: this runs alongside a state transition that has already been
 * committed, and failing to classify must not fail the transition.
 *
 * @returns the outcome written, or null if it was already classified.
 */
export async function classifyAppointment(
  appointmentId: string
): Promise<AttendanceOutcome | null> {
  if (!supabaseAdmin) return null;

  try {
    const { data: events } = await supabaseAdmin
      .from("appointment_join_events")
      .select("role")
      .eq("appointment_id", appointmentId);

    const outcome = classifyAttendance(events ?? []);

    const { data: updated } = await supabaseAdmin
      .from("appointments")
      .update({ attendance_outcome: outcome })
      .eq("id", appointmentId)
      .is("attendance_outcome", null)
      .select("id");

    return updated && updated.length > 0 ? outcome : null;
  } catch (err) {
    console.error(`[attendance] could not classify appointment ${appointmentId}:`, err);
    return null;
  }
}

/**
 * Classify every appointment whose join window has closed.
 *
 * Runs on the same cron harness as the reminder and calendar sweeps, and is
 * safe to run more often than needed: it only ever fills in a NULL outcome, so
 * a re-run over the same rows is a no-op.
 *
 * Both `confirmed` and `completed` appointments are considered. `completed`
 * used to be excluded on the reasoning that a booking the doctor marked
 * complete plainly happened -- which was wrong, and quietly harmful: the doctor
 * is one of the two parties a claim can be made against, so letting their own
 * button decide whether the call happened let them void every claim, by
 * accident or otherwise. Join events decide attendance; the button does not.
 *
 * `cancelled` and `rescheduled` rows were never owed a call at all.
 */
export async function sweepAttendance(now: Date = new Date()): Promise<AttendanceRun> {
  const run: AttendanceRun = { considered: 0, classified: 0 };
  if (!supabaseAdmin) return run;

  // scheduled_date/scheduled_time are a bare wall clock with a per-row zone, so
  // "the window has closed" cannot be expressed in SQL; each candidate is
  // resolved below. A day into the future covers zones ahead of UTC whose
  // "today" has not started here yet.
  //
  // There is deliberately no lower bound. A seven-day floor used to sit here,
  // which quietly meant any appointment the sweep missed for a week -- the
  // feature shipping after the booking, a cron outage, a backlog longer than
  // one batch -- could never be classified at all, and its parent could never
  // claim. Ordering by date oldest-first with a bounded batch drains a backlog
  // over successive runs instead, and the partial index keeps the scan cheap
  // because classified rows are not in it.
  const to = new Date(now.getTime() + DAY_MS).toISOString().slice(0, 10);

  const { data: appointments, error } = await supabaseAdmin
    .from("appointments")
    .select("id, status, scheduled_date, scheduled_time, timezone, duration_minutes")
    .in("status", ["confirmed", "completed"])
    .is("attendance_outcome", null)
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

    // Unreadable schedule: nothing to judge against.
    if (!window) continue;

    // A `completed` row is the doctor declaring the consultation over, so its
    // attendance is already final and is judged now. A `confirmed` one may
    // still be walked into until the window shuts, and calling it missed
    // before then would be guessing.
    const isTerminal = appointment.status === "completed";
    if (!isTerminal && window.closesAt.getTime() > now.getTime()) continue;

    run.considered += 1;

    if (await classifyAppointment(appointment.id)) run.classified += 1;
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

/** Re-resolve an appointment's start instant. Exported for the refund flow. */
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
