"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n-context";
import { StatCard } from "@/components/dashboard/stat-card";
import { TodaySchedule } from "./today-schedule";
import { RecentPatients } from "./recent-patients";
import { Users, CalendarDays, DollarSign, ClipboardList } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { doctorApi, type DoctorStats } from "@/lib/api/doctor";

export function DoctorOverview() {
  const { dictionary: t } = useI18n();
  const [stats, setStats] = useState<DoctorStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    doctorApi
      .getStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t.doctorDashboard.welcome}
        </h1>
        <p className="text-muted-foreground">{t.doctorDashboard.todaySchedule}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))
        ) : (
          <>
            <StatCard
              title={t.doctorDashboard.totalPatients}
              value={stats?.totalPatients ?? 0}
              icon={Users}
            />
            <StatCard
              title={t.doctorDashboard.todayAppointments}
              value={stats?.todayAppointments ?? 0}
              icon={CalendarDays}
            />
            <StatCard
              title={t.doctorDashboard.monthlyRevenue}
              value="—"
              icon={DollarSign}
            />
            <StatCard
              title={t.doctorDashboard.pendingNotes}
              value={stats?.pendingNotes ?? 0}
              icon={ClipboardList}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TodaySchedule />
        <RecentPatients />
      </div>
    </div>
  );
}
