"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n/i18n-context";
import { coursesApi } from "@/lib/api/courses";
import type { CourseDetail, CourseEnrollment } from "@/types/courses";
import { toast } from "sonner";
import {
  GraduationCap,
  BookOpen,
  Lock,
  Play,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  Loader2,
  Eye,
} from "lucide-react";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

interface PageProps {
  params: Promise<{ courseId: string }>;
}

export default function CourseDetailPage({ params }: PageProps) {
  const { courseId } = use(params);
  const { dictionary: t } = useI18n();
  const tc = t.courses;

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [enrollment, setEnrollment] = useState<CourseEnrollment | null>(null);
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function loadData() {
    setIsLoading(true);
    setError(null);
    try {
      const [courseData, enrollments] = await Promise.all([
        coursesApi.get(courseId),
        coursesApi.getMyEnrollments().catch(() => []),
      ]);
      setCourse(courseData);

      const myEnrollment = enrollments.find((e) => e.courses?.id === courseId) ?? null;
      setEnrollment(myEnrollment);

      if (myEnrollment) {
        // Load progress from API — we know lesson counts from enrollment
        // Build completed set from enrollment data
        const enrolled = enrollments.find((e) => e.courses?.id === courseId);
        if (enrolled && enrolled.completed_lessons > 0) {
          // We don't have exact lesson IDs in enrollment response, so we'll
          // track progress locally after marking complete
        }
      }
    } catch {
      setError("Failed to load course. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleEnroll() {
    if (!course) return;
    setIsEnrolling(true);
    try {
      await coursesApi.enroll(courseId);
      toast.success(tc.enrolled);
      await loadData();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Enrollment failed. Please try again.";
      toast.error(message);
    } finally {
      setIsEnrolling(false);
    }
  }

  const isEnrolled = !!enrollment;
  const progressPercent = enrollment?.progress_percent ?? 0;
  const totalLessons = course?.course_lessons.length ?? 0;

  return (
    <DashboardLayout role="parent">
      <div className="flex flex-col gap-6 p-6">
        {/* Back link */}
        <Link
          href="/dashboard/parent/courses"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {tc.backToCourses}
        </Link>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : course ? (
          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            {/* Left column: course info */}
            <div className="flex flex-col gap-6">
              {/* Title + meta */}
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-start gap-2">
                  <h1 className="text-2xl font-bold text-foreground">{course.title}</h1>
                  <Badge variant={course.is_free ? "secondary" : "default"}>
                    {course.is_free ? tc.free : `${Number(course.price_aed).toFixed(0)} AED`}
                  </Badge>
                  {isEnrolled && enrollment?.completed_at && (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      {tc.courseCompleted}
                    </Badge>
                  )}
                </div>

                {course.doctors?.full_name && (
                  <p className="text-sm text-muted-foreground">
                    {tc.instructor}:{" "}
                    <span className="font-medium text-foreground">
                      {course.doctors.full_name}
                    </span>
                  </p>
                )}

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    {totalLessons} {tc.lessons}
                  </span>
                </div>
              </div>

              {course.description && (
                <p className="text-muted-foreground">{course.description}</p>
              )}

              {/* Progress bar for enrolled */}
              {isEnrolled && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{tc.progress}</span>
                      <span className="text-muted-foreground">
                        {enrollment?.completed_lessons ?? 0} / {totalLessons} {tc.lessons}
                      </span>
                    </div>
                    <Progress value={progressPercent} className="mt-2 h-2" />
                  </CardContent>
                </Card>
              )}

              <Separator />

              {/* Lesson list */}
              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold">{tc.courseContent}</h2>
                <div className="flex flex-col gap-2">
                  {course.course_lessons.map((lesson, idx) => {
                    const canWatch = isEnrolled || lesson.is_preview;
                    const isCompleted = completedLessonIds.has(lesson.id);

                    return (
                      <div
                        key={lesson.id}
                        className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                          {isCompleted ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            idx + 1
                          )}
                        </div>

                        <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                          <span className="truncate text-sm font-medium text-foreground">
                            {lesson.title}
                          </span>
                          {lesson.duration_seconds > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {formatDuration(lesson.duration_seconds)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {lesson.is_preview && !isEnrolled && (
                            <Badge variant="outline" className="text-xs">
                              <Eye className="mr-1 h-3 w-3" />
                              {tc.preview}
                            </Badge>
                          )}
                          {canWatch ? (
                            <Button
                              asChild
                              size="sm"
                              variant={isCompleted ? "ghost" : "outline"}
                            >
                              <Link
                                href={`/dashboard/parent/courses/${courseId}/lessons/${lesson.id}`}
                              >
                                <Play className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          ) : (
                            <Lock className="h-4 w-4 text-muted-foreground/50" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right column: enrollment card */}
            <div className="lg:sticky lg:top-6">
              <Card>
                <CardContent className="flex flex-col gap-4 p-6">
                  {course.thumbnail_url ? (
                    <img
                      src={course.thumbnail_url}
                      alt={course.title}
                      className="w-full rounded-lg object-cover"
                      style={{ maxHeight: 160 }}
                    />
                  ) : (
                    <div className="flex h-32 items-center justify-center rounded-lg bg-primary/5">
                      <GraduationCap className="h-12 w-12 text-primary/40" />
                    </div>
                  )}

                  {isEnrolled ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span className="font-medium">{tc.enrolled}</span>
                      </div>
                      <Button asChild className="w-full">
                        <Link
                          href={`/dashboard/parent/courses/${courseId}/lessons/${
                            course.course_lessons[0]?.id ?? ""
                          }`}
                        >
                          <Play className="mr-2 h-4 w-4" />
                          {progressPercent > 0 ? tc.continueLearning : tc.startLearning}
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="text-center">
                        <span className="text-2xl font-bold text-foreground">
                          {course.is_free ? tc.free : `${Number(course.price_aed).toFixed(0)} AED`}
                        </span>
                      </div>
                      <Button
                        className="w-full"
                        onClick={handleEnroll}
                        disabled={isEnrolling}
                      >
                        {isEnrolling ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        {course.is_free ? tc.enrollFree : tc.enrollNow}
                      </Button>
                      <p className="text-center text-xs text-muted-foreground">
                        {tc.enrollToUnlock}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
