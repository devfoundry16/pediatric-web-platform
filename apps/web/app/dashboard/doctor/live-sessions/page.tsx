"use client";

import { useEffect, useState } from "react";
import { RefreshButton } from "@/components/ui/refresh-button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n/i18n-context";
import { liveSessionsApi, type GroupSession } from "@/lib/api/live-sessions";
import { TimezoneNotice } from "@/components/booking/timezone-notice";
import { useViewerTimezone } from "@/hooks/use-viewer-timezone";
import {
  calendarDayInTimezone,
  clockTimeInTimezone,
  formatDateInTimezone,
  formatTimeInTimezone,
  todayInTimezone,
  wallClockToInstant,
} from "@/lib/timezone";
import { toast } from "sonner";
import {
  Video,
  Plus,
  Radio,
  Users,
  CalendarDays,
  Clock,
  ExternalLink,
  Pencil,
  CalendarClock,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

/**
 * Quick date/time change without opening the full edit form — the one field
 * doctors actually change after publishing.
 *
 * Mounted only while open so the inputs always start from the session's current
 * schedule rather than a value captured on first render.
 */
function RescheduleDialog({
  session,
  onOpenChange,
  onConfirm,
}: {
  session: GroupSession;
  onOpenChange: (open: boolean) => void;
  onConfirm: (scheduledAt: string) => Promise<void>;
}) {
  const { dictionary: t } = useI18n();
  const { timezone: viewerTimezone } = useViewerTimezone();
  const [date, setDate] = useState(
    calendarDayInTimezone(session.scheduled_at, viewerTimezone)
  );
  const [time, setTime] = useState(
    clockTimeInTimezone(session.scheduled_at, viewerTimezone)
  );
  const [saving, setSaving] = useState(false);

  const today = todayInTimezone(viewerTimezone);
  const currentDate = calendarDayInTimezone(session.scheduled_at, viewerTimezone);
  const minDate = currentDate < today ? currentDate : today;

  async function handleConfirm() {
    const instant = wallClockToInstant(date, time, viewerTimezone);
    if (isNaN(instant.getTime())) {
      toast.error(t.liveSessions.rescheduleInvalid);
      return;
    }
    setSaving(true);
    try {
      await onConfirm(instant.toISOString());
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t.liveSessions.reschedule}</DialogTitle>
          <DialogDescription>
            {session.participant_count > 0
              ? t.liveSessions.rescheduleWithParticipants.replace(
                  "{count}",
                  String(session.participant_count)
                )
              : t.liveSessions.rescheduleDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <TimezoneNotice timezone={viewerTimezone} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reschedule_date">{t.common.date}</Label>
              <Input
                id="reschedule_date"
                type="date"
                min={minDate}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reschedule_time">{t.common.time}</Label>
              <Input
                id="reschedule_time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t.common.cancel}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={saving || !date || !time}
          >
            {saving ? t.common.loading : t.liveSessions.reschedule}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SessionRow({
  session,
  onGoLive,
  onEnd,
  onPublish,
  onReschedule,
  onCancel,
}: {
  session: GroupSession;
  onGoLive: (id: string) => Promise<void>;
  onEnd: (id: string) => Promise<void>;
  onPublish: (id: string) => Promise<void>;
  onReschedule: (id: string, scheduledAt: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
}) {
  const { dictionary: t } = useI18n();
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);

  async function handlePublish() {
    setActionLoading(true);
    try {
      await onPublish(session.id);
    } finally {
      setActionLoading(false);
    }
  }

  // scheduled_at is a real instant (TIMESTAMPTZ) — format it with an explicit
  // zone rather than relying on the runtime default.
  const { timezone: viewerTimezone } = useViewerTimezone();
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

  async function handleCancel() {
    setActionLoading(true);
    try {
      await onCancel(session.id);
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
              {!session.is_published && (
                <Badge variant="outline" className="text-xs border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-950/30">
                  Draft
                </Badge>
              )}
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
                {formatDateInTimezone(scheduledDate, viewerTimezone)}
              </span>
              <span className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
                <Clock className="h-3.5 w-3.5" />
                {formatTimeInTimezone(scheduledDate, viewerTimezone)}{" "}
                · {session.duration_minutes} {t.common.minutes}
                <TimezoneNotice timezone={viewerTimezone} variant="compact" />
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {session.participant_count}/{session.max_participants}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!session.is_published && session.status === "scheduled" && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-amber-400 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/30"
                disabled={actionLoading}
                onClick={handlePublish}
              >
                Publish
              </Button>
            )}

            {session.status === "scheduled" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={actionLoading}
                  asChild
                >
                  <Link
                    href={`/dashboard/doctor/live-sessions/${session.id}/edit`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t.liveSessions.editSession}
                  </Link>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={actionLoading}
                  onClick={() => setRescheduleOpen(true)}
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                  {t.liveSessions.reschedule}
                </Button>

                {rescheduleOpen && (
                  <RescheduleDialog
                    session={session}
                    onOpenChange={setRescheduleOpen}
                    onConfirm={(scheduledAt) =>
                      onReschedule(session.id, scheduledAt)
                    }
                  />
                )}
              </>
            )}

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

            {(session.status === "scheduled" || session.status === "live") && (
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
            )}

            {session.status === "live" && (
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
            )}

            {session.status === "scheduled" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={actionLoading}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t.liveSessions.cancelSession}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t.liveSessions.cancelSession}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {session.participant_count > 0
                        ? t.liveSessions.confirmCancelWithParticipants.replace(
                            "{count}",
                            String(session.participant_count)
                          )
                        : t.liveSessions.confirmCancel}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    {/* "Cancel" would mean two different things in this dialog. */}
                    <AlertDialogCancel>{t.common.back}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCancel}
                      className="bg-destructive text-white hover:bg-destructive/90"
                    >
                      {t.liveSessions.cancelSession}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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

  async function handleReschedule(id: string, scheduledAt: string) {
    try {
      const session = await liveSessionsApi.updateSession(id, {
        scheduled_at: scheduledAt,
      });
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...session } : s))
      );
      toast.success(t.liveSessions.sessionRescheduled);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to reschedule session";
      toast.error(msg);
    }
  }

  async function handleCancel(id: string) {
    try {
      await liveSessionsApi.cancelSession(id);
      // The API marks the row cancelled rather than deleting it, so registered
      // parents keep a record of what happened. Mirror that locally instead of
      // dropping the row, which also moves it into the past list.
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: "cancelled" } : s))
      );
      toast.success(t.liveSessions.sessionCancelled);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to cancel session";
      toast.error(msg);
    }
  }

  async function handlePublish(id: string) {
    try {
      const session = await liveSessionsApi.updateSession(id, {
        is_published: true,
      });
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...session } : s))
      );
      toast.success("Session published — parents can now see it");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to publish session";
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
          <div className="flex items-center gap-1">
            <RefreshButton onRefresh={loadSessions} />
            <Button asChild className="gap-2">
              <Link href="/dashboard/doctor/live-sessions/new">
                <Plus className="h-4 w-4" />
                {t.liveSessions.newSession}
              </Link>
            </Button>
          </div>
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
                      onPublish={handlePublish}
                      onReschedule={handleReschedule}
                      onCancel={handleCancel}
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
                      onPublish={handlePublish}
                      onReschedule={handleReschedule}
                      onCancel={handleCancel}
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
