/**
 * Timezone handling.
 *
 * Storage contract (see migration 018): `doctor_schedules.start_time/end_time`
 * and `appointments.scheduled_date/scheduled_time` are bare DATE/TIME columns
 * holding wall-clock values in the DOCTOR's timezone (`doctors.timezone`, or
 * `appointments.timezone` for an existing booking). They are not UTC and not
 * the viewer's local time.
 *
 * The API converts those to absolute instants (`startsAt`), so anything shown
 * to a viewer is formatted from an instant with an explicit `timeZone`. Never
 * format without one: the server prerenders client components, so an implicit
 * zone resolves to the SERVER's and flips on hydration.
 */

/** Clinic default, and the zone every pre-existing row is in. */
export const DEFAULT_TIMEZONE = "Asia/Dubai";

/** @deprecated Use {@link DEFAULT_TIMEZONE}. Kept for existing call sites. */
export const APPOINTMENT_TIMEZONE_IANA = DEFAULT_TIMEZONE;

/**
 * Selectable zones, grouped by region.
 *
 * Curated rather than the full ~400-entry `Intl.supportedValuesOf("timeZone")`
 * list: this covers every UTC offset and every plausible location for a Gulf
 * clinic's doctors and patients, and stays usable in a plain <select>. The
 * viewer's detected zone and the current value are always merged in
 * (see {@link buildTimezoneOptions}), so nothing is unreachable.
 */
export const TIMEZONE_GROUPS: { region: string; zones: string[] }[] = [
  {
    region: "Middle East",
    zones: [
      "Asia/Dubai",
      "Asia/Riyadh",
      "Asia/Qatar",
      "Asia/Kuwait",
      "Asia/Bahrain",
      "Asia/Muscat",
      "Asia/Baghdad",
      "Asia/Tehran",
      "Asia/Jerusalem",
      "Asia/Beirut",
      "Asia/Amman",
    ],
  },
  {
    region: "Africa",
    zones: ["Africa/Cairo", "Africa/Nairobi", "Africa/Lagos", "Africa/Johannesburg", "Africa/Casablanca"],
  },
  {
    region: "Asia",
    zones: [
      "Asia/Kabul",
      "Asia/Karachi",
      "Asia/Kolkata",
      "Asia/Colombo",
      "Asia/Kathmandu",
      "Asia/Dhaka",
      "Asia/Yangon",
      "Asia/Bangkok",
      "Asia/Jakarta",
      "Asia/Singapore",
      "Asia/Kuala_Lumpur",
      "Asia/Manila",
      "Asia/Hong_Kong",
      "Asia/Shanghai",
      "Asia/Seoul",
      "Asia/Tokyo",
    ],
  },
  {
    region: "Europe",
    zones: [
      "Europe/London",
      "Europe/Dublin",
      "Europe/Lisbon",
      "Europe/Madrid",
      "Europe/Paris",
      "Europe/Brussels",
      "Europe/Amsterdam",
      "Europe/Berlin",
      "Europe/Zurich",
      "Europe/Rome",
      "Europe/Stockholm",
      "Europe/Warsaw",
      "Europe/Athens",
      "Europe/Bucharest",
      "Europe/Kyiv",
      "Europe/Istanbul",
      "Europe/Moscow",
    ],
  },
  {
    region: "Americas",
    zones: [
      "America/St_Johns",
      "America/Halifax",
      "America/New_York",
      "America/Toronto",
      "America/Chicago",
      "America/Mexico_City",
      "America/Denver",
      "America/Phoenix",
      "America/Los_Angeles",
      "America/Vancouver",
      "America/Anchorage",
      "Pacific/Honolulu",
      "America/Bogota",
      "America/Lima",
      "America/Santiago",
      "America/Sao_Paulo",
      "America/Argentina/Buenos_Aires",
    ],
  },
  {
    region: "Oceania",
    zones: [
      "Australia/Perth",
      "Australia/Adelaide",
      "Australia/Brisbane",
      "Australia/Sydney",
      "Pacific/Auckland",
      "Pacific/Fiji",
    ],
  },
  {
    region: "Other",
    zones: ["UTC"],
  },
];

/**
 * Accepts anything Intl accepts, including non-canonical aliases
 * (`Asia/Calcutta` as well as `Asia/Kolkata`). Deliberately NOT a membership
 * test against `Intl.supportedValuesOf("timeZone")`, which returns only the
 * canonical IDs for the host's ICU version — browsers and Node disagree about
 * which spelling is canonical.
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

/**
 * The viewer's own timezone.
 *
 * CLIENT ONLY — on the server this resolves to the host's zone. Call it from an
 * effect (see `useViewerTimezone`), never during render.
 */
