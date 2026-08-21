import {
  JOIN_CLOSES_MINUTES_AFTER,
  JOIN_OPENS_MINUTES_BEFORE,
} from "./appointment-window";

/**
 * When a live group session is joinable, in absolute time.
 *
 * Mirrors groupSessionJoinWindow in apps/api/src/lib/group-session-room.ts,
 * which uses the same window as 1:1 consultations. The API is the real gate —
 * it refuses a meeting token outside this window — so these values must stay
 * in step. They live here too because the pages have to decide what to show
 * without asking the server.
 *
 * scheduled_at is a TIMESTAMPTZ instant, unlike the appointment's wall-clock
 * date/time pair, so no wallClockToInstant is needed here.
 */

/** The fields any session-shaped row needs for this to work. */
interface SchedulableSession {
  scheduled_at: string;
  duration_minutes: number;
}

/**
 * The instant the session becomes joinable, or null if the stored schedule
 * cannot be read.
 */
export function sessionOpensAt(session: SchedulableSession): Date | null {
  const start = new Date(session.scheduled_at);
  if (isNaN(start.getTime())) return null;
  return new Date(start.getTime() - JOIN_OPENS_MINUTES_BEFORE * 60_000);
}

/** The instant the session's scheduled slot ends, or null if unreadable. */
export function sessionEndsAt(session: SchedulableSession): Date | null {
  const start = new Date(session.scheduled_at);
  if (isNaN(start.getTime())) return null;
  return new Date(start.getTime() + session.duration_minutes * 60_000);
}

/**
 * The instant the session stops being joinable — the scheduled end plus the
 * grace period — or null if the stored schedule cannot be read.
 */
export function sessionClosesAt(session: SchedulableSession): Date | null {
  const end = sessionEndsAt(session);
  if (!end) return null;
  return new Date(end.getTime() + JOIN_CLOSES_MINUTES_AFTER * 60_000);
}

/**
 * Whether the join window has closed.
 *
 * An unreadable schedule counts as still open so the session stays visible
 * and actionable rather than disappearing silently (same convention as
 * appointment-window.ts) — the API still owns the real gate.
 */
export function sessionJoinClosed(
  session: SchedulableSession,
  now: number = Date.now()
): boolean {
  const closesAt = sessionClosesAt(session);
  if (!closesAt) return false;
  return now > closesAt.getTime();
}

/**
 * Whether the session's scheduled slot is over. Deliberately no grace period:
 * this is the registration cutoff, not the join gate. An unreadable schedule
 * counts as not finished, as above.
 */
export function sessionHasFinished(
  session: SchedulableSession,
  now: number = Date.now()
): boolean {
  const end = sessionEndsAt(session);
  if (!end) return false;
  return now > end.getTime();
}
