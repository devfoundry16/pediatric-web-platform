import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "./supabase";
import { DEFAULT_TIMEZONE, wallClockToInstant } from "./timezone";
import { appointmentUrlFor, meetingUrlFor } from "./booking-notifications";
import { frontendUrl } from "./app-url";

/**
 * Mirrors confirmed appointments and published live sessions onto Google
 * Calendar, Calendly-style: the app is the source of truth and pushes
 * events out (insert/patch/delete), never reads back.
 *
 * Every connected calendar belongs to one user, and their role decides what
 * lands on it:
 *   Admin  — every booking on the platform.
 *   Doctor — the appointments and sessions they host.
 *   Parent — the appointments they booked and the sessions they registered for.
 *
 * Each recipient gets their OWN copy of the event, written directly into their
 * calendar. Events carry no attendees at all: nobody is invited to anyone
 * else's calendar, so no family's address is ever exposed to another. Someone
 * who has not connected a calendar simply gets nothing here — they still
 * receive the booking emails (see booking-notifications.ts).
 *
 * Events link to the app dashboards, never to a Daily room — same reasoning as
 * booking-notifications.ts: rooms are private, tokened, and do not exist until
 * the doctor starts the session. Each calendar shows only the dashboard link
 * its owner can actually open.
 *
 * Every sync function here is fire-and-forget: it never throws and never blocks
 * a booking. Each calendar write (or failure) is recorded in
 * calendar_event_logs, attributed to the account it targeted.
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

// openid+email so the callback can name the account that was connected without
// a second API call; calendar.events is the narrowest scope able to create and
// manage events on the user's primary calendar.
const OAUTH_SCOPE = "openid email https://www.googleapis.com/auth/calendar.events";

const STATE_TTL_MS = 10 * 60 * 1000;

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

function getOAuthConfig(): OAuthConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

export function isCalendarConfigured(): boolean {
  return getOAuthConfig() !== null;
}

// ─── OAuth state (CSRF) ───────────────────────────────────────────────────────
// The consent redirect returns to a PUBLIC callback with no Bearer token, so
// the state parameter is the only thing tying the callback to the user who
// clicked Connect. HMAC over {userId, target, issuedAt} with the existing
// JWT_SECRET — no new dependency; tampering and replay past the TTL fail closed.

function stateSecret(): string | null {
  return process.env.JWT_SECRET ?? null;
}

function hmac(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signState(userId: string): string | null {
  const secret = stateSecret();
  if (!secret) return null;
  const payload = Buffer.from(JSON.stringify({ u: userId, t: Date.now() })).toString("base64url");
  return `${payload}.${hmac(payload, secret)}`;
}

export function verifyState(state: unknown): { userId: string } | null {
  const secret = stateSecret();
  if (!secret || typeof state !== "string") return null;

  const dot = state.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = state.slice(0, dot);
  const signature = state.slice(dot + 1);

  const expected = Buffer.from(hmac(payload, secret));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      u?: string;
      t?: number;
    };
    if (typeof parsed.u !== "string" || typeof parsed.t !== "number") return null;
    if (Date.now() - parsed.t > STATE_TTL_MS) return null;
    return { userId: parsed.u };
  } catch {
    return null;
  }
}

// ─── OAuth flows ──────────────────────────────────────────────────────────────

export function buildAuthUrl(state: string): string | null {
  const config = getOAuthConfig();
  if (!config) return null;

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: OAUTH_SCOPE,
    // Both are required to receive a refresh token, and prompt=consent forces a
    // fresh one on reconnect (Google omits it after the first grant otherwise,
    // which would leave a reconnect with nothing to store).
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(
  code: string
): Promise<{ refreshToken: string | null; email: string | null }> {
  const config = getOAuthConfig();
  if (!config) throw new Error("Google Calendar OAuth is not configured");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google token exchange failed (${response.status}): ${body}`);
  }

  const tokens = (await response.json()) as { refresh_token?: string; id_token?: string };

  // The id_token came straight from Google's token endpoint over TLS, so the
  // email claim can be trusted without verifying the signature.
  let email: string | null = null;
  if (tokens.id_token) {
    try {
      const claims = JSON.parse(
        Buffer.from(tokens.id_token.split(".")[1], "base64url").toString()
      ) as { email?: string };
      email = claims.email ?? null;
    } catch {
      email = null;
    }
  }

  return { refreshToken: tokens.refresh_token ?? null, email };
}

// ─── Connected accounts ───────────────────────────────────────────────────────

interface AccountRow {
  id: string;
  /** Owner of the calendar. Their role decides what gets mirrored onto it. */
  user_id: string;
  google_email: string;
  refresh_token: string;
  status: "connected" | "error";
  last_error: string | null;
  connected_at: string;
}

