import { supabaseAdmin } from "./supabase";
import { createRoom, deleteRoom, getRoom, updateRoom } from "./daily";

/**
 * Owns the Daily room behind a live group session: when it exists, how long
 * it stays joinable, and when it goes away. Mirrors appointment-room.ts.
 *
 * Rooms used to be created only when the doctor pressed "Go live", which left
 * nothing to link to before the session started. Rooms are now created as
 * soon as a session is published, so that guard moves to an explicit join
 * window enforced both here (Daily nbf/exp) and at join time.
 */

/** Same window as 1:1 consultations (appointment-room.ts): opens 15 minutes
 *  before the session START, closes 30 minutes after the session END. */
const OPENS_MINUTES_BEFORE = 15;
const CLOSES_MINUTES_AFTER = 30;

/** Bare session id — matches rooms goLive used to create, so existing
 *  sessions keep their room. No collision: appointments use `appt-`. */
export function groupSessionRoomName(sessionId: string): string {
  return sessionId;
}

interface SchedulableSession {
  scheduled_at: string;
  duration_minutes: number;
}

export interface JoinWindow {
  start: Date;
  end: Date;
  opensAt: Date;
  closesAt: Date;
}

/**
 * The joinable window for a group session, in absolute time.
 *
 * scheduled_at is a TIMESTAMPTZ instant, unlike the appointment's wall-clock
 * date/time pair, so no wallClockToInstant is needed here.
 */
export function groupSessionJoinWindow(session: SchedulableSession): JoinWindow | null {
  const start = new Date(session.scheduled_at);
  if (isNaN(start.getTime())) return null;

  const end = new Date(start.getTime() + session.duration_minutes * 60_000);
  return {
    start,
    end,
    opensAt: new Date(start.getTime() - OPENS_MINUTES_BEFORE * 60_000),
    closesAt: new Date(end.getTime() + CLOSES_MINUTES_AFTER * 60_000),
  };
}

function toEpoch(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

/**
 * Make sure the session has a room whose window matches its schedule, and
 * return its URL. For a live session this only covers creating a room that's
 * missing — an existing room's window is left alone (see the live-session
 * guard below), so this is not safe to treat as "always re-syncs the window".
 *
 * Idempotent, and safe to call from every path that publishes or reschedules
 * a session as well as lazily at join time — which is what recovers sessions
 * created before rooms were created eagerly, and any session whose creation
 * call failed. Never throws: a video room is not worth failing a publish over.
 */
export async function ensureGroupSessionRoom(sessionId: string): Promise<string | null> {
  try {
    if (!supabaseAdmin) return null;

    const { data, error } = await supabaseAdmin
      .from("group_sessions")
      .select("id, status, scheduled_at, duration_minutes, daily_room_name, daily_room_url")
      .eq("id", sessionId)
      .single();

    if (error) {
      console.error(
        `[daily] Could not load group session ${sessionId}:`,
        error.message
      );
      return null;
    }
    if (!data) return null;
    // A cancelled or ended session should never gain a room.
    if (["cancelled", "ended"].includes(data.status as string)) return null;

    const window = groupSessionJoinWindow(data as SchedulableSession);
    if (!window) return null;

    const roomName = groupSessionRoomName(sessionId);
    const desired = { notBefore: toEpoch(window.opensAt), expiry: toEpoch(window.closesAt) };

    const existing = await getRoom(roomName);
    let url: string;

    if (!existing) {
      url = (await createRoom(roomName, desired)).url;
    } else {
      url = existing.url;
      // A live session's room may still carry a goLive-era window (nbf=now,
      // exp=now+duration+3600), which can be wider than the schedule window
      // computed here — e.g. a session that started late. Never reconcile it:
      // shrinking exp while participants are on the call would delete the
      // room out from under them. Once a live session has a room, its window
      // is left alone until the session ends.
      if (
        data.status !== "live" &&
        (existing.notBefore !== desired.notBefore || existing.expiry !== desired.expiry)
      ) {
        // A reschedule moves the session but leaves the room pointing at the
        // old slot, which would refuse entry at the new time.
        await updateRoom(roomName, desired);
      }
    }

    if (data.daily_room_name !== roomName || data.daily_room_url !== url) {
      const { error: storeError } = await supabaseAdmin
        .from("group_sessions")
        .update({ daily_room_name: roomName, daily_room_url: url })
        .eq("id", sessionId);
      // Still return the url — the room exists; the next call retries the write.
      if (storeError) {
        console.error(
          `[daily] Could not store room for group session ${sessionId}:`,
          storeError.message
        );
      }
    }
    return url;
  } catch (err) {
    console.error(`[daily] Could not ensure room for group session ${sessionId}:`, String(err));
    return null;
  }
}

/** Drop the room for a cancelled session so its link stops working immediately. */
export async function deleteGroupSessionRoom(sessionId: string): Promise<void> {
  try {
    if (!supabaseAdmin) return;
    await deleteRoom(groupSessionRoomName(sessionId));
    const { error } = await supabaseAdmin
      .from("group_sessions")
      .update({ daily_room_name: null, daily_room_url: null })
      .eq("id", sessionId);
    if (error) {
      console.error(
        `[daily] Could not clear room columns for group session ${sessionId}:`,
        error.message
      );
    }
  } catch (err) {
    console.error(`[daily] Could not delete room for group session ${sessionId}:`, String(err));
  }
}
