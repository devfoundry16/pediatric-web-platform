import { supabaseAdmin } from "./supabase";
import { createRoom, deleteRoom, getRoom, updateRoom } from "./daily";
import { DEFAULT_TIMEZONE, wallClockToInstant } from "./timezone";

/**
 * Owns the Daily room behind an appointment: when it exists, how long it stays
 * joinable, and when it goes away.
 *
 * Rooms used to be created only when the doctor pressed "Start session", which
 * meant there was nothing to link to in a confirmation email, and the room's
 * absence was what stopped a parent walking in days early. Rooms are now
 * created as soon as a booking is confirmed, so that guard moves to an explicit
 * join window enforced both here (Daily nbf/exp) and in joinAppointment.
 */

/** How early someone may join, and how long the room lingers afterwards. */
const OPENS_MINUTES_BEFORE = 15;
const CLOSES_MINUTES_AFTER = 30;

export function appointmentRoomName(appointmentId: string): string {
  return `appt-${appointmentId}`;
}

interface SchedulableAppointment {
  scheduled_date: string;
  scheduled_time: string;
  timezone: string | null;
  duration_minutes: number;
}

export interface JoinWindow {
  start: Date;
  end: Date;
  opensAt: Date;
  closesAt: Date;
}

/**
 * The joinable window for an appointment, in absolute time.
 *
 * Built from wallClockToInstant because scheduled_date/scheduled_time are bare
 * wall-clock values in the appointment's own zone. Never `new Date(date+"T"+time)`
 * — that parses in the server's zone and skews the window by the offset.
 */
export function appointmentJoinWindow(appt: SchedulableAppointment): JoinWindow | null {
  const start = wallClockToInstant(
    appt.scheduled_date,
    appt.scheduled_time,
    appt.timezone || DEFAULT_TIMEZONE
  );
  if (isNaN(start.getTime())) return null;

  const end = new Date(start.getTime() + appt.duration_minutes * 60_000);
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
 * Make sure the appointment has a room whose window matches its schedule, and
 * return its URL.
 *
 * Idempotent, and safe to call from every path that confirms a booking as well
 * as lazily at join time — which is what recovers bookings made before rooms
 * were created eagerly, and any booking whose creation call failed. Never
 * throws: a video room is not worth failing a booking over.
 */
export async function ensureAppointmentRoom(appointmentId: string): Promise<string | null> {
  try {
    if (!supabaseAdmin) return null;

    const { data } = await supabaseAdmin
      .from("appointments")
      .select("id, status, scheduled_date, scheduled_time, timezone, duration_minutes, meeting_url")
      .eq("id", appointmentId)
      .single();

    if (!data) return null;
    // A cancelled booking should never gain a room.
    if (["cancelled", "rescheduled"].includes(data.status as string)) return null;

    const window = appointmentJoinWindow(data as SchedulableAppointment);
    if (!window) return null;

    const roomName = appointmentRoomName(appointmentId);
    const desired = { notBefore: toEpoch(window.opensAt), expiry: toEpoch(window.closesAt) };

    const existing = await getRoom(roomName);
    let url: string;

    if (!existing) {
      url = (await createRoom(roomName, desired)).url;
    } else {
      url = existing.url;
      // A reschedule moves the appointment but leaves the room pointing at the
      // old slot, which would refuse entry at the new time.
      if (existing.notBefore !== desired.notBefore || existing.expiry !== desired.expiry) {
        await updateRoom(roomName, desired);
      }
    }

    if (data.meeting_url !== url) {
      await supabaseAdmin.from("appointments").update({ meeting_url: url }).eq("id", appointmentId);
    }
    return url;
  } catch (err) {
    console.error(`[daily] Could not ensure room for appointment ${appointmentId}:`, String(err));
    return null;
  }
}

/** Drop the room for a cancelled booking so its link stops working immediately. */
export async function deleteAppointmentRoom(appointmentId: string): Promise<void> {
  try {
    if (!supabaseAdmin) return;
    await deleteRoom(appointmentRoomName(appointmentId));
    await supabaseAdmin
      .from("appointments")
      .update({ meeting_url: null })
      .eq("id", appointmentId);
  } catch (err) {
    console.error(`[daily] Could not delete room for appointment ${appointmentId}:`, String(err));
  }
}