/** Account details safe to hand to a client — never includes the token. */
export type PublicAccount = Omit<AccountRow, "refresh_token">;

const ACCOUNT_FIELDS = "id, user_id, google_email, refresh_token, status, last_error, connected_at";

function toPublic(row: AccountRow): PublicAccount {
  const { refresh_token: _token, ...rest } = row;
  return rest;
}

async function fetchUserAccount(userId: string): Promise<AccountRow | null> {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from("google_calendar_accounts")
    .select(ACCOUNT_FIELDS)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as AccountRow | null) ?? null;
}

/**
 * Connected calendars of every active admin. Admins mirror every booking, so
 * this is folded into the target list for each sync.
 */
async function connectedAdminAccounts(): Promise<AccountRow[]> {
  if (!supabaseAdmin) return [];
  const { data: admins } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("is_active", true);

  const ids = (admins ?? []).map((a) => a.id as string);
  if (ids.length === 0) return [];

  const { data } = await supabaseAdmin
    .from("google_calendar_accounts")
    .select(ACCOUNT_FIELDS)
    .in("user_id", ids)
    .eq("status", "connected");
  return (data as AccountRow[] | null) ?? [];
}

export async function getAccountForUser(userId: string): Promise<PublicAccount | null> {
  const row = await fetchUserAccount(userId);
  return row ? toPublic(row) : null;
}

/** Every connected account, for the admin overview. Tokens are stripped. */
export async function listAccounts(): Promise<PublicAccount[]> {
  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin
    .from("google_calendar_accounts")
    .select(ACCOUNT_FIELDS)
    .order("connected_at", { ascending: false });
  return ((data as AccountRow[] | null) ?? []).map(toPublic);
}

/**
 * Store a freshly granted account, replacing any previous grant for the same
 * owner. `userId` null saves the clinic account.
 */
export async function saveAccount(params: {
  userId: string;
  email: string;
  refreshToken: string;
}): Promise<void> {
  if (!supabaseAdmin) throw new Error("Supabase is not configured");

  const existing = await fetchUserAccount(params.userId);

  if (existing) {
    const { error } = await supabaseAdmin
      .from("google_calendar_accounts")
      .update({
        google_email: params.email,
        refresh_token: params.refreshToken,
        status: "connected",
        last_error: null,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    evictToken(existing.id);
    return;
  }

  const { error } = await supabaseAdmin.from("google_calendar_accounts").insert({
    user_id: params.userId,
    connected_by: params.userId,
    google_email: params.email,
    refresh_token: params.refreshToken,
    status: "connected",
    last_error: null,
  });
  if (error) throw new Error(error.message);
}

/**
 * Revoke and forget an account. Mirror rows cascade away with it, so a later
 * reconnect starts clean rather than trying to patch events that the user may
 * have deleted in the meantime.
 */
export async function disconnectAccount(params: { userId: string }): Promise<void> {
  if (!supabaseAdmin) return;
  const row = await fetchUserAccount(params.userId);
  if (!row) return;

  // Best effort: a failed revoke still leaves the token deleted on our side.
  await fetch(REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: row.refresh_token }),
  }).catch(() => {});

  await supabaseAdmin.from("google_calendar_accounts").delete().eq("id", row.id);
  evictToken(row.id);
}

// ─── Access tokens (per account) ──────────────────────────────────────────────

const tokenCache = new Map<string, { accessToken: string; expiresAt: number }>();
// A burst of concurrent syncs on one account must share a single refresh call.
const refreshInFlight = new Map<string, Promise<string | null>>();

function evictToken(accountId: string): void {
  tokenCache.delete(accountId);
  refreshInFlight.delete(accountId);
}

async function markAccountError(accountId: string, reason: string): Promise<void> {
  if (!supabaseAdmin) return;
  await supabaseAdmin
    .from("google_calendar_accounts")
    .update({ status: "error", last_error: reason, updated_at: new Date().toISOString() })
    .eq("id", accountId);
  evictToken(accountId);
}

