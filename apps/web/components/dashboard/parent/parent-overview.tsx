"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n-context";
import { useAuthStore } from "@/lib/stores/auth-store";
import { StatCard } from "@/components/dashboard/stat-card";
import { UpcomingAppointments } from "./upcoming-appointments";
import { ChildrenList } from "./children-list";
import { childrenApi } from "@/lib/api/children";
import { Baby, CalendarDays, Package, GraduationCap } from "lucide-react";

export function ParentOverview() {
  const { dictionary: t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const displayName =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
    "Parent";

  const [childrenCount, setChildrenCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    childrenApi
      .list()
      .then((list) => {
        if (!cancelled) setChildrenCount(list.length);
      })
      .catch(() => {
        if (!cancelled) setChildrenCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t.parentDashboard.welcome}, {displayName}
        </h1>
        <p className="text-muted-foreground">{t.parentDashboard.overview}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t.parentDashboard.totalChildren}
          value={childrenCount ?? "—"}
          icon={Baby}
        />
        <StatCard
          title={t.parentDashboard.totalAppointments}
          value={8}
          icon={CalendarDays}
        />
        <StatCard
          title={t.parentDashboard.activePackagesCount}
          value={1}
          icon={Package}
        />
        <StatCard
          title={t.parentDashboard.enrolledCourses}
          value={3}
          icon={GraduationCap}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UpcomingAppointments />
        <ChildrenList />
      </div>
    </div>
  );
}
