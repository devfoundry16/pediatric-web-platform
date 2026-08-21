"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  Clock,
  Users,
  Video,
  Radio,
  CheckCircle,
} from "lucide-react";
import { TimezoneNotice } from "@/components/booking/timezone-notice";

interface SessionCardProps {
  session: {
    id: string;
    title: string;
    description: string;
    date: string;
    time: string;
    /** Zone `date`/`time` above were formatted in — shown so they aren't ambiguous. */
    timezone?: string;
    duration: number;
    maxUsers: number;
    currentUsers: number;
    price: number;
    isPast?: boolean;
    isLive?: boolean;
    hasRecording?: boolean;
    recordingUrl?: string;
    /** Viewer holds a confirmed (free or paid) place. */
    isRegistered?: boolean;
    /** Viewer started checkout but never paid, so they hold nothing yet. */
    paymentPending?: boolean;
    /** Viewer is the doctor hosting this session. */
    isHost?: boolean;
    /** Preformatted "Join opens at {time}." line, passed only while the join
     *  window is still ahead for a viewer with a join CTA. */
    joinOpensAtText?: string;
  };
}

export function SessionCard({ session }: SessionCardProps) {
  const { dictionary: t } = useI18n();
  const router = useRouter();
  const spotsLeft = session.maxUsers - session.currentUsers;
  const isFull = spotsLeft <= 0;

  return (
    <Card className="transition-all hover:shadow-lg">
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-semibold text-foreground">
                {session.title}
              </h3>
              {session.isLive && (
                <Badge className="gap-1 bg-red-500 text-white hover:bg-red-600">
                  <Radio className="h-3 w-3" />
                  {t.liveSessions.live}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {session.description}
            </p>
          </div>
          {session.price === 0 ? (
            <Badge variant="secondary">{t.liveSessions.free}</Badge>
          ) : (
            <Badge>
              {session.price} {t.common.aed}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" />
            {session.date}
          </span>
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <Clock className="h-4 w-4" />
            {session.time} ({session.duration} {t.common.minutes})
            <TimezoneNotice timezone={session.timezone} variant="compact" />
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {session.currentUsers}/{session.maxUsers} {t.liveSessions.participants}
          </span>
        </div>

        <div className="flex items-center justify-between">
          {!session.isPast && (
            <>
              {session.isLive ? (
                <span className="text-sm text-red-500 font-medium flex items-center gap-1">
                  <Radio className="h-3.5 w-3.5" />
                  {t.liveSessions.liveNow}
                </span>
              ) : !isFull ? (
                <span className="text-sm text-primary font-medium">
                  {spotsLeft} {t.liveSessions.spotsLeft}
                </span>
              ) : (
                <span className="text-sm text-destructive font-medium">
                  {t.liveSessions.full}
                </span>
              )}
              {session.isHost ? (
                // The caller wraps this card in a link to the detail page, so
                // this cannot be an anchor of its own — nested anchors are
                // invalid and React will complain on hydration. Cancel the
                // outer link's navigation and route to the room instead.
                <Button
                  className="gap-2"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    router.push(`/live-sessions/${session.id}/room`);
                  }}
                >
                  <Radio className="h-4 w-4" />
                  {t.liveSessions.joinRoom}
                </Button>
              ) : session.isLive && session.isRegistered ? (
                // The caller wraps this card in a link to the detail page, so
                // this cannot be an anchor of its own — nested anchors are
                // invalid and React will complain on hydration. Cancel the
                // outer link's navigation and route to the room instead.
                <Button
                  className="gap-2"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    router.push(`/live-sessions/${session.id}/room`);
                  }}
                >
                  <Radio className="h-4 w-4" />
                  {t.liveSessions.joinNow}
                </Button>
              ) : session.isRegistered ? (
                <Button variant="secondary" className="gap-2" disabled>
                  <CheckCircle className="h-4 w-4" />
                  {t.liveSessions.registered}
                </Button>
              ) : session.paymentPending ? (
                <Button variant="outline" className="gap-2">
                  <Clock className="h-4 w-4" />
                  {t.liveSessions.paymentPending}
                </Button>
              ) : (
                <Button disabled={isFull && !session.isLive} className="gap-2">
                  <Video className="h-4 w-4" />
                  {session.isLive
                    ? t.liveSessions.joinSession
                    : t.liveSessions.registerSession}
                </Button>
              )}
            </>
          )}
          {session.isPast && (
            <>
              {session.hasRecording && session.recordingUrl ? (
                <>
                  <Badge variant="outline">{t.liveSessions.recording}</Badge>
                  <Button
                    variant="outline"
                    className="gap-2 bg-transparent"
                    onClick={(e) => {
                      e.preventDefault();
                      window.open(session.recordingUrl, "_blank");
                    }}
                  >
                    <Video className="h-4 w-4" />
                    {t.liveSessions.watchRecording}
                  </Button>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {t.liveSessions.sessionEnded}
                </span>
              )}
            </>
          )}
        </div>

        {session.joinOpensAtText && (
          <p className="text-xs text-muted-foreground">
            {session.joinOpensAtText}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
