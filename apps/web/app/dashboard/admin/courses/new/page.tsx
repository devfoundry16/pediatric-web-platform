"use client";

import { NewCourse } from "@/components/dashboard/courses/new-course";

// The admin creating the course teaches it; the API records them as instructor.
export default function AdminNewCoursePage() {
  return <NewCourse basePath="/dashboard/admin/courses" />;
}
