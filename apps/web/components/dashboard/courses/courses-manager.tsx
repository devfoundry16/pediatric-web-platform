"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n/i18n-context";
import { coursesApi } from "@/lib/api/courses";
import { courseInstructorName, type DoctorCourse } from "@/types/courses";
import { useAuthStore } from "@/lib/stores/auth-store";
import { toast } from "sonner";
import {
  GraduationCap,
  Plus,
  BookOpen,
  Users,
  Settings,
  AlertCircle,
  UserRound,
} from "lucide-react";

function CourseCard({
  course,
  basePath,
  showInstructor,
  onTogglePublish,
}: {
  course: DoctorCourse;
  basePath: string;
  showInstructor: boolean;
  onTogglePublish: (id: string, published: boolean) => Promise<void>;
}) {
  const { dictionary: t } = useI18n();
  const tc = t.courses;
  const [isToggling, setIsToggling] = useState(false);
  const currentUserId = useAuthStore((st) => st.user?.id);
  const instructorName =
    course.instructor && course.instructor.id === currentUserId
      ? tc.instructorYou
      : courseInstructorName(course) ?? "—";

  async function handleToggle(checked: boolean) {
    setIsToggling(true);
    try {
      await onTogglePublish(course.id, checked);
    } finally {
      setIsToggling(false);
    }
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {course.thumbnail_url ? (
              <img
                src={course.thumbnail_url}
                alt={course.title}
                className="h-12 w-16 shrink-0 rounded-md object-cover"
              />
            ) : (
              <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <GraduationCap className="h-6 w-6 text-primary/60" />
              </div>
            )}
            <div>
              <CardTitle className="text-base leading-snug">{course.title}</CardTitle>
              <Badge
                variant={course.is_published ? "default" : "secondary"}
                className="mt-1 text-xs"
              >
                {course.is_published ? tc.published : tc.draft}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">
              {course.is_published ? tc.published : tc.draft}
            </span>
            <Switch
              checked={course.is_published}
              onCheckedChange={handleToggle}
              disabled={isToggling}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        {course.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{course.description}</p>
        )}

        {showInstructor && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <UserRound className="h-3.5 w-3.5" />
            {tc.instructor}: {instructorName}
          </p>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5" />
            {course.lesson_count} {tc.lessons}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {course.enrollment_count} {tc.enrollments}
          </span>
          <span className="flex items-center gap-1">
            {course.is_free ? (
              <Badge variant="outline" className="text-xs">
                {tc.free}
              </Badge>
            ) : (
              <span>{Number(course.price_aed).toFixed(0)} {t.common.aed}</span>
            )}
          </span>
        </div>

        <div className="mt-auto pt-1">
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href={`${basePath}/${course.id}`}>
              <Settings className="me-2 h-4 w-4" />
              {tc.editCourse}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The course management list, shared by the doctor dashboard (their own
 * courses) and the admin dashboard (every course). The API decides what the
 * caller may change; this only differs in where it loads from and links to.
 */
export function CoursesManager({
  basePath,
  fetchCourses,
  subtitle,
  showInstructor = false,
  notice,
}: {
  /** Dashboard route the "new" and course links hang off. */
  basePath: string;
  fetchCourses: () => Promise<DoctorCourse[]>;
  subtitle: string;
  /** Show who teaches each course — useful only when the list spans instructors. */
  showInstructor?: boolean;
  /** Shown above the list, e.g. that the section is switched off. */
  notice?: ReactNode;
}) {
  const { dictionary: t } = useI18n();
  const tc = t.courses;

  const [courses, setCourses] = useState<DoctorCourse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  // Load once on mount; fetchCourses is a stable module-level API method.
  useEffect(() => {
    loadCourses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCourses() {
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const data = await fetchCourses();
      setCourses(data);
    } catch {
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleTogglePublish(courseId: string, published: boolean) {
    try {
      await coursesApi.updateCourse(courseId, { is_published: published });
      setCourses((prev) =>
        prev.map((c) => (c.id === courseId ? { ...c, is_published: published } : c))
      );
      toast.success(tc.courseUpdated);
    } catch {
      toast.error(tc.updateError);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{tc.manageCourses}</h1>
            <p className="mt-1 text-muted-foreground">
              {subtitle}
            </p>
          </div>
          <Button asChild>
            <Link href={`${basePath}/new`}>
              <Plus className="me-2 h-4 w-4" />
              {tc.createCourse}
            </Link>
          </Button>
        </div>

        {notice}

        {loadFailed && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {tc.loadError}
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <GraduationCap className="h-12 w-12 text-muted-foreground/40" />
              <p className="font-medium text-foreground">{tc.emptyTitle}</p>
              <p className="text-sm text-muted-foreground">
                {tc.emptySubtitle}
              </p>
              <Button asChild className="mt-2">
                <Link href={`${basePath}/new`}>
                  <Plus className="me-2 h-4 w-4" />
                  {tc.createCourse}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                basePath={basePath}
                showInstructor={showInstructor}
                onTogglePublish={handleTogglePublish}
              />
            ))}
          </div>
        )}
    </div>
  );
}
