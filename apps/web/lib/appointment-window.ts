import { DEFAULT_TIMEZONE, wallClockToInstant } from "@/lib/timezone";

/**
 * When an appointment is joinable, in absolute time.
 *
 * Mirrors OPENS_MINUTES_BEFORE / CLOSES_MINUTES_AFTER in
 * apps/api/src/lib/appointment-room.ts. The API is the real gate — it refuses
 * a meeting token outside this window — so these values must stay in step.
 * They live here too because the dashboard has to decide what to show without
 * asking the server.
 */
export const JOIN_OPENS_MINUTES_BEFORE = 15;
export const JOIN_CLOSES_MINUTES_AFTER = 30;

/** The fields any appointment-shaped row needs for this to work. */
interface SchedulableAppointment {
  scheduled_date: string;
  scheduled_time: string;
  timezone?: string | null;
  duration_minutes: number;
  status: string;
}

const FINISHED_STATUSES = ["cancelled", "completed", "rescheduled"];

/**
 * The instant the appointment stops being joinable, or null if the stored
 * schedule cannot be read.
 *
 * Built from wallClockToInstant because scheduled_date/scheduled_time are bare
 * wall-clock values in the appointment's own zone. `new Date(scheduled_date)`
 * is not equivalent: it parses a bare date as UTC midnight, which lands on the
 * wrong side of "today" for any viewer behind UTC.
 */
export function appointmentClosesAt(appt: SchedulableAppointment): Date | null {
  const start = wallClockToInstant(
    appt.scheduled_date,
    appt.scheduled_time,
    appt.timezone || DEFAULT_TIMEZONE
  );
  if (isNaN(start.getTime())) return null;
  const end = start.getTime() + appt.duration_minutes * 60_000;
  return new Date(end + JOIN_CLOSES_MINUTES_AFTER * 60_000);
}

/**
 * Whether an appointment still belongs under "Upcoming".
 *
 * Deliberately tied to the join window rather than the calendar day: an
 * appointment that is still joinable must not be filed under "Past", which is
 * what happened when the split compared bare dates.
 */
export function isUpcomingAppointment(
  appt: SchedulableAppointment,
  now: number = Date.now()
): boolean {
  if (FINISHED_STATUSES.includes(appt.status)) return false;
  const closesAt = appointmentClosesAt(appt);
  // An unreadable schedule is treated as upcoming so the row stays visible
  // and actionable rather than disappearing into the past silently.
  if (!closesAt) return true;
  return now <= closesAt.getTime();
}

/** Sort key: the appointment's real start instant, not its calendar date. */
export function appointmentStartMs(appt: SchedulableAppointment): number {
  const start = wallClockToInstant(
    appt.scheduled_date,
    appt.scheduled_time,
    appt.timezone || DEFAULT_TIMEZONE
  );
  return isNaN(start.getTime()) ? Number.MAX_SAFE_INTEGER : start.getTime();
}
