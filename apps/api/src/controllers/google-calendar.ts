import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import {
  buildAuthUrl,
  disconnectAccount,
  exchangeCode,
  getAccountForUser,
  isCalendarConfigured,
  listAccounts,
  resyncUpcomingForUser,
  saveAccount,
  signState,
  verifyState,
} from "../lib/google-calendar";
import { frontendUrl } from "../lib/app-url";

/** Where the browser lands after consent — admins manage this on Integrations. */
async function returnPathFor(userId: string): Promise<string> {
  if (!supabaseAdmin) return "/dashboard/parent/profile";
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (data?.role === "admin") return "/dashboard/admin/integrations";
  return data?.role === "doctor" ? "/dashboard/doctor/profile" : "/dashboard/parent/profile";
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
  if (!isCalendarConfigured()) {
    res.status(500).json({ error: "Google Calendar is not configured on the server" });
    return;
  }

  const state = signState(req.userId!);
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

// DELETE /api/google-calendar
export async function disconnectMyCalendar(req: Request, res: Response): Promise<void> {
  await disconnectAccount({ userId: req.userId! });
  // Their personal copies are gone with the account's mirrors; re-sync so the
  // clinic event starts inviting them by email again.
  void resyncUpcomingForUser(req.userId!);
  res.json({ success: true });
}

// ─── Admin oversight ──────────────────────────────────────────────────────────

// GET /api/admin/google-calendar/accounts
export async function listCalendarAccounts(_req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const accounts = await listAccounts();
  const userIds = accounts.map((a) => a.user_id);

  // Label each account with who owns it and the role that decides its contents.
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
      owner: {
        userId: a.user_id,
        fullName: names.get(a.user_id)?.full_name ?? null,
        role: names.get(a.user_id)?.role ?? "unknown",
      },
    })),
  });
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
    const path = verified ? await returnPathFor(verified.userId) : "/dashboard/parent/profile";
    await redirect(path, `calendar_error=${encodeURIComponent(error)}`);
    return;
  }

  if (!verified) {
    await redirect("/dashboard/parent/profile", "calendar_error=invalid_state");
    return;
  }

  const returnPath = await returnPathFor(verified.userId);

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
      userId: verified.userId,
      email: email ?? "(unknown account)",
      refreshToken,
    });
  } catch (err) {
    console.error("[calendar] Failed to store account:", String(err));
    await redirect(returnPath, "calendar_error=store_failed");
    return;
  }

  // Fill their calendar with what they already have, rather than making them
  // wait for the next booking or the sweep. For an admin that is everything.
  void resyncUpcomingForUser(verified.userId);

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
