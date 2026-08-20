"use client";

import { RefreshButton } from "@/components/ui/refresh-button";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Calendar, CheckCircle, XCircle } from "lucide-react";
import { adminApi, type CalendarAccount, type CalendarEventLog } from "@/lib/api/admin";
import { calendarApi, type CalendarConnectionStatus } from "@/lib/api/calendar";

// Codes the OAuth callback can bounce back with (?error=...), mapped to
// something an admin can act on. Keep in step with googleCalendarCallback in
// apps/api/src/controllers/google-calendar.ts.
const CALLBACK_ERRORS: Record<string, string> = {
  access_denied: "The Google consent screen was cancelled. No changes were made.",
  invalid_state: "The connection link expired or was tampered with. Try connecting again.",
  missing_code: "Google did not return an authorization code. Try connecting again.",
  exchange_failed: "Google rejected the authorization code. Try connecting again.",
  no_refresh_token:
    "Google did not issue a refresh token. Remove the app's access at myaccount.google.com/permissions, then connect again.",
  store_failed: "The connection could not be saved. Check the API logs and try again.",
};

function IntegrationsPageInner() {
  const searchParams = useSearchParams();
  const justConnected = searchParams.get("calendar") === "connected";
  const callbackError = searchParams.get("calendar_error");

  const [status, setStatus] = useState<CalendarConnectionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [accounts, setAccounts] = useState<CalendarAccount[]>([]);
  const [logs, setLogs] = useState<CalendarEventLog[]>([]);
  const [total, setTotal] = useState(0);
  const [logsLoading, setLogsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  const loadStatus = useCallback((silent = false) => {
    if (!silent) setStatusLoading(true);
    calendarApi
      .getStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setStatusLoading(false));
    adminApi
      .listCalendarAccounts()
      .then(({ accounts: rows }) => setAccounts(rows))
      .catch(() => setAccounts([]));
  }, []);

  const loadLogs = useCallback((silent = false) => {
    // Skip the skeleton swap on a manual refresh — see RefreshButton.
    if (!silent) setLogsLoading(true);
    adminApi
      .listCalendarLogs({
        status: filterStatus || undefined,
        related_type: filterType || undefined,
        page,
        limit: LIMIT,
      })
      .then(({ calendarLogs, total: t }) => {
        setLogs(calendarLogs);
        setTotal(t);
      })
      .catch(() => {})
      .finally(() => setLogsLoading(false));
  }, [filterStatus, filterType, page]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);
  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleConnect = async () => {
    setBusy(true);
    try {
      window.location.href = await calendarApi.connect();
    } catch {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (
      !window.confirm(
        "Disconnect your Google Calendar? Bookings will stop appearing on it, and the events already there will be removed."
      )
    )
      return;
    setBusy(true);
    try {
      await calendarApi.disconnect();
      loadStatus();
    } finally {
      setBusy(false);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Integrations</h1>
          <p className="text-sm text-muted-foreground">
            Connect your Google Calendar. As an admin you receive every appointment and live
            session on the platform; parents and doctors only receive their own.
          </p>
        </div>
        <RefreshButton onRefresh={() => Promise.all([loadStatus(true), loadLogs(true)])} />
      </div>

      {justConnected && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle className="h-4 w-4 shrink-0" />
          Google Calendar connected. Every appointment and live session will now appear on it.
        </div>
      )}
      {callbackError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {CALLBACK_ERRORS[callbackError] ?? `Connection failed (${callbackError}). Try again.`}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" />
            Google Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : !status?.configured ? (
            <p className="text-sm text-muted-foreground">
              Not configured on the server. Set <code>GOOGLE_CLIENT_ID</code>,{" "}
              <code>GOOGLE_CLIENT_SECRET</code> and <code>GOOGLE_REDIRECT_URI</code> in the API
              environment — see <code>GOOGLE_CALENDAR_SETUP.md</code> — then reload this page.
            </p>
          ) : !status.connected ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                No account connected. Connect yours to receive every appointment and live session on
                the platform.
              </p>
              <Button onClick={handleConnect} disabled={busy}>
                {busy ? "Redirecting…" : "Connect Google Calendar"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">{status.email}</span>
                  {status.status === "error" ? (
                    <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                      Needs reconnect
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                      Connected
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  {status.status === "error" && (
                    <Button onClick={handleConnect} disabled={busy}>
                      Reconnect
                    </Button>
                  )}
                  <Button variant="outline" onClick={handleDisconnect} disabled={busy}>
                    Disconnect
                  </Button>
                </div>
              </div>
              {status.status === "error" && status.lastError && (
                <p className="text-sm text-destructive">{status.lastError}</p>
              )}
              {status.connectedAt && (
                <p className="text-xs text-muted-foreground">
                  Connected {new Date(status.connectedAt).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Connected accounts ({accounts.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {accounts.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No Google accounts connected yet. Parents and doctors connect their own calendar from
              their profile page; anyone who doesn&apos;t is invited by email instead.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Google account</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Owner</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Connected</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-foreground">{a.googleEmail}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.owner.fullName ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs capitalize">
                          {a.owner.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${a.status === "connected" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                          title={a.lastError ?? undefined}
                        >
                          {a.status === "connected" ? (
                            <CheckCircle className="h-3 w-3" />
                          ) : (
                            <XCircle className="h-3 w-3" />
                          )}
                          {a.status === "connected" ? "connected" : "needs reconnect"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(a.connectedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={filterStatus || "all"}
          onValueChange={(v) => {
            setFilterStatus(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filterType || "all"}
          onValueChange={(v) => {
            setFilterType(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="appointment">Appointments</SelectItem>
            <SelectItem value="group_session">Live sessions</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Calendar Event Logs ({total})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logsLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No calendar activity yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">At</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 capitalize text-foreground">{l.action}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs capitalize">
                          {l.related_type.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${l.status === "sent" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                        >
                          {l.status === "sent" ? (
                            <CheckCircle className="h-3 w-3" />
                          ) : (
                            <XCircle className="h-3 w-3" />
                          )}
                          {l.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(l.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {l.error_message ? (
                          <span className="text-destructive" title={l.error_message}>
                            {l.error_message.slice(0, 60)}
                            {l.error_message.length > 60 ? "…" : ""}
                          </span>
                        ) : l.google_event_id ? (
                          l.google_event_id.slice(0, 16) + "…"
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// useSearchParams needs a Suspense boundary or Next fails the prerender.
export default function AdminIntegrationsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-48 w-full" />}>
      <IntegrationsPageInner />
    </Suspense>
  );
}
