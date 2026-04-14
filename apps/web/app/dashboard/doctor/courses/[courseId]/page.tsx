"use client";

import { useEffect, useState, use, useRef } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/lib/i18n/i18n-context";
import { coursesApi } from "@/lib/api/courses";
import type { DoctorCourse, CourseLesson } from "@/types/courses";
import { toast } from "sonner";
import {
  ChevronLeft,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  GripVertical,
  Upload,
  CheckCircle,
} from "lucide-react";

interface LessonFormData {
  title: string;
  description: string;
  video_path: string;
  duration_seconds: string;
  is_preview: boolean;
}

const emptyLesson: LessonFormData = {
  title: "",
  description: "",
  video_path: "",
  duration_seconds: "",
  is_preview: false,
};

interface PageProps {
  params: Promise<{ courseId: string }>;
}

export default function DoctorCourseDetailPage({ params }: PageProps) {
  const { courseId } = use(params);
  const { dictionary: t } = useI18n();
  const tc = t.courses;

  const [course, setCourse] = useState<DoctorCourse | null>(null);
  const [lessons, setLessons] = useState<CourseLesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit course form
  const [isEditingCourse, setIsEditingCourse] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editThumbnail, setEditThumbnail] = useState("");
  const [editIsFree, setEditIsFree] = useState(true);
  const [editPrice, setEditPrice] = useState("");
  const [isSavingCourse, setIsSavingCourse] = useState(false);

  // Lesson dialog
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<CourseLesson | null>(null);
  const [lessonForm, setLessonForm] = useState<LessonFormData>(emptyLesson);
  const [isSavingLesson, setIsSavingLesson] = useState(false);

  // Video upload
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete lesson
  const [deletingLessonId, setDeletingLessonId] = useState<string | null>(null);
  const [isDeletingLesson, setIsDeletingLesson] = useState(false);

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function loadData() {
    setIsLoading(true);
    setError(null);
    try {
      const [coursesData, lessonsData] = await Promise.all([
        coursesApi.getCreatedCourses(),
        coursesApi.getLessons(courseId),
      ]);
      const found = coursesData.find((c) => c.id === courseId) ?? null;
      setCourse(found);
      if (found) {
        setEditTitle(found.title);
        setEditDescription(found.description ?? "");
        setEditThumbnail(found.thumbnail_url ?? "");
        setEditIsFree(found.is_free);
        setEditPrice(found.price_aed ? String(found.price_aed) : "");
      }
      setLessons(lessonsData);
    } catch {
      setError("Failed to load course data.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveCourse(e: React.FormEvent) {
    e.preventDefault();
    if (!course) return;
    setIsSavingCourse(true);
    try {
      const updated = await coursesApi.updateCourse(courseId, {
        title: editTitle,
        description: editDescription || undefined,
        thumbnail_url: editThumbnail || undefined,
        is_free: editIsFree,
        price_aed: editIsFree ? 0 : parseFloat(editPrice) || 0,
      });
      setCourse(updated);
      setIsEditingCourse(false);
      toast.success(tc.courseUpdated);
    } catch {
      toast.error("Failed to update course.");
    } finally {
      setIsSavingCourse(false);
    }
  }

  async function handleTogglePublish(published: boolean) {
    if (!course) return;
    try {
      const updated = await coursesApi.updateCourse(courseId, { is_published: published });
      setCourse(updated);
      toast.success(tc.courseUpdated);
    } catch {
      toast.error("Failed to update course.");
    }
  }

  function openAddLesson() {
    setEditingLesson(null);
    setLessonForm(emptyLesson);
    setLessonDialogOpen(true);
  }

  function openEditLesson(lesson: CourseLesson) {
    setEditingLesson(lesson);
    setLessonForm({
      title: lesson.title,
      description: lesson.description ?? "",
      video_path: lesson.video_path ?? "",
      duration_seconds: lesson.duration_seconds ? String(lesson.duration_seconds) : "",
      is_preview: lesson.is_preview,
    });
    setLessonDialogOpen(true);
  }

  async function handleVideoUpload(file: File) {
    setIsUploading(true);
    setUploadProgress(tc.uploadingVideo);
    try {
      const { uploadUrl, path } = await coursesApi.getUploadUrl(
        courseId,
        file.name,
        file.type
      );
      // Upload directly to Supabase Storage via the signed upload URL
      await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      setLessonForm((prev) => ({ ...prev, video_path: path }));
      setUploadProgress(null);
      toast.success(tc.videoUploaded);
    } catch {
      toast.error("Failed to upload video.");
      setUploadProgress(null);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSaveLesson(e: React.FormEvent) {
    e.preventDefault();
    if (!lessonForm.title.trim()) return;
    setIsSavingLesson(true);
    try {
      const payload = {
        title: lessonForm.title.trim(),
        description: lessonForm.description.trim() || undefined,
        video_path: lessonForm.video_path.trim() || undefined,
        duration_seconds: lessonForm.duration_seconds
          ? parseInt(lessonForm.duration_seconds)
          : 0,
        is_preview: lessonForm.is_preview,
      };

      if (editingLesson) {
        const updated = await coursesApi.updateLesson(courseId, editingLesson.id, payload);
        setLessons((prev) =>
          prev.map((l) => (l.id === editingLesson.id ? updated : l))
        );
        toast.success(tc.lessonUpdated);
      } else {
        const created = await coursesApi.addLesson(courseId, {
          ...payload,
          order_index: lessons.length,
        });
        setLessons((prev) => [...prev, created]);
        toast.success(tc.lessonAdded);
      }
      setLessonDialogOpen(false);
    } catch {
      toast.error("Failed to save lesson.");
    } finally {
      setIsSavingLesson(false);
    }
  }

  async function handleDeleteLesson() {
    if (!deletingLessonId) return;
    setIsDeletingLesson(true);
    try {
      await coursesApi.deleteLesson(courseId, deletingLessonId);
      setLessons((prev) => prev.filter((l) => l.id !== deletingLessonId));
      toast.success(tc.lessonDeleted);
      setDeletingLessonId(null);
    } catch {
      toast.error("Failed to delete lesson.");
    } finally {
      setIsDeletingLesson(false);
    }
  }

  return (
    <DashboardLayout role="doctor">
      <div className="flex flex-col gap-6 p-6">
        <Link
          href="/dashboard/doctor/courses"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {t.common.back}
        </Link>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : course ? (
          <div className="flex flex-col gap-8 max-w-3xl">
            {/* Course details */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="text-base">{tc.editCourse}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={course.is_published ? "default" : "secondary"}>
                      {course.is_published ? tc.published : tc.draft}
                    </Badge>
                    <Switch
                      checked={course.is_published}
                      onCheckedChange={handleTogglePublish}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!isEditingCourse ? (
                  <div className="flex flex-col gap-3">
                    <div>
                      <p className="text-lg font-semibold">{course.title}</p>
                      {course.description && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {course.description}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                      <span>
                        {course.is_free ? tc.free : `${Number(course.price_aed).toFixed(0)} AED`}
                      </span>
                      <span>·</span>
                      <span>{course.lesson_count} {tc.lessons}</span>
                      <span>·</span>
                      <span>{course.enrollment_count} {tc.enrollments}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-fit"
                      onClick={() => setIsEditingCourse(true)}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      {tc.editCourse}
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSaveCourse} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="edit-title">{tc.courseTitle} *</Label>
                      <Input
                        id="edit-title"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="edit-desc">{tc.courseDescription}</Label>
                      <Textarea
                        id="edit-desc"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="edit-thumb">{tc.thumbnailUrl}</Label>
                      <Input
                        id="edit-thumb"
                        type="url"
                        value={editThumbnail}
                        onChange={(e) => setEditThumbnail(e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <Label htmlFor="edit-free" className="cursor-pointer">
                        {tc.isFree}
                      </Label>
                      <Switch
                        id="edit-free"
                        checked={editIsFree}
                        onCheckedChange={setEditIsFree}
                      />
                    </div>
                    {!editIsFree && (
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="edit-price">{tc.priceAed}</Label>
                        <Input
                          id="edit-price"
                          type="number"
                          min="0"
                          step="0.01"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                        />
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" disabled={isSavingCourse}>
                        {isSavingCourse && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {tc.saveCourse}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditingCourse(false)}
                      >
                        {t.common.cancel}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>

            <Separator />

            {/* Lessons */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{tc.courseContent}</h2>
                <Button size="sm" onClick={openAddLesson}>
                  <Plus className="mr-2 h-4 w-4" />
                  {tc.addLesson}
                </Button>
              </div>

              {lessons.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                    <p className="text-sm text-muted-foreground">{tc.noLessons}</p>
                    <Button variant="outline" size="sm" onClick={openAddLesson}>
                      <Plus className="mr-2 h-4 w-4" />
                      {tc.addLesson}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex flex-col gap-2">
                  {lessons.map((lesson, idx) => (
                    <Card key={lesson.id}>
                      <CardContent className="flex items-center gap-3 p-3">
                        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                          {idx + 1}
                        </div>
                        <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{lesson.title}</span>
                            {lesson.is_preview && (
                              <Badge variant="outline" className="text-xs shrink-0">
                                {tc.preview}
                              </Badge>
                            )}
                            {lesson.video_path && (
                              <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                            )}
                          </div>
                          {lesson.description && (
                            <span className="truncate text-xs text-muted-foreground">
                              {lesson.description}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditLesson(lesson)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingLessonId(lesson.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">Course not found.</p>
        )}
      </div>

      {/* Add / Edit Lesson Dialog */}
      <Dialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingLesson ? tc.editLesson : tc.addLesson}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveLesson} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lesson-title">{tc.lessonTitle} *</Label>
              <Input
                id="lesson-title"
                value={lessonForm.title}
                onChange={(e) =>
                  setLessonForm((p) => ({ ...p, title: e.target.value }))
                }
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lesson-desc">{tc.lessonDescription}</Label>
              <Textarea
                id="lesson-desc"
                value={lessonForm.description}
                onChange={(e) =>
                  setLessonForm((p) => ({ ...p, description: e.target.value }))
                }
                rows={2}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{tc.videoFile}</Label>
              <div className="flex flex-col gap-2">
                {lessonForm.video_path && (
                  <p className="flex items-center gap-1.5 rounded-md bg-muted p-2 text-xs text-muted-foreground">
                    <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    <span className="truncate">{lessonForm.video_path}</span>
                  </p>
                )}
                {uploadProgress && (
                  <p className="text-xs text-muted-foreground">{uploadProgress}</p>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleVideoUpload(file);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {isUploading ? tc.uploadingVideo : tc.uploadVideo}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lesson-duration">Duration (seconds)</Label>
              <Input
                id="lesson-duration"
                type="number"
                min="0"
                value={lessonForm.duration_seconds}
                onChange={(e) =>
                  setLessonForm((p) => ({ ...p, duration_seconds: e.target.value }))
                }
                placeholder="e.g. 300 for 5 minutes"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="lesson-preview" className="cursor-pointer text-sm">
                {tc.isPreview}
              </Label>
              <Switch
                id="lesson-preview"
                checked={lessonForm.is_preview}
                onCheckedChange={(v) =>
                  setLessonForm((p) => ({ ...p, is_preview: v }))
                }
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setLessonDialogOpen(false)}
              >
                {t.common.cancel}
              </Button>
              <Button type="submit" disabled={isSavingLesson || !lessonForm.title.trim()}>
                {isSavingLesson && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tc.saveLesson}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Lesson Confirm */}
      <AlertDialog
        open={!!deletingLessonId}
        onOpenChange={(open) => !open && setDeletingLessonId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tc.deleteLesson}</AlertDialogTitle>
            <AlertDialogDescription>
              {tc.deleteLessonConfirm}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLesson}
              disabled={isDeletingLesson}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingLesson && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tc.deleteLesson}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
