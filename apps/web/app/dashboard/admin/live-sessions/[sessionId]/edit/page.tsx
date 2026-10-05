"use client";

import { use } from "react";
import { EditLiveSession } from "@/components/dashboard/live-sessions/edit-live-session";
import { liveSessionsApi } from "@/lib/api/live-sessions";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default function AdminEditLiveSessionPage({ params }: PageProps) {
  const { sessionId } = use(params);

  return (
    <EditLiveSession
      sessionId={sessionId}
      basePath="/dashboard/admin/live-sessions"
      fetchSessions={liveSessionsApi.getAllSessions}
    />
  );
}
