import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";

const CONSULTATION_DURATIONS: Record<string, number> = {
  quick: 15,
  standard: 30,
  extended: 45,
};

const BUFFER_MINUTES = 10;

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h < 12 ? "AM" : "PM";
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHour}:${m.toString().padStart(2, "0")} ${period}`;
}

export async function listDoctors(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("doctors")
    .select("id, full_name, specialty, bio, avatar_url")
    .eq("is_active", true)
    .order("full_name");

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ doctors: data });
}

export async function getDoctorSlots(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const { id } = req.params;
  const { date, type } = req.query;

  if (!date || !type) {
    res.status(400).json({ error: "date and type query parameters are required" });
    return;
  }

  const consultationType = type as string;
  const slotDuration = CONSULTATION_DURATIONS[consultationType];

  if (!slotDuration) {
    res.status(400).json({ error: "type must be quick, standard, or extended" });
    return;
  }

  // Interpret `date` as a calendar day (YYYY-MM-DD), not a UTC instant — matches
  // stored scheduled_date and doctor_schedules.day_of_week (0=Sun … 6=Sat).
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date).trim());
  if (!ymd) {
    res.status(400).json({ error: "Invalid date format" });
    return;
  }
  const dayOfWeek = new Date(
    Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]))
  ).getUTCDay();

  // Check if date is a holiday for this doctor
  const { data: holidays } = await supabaseAdmin
    .from("doctor_holidays")
    .select("id")
    .eq("doctor_id", id)
    .eq("holiday_date", date as string);

  if (holidays && holidays.length > 0) {
    res.json({ slots: [] });
    return;
  }

  // Get doctor's schedule for this day of week
  const { data: schedule, error: scheduleError } = await supabaseAdmin
    .from("doctor_schedules")
    .select("start_time, end_time")
    .eq("doctor_id", id)
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true)
    .single();

  if (scheduleError || !schedule) {
    // Doctor doesn't work on this day
    res.json({ slots: [] });
    return;
  }

  // Get already-booked slots for this doctor on this date
  const { data: booked } = await supabaseAdmin
    .from("appointments")
    .select("scheduled_time, duration_minutes")
    .eq("doctor_id", id)
    .eq("scheduled_date", date as string)
    .not("status", "in", '("cancelled","rescheduled")');

  const bookedRanges = (booked ?? []).map((appt) => {
    const start = timeToMinutes(appt.scheduled_time);
    return {
      start,
      end: start + appt.duration_minutes + BUFFER_MINUTES,
    };
  });

  // Generate available slots
  const startMinutes = timeToMinutes(schedule.start_time);
  const endMinutes = timeToMinutes(schedule.end_time);
  const slotStep = slotDuration + BUFFER_MINUTES;

  const slots: string[] = [];

  for (let t = startMinutes; t + slotDuration <= endMinutes; t += slotStep) {
    const slotEnd = t + slotDuration;

    const isBooked = bookedRanges.some(
      (range) => t < range.end && slotEnd > range.start
    );

    if (!isBooked) {
      slots.push(minutesToTime(t));
    }
  }

  res.json({ slots });
}
