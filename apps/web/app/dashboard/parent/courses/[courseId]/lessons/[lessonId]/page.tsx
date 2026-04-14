"use client";

import { useEffect, useRef, useState, use, useCallback } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n/i18n-context";
import { coursesApi } from "@/lib/api/courses";
import { downloadCourseCertificate } from "@/lib/course-certificate-download";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { CourseDetail, CourseLesson } from "@/types/courses";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  BookOpen,
  Loader2,
  Award,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ courseId: string; lessonId: string }>;
}

export default function LessonPlayerPage({ params }: PageProps) {
  const { courseId, lessonId } = use(params);
  const { dictionary: t } = useI18n();
  const tc = t.courses;

  const videoRef = useRef<HTMLVideoElement>(null);
  const user = useAuthStore((s) => s.user);

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [currentLesson, setCurrentLesson] = useState<CourseLesson | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);
  const [courseCompleted, setCourseCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const courseData = await coursesApi.get(courseId);
      setCourse(courseData);

      const lesson = courseData.course_lessons.find((l) => l.id === lessonId);
      if (!lesson) {
        setError("Lesson not found.");
        return;
      }
      setCurrentLesson(lesson);

      // Get signed stream URL
      if (lesson.video_path) {
        const url = await coursesApi.getStreamUrl(courseId, lessonId);
        setSignedUrl(url);
      }

      // Load enrollment to know progress
      const enrollments = await coursesApi.getMyEnrollments().catch(() => []);
      const enrollment = enrollments.find((e) => e.courses?.id === courseId);
      if (enrollment?.completed_at) {
        setCourseCompleted(true);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load lesson.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [courseId, lessonId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleMarkComplete() {
    if (!currentLesson) return;
    setIsMarkingComplete(true);
    try {
      const result = await coursesApi.markLessonComplete(courseId, lessonId);
      setCompletedIds((prev) => new Set([...prev, lessonId]));
      if (result.course_completed) {
        setCourseCompleted(true);
        toast.success(tc.courseCompleted + " " + tc.congratulations);
      } else {
        toast.success(tc.lessonCompleted);
      }
    } catch {
      toast.error("Failed to mark lesson as complete.");
    } finally {
      setIsMarkingComplete(false);
    }
  }

  const lessons = course?.course_lessons ?? [];
  const currentIndex = lessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? lessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null;
  const isCompleted = completedIds.has(lessonId);
  const completedCount = completedIds.size;
  const totalCount = lessons.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <DashboardLayout role="parent">
      <div className="flex flex-col gap-4 p-6">
        {/* Back link */}
        <Link
          href={`/dashboard/parent/courses/${courseId}`}
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {tc.backToCourse}
        </Link>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {courseCompleted && (
            <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400">
            <Award className="h-5 w-5 shrink-0" />
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <span className="font-medium">{tc.courseCompleted}</span>
              <span className="text-sm">{tc.congratulations}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 border-green-300 text-green-700 hover:bg-green-100 dark:border-green-700 dark:text-green-400"
              onClick={() => {
                if (!course) return;
                downloadCourseCertificate({
                  recipientName:
                    user?.user_metadata?.full_name ??
                    user?.email ??
                    "Participant",
                  courseTitle: course.title,
                  instructorName: course.doctors?.full_name ?? null,
                  completedAt: new Date().toISOString(),
                });
              }}
            >
              {tc.downloadCertificate}
            </Button>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* Video Player */}
          <div className="flex flex-col gap-4">
            {isLoading ? (
              <Skeleton className="aspect-video w-full rounded-xl" />
            ) : signedUrl ? (
              <div className="overflow-hidden rounded-xl bg-black shadow-lg">
                <video
                  ref={videoRef}
                  key={signedUrl}
                  controls
                  className="aspect-video w-full"
                  onEnded={handleMarkComplete}
                >
                  <source src={signedUrl} />
                  Your browser does not support the video tag.
                </video>
              </div>
            ) : (
              <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-muted">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <BookOpen className="h-12 w-12" />
                  <p className="text-sm">No video available for this lesson</p>
                </div>
              </div>
            )}

            {/* Lesson title + actions */}
            {isLoading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : currentLesson ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {tc.lesson} {currentIndex + 1} / {totalCount}
                      </span>
                      {currentLesson.is_preview && (
                        <Badge variant="outline" className="text-xs">
                          {tc.preview}
                        </Badge>
                      )}
                      {isCompleted && (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle className="mr-1 h-3 w-3 text-green-500" />
                          {tc.lessonCompleted}
                        </Badge>
                      )}
                    </div>
                    <h1 className="text-xl font-bold text-foreground">{currentLesson.title}</h1>
                    {currentLesson.description && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {currentLesson.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Mark complete + navigation */}
                <div className="flex flex-wrap items-center gap-2">
                  {!isCompleted && (
                    <Button
                      onClick={handleMarkComplete}
                      disabled={isMarkingComplete}
                      size="sm"
                    >
                      {isMarkingComplete ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="mr-2 h-4 w-4" />
                      )}
                      {tc.lessonComplete}
                    </Button>
                  )}

                  <div className="ml-auto flex items-center gap-2">
                    {prevLesson && (
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={`/dashboard/parent/courses/${courseId}/lessons/${prevLesson.id}`}
                        >
                          <ChevronLeft className="mr-1 h-4 w-4" />
                          {t.common.previous}
                        </Link>
                      </Button>
                    )}
                    {nextLesson && (
                      <Button asChild size="sm">
                        <Link
                          href={`/dashboard/parent/courses/${courseId}/lessons/${nextLesson.id}`}
                        >
                          {t.common.next}
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Lesson Sidebar */}
          <div className="flex flex-col gap-4">
            {/* Progress */}
            {totalCount > 0 && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{tc.progress}</span>
                    <span className="text-muted-foreground">
                      {completedCount}/{totalCount}
                    </span>
                  </div>
                  <Progress value={progressPercent} className="mt-2 h-2" />
                </CardContent>
              </Card>
            )}

            {/* Lesson list */}
            <Card>
              <CardContent className="p-3">
                <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {tc.courseContent}
                </p>
                <div className="flex flex-col gap-1">
                  {isLoading
                    ? [1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-10 rounded-md" />
                      ))
                    : lessons.map((lesson, idx) => {
                        const isCurrent = lesson.id === lessonId;
                        const isDone = completedIds.has(lesson.id);

                        return (
                          <Link
                            key={lesson.id}
                            href={`/dashboard/parent/courses/${courseId}/lessons/${lesson.id}`}
                            className={cn(
                              "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors",
                              isCurrent
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs">
                              {isDone ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <span
                                  className={cn(
                                    "flex h-5 w-5 items-center justify-center rounded-full border text-xs",
                                    isCurrent
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-border"
                                  )}
                                >
                                  {idx + 1}
                                </span>
                              )}
                            </div>
                            <span className="line-clamp-2 flex-1">{lesson.title}</span>
                          </Link>
                        );
                      })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
