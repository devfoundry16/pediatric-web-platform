import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getDoctorId(userId: string | undefined): Promise<string | null> {
  if (!supabaseAdmin || !userId) return null;
  const { data } = await supabaseAdmin
    .from("doctors")
    .select("id")
    .eq("profile_id", userId)
    .single();
  return data?.id ?? null;
}

async function isEnrolled(userId: string, courseId: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const { data } = await supabaseAdmin
    .from("course_enrollments")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();
  return !!data;
}

// ─── Public: Course Catalog ────────────────────────────────────────────────────

// GET /api/courses
export async function listCourses(_req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("courses")
    .select(
      `
      id,
      slug,
      title,
      description,
      thumbnail_url,
      is_free,
      price_aed,
      created_at,
      doctors (
        id,
        full_name
      ),
      course_lessons ( id )
    `,
    )
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const courses = (data ?? []).map((c) => ({
    ...c,
    lesson_count: Array.isArray(c.course_lessons) ? c.course_lessons.length : 0,
    course_lessons: undefined,
  }));

  res.json({ courses });
}

// GET /api/courses/:id
export async function getCourse(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const { id } = req.params;

  const { data: course, error } = await supabaseAdmin
    .from("courses")
    .select(
      `
      id,
      slug,
      title,
      description,
      thumbnail_url,
      is_free,
      price_aed,
      created_at,
      doctors (
        id,
        full_name
      ),
      course_lessons (
        id,
        title,
        description,
        duration_seconds,
        order_index,
        is_preview
      )
    `,
    )
    .eq("id", id)
    .eq("is_published", true)
    .single();

  if (error || !course) {
    res.status(404).json({ error: "Course not found" });
    return;
  }

  // Sort lessons by order_index
  const lessons = (
    Array.isArray(course.course_lessons) ? course.course_lessons : []
  ).sort((a, b) => a.order_index - b.order_index);

  res.json({ course: { ...course, course_lessons: lessons } });
}

// ─── Auth: Enrollment ─────────────────────────────────────────────────────────

// POST /api/courses/:id/enroll
export async function enrollCourse(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const userId = req.userId;
  const { id: courseId } = req.params;

  // Verify course exists and is published
  const { data: course, error: courseError } = await supabaseAdmin
    .from("courses")
    .select("id, is_free, price_aed")
    .eq("id", courseId)
    .eq("is_published", true)
    .single();

  if (courseError || !course) {
    res.status(404).json({ error: "Course not found" });
    return;
  }

  // Only free courses can be enrolled directly (paid courses would need payment)
  if (!course.is_free) {
    res.status(400).json({
      error: "Paid courses are not yet supported for direct enrollment",
    });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("course_enrollments")
    .insert({ user_id: userId, course_id: courseId })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      res.status(409).json({ error: "Already enrolled in this course" });
    } else {
      res.status(500).json({ error: error.message });
    }
    return;
  }

  res.status(201).json({ enrollment: data });
}

