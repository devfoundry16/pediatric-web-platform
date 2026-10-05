"use client";

import Link from "next/link";
import { CoursesManager } from "@/components/dashboard/courses/courses-manager";
import { coursesApi } from "@/lib/api/courses";
import { useFeatureFlag } from "@/lib/feature-flags/feature-flags-context";
import { useI18n } from "@/lib/i18n/i18n-context";
import { EyeOff } from "lucide-react";

// Unlike the doctor and parent course pages, this one is not hidden behind the
// "courses" flag: admins build courses before switching the section on.
export default function AdminCoursesPage() {
  const { dictionary: t } = useI18n();
  const coursesEnabled = useFeatureFlag("courses");

  return (
    <CoursesManager
      basePath="/dashboard/admin/courses"
      fetchCourses={coursesApi.getAllCourses}
      subtitle={t.admin.courses.subtitle}
      showInstructor
      notice={
        coursesEnabled ? null : (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <EyeOff className="h-4 w-4 shrink-0" />
            <span>{t.admin.courses.flagOffNotice}</span>
            <Link href="/dashboard/admin/settings" className="font-medium underline">
              {t.admin.courses.flagOffLink}
            </Link>
          </div>
        )
      }
    />
  );
}
