/**
 * Conversion between the wall-clock times stored in doctor_schedules /
 * appointments (bare DATE + TIME, no zone) and absolute instants.
 *
 * Deliberately dependency-free: apps/api has no date library, and the two
 * operations needed here — read a zone's UTC offset at an instant, and turn a
 * wall clock in a zone into an instant — are a few lines of Intl. Node ships
 * full ICU, so every IANA zone is available.
 */

export const DEFAULT_TIMEZONE = "Asia/Dubai";

/**
 * Accepts anything Intl accepts, which includes non-canonical aliases
 * (`Asia/Calcutta` as well as `Asia/Kolkata`). Deliberately NOT a membership
 * test against `Intl.supportedValuesOf("timeZone")`: that returns only the
 * canonical IDs for the host's ICU version, and browsers and Node disagree
 * about which spelling is canonical, so a zone a browser legitimately reports
 * can be missing from the server's list.
 */
export function isValidTimezone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length === 0) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Milliseconds to add to a UTC instant to get the wall clock in `tz`. */
function offsetMsAt(instantMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instantMs));

  const at = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);

  const asUTC = Date.UTC(
    at("year"),
    at("month") - 1,
    at("day"),
    at("hour"),
    at("minute"),
    at("second")
  );
  return asUTC - instantMs;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The absolute instant of a wall clock in `tz`.
 * `date` is YYYY-MM-DD; `time` is HH:MM or HH:MM:SS (24-hour).
 *
 * Returns an Invalid Date if either input is malformed.
 *
 * DST edges resolve the way Temporal's "compatible" disambiguation does:
 *   - ambiguous (clocks went back, the wall clock happens twice) → the FIRST
 *     occurrence, i.e. the pre-transition offset;
 *   - nonexistent (clocks went forward, the wall clock is skipped) → shifted
 *     FORWARD past the gap, so 02:30 on a spring-forward day becomes 03:30
 *     rather than silently rolling back an hour to 01:30.
 */
export function wallClockToInstant(date: string, time: string, tz: string): Date {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date).trim());
  const t = /^(\d{1,2}):(\d{2})/.exec(String(time).trim());
  if (!d || !t) return new Date(NaN);

  const wallAsUTC = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));

  // The offset must be sampled at the instant we're solving for, which we don't
  // know yet. Sample a day either side instead: transitions are months apart, so
  // these bracket any transition near the target without landing inside it.
  const offBefore = offsetMsAt(wallAsUTC - DAY_MS, tz);
  const offAfter = offsetMsAt(wallAsUTC + DAY_MS, tz);

  // A candidate is real only if the zone actually has that offset at it.
  const early = wallAsUTC - offBefore;
  if (offsetMsAt(early, tz) === offBefore) return new Date(early);

  const late = wallAsUTC - offAfter;
  if (offsetMsAt(late, tz) === offAfter) return new Date(late);

  // Neither is real: the wall clock falls in a spring-forward gap. `early` uses
  // the pre-transition offset, which lands just past the gap.
  return new Date(early);
}

/**
 * Calendar date of an instant in `tz`, e.g. "19 Aug 2026".
 *
 * Emails are rendered server-side with no idea where the recipient is, so
 * anything formatted with these must be labelled with the zone it is in — see
 * zoneLabel() in resend.ts.
 */
export function formatDateInTimezone(instant: Date, tz: string, locale = "en-AE"): string {
  if (isNaN(instant.getTime())) return "";
  return instant.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: tz,
  });
}

/** Time of day of an instant in `tz`, e.g. "9:00 AM". */
export function formatTimeInTimezone(instant: Date, tz: string, locale = "en-AE"): string {
  if (isNaN(instant.getTime())) return "";
  return instant.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
}

/** Calendar date (YYYY-MM-DD) currently in effect in `tz`. */
export function todayInTimezone(tz: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const at = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${at("year")}-${at("month")}-${at("day")}`;
}

/** Minutes since midnight currently in effect in `tz`. */
export function minutesNowInTimezone(tz: string, now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now);

  const at = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return at("hour") * 60 + at("minute");
}

/** "09:00" from minutes since midnight. Zero-padded 24-hour, never a display label. */
export function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Minutes since midnight from "HH:MM" / "HH:MM:SS". NaN if unparseable. */
export function hhmmToMinutes(time: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(time).trim());
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}
