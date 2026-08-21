import { supabaseAdmin } from "./supabase";
import { isCalendarConfigured, sweepMissedCalendarEvents } from "./google-calendar";
import { schedulersEnabled } from "./background-jobs";

/**
 * How often to retry calendar events that should exist but don't (see
 * sweepMissedCalendarEvents). The inline syncs cover the normal case within a
 * request; this only has to catch what they dropped, so a slow cadence is fine.
 */
const TICK_MS = 5 * 60_000;

let timer: NodeJS.Timeout | null = null;
let running = false;

/**
 * Start the calendar retry sweep. Same in-process model as the reminder
 * scheduler, and gated the same way: only a host that stays running can hold a
 * timer, and only one that opts in should act on the production database. In
 * production GET /api/cron/calendar-sweep drives this instead.
 *
 * The same caveats apply: nothing runs while the host is down, and multiple
 * instances each get a timer — harmless here, because the sync is a reconciler
 * (deterministic event ids make concurrent runs converge).
 */
export function startCalendarSweep(): void {
  if (timer) return;

  if (!schedulersEnabled()) {
    console.warn("[calendar] Sweep not started: ENABLE_SCHEDULERS is not true");
    return;
  }
  if (!supabaseAdmin) {
    console.warn("[calendar] Sweep not started: Supabase is not configured");
    return;
  }
  if (!isCalendarConfigured()) {
    console.warn("[calendar] Sweep not started: Google Calendar env vars are not configured");
    return;
  }

  timer = setInterval(() => {
    // A slow run must not overlap the next tick.
    if (running) return;
    running = true;

    void sweepMissedCalendarEvents()
      .then((run) => {
        if (run.considered > 0) {
          console.log(`[calendar] Sweep retried ${run.considered} missing event(s)`);
        }
      })
      .catch((err) => {
        // sweepMissedCalendarEvents swallows its own errors; this is the backstop.
        console.error("[calendar] Sweep failed:", String(err));
      })
      .finally(() => {
        running = false;
      });
  }, TICK_MS);

  // Never hold the process open on this alone.
  timer.unref();

  console.log("[calendar] Sweep started");
}

/** Stop the timer — for tests and graceful shutdown. */
export function stopCalendarSweep(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
