import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import {
  buildAuthUrl,
  disconnectAccount,
  exchangeCode,
  getAccountForUser,
  getClinicAccount,
  isCalendarConfigured,
  listAccounts,
  resyncUpcomingForUser,
  saveAccount,
  signState,
  verifyState,
  type ConnectTarget,
} from "../lib/google-calendar";

function frontendUrl(): string {
  return process.env.FRONTEND_URL ?? "http://localhost:3333";
}

/** Where to send the browser back to after consent, per audience. */
async function returnPathFor(userId: string, target: ConnectTarget): Promise<string> {
  if (target === "clinic") return "/dashboard/admin/integrations";
  if (!supabaseAdmin) return "/dashboard/parent/profile";
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const role = data?.role === "doctor" ? "doctor" : data?.role === "admin" ? "admin" : "parent";
  return role === "admin" ? "/dashboard/admin/integrations" : `/dashboard/${role}/profile`;
}

// ─── Current user ─────────────────────────────────────────────────────────────

// GET /api/google-calendar/status
export async function getMyCalendarStatus(req: Request, res: Response): Promise<void> {
  if (!isCalendarConfigured()) {
    res.json({ configured: false, connected: false });
    return;
  }

  const account = await getAccountForUser(req.userId!);
  if (!account) {
    res.json({ configured: true, connected: false });
    return;
  }

  res.json({
    configured: true,
    connected: true,
    email: account.google_email,
    status: account.status,
    lastError: account.last_error,
    connectedAt: account.connected_at,
  });
}

// POST /api/google-calendar/connect
export async function startMyCalendarConnect(req: Request, res: Response): Promise<void> {
  startConnect(req, res, "self");
}

// DELETE /api/google-calendar
export async function disconnectMyCalendar(req: Request, res: Response): Promise<void> {
  await disconnectAccount({ userId: req.userId! });
  // Their personal copies are gone with the account's mirrors; re-sync so the
  // clinic event starts inviting them by email again.
  void resyncUpcomingForUser(req.userId!);
  res.json({ success: true });
}

// ─── Admin: clinic-wide account ───────────────────────────────────────────────

// GET /api/admin/google-calendar/status
export async function getCalendarStatus(_req: Request, res: Response): Promise<void> {
  if (!isCalendarConfigured()) {
    res.json({ configured: false, connected: false });
    return;
  }

  const account = await getClinicAccount();
  if (!account) {
    res.json({ configured: true, connected: false });
    return;
  }

  res.json({
    configured: true,
    connected: true,
    email: account.google_email,
    status: account.status,
    lastError: account.last_error,
    connectedAt: account.connected_at,
  });
}

// POST /api/admin/google-calendar/connect
export async function startCalendarConnect(req: Request, res: Response): Promise<void> {
  startConnect(req, res, "clinic");
}

// DELETE /api/admin/google-calendar
export async function disconnectCalendar(_req: Request, res: Response): Promise<void> {
  await disconnectAccount({ userId: null });
  res.json({ success: true });
}

// GET /api/admin/google-calendar/accounts
export async function listCalendarAccounts(_req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const accounts = await listAccounts();
  const userIds = accounts.map((a) => a.user_id).filter((id): id is string => !!id);

  // Label each account with who owns it. The clinic account has no user.
  const names = new Map<string, { full_name: string | null; role: string }>();
  if (userIds.length > 0) {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, role")
      .in("id", userIds);
    for (const row of data ?? []) {
      names.set(row.id as string, {
        full_name: (row.full_name as string) ?? null,
        role: row.role as string,
      });
    }
  }

  res.json({
    accounts: accounts.map((a) => ({
      id: a.id,
      googleEmail: a.google_email,
      status: a.status,
      lastError: a.last_error,
      connectedAt: a.connected_at,
      owner: a.user_id
        ? {
            userId: a.user_id,
            fullName: names.get(a.user_id)?.full_name ?? null,
            role: names.get(a.user_id)?.role ?? "unknown",
          }
        : { userId: null, fullName: "Clinic account", role: "clinic" },
    })),
  });
}

// ─── Shared connect entry point ───────────────────────────────────────────────

function startConnect(req: Request, res: Response, target: ConnectTarget): void {
  if (!isCalendarConfigured()) {
    res.status(500).json({ error: "Google Calendar is not configured on the server" });
    return;
  }

  const state = signState(req.userId!, target);
  if (!state) {
    res.status(500).json({ error: "JWT_SECRET is not configured" });
    return;
  }

  const url = buildAuthUrl(state);
  if (!url) {
    res.status(500).json({ error: "Google Calendar is not configured on the server" });
    return;
  }

  res.json({ url });
}

// ─── OAuth callback (public) ──────────────────────────────────────────────────

// GET /api/google-calendar/callback
// Public by necessity: Google's consent redirect is a plain browser navigation
// with no Authorization header. The signed state token (minted for whoever
// clicked Connect, 10-minute TTL) authenticates it, and a clinic-wide connect
// re-checks the admin role against the database before storing anything.
export async function googleCalendarCallback(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const { code, state, error } = req.query as Record<string, string | undefined>;

  const redirect = async (path: string, query: string) => {
    res.redirect(`${frontendUrl()}${path}?${query}`);
  };

  const verified = verifyState(state);

  if (error) {
    // e.g. access_denied when the user cancels the consent screen.
    const path = verified ? await returnPathFor(verified.userId, verified.target) : "/dashboard/parent/profile";
    await redirect(path, `calendar_error=${encodeURIComponent(error)}`);
    return;
  }

  if (!verified) {
    await redirect("/dashboard/parent/profile", "calendar_error=invalid_state");
    return;
  }

  const returnPath = await returnPathFor(verified.userId, verified.target);

  if (verified.target === "clinic") {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", verified.userId)
      .single();

    if (profile?.role !== "admin") {
      await redirect(returnPath, "calendar_error=not_admin");
      return;
    }
  }

  if (!code) {
    await redirect(returnPath, "calendar_error=missing_code");
    return;
  }

  let refreshToken: string | null;
  let email: string | null;
  try {
    ({ refreshToken, email } = await exchangeCode(code));
  } catch (err) {
    console.error("[calendar] Code exchange failed:", String(err));
    await redirect(returnPath, "calendar_error=exchange_failed");
    return;
  }

  // No refresh token means nothing that outlives the hour. Happens when a
  // previous grant exists and consent was skipped; the fix is to remove the app
  // at myaccount.google.com/permissions and reconnect.
  if (!refreshToken) {
    await redirect(returnPath, "calendar_error=no_refresh_token");
    return;
  }

  try {
    await saveAccount({
      userId: verified.target === "clinic" ? null : verified.userId,
      email: email ?? "(unknown account)",
      refreshToken,
    });
  } catch (err) {
    console.error("[calendar] Failed to store account:", String(err));
    await redirect(returnPath, "calendar_error=store_failed");
    return;
  }

  // Fill their calendar with what they already have booked, rather than making
  // them wait for the next booking or the sweep.
  if (verified.target === "self") void resyncUpcomingForUser(verified.userId);

  await redirect(returnPath, "calendar=connected");
}

// ─── Admin: logs ──────────────────────────────────────────────────────────────

// GET /api/admin/calendar-logs
export async function listCalendarLogs(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const { status, related_type, page = "1", limit = "50" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  let query = supabaseAdmin
    .from("calendar_event_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limitNum - 1);

  if (status) query = query.eq("status", status);
  if (related_type) query = query.eq("related_type", related_type);

  const { data, error, count } = await query;
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ calendarLogs: data, total: count ?? 0, page: pageNum, limit: limitNum });
}
