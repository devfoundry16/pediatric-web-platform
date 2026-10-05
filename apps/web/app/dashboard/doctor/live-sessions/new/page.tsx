"use client";

import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { NewLiveSession } from "@/components/dashboard/live-sessions/new-live-session";

export default function NewLiveSessionPage() {
  return (
    <DashboardLayout role="doctor">
      <NewLiveSession basePath="/dashboard/doctor/live-sessions" />
    </DashboardLayout>
  );
}
