"use client";

import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { CoursesManager } from "@/components/dashboard/courses/courses-manager";
import { coursesApi } from "@/lib/api/courses";
import { useI18n } from "@/lib/i18n/i18n-context";

export default function DoctorCoursesPage() {
  const { dictionary: t } = useI18n();

  return (
    <DashboardLayout role="doctor">
      <CoursesManager
        basePath="/dashboard/doctor/courses"
        fetchCourses={coursesApi.getCreatedCourses}
        subtitle={t.courses.manageSubtitle}
      />
    </DashboardLayout>
  );
}
