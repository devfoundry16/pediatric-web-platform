"use client";

import { RefreshButton } from "@/components/ui/refresh-button";
import { useEffect, useState, useCallback } from "react";
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
import { CheckCircle, XCircle, Mail } from "lucide-react";
import { adminApi, type EmailLog } from "@/lib/api/admin";
import { useI18n } from "@/lib/i18n/i18n-context";
import { useViewerTimezone } from "@/hooks/use-viewer-timezone";
import { formatDateInTimezone, formatTimeInTimezone } from "@/lib/timezone";

// Every type the API can write to email_logs — keep in step with the EmailType
// union in apps/api/src/lib/resend.ts. A type missing here is not filterable,
// though its rows still show under "All types". Labels resolve through
// emailTypeLabel below.
const EMAIL_TYPE_VALUES = [
  "",
  "booking_confirmation",
  "booking_notification",
  "package_purchase",
  "appointment_reminder",
  "session_reminder",
  "cancellation",
  "reschedule",
  "other",
] as const;

export default function AdminNotificationsPage() {
  const { dictionary: t, dateLocale } = useI18n();
  const { timezone } = useViewerTimezone();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  const load = useCallback((silent = false) => {
    // Skip the skeleton swap on a manual refresh — see RefreshButton.
    if (!silent) setLoading(true);
    adminApi.listEmailLogs({
      status: filterStatus || undefined,
      email_type: filterType || undefined,
      page,
      limit: LIMIT,
    })
      .then(({ emailLogs, total: t }) => { setLogs(emailLogs); setTotal(t); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterStatus, filterType, page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / LIMIT);
  const sentCount = logs.filter((l) => l.status === "sent").length;
  const failedCount = logs.filter((l) => l.status === "failed").length;

  const emailTypeLabel = (value: string): string => {
    switch (value) {
      case "":
        return t.admin.common.allTypes;
      case "booking_confirmation":
        return t.admin.notifications.typeBookingConfirmation;
      case "booking_notification":
        return t.admin.notifications.typeBookingNotification;
      case "package_purchase":
        return t.admin.notifications.typePackagePurchase;
      case "appointment_reminder":
        return t.admin.notifications.typeAppointmentReminder;
      case "session_reminder":
        return t.admin.notifications.typeSessionReminder;
      case "cancellation":
        return t.admin.notifications.typeCancellation;
      case "reschedule":
        return t.admin.notifications.typeReschedule;
      case "other":
        return t.admin.notifications.typeOther;
      default:
        return value.replace(/_/g, " ");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.admin.notifications.title}</h1>
          <p className="text-sm text-muted-foreground">{t.admin.notifications.subtitle}</p>
        </div>
        <RefreshButton onRefresh={() => load(true)} />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <Mail className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">{t.admin.notifications.totalEmails}</p>
              <p className="text-2xl font-bold text-foreground">{total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-muted-foreground">{t.admin.notifications.delivered}</p>
              <p className="text-2xl font-bold text-foreground">{sentCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <XCircle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-sm text-muted-foreground">{t.admin.common.failed}</p>
              <p className="text-2xl font-bold text-foreground">{failedCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterStatus || "all"} onValueChange={(v) => { setFilterStatus(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t.admin.common.allStatuses} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.admin.common.allStatuses}</SelectItem>
            <SelectItem value="sent">{t.admin.common.sent}</SelectItem>
            <SelectItem value="failed">{t.admin.common.failed}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType || "all"} onValueChange={(v) => { setFilterType(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder={t.admin.common.allTypes} />
          </SelectTrigger>
          <SelectContent>
            {EMAIL_TYPE_VALUES.map((value) => (
              <SelectItem key={value || "all"} value={value || "all"}>{emailTypeLabel(value)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.admin.notifications.listTitle.replace("{count}", String(total))}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : logs.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">{t.admin.notifications.empty}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.admin.notifications.colRecipient}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.admin.common.type}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.common.status}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.admin.notifications.colSentAt}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.admin.notifications.colResendId}</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-foreground">{l.recipient_email}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs capitalize">
                          {emailTypeLabel(l.email_type)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${l.status === "sent" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {l.status === "sent" ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          {l.status === "sent" ? t.admin.common.sent : t.admin.common.failed}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateInTimezone(l.created_at, timezone, dateLocale)} {formatTimeInTimezone(l.created_at, timezone, dateLocale)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {l.resend_id ? l.resend_id.slice(0, 12) + "…" : l.error_message ? (
                          <span className="text-destructive" title={l.error_message ?? ""}>{t.admin.notifications.error}</span>
                        ) : "—"}
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
          <span>{t.admin.common.pageOf.replace("{page}", String(page)).replace("{total}", String(totalPages))}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>{t.common.previous}</Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>{t.common.next}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
