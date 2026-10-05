"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LiveSessionForm } from "@/components/dashboard/doctor/live-session-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/i18n-context";
import { getErrorMessage } from "@/lib/i18n/error-message";
import { useViewerTimezone } from "@/hooks/use-viewer-timezone";
import { calendarDayInTimezone, clockTimeInTimezone } from "@/lib/timezone";
import { liveSessionsApi, type GroupSession } from "@/lib/api/live-sessions";
import { toast } from "sonner";
import { ArrowLeft, AlertCircle } from "lucide-react";

/**
 * The edit-session page body, shared by the doctor and admin dashboards.
 *
 * The public GET /live-sessions/:id only returns published sessions, so a
 * draft would 404 there. The session is found in the dashboard's own list
 * instead (the doctor's sessions, or every session for an admin), which is
 * the one view that includes drafts.
 */
export function EditLiveSession({
  sessionId,
  basePath,
  fetchSessions,
}: {
  sessionId: string;
  basePath: string;
  fetchSessions: () => Promise<GroupSession[]>;
}) {
  const { dictionary: t } = useI18n();
  const router = useRouter();
  const { timezone: viewerTimezone } = useViewerTimezone();

  const [session, setSession] = useState<GroupSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<"not-found" | "load-failed" | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchSessions()
      .then((sessions) => {
        if (cancelled) return;
        const found = sessions.find((s) => s.id === sessionId) ?? null;
        setSession(found);
        if (!found) setFailure("not-found");
      })
      .catch(() => {
        if (!cancelled) setFailure("load-failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [sessionId, fetchSessions]);

  const isEditable =
    session !== null &&
    session.status !== "ended" &&
    session.status !== "cancelled";

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
            {t.liveSessions.editSession}
          </h1>
          {session && (
            <p className="mt-1 text-sm text-muted-foreground">{session.title}</p>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        ) : failure || !session ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {failure === "load-failed"
                ? t.doctorDashboard.loadError
                : t.liveSessions.sessionNotFound}
            </span>
            <Button size="sm" variant="outline" asChild>
              <Link href={basePath}>
                {t.liveSessions.manageSessions}
              </Link>
            </Button>
          </div>
        ) : !isEditable ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {t.liveSessions.notEditable}
            </span>
            <Button size="sm" variant="outline" asChild>
              <Link href={basePath}>
                {t.liveSessions.manageSessions}
              </Link>
            </Button>
          </div>
        ) : (
          <LiveSessionForm
            submitLabel={t.liveSessions.saveSession}
            cancelHref={basePath}
            defaultValues={{
              title: session.title,
              description: session.description ?? "",
              scheduled_date: calendarDayInTimezone(
                session.scheduled_at,
                viewerTimezone
              ),
              scheduled_time: clockTimeInTimezone(
                session.scheduled_at,
                viewerTimezone
              ),
              duration_minutes: session.duration_minutes,
              max_participants: session.max_participants,
              price_aed: Number(session.price_aed),
              is_published: session.is_published,
            }}
            onSubmit={async (payload) => {
              try {
                await liveSessionsApi.updateSession(session.id, payload);
                toast.success(t.liveSessions.sessionUpdated);
                router.push(basePath);
              } catch (err: unknown) {
                const msg = getErrorMessage(err, t, t.liveSessions.updateFailed);
                toast.error(msg);
              }
            }}
          />
        )}
    </div>
  );
}
