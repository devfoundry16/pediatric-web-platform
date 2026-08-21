"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n/i18n-context";
import { coursesApi } from "@/lib/api/courses";
import type { Course, CourseEnrollment } from "@/types/courses";
import {
  GraduationCap,
  BookOpen,
  Play,
  Lock,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

interface CatalogCardProps {
  course: Course;
  isEnrolled: boolean;
  enrollment?: CourseEnrollment;
}

function CatalogCard({ course, isEnrolled, enrollment }: CatalogCardProps) {
  const { dictionary: t } = useI18n();
  const tc = t.courses;

  return (
    <Card className="flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      {course.thumbnail_url ? (
        <div className="relative h-40 overflow-hidden bg-muted">
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="h-full w-full object-cover"
          />
          {isEnrolled && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Play className="h-10 w-10 text-white" />
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center bg-primary/5">
          <GraduationCap className="h-12 w-12 text-primary/40" />
        </div>
      )}

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">{course.title}</CardTitle>
          <Badge variant={course.is_free ? "secondary" : "default"} className="shrink-0">
            {course.is_free ? tc.free : `${Number(course.price_aed).toFixed(0)} ${t.common.aed}`}
          </Badge>
        </div>
        {course.doctors?.full_name && (
          <p className="text-xs text-muted-foreground">
            {tc.instructor}: {course.doctors.full_name}
          </p>
        )}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        {course.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{course.description}</p>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5" />
            {course.lesson_count} {tc.lessons}
          </span>
        </div>

        {isEnrolled && enrollment && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{tc.progress}</span>
              <span className="font-medium text-foreground">
                {enrollment.progress_percent}%
              </span>
            </div>
            <Progress value={enrollment.progress_percent} className="h-1.5" />
            {enrollment.completed_at && (
              <div className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle className="h-3 w-3" />
                {tc.courseCompleted}
              </div>
            )}
          </div>
        )}

        <div className="mt-auto pt-1">
          <Button asChild className="w-full" size="sm" variant={isEnrolled ? "outline" : "default"}>
            <Link href={`/dashboard/parent/courses/${course.id}`}>
              {isEnrolled ? (
                <>
                  <Play className="mr-1.5 h-3.5 w-3.5" />
                  {tc.continueLearning}
                </>
              ) : (
                <>
                  {course.is_free ? (
                    <>
                      <Lock className="mr-1.5 h-3.5 w-3.5" />
                      {tc.enrollFree}
                    </>
                  ) : (
                    <>{tc.enrollNow}</>
                  )}
                </>
              )}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ParentCoursesPage() {
  const { dictionary: t } = useI18n();
  const tc = t.courses;

  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const [courses, myEnrollments] = await Promise.all([
        coursesApi.list(),
        coursesApi.getMyEnrollments().catch(() => []),
      ]);
      setAllCourses(courses);
      setEnrollments(myEnrollments);
    } catch {
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }

  const enrolledCourseIds = new Set(enrollments.map((e) => e.courses?.id).filter(Boolean));
  const enrollmentByCourseId = new Map(
    enrollments.map((e) => [e.courses?.id ?? "", e])
  );

  const enrolledCourses = allCourses.filter((c) => enrolledCourseIds.has(c.id));
  const unenrolledCourses = allCourses.filter((c) => !enrolledCourseIds.has(c.id));

  return (
    <DashboardLayout role="parent">
      <div className="flex flex-col gap-8 p-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">{tc.title}</h1>
          <p className="mt-1 text-muted-foreground">{tc.subtitle}</p>
        </div>

        {loadFailed && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {tc.loadError}
          </div>
        )}

        {/* My Enrolled Courses */}
        {(isLoading || enrolledCourses.length > 0) && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">{tc.enrolledCourses}</h2>
              {!isLoading && (
                <Badge variant="secondary">{enrolledCourses.length}</Badge>
              )}
            </div>
            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-72 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {enrolledCourses.map((course) => (
                  <CatalogCard
                    key={course.id}
                    course={course}
                    isEnrolled
                    enrollment={enrollmentByCourseId.get(course.id)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {enrolledCourses.length > 0 && unenrolledCourses.length > 0 && (
          <Separator />
        )}

        {/* All Available Courses */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">{tc.allCourses}</h2>
            {!isLoading && unenrolledCourses.length > 0 && (
              <Badge variant="secondary">{unenrolledCourses.length}</Badge>
            )}
          </div>
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-72 rounded-xl" />
              ))}
            </div>
          ) : unenrolledCourses.length === 0 && enrolledCourses.length > 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                <CheckCircle className="h-10 w-10 text-primary/40" />
                <p className="font-medium text-foreground">
                  {tc.allEnrolled}
                </p>
              </CardContent>
            </Card>
          ) : unenrolledCourses.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                <Clock className="h-10 w-10 text-muted-foreground/40" />
                <p className="font-medium text-foreground">{tc.noCourses}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {unenrolledCourses.map((course) => (
                <CatalogCard key={course.id} course={course} isEnrolled={false} />
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
