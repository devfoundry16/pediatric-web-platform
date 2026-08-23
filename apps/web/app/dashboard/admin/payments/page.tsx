"use client";

import { RefreshButton } from "@/components/ui/refresh-button";
import { useEffect, useState, useCallback, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminApi, type Payment } from "@/lib/api/admin";
import { useI18n } from "@/lib/i18n/i18n-context";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { getPaymentStatusLabel } from "@/lib/i18n/payment-status";
import { useViewerTimezone } from "@/hooks/use-viewer-timezone";
import { formatDateInTimezone } from "@/lib/timezone";

/**
 * The tab doubles as the `type` filter sent to the API. "all" is the one value
 * that is not a `type` — it is sent as no filter at all.
 */
type TabValue = "all" | "consultation" | "package" | "live_session";

const TABS: readonly TabValue[] = ["all", "consultation", "package", "live_session"];

/**
 * Offering a status a tab can never return is a dead end, so each tab advertises
 * only its own vocabulary: a package is never `pending` and has no
 * `package_credit`, and a live-session ticket has no `package_credit` either.
 */
const STATUSES_BY_TAB: Record<TabValue, readonly string[]> = {
  all: ["paid", "package_credit", "refunded", "pending"],
  consultation: ["paid", "package_credit", "refunded", "pending"],
  package: ["paid", "refunded"],
  live_session: ["paid", "pending", "refunded"],
};

const STATUS_COLORS: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  package_credit: "bg-purple-100 text-purple-700",
  refunded: "bg-gray-100 text-gray-600",
  pending: "bg-yellow-100 text-yellow-700",
};

function tabLabel(t: Dictionary, tab: TabValue): string {
  const map: Record<TabValue, string> = {
    all: t.admin.payments.tabAll,
    consultation: t.admin.payments.tabConsultations,
    package: t.admin.payments.tabPackages,
    live_session: t.admin.payments.tabLiveSessions,
  };
  return map[tab];
}

function kindLabel(t: Dictionary, kind: Payment["kind"]): string {
  const map: Record<Payment["kind"], string> = {
    consultation: t.admin.payments.typeConsultation,
    package: t.admin.common.package,
    live_session: t.admin.payments.typeLiveSession,
  };
  return map[kind];
}

interface Column {
  key: string;
  header: string;
  cell: (p: Payment) => ReactNode;
  /** Applied to the cell only; headers share one style. */
  className?: string;
}

/** Everything a cell renderer needs beyond the row itself. */
interface CellContext {
  t: Dictionary;
  timezone: string;
  dateLocale: string;
}

/**
 * The column set for a tab.
 *
 * "All" mixes unlike things, so it can only show what every kind has in common;
 * each kind-specific tab is free to describe its own rows properly.
 */
