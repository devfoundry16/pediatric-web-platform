import { supabaseAdmin } from "./supabase";
import { sendDueReminders } from "./reminder-notifications";
import { schedulersEnabled } from "./background-jobs";

/**
 * How often the pending window is re-checked. Anything up to the lead time
 * works — the window is a range, so a tick only has to land inside it once.
 */
const TICK_MS = 60_000;

let timer: NodeJS.Timeout | null = null;
let running = false;

/**
 * Start the reminder timer, on a host that has opted into background work.
 *
 * The timer only makes sense where the process stays running. The deployed API
 * is a Vercel serverless function, frozen between requests, so it never ran
 * there — GET /api/cron/reminders is what drives the sweep in production. What
 * did run it was every local `pnpm dev`, against the production database and
 * the live Resend key, which is how real parents received reminders pointing at
 * http://localhost:3333. Hence ENABLE_SCHEDULERS: opt in, never on by default.
 *
 * Two consequences worth knowing: reminders do not go out while the host is
 * down, and if it is ever run as more than one instance each copy will have its
 * own timer — the per-recipient dedupe in email_logs narrows that race but does
 * not close it.
 */
export function startReminderScheduler(): void {
  if (timer) return;

  if (!schedulersEnabled()) {
    console.warn("[reminders] Not started: ENABLE_SCHEDULERS is not true");
    return;
  }
  if (!supabaseAdmin) {
    console.warn("[reminders] Not started: Supabase is not configured");
    return;
  }
  if (!process.env.RESEND_API_KEY) {
    console.warn("[reminders] Not started: RESEND_API_KEY is not configured");
    return;
  }

  timer = setInterval(() => {
    // A slow run must not overlap the next tick and send twice.
    if (running) return;
    running = true;

    void sendDueReminders()
      .then((run) => {
        if (run.sent > 0 || run.failed > 0) {
          console.log(
            `[reminders] ${run.considered} due, ${run.sent} sent, ${run.failed} failed`
          );
        }
      })
      .catch((err) => {
        // sendDueReminders swallows its own errors; this is the backstop.
        console.error("[reminders] Run failed:", String(err));
      })
      .finally(() => {
        running = false;
      });
  }, TICK_MS);

  // Never hold the process open on this alone.
  timer.unref();

  console.log("[reminders] Scheduler started");
}

/** Stop the timer — for tests and graceful shutdown. */
export function stopReminderScheduler(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