export function getSystemTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/** Short offset for a zone at a given instant, e.g. "GMT+4". */
export function getTimezoneOffsetLabel(tz: string, at: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(at);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

/**
 * Human label for a zone, e.g. "Dubai (GMT+4)". The live offset is what makes a
 * long list scannable — people match on the offset, not the city.
 */
export function formatTimezoneLabel(tz: string, at: Date = new Date()): string {
  const city = tz.split("/").pop()?.replace(/_/g, " ") ?? tz;
  const offset = getTimezoneOffsetLabel(tz, at);
  return offset ? `${city} (${offset})` : city;
}

export interface TimezoneOptionGroup {
  region: string;
  options: { value: string; label: string }[];
}

/**
 * Grouped options for a timezone picker, with `extra` zones (the viewer's
 * detected zone, the doctor's configured zone, the current value) merged in
 * under "Detected" so a zone outside the curated list is still selectable and
 * still renders with a label rather than blank.
 */
export function buildTimezoneOptions(extra: (string | undefined | null)[] = []): TimezoneOptionGroup[] {
  const at = new Date();
  const curated = new Set(TIMEZONE_GROUPS.flatMap((g) => g.zones));

  const pinned = Array.from(
    new Set(extra.filter((tz): tz is string => isValidTimezone(tz) && !curated.has(tz)))
  );

  const groups: TimezoneOptionGroup[] = TIMEZONE_GROUPS.map((g) => ({
    region: g.region,
    options: g.zones.map((tz) => ({ value: tz, label: formatTimezoneLabel(tz, at) })),
  }));

  if (pinned.length > 0) {
    groups.unshift({
      region: "Detected",
      options: pinned.map((tz) => ({ value: tz, label: formatTimezoneLabel(tz, at) })),
    });
  }

  return groups;
}

// ─── Formatting instants ──────────────────────────────────────────────────────

/** Time of day for an instant in `tz`, e.g. "9:00 AM". */
export function formatTimeInTimezone(iso: string | Date, tz: string, locale = "en-AE"): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
}

/** Calendar date for an instant in `tz`, e.g. "19 Aug 2026". */
export function formatDateInTimezone(iso: string | Date, tz: string, locale = "en-AE"): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: tz,
  });
}

/** Short date without the year, for the day-shift badge on slot chips. */
export function formatShortDateInTimezone(iso: string | Date, tz: string, locale = "en-AE"): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: tz });
}

/** Calendar day (YYYY-MM-DD) an instant falls on in `tz`. */
export function calendarDayInTimezone(iso: string | Date, tz: string): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const at = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${at("year")}-${at("month")}-${at("day")}`;
}

/**
 * Date + time for a stored appointment, rendered in `viewerTz`.
 *
 * `date`/`time` are the stored wall clock and `apptTz` the zone they belong to
 * (`appointments.timezone`). Falls back to echoing the stored values if the zone
 * is unusable, which is better than showing a wrong time confidently.
 */
export function formatStoredAppointment(
  date: string,
  time: string,
  apptTz: string,
  viewerTz: string,
  locale = "en-AE"
): { date: string; time: string } {
  const instant = wallClockToInstant(date, time, apptTz);
  if (isNaN(instant.getTime())) {
    return { date, time: time.slice(0, 5) };
  }
  return {
    date: formatDateInTimezone(instant, viewerTz, locale),
    time: formatTimeInTimezone(instant, viewerTz, locale),
  };
}

// ─── Wall clock → instant ─────────────────────────────────────────────────────
//
// Mirrors apps/api/src/lib/timezone.ts. Duplicated rather than shared because
// there is no shared runtime package (packages/ holds only ui, eslint-config and
// typescript-config). Keep the two in sync.

const DAY_MS = 24 * 60 * 60 * 1000;

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

  return (
    Date.UTC(at("year"), at("month") - 1, at("day"), at("hour"), at("minute"), at("second")) -
    instantMs
  );
}

/**
 * The absolute instant of a wall clock in `tz`.
 * `date` is YYYY-MM-DD; `time` is HH:MM or HH:MM:SS (24-hour).
 *
 * Ambiguous times (clocks went back) resolve to the first occurrence;
 * nonexistent ones (clocks went forward) shift forward past the gap.
 */
export function wallClockToInstant(date: string, time: string, tz: string): Date {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date).trim());
  const t = /^(\d{1,2}):(\d{2})/.exec(String(time).trim());
  if (!d || !t || !isValidTimezone(tz)) return new Date(NaN);

  const wallAsUTC = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));

  const offBefore = offsetMsAt(wallAsUTC - DAY_MS, tz);
  const offAfter = offsetMsAt(wallAsUTC + DAY_MS, tz);

  const early = wallAsUTC - offBefore;
  if (offsetMsAt(early, tz) === offBefore) return new Date(early);

  const late = wallAsUTC - offAfter;
  if (offsetMsAt(late, tz) === offAfter) return new Date(late);

  return new Date(early);
}

/** Calendar date (YYYY-MM-DD) currently in effect in `tz`. */
export function todayInTimezone(tz: string, now: Date = new Date()): string {
  return calendarDayInTimezone(now, tz);
}

// ─── Legacy Dubai-fixed helpers ───────────────────────────────────────────────

/**
 * Format a date for display (ISO timestamp or date string) in Dubai time.
 * Always pass `timeZone` so SSR (Node) and the browser produce identical strings
 * and avoid React hydration mismatches.
 */
export function formatDateDisplayDubai(iso: string): string {
  return formatDateInTimezone(iso, DEFAULT_TIMEZONE);
}

/** Long form with weekday — use same fixed timezone as SSR-safe display. */
export function formatHolidayDateDubai(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-AE", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: DEFAULT_TIMEZONE,
  });
}

/**
 * Calendar date as YYYY-MM-DD in the user's local timezone.
 * Do not use Date#toISOString().split("T")[0] for this — it converts to UTC and
 * shifts the calendar day for timezones ahead of UTC (e.g. UAE), breaking slot lookup.
 */
export function formatLocalDateYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as a local calendar day (for calendar UI / stored date strings). */
export function parseLocalYMD(s: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
