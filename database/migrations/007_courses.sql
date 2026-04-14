-- ============================================================
-- Migration 007: Online Courses Platform
-- ============================================================

-- ============================================================
-- 1. Courses
-- ============================================================
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
  is_free BOOLEAN NOT NULL DEFAULT TRUE,
  price_aed NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (price_aed >= 0),
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. Course Lessons
-- ============================================================
CREATE TABLE IF NOT EXISTS public.course_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  video_path TEXT,          -- Supabase Storage path (bucket: course-videos)
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  order_index INTEGER NOT NULL DEFAULT 0,
  is_preview BOOLEAN NOT NULL DEFAULT FALSE,  -- watchable without enrollment
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. Course Enrollments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT course_enrollments_unique_user_course UNIQUE (user_id, course_id)
);

-- ============================================================
-- 4. Lesson Progress
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.course_lessons(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lesson_progress_unique_user_lesson UNIQUE (user_id, lesson_id)
);

-- ============================================================
-- 5. Updated-at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_courses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.handle_courses_updated_at();

CREATE TRIGGER trg_course_lessons_updated_at
  BEFORE UPDATE ON public.course_lessons
  FOR EACH ROW EXECUTE FUNCTION public.handle_courses_updated_at();

-- ============================================================
-- 6. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_courses_doctor_id ON public.courses(doctor_id);
CREATE INDEX IF NOT EXISTS idx_courses_is_published ON public.courses(is_published);
CREATE INDEX IF NOT EXISTS idx_course_lessons_course_id ON public.course_lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_course_lessons_order ON public.course_lessons(course_id, order_index);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_user_id ON public.course_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_course_id ON public.course_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_id ON public.lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_course_id ON public.lesson_progress(course_id);

-- ============================================================
-- 7. Row Level Security
-- ============================================================
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

-- courses: anyone can read published rows; service role (API) handles writes
CREATE POLICY "courses_public_read"
  ON public.courses FOR SELECT
  USING (is_published = TRUE);

CREATE POLICY "courses_doctor_read_own"
  ON public.courses FOR SELECT
  USING (doctor_id = public.get_doctor_id_for_user(auth.uid()));

CREATE POLICY "courses_doctor_insert"
  ON public.courses FOR INSERT
  WITH CHECK (public.get_doctor_id_for_user(auth.uid()) IS NOT NULL);

CREATE POLICY "courses_doctor_update_own"
  ON public.courses FOR UPDATE
  USING (doctor_id = public.get_doctor_id_for_user(auth.uid()));

CREATE POLICY "courses_doctor_delete_own"
  ON public.courses FOR DELETE
  USING (doctor_id = public.get_doctor_id_for_user(auth.uid()));

-- course_lessons: preview lessons public; full access requires enrollment
CREATE POLICY "course_lessons_preview_read"
  ON public.course_lessons FOR SELECT
  USING (is_preview = TRUE AND course_id IN (
    SELECT id FROM public.courses WHERE is_published = TRUE
  ));

CREATE POLICY "course_lessons_enrolled_read"
  ON public.course_lessons FOR SELECT
  USING (
    course_id IN (
      SELECT course_id FROM public.course_enrollments
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "course_lessons_doctor_manage"
  ON public.course_lessons FOR ALL
  USING (
    course_id IN (
      SELECT id FROM public.courses
      WHERE doctor_id = public.get_doctor_id_for_user(auth.uid())
    )
  )
  WITH CHECK (
    course_id IN (
      SELECT id FROM public.courses
      WHERE doctor_id = public.get_doctor_id_for_user(auth.uid())
    )
  );

-- course_enrollments: users manage their own rows
CREATE POLICY "course_enrollments_owner_select"
  ON public.course_enrollments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "course_enrollments_owner_insert"
  ON public.course_enrollments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "course_enrollments_owner_update"
  ON public.course_enrollments FOR UPDATE
  USING (auth.uid() = user_id);

-- lesson_progress: users manage their own rows
CREATE POLICY "lesson_progress_owner_select"
  ON public.lesson_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "lesson_progress_owner_insert"
  ON public.lesson_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 8. Storage bucket note
-- NOTE: Create a private bucket named "course-videos" in Supabase
-- dashboard. The API generates signed URLs (server-side) after
-- verifying enrollment. No direct client access.
-- ============================================================