async function refreshAccessToken(account: AccountRow): Promise<string | null> {
  const config = getOAuthConfig();
  if (!config || !supabaseAdmin) return null;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: account.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    // invalid_grant means the grant itself is dead (revoked by the user, or
    // expired under a Testing-mode consent screen). Only a reconnect fixes it,
    // so surface it on the account instead of failing silently on every sync.
    if (response.status === 400 && body.includes("invalid_grant")) {
      await markAccountError(
        account.id,
        "Google refused the stored refresh token (invalid_grant). Reconnect this Google account."
      );
    }
    throw new Error(`Google token refresh failed (${response.status}): ${body}`);
  }

  const tokens = (await response.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };

  // Google occasionally rotates the refresh token; dropping the new one would
  // strand this account at the old token's expiry.
  if (tokens.refresh_token && tokens.refresh_token !== account.refresh_token) {
    await supabaseAdmin
      .from("google_calendar_accounts")
      .update({ refresh_token: tokens.refresh_token, updated_at: new Date().toISOString() })
      .eq("id", account.id);
  }

  tokenCache.set(account.id, {
    accessToken: tokens.access_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  });
  return tokens.access_token;
}

async function getAccessToken(account: AccountRow): Promise<string | null> {
  const cached = tokenCache.get(account.id);
  if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.accessToken;

  let inFlight = refreshInFlight.get(account.id);
  if (!inFlight) {
    inFlight = refreshAccessToken(account).finally(() => refreshInFlight.delete(account.id));
    refreshInFlight.set(account.id, inFlight);
  }
  return inFlight;
}

// ─── Calendar API ─────────────────────────────────────────────────────────────

interface EventDateTime {
  dateTime: string;
  timeZone: string;
}

interface EventAttendee {
  email: string;
  responseStatus?: string;
  organizer?: boolean;
  self?: boolean;
  [key: string]: unknown;
}

interface CalendarEvent {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  start?: EventDateTime;
  end?: EventDateTime;
  attendees?: EventAttendee[];
  guestsCanInviteOthers?: boolean;
  guestsCanModify?: boolean;
  guestsCanSeeOtherGuests?: boolean;
  reminders?: { useDefault: boolean };
}

interface CalendarResponse {
  status: number;
  body: CalendarEvent | null;
  errorText: string | null;
}

async function calendarRequest(
  account: AccountRow,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: CalendarEvent
): Promise<CalendarResponse> {
  // A dead grant must not abort the whole sync: one person's revoked access
  // would otherwise stop everyone else on the booking from getting their copy.
  // Turn it into a failed response so the caller logs it and moves on.
  let accessToken: string | null;
  try {
    accessToken = await getAccessToken(account);
  } catch (err) {
    return { status: 0, body: null, errorText: String(err) };
  }
  if (!accessToken) {
    return { status: 0, body: null, errorText: "No Google access token available" };
  }

  // sendUpdates=all makes Google email attendees about creations, changes and
  // cancellations — that email IS the delivery mechanism for anyone who has not
  // connected their own calendar.
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`${EVENTS_URL}${path}${separator}sendUpdates=all`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (response.status === 204) return { status: 204, body: null, errorText: null };
  if (!response.ok) {
    return { status: response.status, body: null, errorText: await response.text() };
  }
  return {
    status: response.status,
    body: (await response.json()) as CalendarEvent,
    errorText: null,
  };
}

// ─── Deterministic event ids ──────────────────────────────────────────────────
// Google event ids must be base32hex ([a-v0-9]); uuid hex and these prefixes
// qualify. Deriving the id from the row uuid makes creation idempotent across
// the Stripe-webhook / verify-fallback race: the loser gets a 409 and converges
// by PATCH instead of duplicating. Ids need only be unique PER calendar, so the
// same id is reused across every connected calendar.

export function appointmentEventId(appointmentId: string): string {
  return `appt${appointmentId.replace(/-/g, "").toLowerCase()}`;
}

export function groupSessionEventId(sessionId: string): string {
  return `gsess${sessionId.replace(/-/g, "").toLowerCase()}`;
}

// ─── Logging (mirrors email_logs) ─────────────────────────────────────────────

type CalendarAction = "create" | "update" | "delete";
type RelatedType = "appointment" | "group_session";

async function logCalendar(entry: {
  action: CalendarAction;
  related_type: RelatedType;
  related_id: string;
  account_id?: string | null;
  google_event_id?: string | null;
  status: "sent" | "failed";
  error_message?: string | null;
}): Promise<void> {
  if (!supabaseAdmin) return;
  await supabaseAdmin.from("calendar_event_logs").insert(entry);
}