// GET /api/courses/my
export async function getMyEnrollments(
  req: Request,
  res: Response,
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const userId = req.userId;

  const { data, error } = await supabaseAdmin
    .from("course_enrollments")
    .select(
      `
      id,
      enrolled_at,
      completed_at,
      courses (
        id,
        slug,
        title,
        description,
        thumbnail_url,
        is_free,
        price_aed,
        doctors ( id, full_name ),
        course_lessons ( id )
      )
    `,
    )
    .eq("user_id", userId)
    .order("enrolled_at", { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Attach progress for each enrollment
  const enrollmentIds = (data ?? []).map((e) => e.id);
  let progressMap: Record<string, number> = {};

  if (enrollmentIds.length > 0) {
    const { data: progressRows } = await supabaseAdmin
      .from("lesson_progress")
      .select("course_id")
      .eq("user_id", userId);

    // Count completed lessons per course
    for (const row of progressRows ?? []) {
      progressMap[row.course_id] = (progressMap[row.course_id] ?? 0) + 1;
    }
  }

  const enrollments = (data ?? []).map((e: any) => {
    const totalLessons = Array.isArray(e.courses?.course_lessons)
      ? e.courses.course_lessons.length
      : 0;
    const completedLessons =
      progressMap[(e.courses as { id: string } | null)?.id ?? ""] ?? 0;
    return {
      ...e,
      courses: e.courses
        ? {
            ...e.courses,
            lesson_count: totalLessons,
            course_lessons: undefined,
          }
        : null,
      progress_percent:
        totalLessons > 0
          ? Math.round((completedLessons / totalLessons) * 100)
          : 0,
      completed_lessons: completedLessons,
      total_lessons: totalLessons,
    };
  });

  res.json({ enrollments });
}

// GET /api/courses/:id/lessons/:lessonId/stream
export async function streamLesson(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const userId = req.userId!;
  const { id: courseId, lessonId } = req.params;

  // Fetch lesson to get video_path and check is_preview
  const { data: lesson, error: lessonError } = await supabaseAdmin
    .from("course_lessons")
    .select("id, video_path, is_preview, course_id")
    .eq("id", lessonId)
    .eq("course_id", courseId)
    .single();

  if (lessonError || !lesson) {
    res.status(404).json({ error: "Lesson not found" });
    return;
  }

  if (!lesson.video_path) {
    res.status(404).json({ error: "No video available for this lesson" });
    return;
  }

  // Non-preview lessons require enrollment
  if (!lesson.is_preview) {
    const enrolled = await isEnrolled(userId, courseId as string);
    if (!enrolled) {
      res
        .status(403)
        .json({ error: "You must be enrolled to watch this lesson" });
      return;
    }
  }

  // Generate a signed URL valid for 1 hour
  const { data: signedData, error: signedError } = await supabaseAdmin.storage
    .from("course-videos")
    .createSignedUrl(lesson.video_path, 3600);

  if (signedError || !signedData?.signedUrl) {
    res.status(500).json({ error: "Could not generate video URL" });
    return;
  }

  res.json({ signedUrl: signedData.signedUrl });
}

// POST /api/courses/:id/lessons/:lessonId/progress
export async function markLessonComplete(
  req: Request,
  res: Response,
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const userId = req.userId!;
  const { id: courseId, lessonId } = req.params;

  // Must be enrolled
  const enrolled = await isEnrolled(userId, courseId as string);
  if (!enrolled) {
    res.status(403).json({ error: "You must be enrolled to track progress" });
    return;
  }

  // Upsert progress
  const { error: progressError } = await supabaseAdmin
    .from("lesson_progress")
    .upsert(
      { user_id: userId, lesson_id: lessonId, course_id: courseId },
      { onConflict: "user_id,lesson_id" },
    );

  if (progressError) {
    res.status(500).json({ error: progressError.message });
    return;
  }

  // Check if all lessons are now complete
  const { data: allLessons } = await supabaseAdmin
    .from("course_lessons")
    .select("id")
    .eq("course_id", courseId);

  const { data: completedLessons } = await supabaseAdmin
    .from("lesson_progress")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId);

  const totalCount = allLessons?.length ?? 0;
  const completedCount = completedLessons?.length ?? 0;
  let courseCompleted = false;

  if (totalCount > 0 && completedCount >= totalCount) {
    await supabaseAdmin
      .from("course_enrollments")
      .update({ completed_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .is("completed_at", null);
    courseCompleted = true;
  }

  res.json({
    success: true,
    completed_lessons: completedCount,
    total_lessons: totalCount,
    course_completed: courseCompleted,
  });
}

// ─── Doctor: Course Management ─────────────────────────────────────────────────

// GET /api/courses/created
export async function getCreatedCourses(
  req: Request,
  res: Response,
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const doctorId = await getDoctorId(req.userId);
  if (!doctorId) {
    res.status(403).json({ error: "Only doctors can access this endpoint" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("courses")
    .select(
      `
      id,
      slug,
      title,
      description,
      thumbnail_url,
      is_free,
      price_aed,
      is_published,
      created_at,
      updated_at,
      course_lessons ( id ),
      course_enrollments ( id )
    `,
    )
    .eq("doctor_id", doctorId)
    .order("created_at", { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const courses = (data ?? []).map((c) => ({
    ...c,
    lesson_count: Array.isArray(c.course_lessons) ? c.course_lessons.length : 0,
    enrollment_count: Array.isArray(c.course_enrollments)
      ? c.course_enrollments.length
      : 0,
    course_lessons: undefined,
    course_enrollments: undefined,
  }));

  res.json({ courses });
}

// POST /api/courses
export async function createCourse(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const doctorId = await getDoctorId(req.userId);
  if (!doctorId) {
    res.status(403).json({ error: "Only doctors can create courses" });
    return;
  }

  const { title, description, thumbnail_url, is_free, price_aed } = req.body;

  if (!title) {
    res.status(400).json({ error: "title is required" });
    return;
  }

  // Generate slug from title
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") +
    "-" +
    Date.now();

  const { data, error } = await supabaseAdmin
    .from("courses")
    .insert({
      slug,
      title,
      description: description ?? null,
      thumbnail_url: thumbnail_url ?? null,
      doctor_id: doctorId,
      is_free: is_free !== false,
      price_aed: price_aed ?? 0,
      is_published: false,
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json({ course: data });
}

// PUT /api/courses/:id
export async function updateCourse(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const doctorId = await getDoctorId(req.userId);
  if (!doctorId) {
    res.status(403).json({ error: "Only doctors can update courses" });
    return;
  }

  const { id } = req.params;
  const {
    title,
    description,
    thumbnail_url,
    is_free,
    price_aed,
    is_published,
  } = req.body;

  const { data, error } = await supabaseAdmin
    .from("courses")
    .update({
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(thumbnail_url !== undefined && { thumbnail_url }),
      ...(is_free !== undefined && { is_free }),
      ...(price_aed !== undefined && { price_aed }),
      ...(is_published !== undefined && { is_published }),
    })
    .eq("id", id)
    .eq("doctor_id", doctorId)
    .select()
    .single();

  if (error) {
    res.status(404).json({ error: "Course not found or access denied" });
    return;
  }

  res.json({ course: data });
}

// GET /api/courses/:id/lessons (doctor view — includes video_path)
export async function getCourseLesson(
  req: Request,
  res: Response,
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const doctorId = await getDoctorId(req.userId);
  if (!doctorId) {
    res.status(403).json({ error: "Only doctors can access this endpoint" });
    return;
  }

  const { id: courseId } = req.params;

  // Ensure doctor owns this course
  const { data: course } = await supabaseAdmin
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .eq("doctor_id", doctorId)
    .single();

  if (!course) {
    res.status(404).json({ error: "Course not found or access denied" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("course_lessons")
    .select("*")
    .eq("course_id", courseId)
    .order("order_index", { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ lessons: data ?? [] });
}

// POST /api/courses/:id/lessons
export async function addLesson(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const doctorId = await getDoctorId(req.userId);
  if (!doctorId) {
    res.status(403).json({ error: "Only doctors can add lessons" });
    return;
  }

  const { id: courseId } = req.params;

  // Ensure doctor owns this course
  const { data: course } = await supabaseAdmin
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .eq("doctor_id", doctorId)
    .single();

  if (!course) {
    res.status(404).json({ error: "Course not found or access denied" });
    return;
  }

  const {
    title,
    description,
    video_path,
    duration_seconds,
    order_index,
    is_preview,
  } = req.body;

  if (!title) {
    res.status(400).json({ error: "title is required" });
    return;
  }

  // Auto-set order_index to end if not provided
  let resolvedOrder = order_index;
  if (resolvedOrder === undefined) {
    const { count } = await supabaseAdmin
      .from("course_lessons")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseId);
    resolvedOrder = count ?? 0;
  }

  const { data, error } = await supabaseAdmin
    .from("course_lessons")
    .insert({
      course_id: courseId,
      title,
      description: description ?? null,
      video_path: video_path ?? null,
      duration_seconds: duration_seconds ?? 0,
      order_index: resolvedOrder,
      is_preview: is_preview ?? false,
    })
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json({ lesson: data });
}

// PUT /api/courses/:id/lessons/:lessonId
export async function updateLesson(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const doctorId = await getDoctorId(req.userId);
  if (!doctorId) {
    res.status(403).json({ error: "Only doctors can update lessons" });
    return;
  }

  const { id: courseId, lessonId } = req.params;

  // Ensure doctor owns this course
  const { data: course } = await supabaseAdmin
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .eq("doctor_id", doctorId)
    .single();

  if (!course) {
    res.status(404).json({ error: "Course not found or access denied" });
    return;
  }

  const {
    title,
    description,
    video_path,
    duration_seconds,
    order_index,
    is_preview,
  } = req.body;

  const { data, error } = await supabaseAdmin
    .from("course_lessons")
    .update({
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(video_path !== undefined && { video_path }),
      ...(duration_seconds !== undefined && { duration_seconds }),
      ...(order_index !== undefined && { order_index }),
      ...(is_preview !== undefined && { is_preview }),
    })
    .eq("id", lessonId)
    .eq("course_id", courseId)
    .select()
    .single();

  if (error) {
    res.status(404).json({ error: "Lesson not found" });
    return;
  }

  res.json({ lesson: data });
}

// DELETE /api/courses/:id/lessons/:lessonId
export async function deleteLesson(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const doctorId = await getDoctorId(req.userId);
  if (!doctorId) {
    res.status(403).json({ error: "Only doctors can delete lessons" });
    return;
  }

  const { id: courseId, lessonId } = req.params;

  // Ensure doctor owns this course
  const { data: course } = await supabaseAdmin
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .eq("doctor_id", doctorId)
    .single();

  if (!course) {
    res.status(404).json({ error: "Course not found or access denied" });
    return;
  }

  const { error } = await supabaseAdmin
    .from("course_lessons")
    .delete()
    .eq("id", lessonId)
    .eq("course_id", courseId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ success: true });
}

// POST /api/courses/:id/upload-url  (get a signed upload URL for a video)
export async function getUploadUrl(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const doctorId = await getDoctorId(req.userId);
  if (!doctorId) {
    res.status(403).json({ error: "Only doctors can upload videos" });
    return;
  }

  const { id: courseId } = req.params;
  const { fileName, contentType } = req.body;

  if (!fileName) {
    res.status(400).json({ error: "fileName is required" });
    return;
  }

  // Ensure doctor owns this course
  const { data: course } = await supabaseAdmin
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .eq("doctor_id", doctorId)
    .single();

  if (!course) {
    res.status(404).json({ error: "Course not found or access denied" });
    return;
  }

  const storagePath = `courses/${courseId}/${Date.now()}-${fileName}`;

  const { data, error } = await supabaseAdmin.storage
    .from("course-videos")
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    res.status(500).json({ error: "Could not generate upload URL" });
    return;
  }

  res.json({
    uploadUrl: data.signedUrl,
    token: data.token,
    path: storagePath,
    contentType: contentType ?? "video/mp4",
  });
}
