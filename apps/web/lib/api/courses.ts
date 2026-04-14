import axios from "axios";
import { createClient } from "@/lib/supabase/client";
import type {
  Course,
  CourseDetail,
  CourseEnrollment,
  CourseLesson,
  DoctorCourse,
} from "@/types/courses";

function getBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
  return base.replace(/\/$/, "");
}

async function authHeaders(): Promise<Record<string, string>> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

export const coursesApi = {
  // ── Public ─────────────────────────────────────────────────────────────────

  async list(): Promise<Course[]> {
    const { data } = await axios.get<{ courses: Course[] }>(
      `${getBaseUrl()}/courses`
    );
    return data.courses;
  },

  async get(courseId: string): Promise<CourseDetail> {
    const { data } = await axios.get<{ course: CourseDetail }>(
      `${getBaseUrl()}/courses/${courseId}`
    );
    return data.course;
  },

  // ── Parent: Enrollments & Progress ─────────────────────────────────────────

  async enroll(courseId: string): Promise<void> {
    await axios.post(
      `${getBaseUrl()}/courses/${courseId}/enroll`,
      {},
      { headers: await authHeaders() }
    );
  },

  async getMyEnrollments(): Promise<CourseEnrollment[]> {
    const { data } = await axios.get<{ enrollments: CourseEnrollment[] }>(
      `${getBaseUrl()}/courses/my`,
      { headers: await authHeaders() }
    );
    return data.enrollments;
  },

  async getStreamUrl(courseId: string, lessonId: string): Promise<string> {
    const { data } = await axios.get<{ signedUrl: string }>(
      `${getBaseUrl()}/courses/${courseId}/lessons/${lessonId}/stream`,
      { headers: await authHeaders() }
    );
    return data.signedUrl;
  },

  async markLessonComplete(
    courseId: string,
    lessonId: string
  ): Promise<{
    success: boolean;
    completed_lessons: number;
    total_lessons: number;
    course_completed: boolean;
  }> {
    const { data } = await axios.post(
      `${getBaseUrl()}/courses/${courseId}/lessons/${lessonId}/progress`,
      {},
      { headers: await authHeaders() }
    );
    return data;
  },

  // ── Doctor: Course Management ───────────────────────────────────────────────

  async getCreatedCourses(): Promise<DoctorCourse[]> {
    const { data } = await axios.get<{ courses: DoctorCourse[] }>(
      `${getBaseUrl()}/courses/created`,
      { headers: await authHeaders() }
    );
    return data.courses;
  },

  async createCourse(payload: {
    title: string;
    description?: string;
    thumbnail_url?: string;
    is_free?: boolean;
    price_aed?: number;
  }): Promise<DoctorCourse> {
    const { data } = await axios.post<{ course: DoctorCourse }>(
      `${getBaseUrl()}/courses`,
      payload,
      { headers: await authHeaders() }
    );
    return data.course;
  },

  async updateCourse(
    courseId: string,
    payload: Partial<{
      title: string;
      description: string;
      thumbnail_url: string;
      is_free: boolean;
      price_aed: number;
      is_published: boolean;
    }>
  ): Promise<DoctorCourse> {
    const { data } = await axios.put<{ course: DoctorCourse }>(
      `${getBaseUrl()}/courses/${courseId}`,
      payload,
      { headers: await authHeaders() }
    );
    return data.course;
  },

  async getLessons(courseId: string): Promise<CourseLesson[]> {
    const { data } = await axios.get<{ lessons: CourseLesson[] }>(
      `${getBaseUrl()}/courses/${courseId}/lessons`,
      { headers: await authHeaders() }
    );
    return data.lessons;
  },

  async addLesson(
    courseId: string,
    payload: {
      title: string;
      description?: string;
      video_path?: string;
      duration_seconds?: number;
      order_index?: number;
      is_preview?: boolean;
    }
  ): Promise<CourseLesson> {
    const { data } = await axios.post<{ lesson: CourseLesson }>(
      `${getBaseUrl()}/courses/${courseId}/lessons`,
      payload,
      { headers: await authHeaders() }
    );
    return data.lesson;
  },

  async updateLesson(
    courseId: string,
    lessonId: string,
    payload: Partial<{
      title: string;
      description: string;
      video_path: string;
      duration_seconds: number;
      order_index: number;
      is_preview: boolean;
    }>
  ): Promise<CourseLesson> {
    const { data } = await axios.put<{ lesson: CourseLesson }>(
      `${getBaseUrl()}/courses/${courseId}/lessons/${lessonId}`,
      payload,
      { headers: await authHeaders() }
    );
    return data.lesson;
  },

  async deleteLesson(courseId: string, lessonId: string): Promise<void> {
    await axios.delete(
      `${getBaseUrl()}/courses/${courseId}/lessons/${lessonId}`,
      { headers: await authHeaders() }
    );
  },

  async getUploadUrl(
    courseId: string,
    fileName: string,
    contentType?: string
  ): Promise<{ uploadUrl: string; token: string; path: string }> {
    const { data } = await axios.post(
      `${getBaseUrl()}/courses/${courseId}/upload-url`,
      { fileName, contentType },
      { headers: await authHeaders() }
    );
    return data;
  },
};
