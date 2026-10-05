"use client";

import { use } from "react";
import { CourseBuilder } from "@/components/dashboard/courses/course-builder";
import { coursesApi } from "@/lib/api/courses";

interface PageProps {
  params: Promise<{ courseId: string }>;
}

export default function AdminCourseBuilderPage({ params }: PageProps) {
  const { courseId } = use(params);

  return (
    <CourseBuilder
      courseId={courseId}
      basePath="/dashboard/admin/courses"
      fetchCourses={coursesApi.getAllCourses}
    />
  );
}
