"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n/i18n-context";
import { liveSessionsApi, type GroupSession } from "@/lib/api/live-sessions";
import { toast } from "sonner";
import {
  Video,
  Plus,
  Radio,
  Users,
  CalendarDays,
  Clock,
  ExternalLink,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function statusBadge(
  status: GroupSession["status"],
  t: ReturnType<typeof useI18n>["dictionary"]
) {
  switch (status) {
    case "scheduled":
      return <Badge variant="outline">{t.liveSessions.statusScheduled}</Badge>;
    case "live":
      return (
        <Badge className="gap-1 bg-red-500 text-white hover:bg-red-600">
          <Radio className="h-3 w-3" />
          {t.liveSessions.statusLive}
        </Badge>
      );
    case "ended":
      return <Badge variant="secondary">{t.liveSessions.statusEnded}</Badge>;
    case "cancelled":
      return (
        <Badge variant="destructive">{t.liveSessions.statusCancelled}</Badge>
      );
  }
}

function SessionRow({
  session,
  onGoLive,
  onEnd,
}: {
  session: GroupSession;
  onGoLive: (id: string) => Promise<void>;
  onEnd: (id: string) => Promise<void>;
}) {
  const { dictionary: t } = useI18n();
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState(false);

  const scheduledDate = new Date(session.scheduled_at);

  async function handleGoLive() {
    setActionLoading(true);
    try {
      await onGoLive(session.id);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleEnd() {
    setActionLoading(true);
    try {
      await onEnd(session.id);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground truncate">
                {session.title}
              </h3>
              {statusBadge(session.status, t)}
              {session.is_free ? (
                <Badge variant="secondary" className="text-xs">
                  {t.liveSessions.free}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  {Number(session.price_aed)} {t.common.aed}
                </Badge>
              )}
            </div>

            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {scheduledDate.toLocaleDateString("en-AE", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {scheduledDate.toLocaleTimeString("en-AE", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                · {session.duration_minutes} {t.common.minutes}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {session.participant_count}/{session.max_participants}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {session.status === "scheduled" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    disabled={actionLoading}
                  >
                    <Radio className="h-3.5 w-3.5" />
                    {t.liveSessions.goLive}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t.liveSessions.goLive}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t.liveSessions.confirmGoLive}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleGoLive}>
                      {t.liveSessions.goLive}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {session.status === "live" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() =>
                    router.push(`/live-sessions/${session.id}/room`)
                  }
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t.liveSessions.joinRoom}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={actionLoading}
                    >
                      {t.liveSessions.endSession}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {t.liveSessions.endSession}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {t.liveSessions.confirmEnd}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleEnd}>
                        {t.liveSessions.endSession}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}

            {(session.status === "scheduled" || session.status === "ended") && (
              <Button size="sm" variant="ghost" asChild>
                <Link href={`/live-sessions/${session.id}`}>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DoctorLiveSessionsPage() {
  const { dictionary: t } = useI18n();
  const [sessions, setSessions] = useState<GroupSession[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadSessions() {
    try {
      const data = await liveSessionsApi.getDoctorSessions();
      setSessions(data);
    } catch {
      toast.error(t.doctorDashboard.loadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSessions();
  }, []);

  async function handleGoLive(id: string) {
    try {
      const { session } = await liveSessionsApi.goLive(id);
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...session } : s))
      );
      toast.success(`${session.title} is now live!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to go live";
      toast.error(msg);
    }
  }

  async function handleEnd(id: string) {
    try {
      const session = await liveSessionsApi.endSession(id);
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...session } : s))
      );
      toast.success(t.liveSessions.statusEnded);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to end session";
      toast.error(msg);
    }
  }

  const upcoming = sessions.filter(
    (s) => s.status === "scheduled" || s.status === "live"
  );
  const past = sessions.filter(
    (s) => s.status === "ended" || s.status === "cancelled"
  );

  return (
    <DashboardLayout role="doctor">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {t.liveSessions.manageSessions}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.liveSessions.subtitle}
            </p>
          </div>
          <Button asChild className="gap-2">
            <Link href="/dashboard/doctor/live-sessions/new">
              <Plus className="h-4 w-4" />
              {t.liveSessions.newSession}
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Video className="h-4 w-4" />
                    {t.liveSessions.upcoming}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 pt-0">
                  {upcoming.map((s) => (
                    <SessionRow
                      key={s.id}
                      session={s}
                      onGoLive={handleGoLive}
                      onEnd={handleEnd}
                    />
                  ))}
                </CardContent>
              </Card>
            )}

            {past.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {t.liveSessions.past}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 pt-0">
                  {past.map((s) => (
                    <SessionRow
                      key={s.id}
                      session={s}
                      onGoLive={handleGoLive}
                      onEnd={handleEnd}
                    />
                  ))}
                </CardContent>
              </Card>
            )}

            {sessions.length === 0 && (
              <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Video className="h-6 w-6 text-primary/60" />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {t.common.noResults}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.liveSessions.createSession}
                  </p>
                </div>
                <Button asChild className="gap-2">
                  <Link href="/dashboard/doctor/live-sessions/new">
                    <Plus className="h-4 w-4" />
                    {t.liveSessions.newSession}
                  </Link>
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
