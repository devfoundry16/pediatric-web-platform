"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n/i18n-context";
import {
  liveSessionsApi,
  type SessionRegistration,
} from "@/lib/api/live-sessions";
import { toast } from "sonner";
import {
  CalendarDays,
  Clock,
  Video,
  Radio,
  Users,
  ExternalLink,
} from "lucide-react";
import { TimezoneNotice } from "@/components/booking/timezone-notice";
import { useViewerTimezone } from "@/hooks/use-viewer-timezone";
import { formatDateInTimezone, formatTimeInTimezone } from "@/lib/timezone";

function RegistrationCard({
  reg,
}: {
  reg: SessionRegistration;
}) {
  const { dictionary: t } = useI18n();
  const router = useRouter();
  // scheduled_at is a real instant (TIMESTAMPTZ) — format it with an explicit
  // zone rather than relying on the runtime default and labelling it GST.
  const { timezone: viewerTimezone } = useViewerTimezone();

  const session = reg.group_sessions;
  if (!session) return null;

  const scheduledDate = new Date(session.scheduled_at);
  const isLive = session.status === "live";
  const isEnded = session.status === "ended";

  return (
    <Card className="transition-all hover:shadow-md">
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground truncate">
                {session.title}
              </h3>
              {isLive && (
                <Badge className="gap-1 bg-red-500 text-white hover:bg-red-600">
                  <Radio className="h-3 w-3" />
                  {t.liveSessions.live}
                </Badge>
              )}
              {isEnded && (
                <Badge variant="secondary">{t.liveSessions.statusEnded}</Badge>
              )}
              {session.status === "scheduled" && (
                <Badge variant="outline">
                  {t.liveSessions.statusScheduled}
                </Badge>
              )}
            </div>

            {session.doctors && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t.liveSessions.hostedBy} {session.doctors.full_name}
              </p>
            )}

            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDateInTimezone(scheduledDate, viewerTimezone)}
              </span>
              <span className="flex items-center gap-x-1 gap-y-0.5 flex-wrap">
                <Clock className="h-3.5 w-3.5" />
                {formatTimeInTimezone(scheduledDate, viewerTimezone)}{" "}
                · {session.duration_minutes} {t.common.minutes}
                <TimezoneNotice timezone={viewerTimezone} variant="compact" />
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {session.max_participants} max
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isLive && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  router.push(`/live-sessions/${session.id}/room`)
                }
              >
                <Radio className="h-3.5 w-3.5" />
                {t.liveSessions.joinRoom}
              </Button>
            )}

            {isEnded && session.recording_url && (
              <Button size="sm" variant="outline" className="gap-1.5" asChild>
                <a
                  href={session.recording_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Video className="h-3.5 w-3.5" />
                  {t.liveSessions.watchRecording}
                </a>
              </Button>
            )}

            <Button size="sm" variant="ghost" asChild>
              <Link href={`/live-sessions/${session.id}`}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ParentLiveSessionsPage() {
  const { dictionary: t } = useI18n();
  const [registrations, setRegistrations] = useState<SessionRegistration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await liveSessionsApi.getMyRegistrations();
        setRegistrations(data);
      } catch {
        toast.error(t.doctorDashboard.loadError);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const upcoming = registrations.filter(
    (r) =>
      r.group_sessions?.status === "scheduled" ||
      r.group_sessions?.status === "live"
  );
  const past = registrations.filter(
    (r) =>
      r.group_sessions?.status === "ended" ||
      r.group_sessions?.status === "cancelled"
  );

  return (
    <DashboardLayout role="parent">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {t.liveSessions.mySessions}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.liveSessions.subtitle}
            </p>
          </div>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/live-sessions">
              <Video className="h-4 w-4" />
              {t.liveSessions.title}
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : registrations.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Video className="h-6 w-6 text-primary/60" />
            </div>
            <div>
              <p className="font-medium text-foreground">
                {t.liveSessions.noRegistrations}
              </p>
            </div>
            <Button asChild className="gap-2">
              <Link href="/live-sessions">
                <Video className="h-4 w-4" />
                {t.liveSessions.title}
              </Link>
            </Button>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div className="flex flex-col gap-3">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  {t.liveSessions.upcoming}
                </h2>
                {upcoming.map((reg) => (
                  <RegistrationCard key={reg.id} reg={reg} />
                ))}
              </div>
            )}

            {past.length > 0 && (
              <div className="flex flex-col gap-3">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  {t.liveSessions.past}
                </h2>
                {past.map((reg) => (
                  <RegistrationCard key={reg.id} reg={reg} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
