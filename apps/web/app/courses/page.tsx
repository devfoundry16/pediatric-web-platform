"use client";

import { useI18n } from "@/lib/i18n/i18n-context";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { CourseCard } from "@/components/courses/course-card";
import { ComingSoon } from "@/components/coming-soon";
import { useFeatureFlag } from "@/lib/feature-flags/feature-flags-context";
import { GraduationCap } from "lucide-react";

// Placeholder catalog; the text lives in the dictionary (courses.samples).
const mockCourses = [
  {
    id: "1",
    key: "c1",
    lessons: 12,
    price: 199,
    enrolled: false,
  },
  {
    id: "2",
    key: "c2",
    lessons: 8,
    price: 149,
    enrolled: true,
    progress: 62,
  },
  {
    id: "3",
    key: "c3",
    lessons: 6,
    price: 0,
    enrolled: false,
  },
  {
    id: "4",
    key: "c4",
    lessons: 10,
    price: 179,
    enrolled: true,
    progress: 25,
  },
  {
    id: "5",
    key: "c5",
    lessons: 15,
    price: 249,
    enrolled: false,
  },
  {
    id: "6",
    key: "c6",
    lessons: 9,
    price: 129,
    enrolled: false,
  },
] as const;

export default function CoursesPage() {
  const { dictionary: t } = useI18n();
  const coursesEnabled = useFeatureFlag("courses");

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {t.courses.title}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              {t.courses.subtitle}
            </p>
          </div>

          {coursesEnabled ? (
            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {mockCourses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={{ ...course, ...t.courses.samples[course.key] }}
                />
              ))}
            </div>
          ) : (
            <div className="mx-auto mt-12 max-w-2xl">
              <ComingSoon
                title={t.courses.comingSoonTitle}
                description={t.courses.comingSoonDesc}
                icon={GraduationCap}
              />
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