// ─── Event mirrors ────────────────────────────────────────────────────────────

async function storeMirror(
  accountId: string,
  relatedType: RelatedType,
  relatedId: string,
  googleEventId: string
): Promise<void> {
  if (!supabaseAdmin) return;
  await supabaseAdmin.from("calendar_event_mirrors").upsert(
    {
      account_id: accountId,
      related_type: relatedType,
      related_id: relatedId,
      google_event_id: googleEventId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "account_id,related_type,related_id" }
  );
}

async function deleteMirror(
  accountId: string,
  relatedType: RelatedType,
  relatedId: string
): Promise<void> {
  if (!supabaseAdmin) return;
  await supabaseAdmin
    .from("calendar_event_mirrors")
    .delete()
    .eq("account_id", accountId)
    .eq("related_type", relatedType)
    .eq("related_id", relatedId);
}

async function mirroredAccountIds(
  relatedType: RelatedType,
  relatedId: string
): Promise<string[]> {
  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin
    .from("calendar_event_mirrors")
    .select("account_id")
    .eq("related_type", relatedType)
    .eq("related_id", relatedId);
  return ((data as Array<{ account_id: string }> | null) ?? []).map((r) => r.account_id);
}

// ─── Desired event construction ───────────────────────────────────────────────

function instantToEventTime(instant: Date, timeZone: string): EventDateTime {
  return { dateTime: instant.toISOString(), timeZone };
}

function attendeeEmails(event: CalendarEvent): Set<string> {
  return new Set(
    (event.attendees ?? [])
      .filter((a) => !a.organizer && !a.self)
      .map((a) => a.email.toLowerCase())
  );
}

function sameInstant(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const pa = Date.parse(a);
  const pb = Date.parse(b);
  return !isNaN(pa) && pa === pb;
}

function eventMatches(existing: CalendarEvent, desired: CalendarEvent): boolean {
  if (existing.status === "cancelled") return false;
  if ((existing.summary ?? "") !== (desired.summary ?? "")) return false;
  if ((existing.description ?? "") !== (desired.description ?? "")) return false;
  if (!sameInstant(existing.start?.dateTime, desired.start?.dateTime)) return false;
  if (!sameInstant(existing.end?.dateTime, desired.end?.dateTime)) return false;

  const have = attendeeEmails(existing);
  const want = attendeeEmails(desired);
  if (have.size !== want.size) return false;
  for (const email of want) if (!have.has(email)) return false;
  return true;
}

// ─── Upsert / delete primitives ───────────────────────────────────────────────

interface SyncTarget {
  account: AccountRow;
  relatedType: RelatedType;
  relatedId: string;
  eventId: string;
}

async function upsertEvent(target: SyncTarget, desired: CalendarEvent): Promise<void> {
  const { account, relatedType, relatedId, eventId } = target;
  const existing = await calendarRequest(account, "GET", `/${eventId}`);

  if (existing.status === 200 && existing.body) {
    // Reloads of the verify/success pages re-run the sync; a no-change PATCH
    // would still make Google re-notify every attendee, so diff first.
    if (eventMatches(existing.body, desired)) {
      await storeMirror(account.id, relatedType, relatedId, eventId);
      return;
    }
    const patched = await calendarRequest(account, "PATCH", `/${eventId}`, {
      ...desired,
      // Also resurrects an event that was cancelled (booking cancelled, then
      // rescheduled back) — deleted Google events keep their id, and only a
      // status flip brings them back; re-inserting the id would 409.
      status: "confirmed",
    });
    await logCalendar({
      action: "update",
      related_type: relatedType,
      related_id: relatedId,
      account_id: account.id,
      google_event_id: eventId,
      status: patched.errorText ? "failed" : "sent",
      error_message: patched.errorText,
    });
    if (!patched.errorText) await storeMirror(account.id, relatedType, relatedId, eventId);
    return;
  }

  if (existing.status === 404 || existing.status === 410) {
    const inserted = await calendarRequest(account, "POST", "", { ...desired, id: eventId });

    // 409: created between our GET and POST (webhook/verify race) — converge
    // through PATCH rather than failing.
    if (inserted.status === 409) {
      const retry = await calendarRequest(account, "PATCH", `/${eventId}`, {
        ...desired,
        status: "confirmed",
      });
      await logCalendar({
        action: "create",
        related_type: relatedType,
        related_id: relatedId,
        account_id: account.id,
        google_event_id: eventId,
        status: retry.errorText ? "failed" : "sent",
        error_message: retry.errorText,
      });
      if (!retry.errorText) await storeMirror(account.id, relatedType, relatedId, eventId);
      return;
    }

    await logCalendar({
      action: "create",
      related_type: relatedType,
      related_id: relatedId,
      account_id: account.id,
      google_event_id: eventId,
      status: inserted.errorText ? "failed" : "sent",
      error_message: inserted.errorText,
    });
    if (!inserted.errorText) await storeMirror(account.id, relatedType, relatedId, eventId);
    return;
  }

  await logCalendar({
    action: "update",
    related_type: relatedType,
    related_id: relatedId,
    account_id: account.id,
    google_event_id: eventId,
    status: "failed",
    error_message: existing.errorText ?? `Unexpected Google response ${existing.status}`,
  });
}

