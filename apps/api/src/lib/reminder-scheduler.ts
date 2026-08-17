import { supabaseAdmin } from "./supabase";
import { sendDueReminders } from "./reminder-notifications";

/**
 * How often the pending window is re-checked. Anything up to the lead time
 * works — the window is a range, so a tick only has to land inside it once.
 */
const TICK_MS = 60_000;

let timer: NodeJS.Timeout | null = null;
let running = false;

/**
 * Start the reminder timer.
 *
 * This is the only scheduled work in the API; everything else sends mail inline
 * from the request that caused it. It lives in-process because the API is a
 * long-running server, which keeps the schedule next to the templates and needs
 * no infrastructure to hold it.
 *
 * Two consequences worth knowing: reminders do not go out while the API is
 * down, and if the API is ever run as more than one instance each copy will
 * have its own timer — the per-recipient dedupe in email_logs narrows that race
 * but does not close it.
 */
export function startReminderScheduler(): void {
  if (timer) return;

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
