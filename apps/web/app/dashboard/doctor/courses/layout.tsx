"use client";

import type { ReactNode } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ComingSoon } from "@/components/coming-soon";
import { useI18n } from "@/lib/i18n/i18n-context";
import { useFeatureFlag } from "@/lib/feature-flags/feature-flags-context";
import { GraduationCap } from "lucide-react";

/**
 * Gating happens in the layout so every route below it — course list, course
 * builder, new course — is replaced by the coming-soon panel. The pages
 * underneath are never rendered, so they never hit the courses API.
 */
export default function DoctorCoursesLayout({ children }: { children: ReactNode }) {
  const { dictionary: t } = useI18n();
  const coursesEnabled = useFeatureFlag("courses");

  if (coursesEnabled) return <>{children}</>;

  return (
    <DashboardLayout role="doctor">
      <div className="mx-auto max-w-2xl">
        <ComingSoon
          title={t.courses.comingSoonTitle}
          description={t.courses.comingSoonDesc}
          icon={GraduationCap}
        />
      </div>
    </DashboardLayout>
  );
}