async function deleteEvent(target: SyncTarget): Promise<void> {
  const { account, relatedType, relatedId, eventId } = target;
  const deleted = await calendarRequest(account, "DELETE", `/${eventId}`);

  // 404/410 mean there is nothing to delete (never created, or already gone) —
  // the desired state, not a failure, and not worth a log row.
  if (deleted.status === 404 || deleted.status === 410) {
    await deleteMirror(account.id, relatedType, relatedId);
    return;
  }

  await logCalendar({
    action: "delete",
    related_type: relatedType,
    related_id: relatedId,
    account_id: account.id,
    google_event_id: eventId,
    status: deleted.errorText ? "failed" : "sent",
    error_message: deleted.errorText,
  });
  if (!deleted.errorText) await deleteMirror(account.id, relatedType, relatedId);
}

// ─── Participant / account resolution ─────────────────────────────────────────

/** Which dashboard the recipient uses — decides which link their copy shows. */
type ParticipantRole = "parent" | "doctor" | "admin";

/** One calendar to write this booking to, and the link its owner can open. */
interface SyncRecipient {
  account: AccountRow;
  role: ParticipantRole;
}

/**
 * Everyone who should receive a copy of a booking: the participants who have
 * connected a calendar, plus every admin who has (admins mirror everything).
 *
 * Participants are given first so that an admin who is also the parent or the
 * doctor on a booking keeps the more specific role — and therefore the link
 * they will actually use.
 */
async function resolveRecipients(
  participants: Array<{ userId: string | null; role: ParticipantRole }>
): Promise<SyncRecipient[]> {
  const byAccountId = new Map<string, SyncRecipient>();

  for (const participant of participants) {
    if (!participant.userId) continue;
    const account = await fetchUserAccount(participant.userId);
    if (account && account.status === "connected" && !byAccountId.has(account.id)) {
      byAccountId.set(account.id, { account, role: participant.role });
    }
  }

  for (const account of await connectedAdminAccounts()) {
    if (!byAccountId.has(account.id)) {
      byAccountId.set(account.id, { account, role: "admin" });
    }
  }

  return [...byAccountId.values()];
}

/** Accounts that hold a mirror for this booking but are no longer a target. */
async function staleTargets(
  relatedType: RelatedType,
  relatedId: string,
  keepAccountIds: Set<string>
): Promise<AccountRow[]> {
  if (!supabaseAdmin) return [];
  const ids = (await mirroredAccountIds(relatedType, relatedId)).filter(
    (id) => !keepAccountIds.has(id)
  );
  if (ids.length === 0) return [];
  const { data } = await supabaseAdmin
    .from("google_calendar_accounts")
    .select(ACCOUNT_FIELDS)
    .in("id", ids);
  return (data as AccountRow[] | null) ?? [];
}

/** Every account currently holding a mirror for this booking. */
async function allMirroredAccounts(
  relatedType: RelatedType,
  relatedId: string
): Promise<AccountRow[]> {
  return staleTargets(relatedType, relatedId, new Set());
}

// ─── Appointment reconciler ───────────────────────────────────────────────────

interface AppointmentRow {
  id: string;
  parent_id: string;
  status: string;
  payment_status: string;
  scheduled_date: string;
  scheduled_time: string;
  timezone: string | null;
  duration_minutes: number;
  doctors: { full_name: string; email: string | null; profile_id: string | null } | null;
}

