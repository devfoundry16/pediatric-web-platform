import { supabaseAdmin } from "./supabase";
import { BUFFER_MINUTES, CONSULTATION_CONFIG, isBlockingAppointment } from "./consultation";
import {
  DEFAULT_TIMEZONE,
  hhmmToMinutes,
  minutesNowInTimezone,
  minutesToHHMM,
  todayInTimezone,
  wallClockToInstant,
} from "./timezone";

export interface Slot {
  /** Doctor-local calendar day, YYYY-MM-DD. */
  date: string;
  /** Doctor-local wall clock, "HH:MM". THIS is the canonical value to book. */
  time: string;
  /** The same moment as an absolute instant, for display in any timezone. */
  startsAt: string;
}

export interface SlotsResult {
  /** The doctor's IANA timezone — the zone `date`/`time` above are expressed in. */
  timezone: string;
  slots: Slot[];
}

/** A calendar day string, deliberately timezone-free. */
export function isValidYMD(date: unknown): date is string {
  return typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date.trim());
}

/**
 * The bookable slots for one doctor on one doctor-local calendar day.
 *
 * Returns an empty list (never an error) when the day is a holiday, falls
 * outside the doctor's working days, or is entirely in the past — those are
 * ordinary "nothing available" answers, not failures. Invalid inputs are the
 * caller's job to reject before calling.
 */
export async function generateSlots(
  doctorId: string,
  date: string,
  consultationType: string
): Promise<SlotsResult> {
  const slotDuration = CONSULTATION_CONFIG[consultationType]?.duration;

  const { data: doctor } = await supabaseAdmin!
    .from("doctors")
    .select("timezone")
    .eq("id", doctorId)
    .maybeSingle();

  const timezone = doctor?.timezone || DEFAULT_TIMEZONE;

  if (!slotDuration || !isValidYMD(date)) return { timezone, slots: [] };

  // Weekday comes from the calendar-date STRING via a UTC-anchored Date, so it
  // never picks up the server's timezone. This is correct for any doctor
  // timezone — `date` is already a doctor-local calendar day, and
  // doctor_schedules.day_of_week means "what weekday is this date".
  // Do not "fix" this to use the doctor's zone.
  const [y, m, d] = date.trim().split("-").map(Number);
  const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

  const { data: holidays } = await supabaseAdmin!
    .from("doctor_holidays")
    .select("id")
    .eq("doctor_id", doctorId)
    .eq("holiday_date", date);

  if (holidays && holidays.length > 0) return { timezone, slots: [] };

  const { data: schedule, error: scheduleError } = await supabaseAdmin!
    .from("doctor_schedules")
    .select("start_time, end_time")
    .eq("doctor_id", doctorId)
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true)
    .single();

  // Doctor doesn't work on this day.
  if (scheduleError || !schedule) return { timezone, slots: [] };

  const { data: booked } = await supabaseAdmin!
    .from("appointments")
    .select("scheduled_time, duration_minutes, status, payment_status, created_at")
    .eq("doctor_id", doctorId)
    .eq("scheduled_date", date)
    .not("status", "in", '("cancelled","rescheduled")');

  // Apply the same stale-pending rule booking uses. These used to disagree: the
  // grid hid slots held by an abandoned checkout that booking would have
  // happily accepted.
  const bookedRanges = (booked ?? [])
    .filter((appt) => isBlockingAppointment(appt))
    .map((appt) => {
      const start = hhmmToMinutes(appt.scheduled_time);
      return { start, end: start + appt.duration_minutes + BUFFER_MINUTES };
    });

  // Don't offer slots that have already passed. Previously every visitor was in
  // Dubai and this was merely untidy; with visitors worldwide, same-day booking
  // would otherwise advertise times that are hours gone for the doctor.
  const today = todayInTimezone(timezone);
  if (date < today) return { timezone, slots: [] };
  const earliestMinutes = date === today ? minutesNowInTimezone(timezone) : -1;

  const startMinutes = hhmmToMinutes(schedule.start_time);
  const endMinutes = hhmmToMinutes(schedule.end_time);
  const slotStep = slotDuration + BUFFER_MINUTES;

  const slots: Slot[] = [];

  for (let t = startMinutes; t + slotDuration <= endMinutes; t += slotStep) {
    if (t <= earliestMinutes) continue;

    const slotEnd = t + slotDuration;
    const isBooked = bookedRanges.some((range) => t < range.end && slotEnd > range.start);
    if (isBooked) continue;

    const time = minutesToHHMM(t);
    slots.push({
      date,
      time,
      startsAt: wallClockToInstant(date, time, timezone).toISOString(),
    });
  }

  return { timezone, slots };
}

/**
 * Whether `(date, time)` is a slot this doctor is actually offering.
 *
 * The client only ever echoes back a value the server produced, so this looks
 * redundant — but the booking UI now renders a *converted* time beside the
 * canonical one, and submitting the wrong one of the two would book a real,
 * paid appointment hours off with nothing to catch it: any "HH:MM" is a legal
 * TIME value, and the conflict check is exact-equality only.
 */
export async function isOfferedSlot(
  doctorId: string,
  date: string,
  time: string,
  consultationType: string
): Promise<boolean> {
  const { slots } = await generateSlots(doctorId, date, consultationType);
  const wanted = hhmmToMinutes(time);
  return slots.some((s) => hhmmToMinutes(s.time) === wanted);
}
