import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { createMeetingToken } from "../lib/daily";
import { syncGroupSessionCalendarEvent } from "../lib/google-calendar";
import {
  deleteGroupSessionRoom,
  ensureGroupSessionRoom,
  groupSessionJoinWindow,
  groupSessionRoomName,
} from "../lib/group-session-room";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const StripeLib: new (key: string) => StripeClient = require("stripe");

interface StripePrice {
  currency: string;
  unit_amount: number;
  product_data: { name: string; description?: string };
}
interface StripeLineItem {
  quantity: number;
  price_data: StripePrice;
}
interface StripeSessionCreate {
  mode: "payment";
  line_items: StripeLineItem[];
  metadata: Record<string, string>;
  success_url: string;
  cancel_url: string;
}
interface StripeCheckoutSessionResponse {
  id: string;
  payment_status: string;
  /** Persisted at fulfilment — refunds and disputes are matched on it, not on the session id. */
  payment_intent: string | null;
  metadata: Record<string, string> | null;
}
interface StripeClient {
  checkout: {
    sessions: {
      create(params: StripeSessionCreate): Promise<{ url: string | null }>;
      retrieve(id: string): Promise<StripeCheckoutSessionResponse>;
    };
  };
}

function getStripe(): StripeClient | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new StripeLib(key);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveDoctor(
  userId: string
): Promise<{ id: string } | null> {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from("doctors")
    .select("id")
    .eq("profile_id", userId)
    .single();
  return data ?? null;
}

/** Name shown to everyone else in the call; Daily labels a nameless token "Guest". */
async function resolveDisplayName(userId: string, fallback: string): Promise<string> {
  if (!supabaseAdmin) return fallback;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  return data?.full_name || fallback;
}

function participantCount(
  registrations: Array<{ payment_status: string }>
): number {
  return registrations.filter(
    (r) => r.payment_status === "free" || r.payment_status === "paid"
  ).length;
}

/**
 * Whether a session's slot has passed.
 *
 * Status alone does not say this: a session the doctor never started stays
 * 'scheduled' forever, so without the clock it would keep advertising itself as
 * upcoming and keep taking registrations long after the fact. The cutoff is the
 * scheduled END, so joining late while it is still running stays possible.
 */
function hasFinished(
  session: { scheduled_at: string; duration_minutes: number },
  now: number = Date.now()
): boolean {
  const endsAt =
    new Date(session.scheduled_at).getTime() + session.duration_minutes * 60_000;
  return Number.isFinite(endsAt) && now > endsAt;
}

// ─── Public ───────────────────────────────────────────────────────────────────

