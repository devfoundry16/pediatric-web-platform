"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { LiveSessionForm } from "@/components/dashboard/doctor/live-session-form";
import { useI18n } from "@/lib/i18n/i18n-context";
import { liveSessionsApi } from "@/lib/api/live-sessions";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

export default function NewLiveSessionPage() {
  const { dictionary: t } = useI18n();
  const router = useRouter();

  return (
    <DashboardLayout role="doctor">
      <div className="flex max-w-2xl flex-col gap-6">
        <div>
          <Link
            href="/dashboard/doctor/live-sessions"
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t.liveSessions.manageSessions}
          </Link>
          <h1 className="text-2xl font-bold text-foreground">
            {t.liveSessions.newSession}
          </h1>
        </div>

        <LiveSessionForm
          submitLabel={t.liveSessions.saveSession}
          onSubmit={async (payload) => {
            try {
              await liveSessionsApi.createSession(payload);
              toast.success(t.liveSessions.sessionCreated);
              router.push("/dashboard/doctor/live-sessions");
            } catch (err: unknown) {
              const msg =
                err instanceof Error ? err.message : t.liveSessions.createFailed;
              toast.error(msg);
            }
          }}
        />
      </div>
    </DashboardLayout>
  );
}
