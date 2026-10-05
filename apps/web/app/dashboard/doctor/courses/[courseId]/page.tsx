"use client";

import { use } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { CourseBuilder } from "@/components/dashboard/courses/course-builder";
import { coursesApi } from "@/lib/api/courses";

interface PageProps {
  params: Promise<{ courseId: string }>;
}

export default function DoctorCourseDetailPage({ params }: PageProps) {
  const { courseId } = use(params);

  return (
    <DashboardLayout role="doctor">
      <CourseBuilder
        courseId={courseId}
        basePath="/dashboard/doctor/courses"
        fetchCourses={coursesApi.getCreatedCourses}
      />
    </DashboardLayout>
  );
}