/**
 * Converge every connected calendar onto this appointment's current state.
 *
 * An event should exist iff the appointment is confirmed AND settled (paid or
 * package credit) — status alone is not enough, because reschedule force-sets
 * "confirmed" even on unpaid pending rows. Cancelled/refunded rows converge to
 * "no event"; completed rows are left as calendar history.
 *
 * Safe to call from anywhere, any number of times; never throws.
 */
export async function syncAppointmentCalendarEvent(appointmentId: string): Promise<void> {
  try {
    if (!supabaseAdmin || !isCalendarConfigured()) return;

    const { data } = await supabaseAdmin
      .from("appointments")
      .select(
        `id, parent_id, status, payment_status, scheduled_date, scheduled_time,
         timezone, duration_minutes,
         doctors!appointments_doctor_id_fkey ( full_name, email, profile_id )`
      )
      .eq("id", appointmentId)
      .single();

    const appt = data as unknown as AppointmentRow | null;
    if (!appt) return;

    const eventId = appointmentEventId(appt.id);
    const settled = ["paid", "package_credit"].includes(appt.payment_status);
    const shouldExist = appt.status === "confirmed" && settled;
    const shouldDelete =
      ["cancelled", "rescheduled"].includes(appt.status) || appt.payment_status === "refunded";

    if (shouldDelete) {
      for (const account of await allMirroredAccounts("appointment", appt.id)) {
        await deleteEvent({
          account,
          relatedType: "appointment",
          relatedId: appt.id,
          eventId,
        });
      }
      return;
    }
    if (!shouldExist) return; // pending / completed: leave the calendar alone

    const timezone = appt.timezone ?? DEFAULT_TIMEZONE;
    const start = wallClockToInstant(appt.scheduled_date, appt.scheduled_time, timezone);
    if (isNaN(start.getTime())) {
      await logCalendar({
        action: "create",
        related_type: "appointment",
        related_id: appt.id,
        status: "failed",
        error_message: `Unparseable schedule: ${appt.scheduled_date} ${appt.scheduled_time} (${timezone})`,
      });
      return;
    }
    const end = new Date(start.getTime() + appt.duration_minutes * 60_000);

    const recipients = await resolveRecipients([
      { userId: appt.parent_id, role: "parent" },
      { userId: appt.doctors?.profile_id ?? null, role: "doctor" },
    ]);

    const doctorName = appt.doctors?.full_name ?? "Your doctor";

    /**
     * Each copy shows only the link its owner can open — a parent has no access
     * to the doctor dashboard, and vice versa.
     */
    const describeFor = (role: ParticipantRole): string => {
      const action =
        role === "doctor"
          ? `Start the consultation from your dashboard:\n${appointmentUrlFor("doctor", appt.id)}`
          : role === "admin"
            ? `Open this booking in the admin dashboard:\n${appointmentUrlFor("admin", appt.id)}`
            : `Join from your dashboard:\n${appointmentUrlFor("parent", appt.id)}`;
      return [
        `Pediatric video consultation (${appt.duration_minutes} min).`,
        `Join the call:\n${meetingUrlFor(appt.id)}`,
        action,
        "The room opens 15 minutes before the appointment.",
      ].join("\n\n");
    };

    // PHI-minimal on purpose: no child name, no symptoms — calendars are shared
    // and synced surfaces. Details stay behind the dashboard links.
    const baseEvent: Omit<CalendarEvent, "description"> = {
      summary: `LittleCare – Consultation with ${doctorName}`,
      start: instantToEventTime(start, timezone),
      end: instantToEventTime(end, timezone),
      guestsCanInviteOthers: false,
      guestsCanModify: false,
      guestsCanSeeOtherGuests: false,
      reminders: { useDefault: true },
    };

    const keep = new Set<string>();

    // Every copy is private: no attendees, so no address is shared between a
    // family and anyone else. `attendees: []` is explicit so a copy created
    // before this rule loses the guests it used to carry.
    for (const { account, role } of recipients) {
      keep.add(account.id);
      try {
        await upsertEvent(
          { account, relatedType: "appointment", relatedId: appt.id, eventId },
          { ...baseEvent, description: describeFor(role), attendees: [] }
        );
      } catch (err) {
        // One calendar failing must not cost the others their copy.
        await logCalendar({
          action: "update",
          related_type: "appointment",
          related_id: appt.id,
          account_id: account.id,
          status: "failed",
          error_message: String(err),
        });
      }
    }

    // Someone disconnected, or stopped being a participant: clear their copy.
    for (const account of await staleTargets("appointment", appt.id, keep)) {
      await deleteEvent({ account, relatedType: "appointment", relatedId: appt.id, eventId });
    }
  } catch (err) {
    console.error(`[calendar] Appointment sync failed for ${appointmentId}:`, String(err));
    await logCalendar({
      action: "update",
      related_type: "appointment",
      related_id: appointmentId,
      status: "failed",
      error_message: String(err),
    }).catch(() => {});
  }
}

