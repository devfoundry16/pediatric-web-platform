const DAILY_API_URL = "https://api.daily.co/v1";

function getDailyApiKey(): string | null {
  return process.env.DAILY_API_KEY ?? null;
}

async function dailyRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const key = getDailyApiKey();
  if (!key) throw new Error("DAILY_API_KEY is not configured");

  const response = await fetch(`${DAILY_API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Daily API error ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}

interface DailyRoomResponse {
  name: string;
  url: string;
  id: string;
  config?: { nbf?: number; exp?: number };
}

interface DailyTokenResponse {
  token: string;
}

export interface DailyRoom {
  name: string;
  url: string;
  /** Start of the joinable window, if the room has one. */
  notBefore: number | null;
  /** End of the joinable window; Daily deletes the room after this. */
  expiry: number | null;
}

function toRoom(room: DailyRoomResponse): DailyRoom {
  return {
    name: room.name,
    url: room.url,
    notBefore: room.config?.nbf ?? null,
    expiry: room.config?.exp ?? null,
  };
}

interface RoomWindow {
  /** Unix seconds. Nobody may join before this. */
  notBefore: number;
  /** Unix seconds. Daily removes the room at this point. */
  expiry: number;
}

function roomProperties(window: RoomWindow) {
  return {
    // The window is what keeps a room booked days in advance from being a
    // lobby anyone can loiter in. Rooms used to be created only when the
    // doctor pressed Start, and their absence was the guard; now that a room
    // exists from booking time, nbf/exp take over that job.
    nbf: window.notBefore,
    exp: window.expiry,
    enable_recording: "cloud",
    enable_chat: true,
    enable_knocking: false,
    start_video_off: false,
    start_audio_off: false,
  };
}

/**
 * Create a Daily room for a booking.
 *
 * The room is PRIVATE so that possession of the URL alone does not grant
 * entry — every participant must present a server-minted meeting token (see
 * createMeetingToken). This is the core access control for 1:1 pediatric
 * consultations and paid group sessions: without it, anyone holding the URL
 * could join (PHI/privacy leak). It is also why links we email point at the
 * app rather than at Daily directly.
 *
 * @param roomName - the exact Daily room name (must match the room_name used
 *   when minting meeting tokens, otherwise Daily rejects the token)
 */
export async function createRoom(
  roomName: string,
  window: RoomWindow
): Promise<DailyRoom> {
  const room = await dailyRequest<DailyRoomResponse>("/rooms", {
    method: "POST",
    body: JSON.stringify({
      name: roomName,
      privacy: "private",
      properties: roomProperties(window),
    }),
  });

  return toRoom(room);
}

/** The room, or null when it does not exist (never created, or expired away). */
export async function getRoom(roomName: string): Promise<DailyRoom | null> {
  try {
    return toRoom(await dailyRequest<DailyRoomResponse>(`/rooms/${roomName}`));
  } catch (err) {
    if (String(err).includes("404")) return null;
    throw err;
  }
}

/** Move an existing room's joinable window — used when a booking is rescheduled. */
export async function updateRoom(roomName: string, window: RoomWindow): Promise<DailyRoom> {
  const room = await dailyRequest<DailyRoomResponse>(`/rooms/${roomName}`, {
    method: "POST",
    body: JSON.stringify({ properties: roomProperties(window) }),
  });
  return toRoom(room);
}

/** Remove a room outright — a cancelled booking should not stay joinable. */
export async function deleteRoom(roomName: string): Promise<void> {
  try {
    await dailyRequest(`/rooms/${roomName}`, { method: "DELETE" });
  } catch (err) {
    // Already gone is the desired state, not a failure.
    if (String(err).includes("404")) return;
    throw err;
  }
}

export interface MeetingTokenOptions {
  roomName: string;
  /** Supabase user id, for Daily-side participant tracking. */
  userId: string;
  /** Shown to everyone else in the call. Without it Daily labels them "Guest". */
  userName: string;
  /** Grants host privileges: mute others, end the meeting, record. */
  isOwner: boolean;
  /** Unix seconds. */
  expiryEpoch: number;
  /** Unix seconds; the token is refused before this. */
  notBeforeEpoch?: number;
}

/**
 * Mint a meeting token for one participant.
 *
 * Pass the result to daily-js `join({ url, token })` rather than appending it
 * to the room URL: Daily recommends it, and a token in the query string is
 * what breaks the hosted "leave" flow — on exit Daily reloads the room URL
 * without the token, and a private room with no token renders "the meeting you
 * are trying to join does not exist".
 */
export async function createMeetingToken(options: MeetingTokenOptions): Promise<string> {
  const result = await dailyRequest<DailyTokenResponse>("/meeting-tokens", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        room_name: options.roomName,
        user_id: options.userId,
        user_name: options.userName,
        is_owner: options.isOwner,
        exp: options.expiryEpoch,
        ...(options.notBeforeEpoch ? { nbf: options.notBeforeEpoch } : {}),
        enable_recording: options.isOwner ? "cloud" : undefined,
      },
    }),
  });

  return result.token;
}
