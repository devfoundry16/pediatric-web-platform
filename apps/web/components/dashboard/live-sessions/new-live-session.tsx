"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LiveSessionForm } from "@/components/dashboard/doctor/live-session-form";
import { useI18n } from "@/lib/i18n/i18n-context";
import { getErrorMessage } from "@/lib/i18n/error-message";
import { liveSessionsApi } from "@/lib/api/live-sessions";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

/** The new-session page body, shared by the doctor and admin dashboards. */
export function NewLiveSession({ basePath }: { basePath: string }) {
  const { dictionary: t } = useI18n();
  const router = useRouter();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
        <div>
          <Link
            href={basePath}
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            {t.liveSessions.manageSessions}
          </Link>
          <h1 className="text-2xl font-bold text-foreground">
            {t.liveSessions.newSession}
          </h1>
        </div>

        <LiveSessionForm
          submitLabel={t.liveSessions.saveSession}
          cancelHref={basePath}
          onSubmit={async (payload) => {
            try {
              await liveSessionsApi.createSession(payload);
              toast.success(t.liveSessions.sessionCreated);
              router.push(basePath);
            } catch (err: unknown) {
              const msg = getErrorMessage(err, t, t.liveSessions.createFailed);
              toast.error(msg);
            }
          }}
        />
    </div>
  );
}
