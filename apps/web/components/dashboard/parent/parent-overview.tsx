"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n-context";
import { useAuthStore } from "@/lib/stores/auth-store";
import { StatCard } from "@/components/dashboard/stat-card";
import { UpcomingAppointments } from "./upcoming-appointments";
import { ChildrenList } from "./children-list";
import { childrenApi } from "@/lib/api/children";
import { appointmentsApi } from "@/lib/api/appointments";
import { packagesApi } from "@/lib/api/packages";
import { coursesApi } from "@/lib/api/courses";
import { useFeatureFlag } from "@/lib/feature-flags/feature-flags-context";
import { cn } from "@/lib/utils";
import { Baby, CalendarDays, Package, GraduationCap } from "lucide-react";

export function ParentOverview() {
  const { dictionary: t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const coursesEnabled = useFeatureFlag("courses");
  const displayName =
    (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
    t.parentDashboard.parentFallback;

  const [childrenCount, setChildrenCount] = useState<number | null>(null);
  const [appointmentCount, setAppointmentCount] = useState<number | null>(null);
  const [activePackagesCount, setActivePackagesCount] = useState<number | null>(null);
  const [enrolledCoursesCount, setEnrolledCoursesCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    childrenApi
      .list()
      .then((list) => { if (!cancelled) setChildrenCount(list.length); })
      .catch(() => { if (!cancelled) setChildrenCount(0); });

    appointmentsApi
      .list()
      .then((list) => {
        if (!cancelled)
          setAppointmentCount(list.filter((a) => a.status !== "cancelled").length);
      })
      .catch(() => { if (!cancelled) setAppointmentCount(0); });

    packagesApi
      .getMyPackages()
      .then((pkgs) => {
        if (!cancelled)
          setActivePackagesCount(pkgs.filter((p) => p.status === "active").length);
      })
      .catch(() => { if (!cancelled) setActivePackagesCount(0); });

    return () => { cancelled = true; };
  }, []);

  // Only ask for enrollments once we know the section is live — while courses
  // are coming soon there is no card to fill.
  useEffect(() => {
    if (!coursesEnabled) return;
    let cancelled = false;

    coursesApi
      .getMyEnrollments()
      .then((enrollments) => {
        if (!cancelled) setEnrolledCoursesCount(enrollments.length);
      })
      .catch(() => { if (!cancelled) setEnrolledCoursesCount(0); });

    return () => { cancelled = true; };
  }, [coursesEnabled]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t.parentDashboard.welcome}, {displayName}
        </h1>
        <p className="text-muted-foreground">{t.parentDashboard.overview}</p>
      </div>

      <div
        className={cn(
          "grid grid-cols-1 gap-4 sm:grid-cols-2",
          coursesEnabled ? "lg:grid-cols-4" : "lg:grid-cols-3",
        )}
      >
        <StatCard
          title={t.parentDashboard.totalChildren}
          value={childrenCount ?? "—"}
          icon={Baby}
        />
        <StatCard
          title={t.parentDashboard.totalAppointments}
          value={appointmentCount ?? "—"}
          icon={CalendarDays}
        />
        <StatCard
          title={t.parentDashboard.activePackagesCount}
          value={activePackagesCount ?? "—"}
          icon={Package}
        />
        {coursesEnabled && (
          <StatCard
            title={t.parentDashboard.enrolledCourses}
            value={enrolledCoursesCount ?? "—"}
            icon={GraduationCap}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UpcomingAppointments />
        <ChildrenList />
      </div>
    </div>
  );
}
