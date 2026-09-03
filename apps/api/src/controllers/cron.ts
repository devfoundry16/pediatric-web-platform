import type { Request, Response } from "express";
import { sendDueReminders } from "../lib/reminder-notifications";
import { sweepMissedCalendarEvents } from "../lib/google-calendar";
import { sweepAttendance } from "../lib/attendance";

/**
 * The scheduled half of the API.
 *
 * These handlers call exactly what the in-process timers call, so a serverless
 * deployment — which cannot hold a timer — gets the same work by being poked on
 * a schedule. Each sweep is safe to run more often than needed: reminders are
 * deduped per recipient in email_logs, the calendar sweep is a reconciler, and
 * the attendance sweep only ever fills in an outcome that is still NULL.
 *
 * The counts come back in the response so a failing schedule is visible in the
 * cron provider's own log without opening the database.
 */

// GET /api/cron/reminders
export async function runReminders(_req: Request, res: Response): Promise<void> {
  res.json(await sendDueReminders());
}

// GET /api/cron/calendar-sweep
export async function runCalendarSweep(_req: Request, res: Response): Promise<void> {
  res.json(await sweepMissedCalendarEvents());
}

// GET /api/cron/attendance-sweep
export async function runAttendanceSweep(_req: Request, res: Response): Promise<void> {
  res.json(await sweepAttendance());
}
