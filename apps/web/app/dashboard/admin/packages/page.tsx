"use client";

import { RefreshButton } from "@/components/ui/refresh-button";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminApi, type AdminUserPackage } from "@/lib/api/admin";
import { useI18n } from "@/lib/i18n/i18n-context";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { UserPackageStatus } from "@/types/packages";
import { useViewerTimezone } from "@/hooks/use-viewer-timezone";
import { formatDateInTimezone } from "@/lib/timezone";

const PACKAGE_STATUSES: UserPackageStatus[] = [
  "active",
  "expired",
  "exhausted",
  "cancelled",
  "refunded",
];

const STATUS_COLORS: Record<UserPackageStatus, string> = {
  active: "bg-green-100 text-green-700",
  expired: "bg-gray-100 text-gray-600",
  exhausted: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-gray-100 text-gray-600",
  refunded: "bg-red-100 text-red-700",
};

function statusLabel(t: Dictionary, status: UserPackageStatus): string {
  const map: Record<UserPackageStatus, string> = {
    active: t.packages.statusActive,
    expired: t.packages.statusExpired,
    exhausted: t.packages.statusExhausted,
    cancelled: t.packages.statusCancelled,
    refunded: t.packages.statusRefunded,
  };
  return map[status] ?? status;
}

export default function AdminPackagesPage() {
  const { dictionary: t, dateLocale } = useI18n();
  const { timezone } = useViewerTimezone();
  const [packages, setPackages] = useState<AdminUserPackage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState("");
  const LIMIT = 50;

  const load = useCallback((silent = false) => {
    // Skip the skeleton swap on a manual refresh — see RefreshButton.
    if (!silent) setLoading(true);
    adminApi.listUserPackages({ status: filterStatus || undefined, page, limit: LIMIT })
      .then(({ packages: p, total: count }) => { setPackages(p); setTotal(count); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterStatus, page]);

  useEffect(() => { load(); }, [load]);

  const activeCount = packages.filter((p) => p.status === "active").length;
  const creditsRemaining = packages.reduce((sum, p) => sum + p.credits_remaining, 0);
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.admin.packages.title}</h1>
          <p className="text-sm text-muted-foreground">{t.admin.packages.subtitle}</p>
        </div>
        <RefreshButton onRefresh={() => load(true)} />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t.admin.packages.totalPurchases}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t.admin.packages.activePackages}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t.admin.packages.creditsRemaining}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{creditsRemaining}</p>
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
            <SelectItem value="all">{t.admin.common.allStatuses}</SelectItem>
            {PACKAGE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{statusLabel(t, s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.admin.packages.listTitle.replace("{count}", String(total))}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : packages.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">{t.admin.packages.empty}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.admin.packages.colPurchased}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.admin.packages.colBuyer}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.admin.packages.colPackage}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.admin.packages.colCredits}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.admin.common.amount}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.admin.packages.colExpires}</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t.common.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {packages.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateInTimezone(p.purchased_at, timezone, dateLocale)}
                      </td>
                      <td className="px-4 py-3 text-foreground">{p.buyer_name ?? "—"}</td>
                      <td className="px-4 py-3 text-foreground">{p.consultation_packages?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-foreground">
                        {t.admin.packages.creditsOf
                          .replace("{remaining}", String(p.credits_remaining))
                          .replace("{total}", String(p.credits_total))}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {t.admin.common.amountAed.replace("{amount}", p.amount_aed.toFixed(0))}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateInTimezone(p.expires_at, timezone, dateLocale)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {statusLabel(t, p.status)}
                        </span>
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