// ─── Group session reconciler ─────────────────────────────────────────────────

interface SessionRow {
  id: string;
  title: string;
  status: string;
  is_published: boolean;
  scheduled_at: string;
  duration_minutes: number;
  doctors: { full_name: string; email: string | null; profile_id: string | null; timezone: string | null } | null;
  session_registrations: Array<{ user_id: string; payment_status: string }>;
}

/**
 * Converge every connected calendar onto this live session's current state.
 * Registrants who connected their own calendar get a personal copy; the rest
 * are invited to the clinic event, with guestsCanSeeOtherGuests off so parents
 * never see each other's addresses. Unpublished drafts and cancelled sessions
 * converge to "no event"; ended sessions stay as history.
 */
export async function syncGroupSessionCalendarEvent(sessionId: string): Promise<void> {
  try {
    if (!supabaseAdmin || !isCalendarConfigured()) return;

    const { data } = await supabaseAdmin
      .from("group_sessions")
      .select(
        `id, title, status, is_published, scheduled_at, duration_minutes,
         doctors ( full_name, email, profile_id, timezone ),
         session_registrations ( user_id, payment_status )`
      )
      .eq("id", sessionId)
      .single();

    const session = data as unknown as SessionRow | null;
    if (!session) return;

    const eventId = groupSessionEventId(session.id);
    const shouldExist = session.is_published && ["scheduled", "live"].includes(session.status);

    if (session.status === "cancelled" || (!session.is_published && session.status !== "ended")) {
      for (const account of await allMirroredAccounts("group_session", session.id)) {
        await deleteEvent({
          account,
          relatedType: "group_session",
          relatedId: session.id,
          eventId,
        });
      }
      return;
    }
    if (!shouldExist) return; // ended: leave as history

    const start = new Date(session.scheduled_at);
    if (isNaN(start.getTime())) return;
    const end = new Date(start.getTime() + session.duration_minutes * 60_000);
    const timezone = session.doctors?.timezone ?? DEFAULT_TIMEZONE;

    const confirmed = (session.session_registrations ?? []).filter((r) =>
      ["free", "paid"].includes(r.payment_status)
    );
    const recipients = await resolveRecipients([
      // The host first, so a doctor who also registered keeps the host link.
      { userId: session.doctors?.profile_id ?? null, role: "doctor" },
      ...confirmed.map((r) => ({ userId: r.user_id, role: "parent" as const })),
    ]);

    const baseEvent: CalendarEvent = {
      summary: session.title,
      description:
        `Live group session with ${session.doctors?.full_name ?? "our doctor"}.\n\n` +
        `Session page (details and join):\n${frontendUrl()}/live-sessions/${session.id}`,
      start: instantToEventTime(start, timezone),
      end: instantToEventTime(end, timezone),
      guestsCanInviteOthers: false,
      guestsCanModify: false,
      guestsCanSeeOtherGuests: false,
      reminders: { useDefault: true },
    };

    const keep = new Set<string>();

    // Private copies only — registrants never see each other's addresses
    // because nobody is an attendee on anybody's event.
    for (const { account } of recipients) {
      keep.add(account.id);
      try {
        await upsertEvent(
          { account, relatedType: "group_session", relatedId: session.id, eventId },
          { ...baseEvent, attendees: [] }
        );
      } catch (err) {
        // One calendar failing must not cost the others their copy.
        await logCalendar({
          action: "update",
          related_type: "group_session",
          related_id: session.id,
          account_id: account.id,
          status: "failed",
          error_message: String(err),
        });
      }
    }

    // Unregistered, refunded or disconnected: drop their copy.
    for (const account of await staleTargets("group_session", session.id, keep)) {
      await deleteEvent({
        account,
        relatedType: "group_session",
        relatedId: session.id,
        eventId,
      });
    }
  } catch (err) {
    console.error(`[calendar] Session sync failed for ${sessionId}:`, String(err));
    await logCalendar({
      action: "update",
      related_type: "group_session",
      related_id: sessionId,
      status: "failed",
      error_message: String(err),
    }).catch(() => {});
  }
}

