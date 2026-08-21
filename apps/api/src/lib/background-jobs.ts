/**
 * Whether this process should run the in-process background timers.
 *
 * Off unless a host asks for it, because starting a timer on boot is not safe
 * by default. A developer running the API locally points at the production
 * database and holds the live Resend key, so the reminder sweep mailed real
 * parents and doctors on every `pnpm dev` — with localhost links, and recorded
 * as sent, which spent the single reminder each recipient gets.
 *
 * The deployed API is a Vercel serverless function: it is frozen between
 * requests and holds no timer, so setting this there would achieve nothing.
 * Production drives the same sweeps through the routes in routes/cron.ts.
 * Set ENABLE_SCHEDULERS=true only on a host that stays running.
 */
export function schedulersEnabled(): boolean {
  return process.env.ENABLE_SCHEDULERS === "true";
}