// GET /api/live-sessions
export async function listSessions(
  req: Request,
  res: Response
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const { filter } = req.query;

  let query = supabaseAdmin
    .from("group_sessions")
    .select(
      `id, title, description, scheduled_at, duration_minutes,
       max_participants, price_aed, is_free, status, daily_room_url,
       recording_url, is_published, created_at,
       doctors (id, full_name, specialty, avatar_url),
       session_registrations (payment_status)`
    )
    .eq("is_published", true)
    .neq("status", "cancelled");

  // A 'scheduled' session whose slot has already passed belongs in "past" even
  // though the doctor never ended it, so the split cannot be made in SQL —
  // scheduled_at + duration_minutes is not a column. Narrow by status here and
  // apply the clock below.
  if (filter === "past") {
    query = query.in("status", ["ended", "scheduled"]);
  } else if (filter === "upcoming") {
    query = query.in("status", ["scheduled", "live"]);
  }

  const { data, error } = await query.order("scheduled_at", { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const inWindow = (data ?? []).filter((s) => {
    if (filter === "past") return s.status === "ended" || hasFinished(s);
    if (filter === "upcoming") return s.status === "live" || !hasFinished(s);
    return true;
  });

  const sessions = inWindow.map((s) => {
    const regs = Array.isArray(s.session_registrations)
      ? (s.session_registrations as Array<{ payment_status: string }>)
      : [];
    return {
      ...s,
      session_registrations: undefined,
      // daily_room_url is only handed out to authenticated participants via the
      // /join endpoint (which also mints the required meeting token). Leaking it
      // on this public, unauthenticated list would let anyone join a live paid
      // session directly.
      daily_room_url: undefined,
      participant_count: participantCount(regs),
    };
  });

  res.json({ sessions });
}

// GET /api/live-sessions/:id
export async function getSession(
  req: Request,
  res: Response
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const { id } = req.params;

  const { data, error } = await supabaseAdmin
    .from("group_sessions")
    .select(
      `id, title, description, scheduled_at, duration_minutes,
       max_participants, price_aed, is_free, status, daily_room_url,
       recording_url, is_published, created_at,
       doctors (id, full_name, specialty, avatar_url),
       session_registrations (payment_status)`
    )
    .eq("id", id)
    .eq("is_published", true)
    .single();

  if (error || !data) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const regs = Array.isArray(data.session_registrations)
    ? (data.session_registrations as Array<{ payment_status: string }>)
    : [];

  res.json({
    session: {
      ...data,
      session_registrations: undefined,
      // daily_room_url is only provided to authenticated participants via /join
      daily_room_url: undefined,
      participant_count: participantCount(regs),
    },
  });
}

// ─── Doctor ───────────────────────────────────────────────────────────────────

// GET /api/live-sessions/doctor/mine
export async function getDoctorSessions(
  req: Request,
  res: Response
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const doctor = await resolveDoctor(req.userId!);
  if (!doctor) {
    res.status(404).json({ error: "No doctor profile found" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("group_sessions")
    .select(
      `id, title, description, scheduled_at, duration_minutes,
       max_participants, price_aed, is_free, status,
       daily_room_url, recording_url, is_published, created_at,
       session_registrations (payment_status)`
    )
    .eq("doctor_id", doctor.id)
    .order("scheduled_at", { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const sessions = (data ?? []).map((s) => {
    const regs = Array.isArray(s.session_registrations)
      ? (s.session_registrations as Array<{ payment_status: string }>)
      : [];
    return {
      ...s,
      session_registrations: undefined,
      participant_count: participantCount(regs),
    };
  });

  res.json({ sessions });
}

// POST /api/live-sessions
export async function createSession(
  req: Request,
  res: Response
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const doctor = await resolveDoctor(req.userId!);
  if (!doctor) {
    res.status(403).json({ error: "Only doctors can create sessions" });
    return;
  }

  const {
    title,
    description,
    scheduled_at,
    duration_minutes,
    max_participants,
    price_aed,
    is_published,
  } = req.body as {
    title?: string;
    description?: string;
    scheduled_at?: string;
    duration_minutes?: number;
    max_participants?: number;
    price_aed?: number;
    is_published?: boolean;
  };

  if (!title || !scheduled_at) {
    res.status(400).json({ error: "title and scheduled_at are required" });
    return;
  }

  const priceNum = Number(price_aed ?? 0);
  const isFree = priceNum === 0;

  const { data, error } = await supabaseAdmin
    .from("group_sessions")
    .insert({
      doctor_id: doctor.id,
      title,
      description: description ?? null,
      scheduled_at,
      duration_minutes: duration_minutes ?? 60,
      max_participants: max_participants ?? 30,
      price_aed: priceNum,
      is_free: isFree,
      is_published: is_published ?? false,
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Mirror onto the clinic Google Calendar (non-blocking). Drafts are skipped
  // by the reconciler until is_published flips true.
  if (data) void syncGroupSessionCalendarEvent(data.id as string);

  // Create the room at publish time so the join link exists before go-live.
  if (data?.is_published) void ensureGroupSessionRoom(data.id as string);

  res.status(201).json({ session: data });
}

// PATCH /api/live-sessions/:id
export async function updateSession(
  req: Request,
  res: Response
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const doctor = await resolveDoctor(req.userId!);
  if (!doctor) {
    res.status(403).json({ error: "Only doctors can update sessions" });
    return;
  }

  const { id } = req.params;
  const {
    title,
    description,
    scheduled_at,
    duration_minutes,
    max_participants,
    price_aed,
    is_published,
  } = req.body as {
    title?: string;
    description?: string;
    scheduled_at?: string;
    duration_minutes?: number;
    max_participants?: number;
    price_aed?: number;
    is_published?: boolean;
  };

  // Fetch first so a session belonging to another doctor answers 404 rather
  // than PostgREST's "0 rows" 500, and so a terminal session cannot be edited
  // by calling the API directly — the UI only offers editing while scheduled.
  const { data: existing } = await supabaseAdmin
    .from("group_sessions")
    .select("id, status")
    .eq("id", id)
    .eq("doctor_id", doctor.id)
    .maybeSingle();

  if (!existing) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (existing.status === "ended" || existing.status === "cancelled") {
    res
      .status(400)
      .json({ error: `Cannot edit a session that is ${existing.status}` });
    return;
  }

  // Rescheduling a live session would shift the join window (and the room's
  // Daily nbf/exp) out from under participants mid-call. Everything else
  // about a live session stays editable.
  if (
    existing.status === "live" &&
    (scheduled_at !== undefined || duration_minutes !== undefined)
  ) {
    res
      .status(400)
      .json({ error: "Cannot reschedule a session that is already live" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (scheduled_at !== undefined) updates.scheduled_at = scheduled_at;
  if (duration_minutes !== undefined) updates.duration_minutes = duration_minutes;
  if (max_participants !== undefined) updates.max_participants = max_participants;
  if (price_aed !== undefined) {
    const priceNum = Number(price_aed);
    updates.price_aed = priceNum;
    updates.is_free = priceNum === 0;
  }
  if (is_published !== undefined) updates.is_published = is_published;

  const { data, error } = await supabaseAdmin
    .from("group_sessions")
    .update(updates)
    .eq("id", id)
    .eq("doctor_id", doctor.id)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  // Converge the mirrored calendar event onto the new row state: time/title
  // edits patch it, publishing creates it, unpublishing removes it, and a
  // cancelled session stays deleted no matter what was patched.
  void syncGroupSessionCalendarEvent(id as string);

  // Covers publish, reschedule, and duration edits; ensure is idempotent so
  // over-calling here is harmless — the predicate just avoids a Daily
  // round-trip on title-only edits.
  if (
    data.is_published &&
    (scheduled_at !== undefined ||
      duration_minutes !== undefined ||
      is_published !== undefined)
  ) {
    void ensureGroupSessionRoom(id as string);
  }

  res.json({ session: data });
}

// DELETE /api/live-sessions/:id
export async function cancelSession(
  req: Request,
  res: Response
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const doctor = await resolveDoctor(req.userId!);
  if (!doctor) {
    res.status(403).json({ error: "Only doctors can cancel sessions" });
    return;
  }

  const { id } = req.params;

  const { data: existing } = await supabaseAdmin
    .from("group_sessions")
    .select("id, status")
    .eq("id", id)
    .eq("doctor_id", doctor.id)
    .maybeSingle();

  if (!existing) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  // Ending a session is a separate action with its own endpoint; cancelling one
  // that already ran would rewrite history for everyone who attended.
  if (existing.status === "ended") {
    res.status(400).json({ error: "This session has already ended" });
    return;
  }

  if (existing.status === "cancelled") {
    res.json({ success: true });
    return;
  }

  const { error } = await supabaseAdmin
    .from("group_sessions")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("doctor_id", doctor.id);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Remove the mirrored calendar event; Google emails the cancellation to
  // every registered attendee (sendUpdates=all).
  void syncGroupSessionCalendarEvent(id as string);

  // A cancelled session's link should stop working immediately.
  void deleteGroupSessionRoom(id as string);

  res.json({ success: true });
}

// PATCH /api/live-sessions/:id/go-live
export async function goLive(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const doctor = await resolveDoctor(req.userId!);
  if (!doctor) {
    res.status(403).json({ error: "Only doctors can start sessions" });
    return;
  }

  const { id } = req.params;

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("group_sessions")
    .select("id, status, scheduled_at, duration_minutes")
    .eq("id", id)
    .eq("doctor_id", doctor.id)
    .single();

  if (fetchError || !existing) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (existing.status !== "scheduled") {
    res
      .status(400)
      .json({ error: `Cannot go live from status: ${existing.status}` });
    return;
  }

  const window = groupSessionJoinWindow(existing);
  if (!window) {
    res.status(500).json({ error: "Session has an unreadable schedule" });
    return;
  }

  // Joins are window-gated, so flipping to live outside the window would wedge
  // the session: unjoinable, and the live status blocks rescheduling out of it.
  const now = Date.now();
  if (now < window.opensAt.getTime()) {
    res.status(400).json({
      error: "This session cannot go live yet",
      opensAt: window.opensAt.toISOString(),
    });
    return;
  }
  if (now > window.closesAt.getTime()) {
    res.status(400).json({
      error: "This session's scheduled time has passed — reschedule it first",
    });
    return;
  }

  // The room exists from publish time with a schedule-derived window; going
  // live only flips the status that drives badges and Join buttons. Ensure is
  // the recovery path for sessions published before rooms were created eagerly.
  const roomUrl = await ensureGroupSessionRoom(id as string);
  if (!roomUrl) {
    res.status(502).json({ error: "Video room is unavailable, please try again" });
    return;
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("group_sessions")
    .update({ status: "live" })
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    res.status(500).json({ error: updateError.message });
    return;
  }

  res.json({ session: updated });
}

// PATCH /api/live-sessions/:id/end
export async function endSession(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const doctor = await resolveDoctor(req.userId!);
  if (!doctor) {
    res.status(403).json({ error: "Only doctors can end sessions" });
    return;
  }

  const { id } = req.params;
  const { recording_url } = req.body as { recording_url?: string };

  const { data, error } = await supabaseAdmin
    .from("group_sessions")
    .update({
      status: "ended",
      recording_url: recording_url ?? null,
    })
    .eq("id", id)
    .eq("doctor_id", doctor.id)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json({ session: data });
}

// ─── Authenticated (parent) ───────────────────────────────────────────────────

// POST /api/live-sessions/:id/register
export async function registerForSession(
  req: Request,
  res: Response
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const { id } = req.params;
  const userId = req.userId!;

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("group_sessions")
    .select(
      "id, title, price_aed, is_free, status, is_published, max_participants, scheduled_at, duration_minutes, doctor_id, session_registrations (payment_status)"
    )
    .eq("id", id)
    .eq("is_published", true)
    .single();

  if (sessionError || !session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (session.status === "cancelled" || session.status === "ended") {
    res.status(400).json({ error: "This session is no longer available" });
    return;
  }

  if (hasFinished(session)) {
    res
      .status(400)
      .json({ error: "Registration for this session has closed" });
    return;
  }

  // Hosts join through the host path; a registration row for the host would also consume a seat.
  // A doctors lookup failure must not fail open into checkout for the host.
  const { data: hostDoctor, error: hostDoctorError } = await supabaseAdmin
    .from("doctors")
    .select("id")
    .eq("profile_id", userId)
    .maybeSingle();
  if (hostDoctorError) {
    res.status(500).json({ error: hostDoctorError.message });
    return;
  }
  if (hostDoctor && session.doctor_id === hostDoctor.id) {
    res.status(400).json({ error: "You are the host of this session" });
    return;
  }

  const regs = Array.isArray(session.session_registrations)
    ? (session.session_registrations as Array<{ payment_status: string }>)
    : [];
  if (participantCount(regs) >= session.max_participants) {
    res.status(400).json({ error: "This session is full" });
    return;
  }

  // Check if already registered
  const { data: existing } = await supabaseAdmin
    .from("session_registrations")
    .select("id, payment_status")
    .eq("session_id", id)
    .eq("user_id", userId)
    .single();

  if (existing) {
    if (existing.payment_status === "free" || existing.payment_status === "paid") {
      res.status(400).json({ error: "Already registered for this session" });
      return;
    }
  }

  // Free session — register immediately
  if (session.is_free) {
    const { data: reg, error: regError } = await supabaseAdmin
      .from("session_registrations")
      .upsert(
        { session_id: id, user_id: userId, payment_status: "free" },
        { onConflict: "session_id,user_id" }
      )
      .select()
      .single();

    if (regError) {
      res.status(500).json({ error: regError.message });
      return;
    }

    // Add the new registrant to the session's Google Calendar event.
    void syncGroupSessionCalendarEvent(id as string);

    res.json({ registration: reg });
    return;
  }

  // Paid session — create Stripe checkout
  const stripe = getStripe();
  if (!stripe) {
    res.status(500).json({ error: "Payment service not configured" });
    return;
  }

  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3333";

  const { error: pendingError } = await supabaseAdmin
    .from("session_registrations")
    .upsert(
      { session_id: id, user_id: userId, payment_status: "pending" },
      { onConflict: "session_id,user_id" }
    );

  if (pendingError) {
    res.status(500).json({ error: pendingError.message });
    return;
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "aed",
          unit_amount: Math.round(Number(session.price_aed) * 100),
          product_data: {
            name: session.title,
            description: `Live group session ticket`,
          },
        },
      },
    ],
    metadata: {
      type: "group_session",
      sessionId: String(id),
      userId,
    },
    success_url: `${frontendUrl}/live-sessions/${id}?registered=1&stripe_session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/live-sessions/${id}?cancelled=1`,
  });

  res.json({ checkoutUrl: checkoutSession.url });
}

// GET /api/live-sessions/registered
export async function getMyRegistrations(
  req: Request,
  res: Response
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("session_registrations")
    .select(
      `id, payment_status, registered_at,
       group_sessions (
         id, title, description, scheduled_at, duration_minutes,
         max_participants, price_aed, is_free, status,
         daily_room_url, recording_url,
         doctors (id, full_name, specialty, avatar_url)
       )`
    )
    .eq("user_id", req.userId!)
    .order("registered_at", { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ registrations: data ?? [] });
}

// GET /api/live-sessions/:id/join
export async function joinSession(
  req: Request,
  res: Response
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const { id } = req.params;
  const userId = req.userId!;

  // Fetch session including doctor_id so we can grant host bypass
  const { data: session, error: sessionError } = await supabaseAdmin
    .from("group_sessions")
    .select(
      "id, status, daily_room_name, daily_room_url, scheduled_at, duration_minutes, doctor_id"
    )
    .eq("id", id)
    .single();

  if (sessionError || !session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (session.status === "cancelled" || session.status === "ended") {
    res.status(400).json({ error: "This session is no longer available" });
    return;
  }

  // Check if the requester is the doctor who owns this session
  const doctor = await resolveDoctor(userId);
  const isDoctorHost =
    doctor !== null && session.doctor_id === doctor.id;

  if (!isDoctorHost) {
    // Verify participant registration with confirmed payment
    const { data: registration } = await supabaseAdmin
      .from("session_registrations")
      .select("id, payment_status")
      .eq("session_id", id)
      .eq("user_id", userId)
      .single();

    if (
      !registration ||
      !["free", "paid"].includes(registration.payment_status)
    ) {
      res
        .status(403)
        .json({ error: "You are not registered for this session" });
      return;
    }
  }

  const window = groupSessionJoinWindow(session);
  if (!window) {
    res.status(500).json({ error: "Session has an unreadable schedule" });
    return;
  }

  // The room exists from publish time, so the window — not the doctor pressing
  // Go Live — is what stops anyone arriving days early or rejoining long after.
  const now = Date.now();
  if (now < window.opensAt.getTime()) {
    res.status(403).json({
      error: "This session is not open yet",
      opensAt: window.opensAt.toISOString(),
    });
    return;
  }
  if (now > window.closesAt.getTime()) {
    res.status(403).json({ error: "This session has ended" });
    return;
  }

  // Reconciles a room whose window a failed background ensure left stale
  // (e.g. after a reschedule); falls back to the stored URL so a Daily blip
  // at join time does not block an otherwise-working room.
  const roomUrl =
    (await ensureGroupSessionRoom(id as string)) ?? session.daily_room_url;
  if (!roomUrl) {
    res.status(502).json({ error: "Video room is unavailable, please try again" });
    return;
  }

  let token: string;
  try {
    token = await createMeetingToken({
      roomName: session.daily_room_name ?? groupSessionRoomName(id as string),
      userId,
      userName: await resolveDisplayName(userId, isDoctorHost ? "Doctor" : "Participant"),
      isOwner: isDoctorHost,
      expiryEpoch: Math.floor(window.closesAt.getTime() / 1000),
    });
  } catch (err) {
    res
      .status(502)
      .json({ error: "Could not authorise you for the video room", detail: String(err) });
    return;
  }

  res.json({ token, roomUrl });
}

// GET /api/live-sessions/user/verify-payment?stripe_session_id=xxx
// Called from the frontend after Stripe redirects to the success URL.
// Acts as a webhook fallback to confirm payment without relying on server-to-server events.
export async function verifySessionPayment(
  req: Request,
  res: Response
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const stripeSessionId =
    typeof req.query.stripe_session_id === "string"
      ? req.query.stripe_session_id
      : null;

  if (!stripeSessionId) {
    res.status(400).json({ error: "stripe_session_id query param is required" });
    return;
  }

  const stripe = getStripe();
  if (!stripe) {
    res.status(500).json({ error: "Payment service not configured" });
    return;
  }

  let checkoutSession: StripeCheckoutSessionResponse;
  try {
    checkoutSession = await stripe.checkout.sessions.retrieve(stripeSessionId);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to retrieve session";
    res.status(400).json({ error: message });
    return;
  }

  if (checkoutSession.payment_status !== "paid") {
    res.status(400).json({ error: "Payment not completed" });
    return;
  }

  const metadata = checkoutSession.metadata ?? {};
  if (metadata.type !== "group_session" || !metadata.sessionId) {
    res.status(400).json({ error: "Invalid session metadata" });
    return;
  }

  const { sessionId } = metadata;
  const userId = req.userId!;

  // Bind the checkout to the caller. Without this, any user could pass a paid
  // stripe_session_id belonging to someone else's payment for the same session
  // and have their own pending registration marked paid (free access).
  if (metadata.userId !== userId) {
    res.status(403).json({ error: "This payment does not belong to you" });
    return;
  }

  // stripe_payment_intent matters as much as the status: charge.refunded and
  // charge.dispute.* carry a payment_intent, never a checkout-session id, so a
  // registration confirmed down this path without it could be refunded or
  // charged back and keep its access. verifyAppointmentPayment does the same.
  const { error } = await supabaseAdmin
    .from("session_registrations")
    .update({
      payment_status: "paid",
      stripe_session_id: stripeSessionId,
      stripe_payment_intent: checkoutSession.payment_intent,
    })
    .eq("session_id", sessionId)
    .eq("user_id", userId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Webhook fallback path: make sure the paid registrant reaches the
  // session's calendar event even if the webhook never arrives. The
  // reconciler diffs before patching, so the double-fire is harmless.
  void syncGroupSessionCalendarEvent(sessionId);

  res.json({ success: true, sessionId });
}
