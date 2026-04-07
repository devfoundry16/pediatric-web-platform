/**
 * All appointment slots and displayed times use Gulf Standard Time (UAE),
 * matching the service region and AED pricing.
 */
export const APPOINTMENT_TIMEZONE_IANA = "Asia/Dubai" as const;

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
