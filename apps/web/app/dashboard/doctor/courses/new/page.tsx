"use client";

import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { NewCourse } from "@/components/dashboard/courses/new-course";

export default function NewCoursePage() {
  return (
    <DashboardLayout role="doctor">
      <NewCourse basePath="/dashboard/doctor/courses" />
    </DashboardLayout>
  );
}
