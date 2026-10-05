export interface CourseDoctor {
  id: string;
  full_name: string | null;
}

export interface CourseLesson {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  video_path: string | null;
  duration_seconds: number;
  order_index: number;
  is_preview: boolean;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  is_free: boolean;
  price_aed: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  doctors: CourseDoctor | null;
  /** Set only when no doctor teaches the course — an admin built it. */
  instructor: CourseInstructor | null;
  lesson_count: number;
}

/** The account teaching a course that has no doctor. */
export interface CourseInstructor {
  id: string;
  full_name: string | null;
}

/** Who to show as a course's instructor: its doctor, else the admin who built it. */
export function courseInstructorName(
  course: Pick<Course, "doctors" | "instructor">
): string | null {
  return course.doctors?.full_name ?? course.instructor?.full_name ?? null;
}

export interface CourseDetail extends Omit<Course, "lesson_count"> {
  course_lessons: CourseLesson[];
}

export interface CourseEnrollment {
  id: string;
  enrolled_at: string;
  completed_at: string | null;
  courses: (Omit<Course, "doctors"> & { doctors: CourseDoctor | null }) | null;
  progress_percent: number;
  completed_lessons: number;
  total_lessons: number;
}

export interface DoctorCourse extends Course {
  enrollment_count: number;
}
