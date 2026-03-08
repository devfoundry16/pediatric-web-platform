"use client";

import { useI18n } from "@/lib/i18n/i18n-context";
import { StatCard } from "@/components/dashboard/stat-card";
import { TodaySchedule } from "./today-schedule";
import { RecentPatients } from "./recent-patients";
import { Users, CalendarDays, DollarSign, ClipboardList } from "lucide-react";

export function DoctorOverview() {
  const { dictionary: t } = useI18n();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t.doctorDashboard.welcome}
        </h1>
        <p className="text-muted-foreground">{t.doctorDashboard.todaySchedule}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t.doctorDashboard.totalPatients}
          value={156}
          icon={Users}
        />
        <StatCard
          title={t.doctorDashboard.todayAppointments}
          value={6}
          icon={CalendarDays}
        />
        <StatCard
          title={t.doctorDashboard.monthlyRevenue}
          value="12,450 AED"
          icon={DollarSign}
        />
        <StatCard
          title={t.doctorDashboard.pendingNotes}
          value={3}
          icon={ClipboardList}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TodaySchedule />
        <RecentPatients />
      </div>
    </div>
  );
}
