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

const PAYMENT_STATUSES = ["", "paid", "package_credit", "refunded", "pending"] as const;

const STATUS_COLORS: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  package_credit: "bg-purple-100 text-purple-700",
  refunded: "bg-gray-100 text-gray-600",
  pending: "bg-yellow-100 text-yellow-700",
};

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState("");
  const LIMIT = 50;

  const load = useCallback((silent = false) => {
    // Skip the skeleton swap on a manual refresh — see RefreshButton.
    if (!silent) setLoading(true);
    adminApi.listPayments({ status: filterStatus || undefined, page, limit: LIMIT })
      .then(({ payments: p, total: t }) => { setPayments(p); setTotal(t); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterStatus, page]);

  useEffect(() => { load(); }, [load]);

  const totalRevenue = payments.filter((p) => p.payment_status === "paid").reduce((s, p) => s + Number(p.price_aed), 0);
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payments</h1>
          <p className="text-sm text-muted-foreground">Monitor all payment transactions</p>
        </div>
        <RefreshButton onRefresh={() => load(true)} />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Showing revenue</p>
            <p className="mt-1 text-2xl font-bold text-foreground">AED {totalRevenue.toFixed(0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total transactions</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Package credits</p>
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
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_STATUSES.map((s) => (
              <SelectItem key={s || "all"} value={s || "all"}>{s || "All statuses"}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Transactions ({total})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : payments.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">No payments found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Patient</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Doctor</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Amount</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {p.child_profiles ? `${p.child_profiles.first_name} ${p.child_profiles.last_name}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-foreground">{p.doctors?.full_name ?? "—"}</td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {p.price_aed > 0 ? `AED ${p.price_aed}` : <Badge variant="outline" className="text-xs">Package</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[p.payment_status] ?? "bg-gray-100 text-gray-600"}`}>
                          {p.payment_status}
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
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
