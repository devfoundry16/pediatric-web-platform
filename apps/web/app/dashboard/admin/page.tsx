"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, Users, CreditCard, Activity, Clock } from "lucide-react";
import { adminApi, type AdminStats } from "@/lib/api/admin";

function StatCard({
  title,
  value,
  icon: Icon,
  loading,
}: {
  title: string;
  value: string | number | null;
  icon: React.ElementType;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          {loading ? (
            <Skeleton className="mt-1 h-7 w-16" />
          ) : (
            <p className="text-2xl font-bold text-foreground">{value ?? "—"}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  pending: "bg-yellow-100 text-yellow-700",
};

const PAYMENT_COLORS: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  package_credit: "bg-purple-100 text-purple-700",
  refunded: "bg-gray-100 text-gray-600",
  pending: "bg-yellow-100 text-yellow-700",
};

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extracted from the effect so the refresh control can call it too. The
  // error is cleared on success rather than up front: a synchronous setState
  // here runs inside the mount effect and triggers a cascading render.
  const load = useCallback(() => {
    return adminApi
      .getStats()
      .then((data) => {
        setStats(data);
        setError(null);
      })
      .catch(() => setError("Failed to load stats"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">Admin Overview</h1>
          <RefreshButton onRefresh={load} />
        </div>
        <p className="text-sm text-muted-foreground">
          Platform summary and quick status
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Bookings"
          value={stats?.totalBookings ?? null}
          icon={CalendarDays}
          loading={loading}
        />
        <StatCard
          title="Today's Appointments"
          value={stats?.todayAppointments ?? null}
          icon={Clock}
          loading={loading}
        />
        <StatCard
          title="New Users (30d)"
          value={stats?.newUsers ?? null}
          icon={Users}
          loading={loading}
        />
        <StatCard
          title="Revenue (shown below)"
          value={
            stats?.recentPayments
              ? `AED ${stats.recentPayments.reduce((s, p) => s + Number(p.price_aed), 0).toFixed(0)}`
              : null
          }
          icon={CreditCard}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Today's appointments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              Today&apos;s Appointments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !stats?.recentAppointments?.length ? (
              <p className="text-sm text-muted-foreground">
                No appointments today.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {stats.recentAppointments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-foreground">
                      {a.scheduled_time}
                    </span>
                    <span className="flex-1 truncate px-2 text-muted-foreground capitalize">
                      {a.consultation_type}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[a.status] ?? "bg-gray-100 text-gray-700"}`}
                    >
                      {a.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent payments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" />
              Recent Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : !stats?.recentPayments?.length ? (
              <p className="text-sm text-muted-foreground">No payments yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {stats.recentPayments.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-foreground">
                      AED {p.price_aed}
                    </span>
                    <span className="flex-1 truncate px-2 text-muted-foreground">
                      {p.scheduled_date}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-xs ${PAYMENT_COLORS[p.payment_status] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {p.payment_status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
