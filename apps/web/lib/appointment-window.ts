import type { Dictionary } from "@/lib/i18n/get-dictionary";
import {
  DEFAULT_TIMEZONE,
  calendarDayInTimezone,
  formatShortDateInTimezone,
  formatTimeInTimezone,
  wallClockToInstant,
} from "@/lib/timezone";

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

/** The join-window explainer with the minute values filled in from the
 *  constants above, so the copy tracks the code. */
export function joinWindowHintText(t: Dictionary): string {
  return t.appointments.joinWindowHint
    .replace("{openMinutes}", String(JOIN_OPENS_MINUTES_BEFORE))
    .replace("{closeMinutes}", String(JOIN_CLOSES_MINUTES_AFTER));
}

/**
 * The filled-in "Join opens at {time}." line.
 *
 * Prefixed with a short date when the window opens on a different calendar
 * day than the start in `tz` — a time alone would read as the wrong day for
 * slots just after midnight, whose window opens the evening before.
 */
export function joinOpensAtLabel(
  t: Dictionary,
  opensAt: Date,
  startsAt: Date,
  tz: string,
  locale: string
): string {
  const time =
    calendarDayInTimezone(opensAt, tz) !== calendarDayInTimezone(startsAt, tz)
      ? `${formatShortDateInTimezone(opensAt, tz, locale)}, ${formatTimeInTimezone(opensAt, tz, locale)}`
      : formatTimeInTimezone(opensAt, tz, locale);
  return t.appointments.joinOpensAt.replace("{time}", time);
}

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
 * The instant the appointment becomes joinable, or null if the stored
 * schedule cannot be read.
 *
 * The counterpart to {@link appointmentClosesAt}; see it for why the start is
 * built from wallClockToInstant.
 */
export function appointmentOpensAt(appt: SchedulableAppointment): Date | null {
  const start = wallClockToInstant(
    appt.scheduled_date,
    appt.scheduled_time,
    appt.timezone || DEFAULT_TIMEZONE
  );
  if (isNaN(start.getTime())) return null;
  return new Date(start.getTime() - JOIN_OPENS_MINUTES_BEFORE * 60_000);
}

/**
 * Whether `opensAt` is still ahead — the case worth announcing next to a Join
 * button. The clock read lives here rather than in component bodies, which
 * the React Compiler's purity lint rejects.
 */
export function joinNotYetOpen(opensAt: Date, now: number = Date.now()): boolean {
  return now < opensAt.getTime();
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