// ─── Self-healing sweep ───────────────────────────────────────────────────────

export interface SweepRun {
  considered: number;
  synced: number;
}

/**
 * Retry pass for bookings whose calendars are out of step — a booking made
 * while Google was unreachable, or one that predates a user connecting their
 * calendar. The inline syncs are fire-and-forget with no queue, so without this
 * a transient failure would never be repaired.
 *
 * Cheap approximation: re-sync upcoming bookings that have fewer mirror rows
 * than there are connected accounts involved. The reconcilers are idempotent
 * and diff before writing, so a redundant pass costs one GET per calendar and
 * notifies nobody.
 */
export async function sweepMissedCalendarEvents(): Promise<SweepRun> {
  const run: SweepRun = { considered: 0, synced: 0 };
  if (!supabaseAdmin || !isCalendarConfigured()) return run;

  const { data: accounts } = await supabaseAdmin
    .from("google_calendar_accounts")
    .select("id")
    .eq("status", "connected")
    .limit(1);
  if (!accounts || accounts.length === 0) return run;

  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);

  const { data: appointments } = await supabaseAdmin
    .from("appointments")
    .select("id")
    .eq("status", "confirmed")
    .in("payment_status", ["paid", "package_credit"])
    .gte("scheduled_date", today)
    .limit(25);

  const { data: sessions } = await supabaseAdmin
    .from("group_sessions")
    .select("id")
    .in("status", ["scheduled", "live"])
    .eq("is_published", true)
    .gte("scheduled_at", nowIso)
    .limit(25);

  for (const row of appointments ?? []) {
    run.considered += 1;
    await syncAppointmentCalendarEvent(row.id as string);
    run.synced += 1;
  }
  for (const row of sessions ?? []) {
    run.considered += 1;
    await syncGroupSessionCalendarEvent(row.id as string);
    run.synced += 1;
  }
  return run;
}

/**
 * Re-sync a user's upcoming bookings right after they connect or disconnect,
 * so their calendar fills in (or empties) immediately instead of waiting for
 * the sweep.
 */
export async function resyncUpcomingForUser(userId: string): Promise<void> {
  try {
    if (!supabaseAdmin || !isCalendarConfigured()) return;
    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);

    // Admins mirror every booking, so their backfill is the whole upcoming
    // schedule rather than the handful of rows they appear on.
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.role === "admin") {
      await sweepMissedCalendarEvents();
      return;
    }

    const { data: appointments } = await supabaseAdmin
      .from("appointments")
      .select("id")
      .eq("parent_id", userId)
      .eq("status", "confirmed")
      .gte("scheduled_date", today)
      .limit(50);

    for (const row of appointments ?? []) {
      await syncAppointmentCalendarEvent(row.id as string);
    }

    const { data: registrations } = await supabaseAdmin
      .from("session_registrations")
      .select("session_id")
      .eq("user_id", userId)
      .in("payment_status", ["free", "paid"])
      .limit(50);

    for (const sessionId of new Set(
      (registrations ?? []).map((r) => r.session_id as string)
    )) {
      await syncGroupSessionCalendarEvent(sessionId);
    }

    // Doctors: their own upcoming appointments and sessions.
    const { data: doctor } = await supabaseAdmin
      .from("doctors")
      .select("id")
      .eq("profile_id", userId)
      .maybeSingle();

    if (doctor) {
      const { data: docAppts } = await supabaseAdmin
        .from("appointments")
        .select("id")
        .eq("doctor_id", doctor.id)
        .eq("status", "confirmed")
        .gte("scheduled_date", today)
        .limit(50);
      for (const row of docAppts ?? []) {
        await syncAppointmentCalendarEvent(row.id as string);
      }

      const { data: docSessions } = await supabaseAdmin
        .from("group_sessions")
        .select("id")
        .eq("doctor_id", doctor.id)
        .in("status", ["scheduled", "live"])
        .gte("scheduled_at", nowIso)
        .limit(50);
      for (const row of docSessions ?? []) {
        await syncGroupSessionCalendarEvent(row.id as string);
      }
    }
  } catch (err) {
    console.error(`[calendar] Resync after connect failed for ${userId}:`, String(err));
  }
}
