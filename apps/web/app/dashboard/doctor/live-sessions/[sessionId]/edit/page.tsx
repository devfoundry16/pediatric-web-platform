"use client";

import { use } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { EditLiveSession } from "@/components/dashboard/live-sessions/edit-live-session";
import { liveSessionsApi } from "@/lib/api/live-sessions";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default function EditLiveSessionPage({ params }: PageProps) {
  const { sessionId } = use(params);

  return (
    <DashboardLayout role="doctor">
      <EditLiveSession
        sessionId={sessionId}
        basePath="/dashboard/doctor/live-sessions"
        fetchSessions={liveSessionsApi.getDoctorSessions}
      />
    </DashboardLayout>
  );
}
