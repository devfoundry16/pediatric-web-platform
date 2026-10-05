"use client";

import { LiveSessionsManager } from "@/components/dashboard/live-sessions/live-sessions-manager";
import { liveSessionsApi } from "@/lib/api/live-sessions";
import { useI18n } from "@/lib/i18n/i18n-context";

export default function AdminLiveSessionsPage() {
  const { dictionary: t } = useI18n();

  return (
    <LiveSessionsManager
      basePath="/dashboard/admin/live-sessions"
      fetchSessions={liveSessionsApi.getAllSessions}
      subtitle={t.admin.liveSessions.subtitle}
      showHost
    />
  );
}
