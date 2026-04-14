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
  lesson_count: number;
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
