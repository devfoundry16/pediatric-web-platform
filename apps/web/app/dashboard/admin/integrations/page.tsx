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
import { useI18n } from "@/lib/i18n/i18n-context";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { useViewerTimezone } from "@/hooks/use-viewer-timezone";
import { formatDateInTimezone, formatTimeInTimezone } from "@/lib/timezone";

// Codes the OAuth callback can bounce back with (?error=...), mapped to a
// dictionary key an admin can act on. Keep in step with googleCalendarCallback
// in apps/api/src/controllers/google-calendar.ts.
const CALLBACK_ERROR_KEYS: Record<string, keyof Dictionary["admin"]["integrations"]> = {
  access_denied: "errAccessDenied",
  invalid_state: "errInvalidState",
  missing_code: "errMissingCode",
  exchange_failed: "errExchangeFailed",
  no_refresh_token: "errNoRefreshToken",
  store_failed: "errStoreFailed",
};

/** Renders a dictionary string whose `code`-formatted tokens are marked with backticks. */
function TextWithCode({ text }: { text: string }) {
  return (
    <>
      {text.split("`").map((part, i) => (i % 2 === 1 ? <code key={i}>{part}</code> : part))}
    </>
  );
}

function IntegrationsPageInner() {
  const { dictionary: t, dateLocale } = useI18n();
  const { timezone } = useViewerTimezone();
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
    if (!window.confirm(t.admin.integrations.disconnectConfirm)) return;
    setBusy(true);
    try {
      await calendarApi.disconnect();
      loadStatus();
    } finally {
      setBusy(false);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  const callbackErrorKey = callbackError ? CALLBACK_ERROR_KEYS[callbackError] : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.admin.integrations.title}</h1>
          <p className="text-sm text-muted-foreground">
            {t.admin.integrations.subtitle}
          </p>
        </div>
        <RefreshButton onRefresh={() => Promise.all([loadStatus(true), loadLogs(true)])} />
      </div>

      {justConnected && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle className="h-4 w-4 shrink-0" />
          {t.admin.integrations.connectedBanner}
        </div>
      )}
      {callbackError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {callbackErrorKey
            ? t.admin.integrations[callbackErrorKey]
            : t.admin.integrations.connectionFailed.replace("{code}", callbackError)}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" />
            {t.profile.googleCalendar.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : !status?.configured ? (
            <p className="text-sm text-muted-foreground">
              <TextWithCode text={t.admin.integrations.notConfigured} />
            </p>
          ) : !status.connected ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                {t.admin.integrations.notConnected}
              </p>
              <Button onClick={handleConnect} disabled={busy}>
                {busy ? t.admin.integrations.redirecting : t.profile.googleCalendar.connect}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">{status.email}</span>
                  {status.status === "error" ? (
                    <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                      {t.admin.integrations.needsReconnect}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                      {t.admin.integrations.connected}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  {status.status === "error" && (
                    <Button onClick={handleConnect} disabled={busy}>
                      {t.profile.googleCalendar.reconnect}
                    </Button>
                  )}
                  <Button variant="outline" onClick={handleDisconnect} disabled={busy}>
                    {t.profile.googleCalendar.disconnect}
                  </Button>
                </div>
              </div>
              {status.status === "error" && status.lastError && (
                <p className="text-sm text-destructive">{status.lastError}</p>
              )}
              {status.connectedAt && (
                <p className="text-xs text-muted-foreground">
                  {t.admin.integrations.connectedAtLine.replace(
                    "{date}",
                    `${formatDateInTimezone(status.connectedAt, timezone, dateLocale)} ${formatTimeInTimezone(status.connectedAt, timezone, dateLocale)}`
                  )}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.admin.integrations.accountsTitle.replace("{count}", String(accounts.length))}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {accounts.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              {t.admin.integrations.accountsEmpty}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.admin.integrations.colGoogleAccount}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.admin.integrations.colOwner}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.admin.common.role}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.common.status}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.admin.integrations.colConnectedAt}</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-foreground">{a.googleEmail}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.owner.fullName ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs capitalize">
                          {a.owner.role === "parent"
                            ? t.admin.common.roleParent
                            : a.owner.role === "doctor"
                              ? t.admin.common.roleDoctor
                              : a.owner.role === "admin"
                                ? t.admin.common.roleAdmin
                                : a.owner.role}
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
                          {a.status === "connected" ? t.admin.integrations.connected : t.admin.integrations.needsReconnect}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateInTimezone(a.connectedAt, timezone, dateLocale)}
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
            <SelectValue placeholder={t.admin.common.allStatuses} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.admin.common.allStatuses}</SelectItem>
            <SelectItem value="sent">{t.admin.common.sent}</SelectItem>
            <SelectItem value="failed">{t.admin.common.failed}</SelectItem>
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
            <SelectValue placeholder={t.admin.common.allTypes} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.admin.common.allTypes}</SelectItem>
            <SelectItem value="appointment">{t.admin.integrations.typeAppointments}</SelectItem>
            <SelectItem value="group_session">{t.admin.integrations.typeLiveSessions}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.admin.integrations.logsTitle.replace("{count}", String(total))}</CardTitle>
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
              {t.admin.integrations.logsEmpty}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.admin.integrations.colAction}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.admin.common.type}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.common.status}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.admin.integrations.colAt}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.admin.integrations.colDetail}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 capitalize text-foreground">{l.action}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs capitalize">
                          {l.related_type === "appointment"
                            ? t.admin.integrations.relatedAppointment
                            : t.admin.integrations.relatedGroupSession}
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
                          {l.status === "sent" ? t.admin.common.sent : t.admin.common.failed}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateInTimezone(l.created_at, timezone, dateLocale)} {formatTimeInTimezone(l.created_at, timezone, dateLocale)}
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
            {t.admin.common.pageOf.replace("{page}", String(page)).replace("{total}", String(totalPages))}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              {t.common.previous}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              {t.common.next}
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