function columnsFor(tab: TabValue, ctx: CellContext): Column[] {
  const { t, timezone, dateLocale } = ctx;
  const date = (value: string | null) =>
    value ? formatDateInTimezone(value, timezone, dateLocale) : "—";

  const amount: Column = {
    key: "amount",
    header: t.admin.common.amount,
    cell: (p) => t.admin.common.amountAed.replace("{amount}", p.amount_aed.toFixed(0)),
    className: "font-medium text-foreground",
  };
  const status: Column = {
    key: "status",
    header: t.common.status,
    cell: (p) => (
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[p.payment_status] ?? "bg-gray-100 text-gray-600"}`}
      >
        {getPaymentStatusLabel(t, p.payment_status)}
      </span>
    ),
  };
  const reference: Column = {
    key: "reference",
    header: t.admin.payments.colReference,
    cell: (p) => p.payment_reference ?? "—",
    className: "font-mono text-xs text-muted-foreground truncate max-w-32",
  };

  if (tab === "consultation") {
    return [
      { key: "date", header: t.common.date, cell: (p) => date(p.created_at), className: "text-muted-foreground" },
      { key: "patient", header: t.admin.common.patient, cell: (p) => (p.child_profiles ? `${p.child_profiles.first_name} ${p.child_profiles.last_name}` : "—"), className: "text-foreground" },
      { key: "doctor", header: t.admin.common.doctor, cell: (p) => p.doctors?.full_name ?? "—", className: "text-foreground" },
      { key: "scheduled", header: t.admin.payments.colConsultationDate, cell: (p) => date(p.scheduled_date), className: "text-muted-foreground" },
      amount,
      status,
      reference,
    ];
  }

  if (tab === "package") {
    return [
      { key: "date", header: t.admin.packages.colPurchased, cell: (p) => date(p.created_at), className: "text-muted-foreground" },
      { key: "buyer", header: t.admin.packages.colBuyer, cell: (p) => p.buyer_name ?? "—", className: "text-foreground" },
      { key: "package", header: t.admin.packages.colPackage, cell: (p) => p.package_name ?? "—", className: "text-foreground" },
      {
        key: "credits",
        header: t.admin.packages.colCredits,
        cell: (p) =>
          p.credits_total === null
            ? "—"
            : t.admin.packages.creditsOf
                .replace("{remaining}", String(p.credits_remaining))
                .replace("{total}", String(p.credits_total)),
        className: "text-foreground",
      },
      { key: "expires", header: t.admin.packages.colExpires, cell: (p) => date(p.expires_at), className: "text-muted-foreground" },
      amount,
      status,
      reference,
    ];
  }

  if (tab === "live_session") {
    return [
      { key: "date", header: t.common.date, cell: (p) => date(p.created_at), className: "text-muted-foreground" },
      { key: "buyer", header: t.admin.packages.colBuyer, cell: (p) => p.buyer_name ?? "—", className: "text-foreground" },
      { key: "session", header: t.admin.payments.colSession, cell: (p) => p.session_title ?? "—", className: "text-foreground" },
      { key: "host", header: t.admin.common.doctor, cell: (p) => p.doctors?.full_name ?? "—", className: "text-foreground" },
      { key: "scheduled", header: t.admin.payments.colScheduled, cell: (p) => date(p.scheduled_at), className: "text-muted-foreground" },
      amount,
      status,
      reference,
    ];
  }

  return [
    { key: "date", header: t.common.date, cell: (p) => date(p.created_at), className: "text-muted-foreground" },
    {
      key: "type",
      header: t.admin.common.type,
      cell: (p) => (
        <Badge variant="outline" className="text-xs">
          {kindLabel(t, p.kind)}
        </Badge>
      ),
    },
    amount,
    status,
    reference,
  ];
}

function PaymentsTable({
  columns,
  payments,
  loading,
  emptyLabel,
}: {
  columns: Column[];
  payments: Payment[];
  loading: boolean;
  emptyLabel: string;
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  if (payments.length === 0) {
    return <p className="px-6 py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((c) => (
              <th key={c.key} className="px-4 py-3 text-left font-medium text-muted-foreground">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
              {columns.map((c) => (
                <td key={c.key} className={`px-4 py-3 ${c.className ?? ""}`}>
                  {c.cell(p)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminPaymentsPage() {
  const { dictionary: t, dateLocale } = useI18n();
  const { timezone } = useViewerTimezone();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState("");
  const [tab, setTab] = useState<TabValue>("all");
  const LIMIT = 50;

  const load = useCallback((silent = false) => {
    // Skip the skeleton swap on a manual refresh — see RefreshButton.
    if (!silent) setLoading(true);
    adminApi.listPayments({
      status: filterStatus || undefined,
      type: tab === "all" ? undefined : tab,
      page,
      limit: LIMIT,
    })
      .then(({ payments: p, total: t }) => { setPayments(p); setTotal(t); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterStatus, tab, page]);

  useEffect(() => { load(); }, [load]);

  // A status the new tab cannot return would strand the table on an empty list
  // with no hint why, so it is dropped rather than carried across.
  const selectTab = (next: TabValue) => {
    setTab(next);
    setPage(1);
    if (filterStatus && !STATUSES_BY_TAB[next].includes(filterStatus)) setFilterStatus("");
  };

  const totalRevenue = payments.filter((p) => p.payment_status === "paid").reduce((s, p) => s + Number(p.amount_aed), 0);
  const totalPages = Math.ceil(total / LIMIT);
  const cellContext = { t, timezone, dateLocale };

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

      <Tabs value={tab} onValueChange={(v) => selectTab(v as TabValue)}>
        <TabsList className="w-full justify-start">
          {TABS.map((v) => (
            <TabsTrigger key={v} value={v}>{tabLabel(t, v)}</TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6 flex gap-3">
          <Select value={filterStatus || "all"} onValueChange={(v) => { setFilterStatus(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t.admin.common.allStatuses} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.admin.common.allStatuses}</SelectItem>
              {STATUSES_BY_TAB[tab].map((s) => (
                <SelectItem key={s} value={s}>{getPaymentStatusLabel(t, s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {TABS.map((v) => (
          <TabsContent key={v} value={v} className="mt-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t.admin.payments.listTitle.replace("{count}", String(total))}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <PaymentsTable
                  columns={columnsFor(v, cellContext)}
                  payments={payments}
                  loading={loading}
                  emptyLabel={t.admin.payments.empty}
                />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

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
