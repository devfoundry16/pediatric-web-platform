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
}

interface DailyTokenResponse {
  token: string;
}

/**
 * Create a Daily room for a group session.
 * @param sessionId - used as the room name prefix for uniqueness
 * @param expiryEpoch - Unix timestamp (seconds) when the room should expire
 */
export async function createRoom(
  sessionId: string,
  expiryEpoch: number
): Promise<{ name: string; url: string }> {
  const room = await dailyRequest<DailyRoomResponse>("/rooms", {
    method: "POST",
    body: JSON.stringify({
      name: `session-${sessionId}`,
      properties: {
        exp: expiryEpoch,
        enable_recording: "cloud",
        enable_chat: true,
        enable_knocking: false,
        start_video_off: false,
        start_audio_off: false,
      },
    }),
  });

  return { name: room.name, url: room.url };
}

/**
 * Create a meeting token for a participant joining a Daily room.
 * @param roomName - the Daily room name
 * @param userId - Supabase user ID (used as token user_id for tracking)
 * @param isOwner - if true, grants host privileges (mute others, end meeting)
 * @param expiryEpoch - Unix timestamp (seconds) when the token expires
 */
export async function createMeetingToken(
  roomName: string,
  userId: string,
  isOwner: boolean,
  expiryEpoch: number
): Promise<string> {
  const result = await dailyRequest<DailyTokenResponse>("/meeting-tokens", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_id: userId,
        is_owner: isOwner,
        exp: expiryEpoch,
        enable_recording: isOwner ? "cloud" : undefined,
      },
    }),
  });

  return result.token;
}
