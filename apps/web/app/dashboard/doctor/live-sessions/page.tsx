"use client";

import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { LiveSessionsManager } from "@/components/dashboard/live-sessions/live-sessions-manager";
import { liveSessionsApi } from "@/lib/api/live-sessions";
import { useI18n } from "@/lib/i18n/i18n-context";

export default function DoctorLiveSessionsPage() {
  const { dictionary: t } = useI18n();

  return (
    <DashboardLayout role="doctor">
      <LiveSessionsManager
        basePath="/dashboard/doctor/live-sessions"
        fetchSessions={liveSessionsApi.getDoctorSessions}
        subtitle={t.liveSessions.subtitle}
      />
    </DashboardLayout>
  );
}
