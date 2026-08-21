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
import { adminApi, type Payment } from "@/lib/api/admin";
import { useI18n } from "@/lib/i18n/i18n-context";
import { getPaymentStatusLabel } from "@/lib/i18n/payment-status";
import { useViewerTimezone } from "@/hooks/use-viewer-timezone";
import { formatDateInTimezone } from "@/lib/timezone";

const PAYMENT_STATUSES = ["", "paid", "package_credit", "refunded", "pending"] as const;

const PAYMENT_TYPES = ["", "consultation", "package"] as const;

const STATUS_COLORS: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  package_credit: "bg-purple-100 text-purple-700",
  refunded: "bg-gray-100 text-gray-600",
  pending: "bg-yellow-100 text-yellow-700",
};

export default function AdminPaymentsPage() {
  const { dictionary: t, dateLocale } = useI18n();
  const { timezone } = useViewerTimezone();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const LIMIT = 50;

  const load = useCallback((silent = false) => {
    // Skip the skeleton swap on a manual refresh — see RefreshButton.
    if (!silent) setLoading(true);
    adminApi.listPayments({
      status: filterStatus || undefined,
      type: filterType || undefined,
      page,
      limit: LIMIT,
    })
      .then(({ payments: p, total: t }) => { setPayments(p); setTotal(t); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterStatus, filterType, page]);

  useEffect(() => { load(); }, [load]);

  const totalRevenue = payments.filter((p) => p.payment_status === "paid").reduce((s, p) => s + Number(p.amount_aed), 0);
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.admin.payments.title}</h1>
          <p className="text-sm text-muted-foreground">{t.admin.payments.subtitle}</p>
        </div>
        <RefreshButton onRefresh={() => load(true)} />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t.admin.payments.showingRevenue}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{t.admin.common.amountAed.replace("{amount}", totalRevenue.toFixed(0))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t.admin.payments.totalTransactions}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t.admin.payments.packageCredits}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {payments.filter((p) => p.payment_status === "package_credit").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={filterStatus || "all"} onValueChange={(v) => { setFilterStatus(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t.admin.common.allStatuses} />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_STATUSES.map((s) => (
              <SelectItem key={s || "all"} value={s || "all"}>{s ? getPaymentStatusLabel(t, s) : t.admin.common.allStatuses}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterType || "all"} onValueChange={(v) => { setFilterType(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t.admin.common.allTypes} />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_TYPES.map((ty) => (
              <SelectItem key={ty || "all"} value={ty || "all"}>
                {ty === "consultation"
                  ? t.admin.payments.typeConsultation
                  : ty === "package"
                    ? t.admin.common.package
                    : t.admin.common.allTypes}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.admin.payments.listTitle.replace("{count}", String(total))}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : payments.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">{t.admin.payments.empty}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.common.date}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.admin.common.type}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.admin.common.patient}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.admin.common.doctor}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.admin.common.amount}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.common.status}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.admin.payments.colReference}</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateInTimezone(p.created_at, timezone, dateLocale)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">
                          {p.kind === "package" ? t.admin.common.package : t.admin.payments.typeConsultation}
                        </Badge>
                      </td>
                      {/* Both columns carry the package equivalent on a package
                          row: the buyer stands in for the patient, and the
                          package bought for the doctor seen. */}
                      <td className="px-4 py-3 text-foreground">
                        {p.kind === "package"
                          ? p.buyer_name ?? "—"
                          : p.child_profiles
                            ? `${p.child_profiles.first_name} ${p.child_profiles.last_name}`
                            : "—"}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {p.kind === "package" ? p.package_name ?? "—" : p.doctors?.full_name ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {t.admin.common.amountAed.replace("{amount}", p.amount_aed.toFixed(0))}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[p.payment_status] ?? "bg-gray-100 text-gray-600"}`}>
                          {getPaymentStatusLabel(t, p.payment_status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground truncate max-w-32">
                        {p.payment_reference ?? "—"}
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
