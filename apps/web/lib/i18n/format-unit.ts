/**
 * Numbers with units, through Intl so each language gets its own plural forms
 * (Arabic has singular, dual and plural: سنة / سنتان / 3 سنوات) without a
 * dictionary key per form. Pass `dateLocale` from useI18n().
 */

type Unit = "year" | "month" | "day" | "minute" | "second" | "byte" | "kilobyte" | "megabyte";

export function formatUnit(
  locale: string,
  value: number,
  unit: Unit,
  unitDisplay: "long" | "short" = "long",
  maximumFractionDigits = 0
): string {
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit,
    unitDisplay,
    maximumFractionDigits,
  }).format(value);
}

export function formatFileSize(locale: string, bytes: number): string {
  if (bytes < 1024) return formatUnit(locale, bytes, "byte", "short");
  if (bytes < 1024 * 1024) return formatUnit(locale, bytes / 1024, "kilobyte", "short");
  return formatUnit(locale, bytes / (1024 * 1024), "megabyte", "short", 1);
}

/** A lesson or video length, e.g. "5 min 30 sec". */
export function formatDurationSeconds(locale: string, totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (minutes > 0) parts.push(formatUnit(locale, minutes, "minute", "short"));
  if (seconds > 0 || minutes === 0) parts.push(formatUnit(locale, seconds, "second", "short"));
  return parts.join(" ");
}
