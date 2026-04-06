"use client";

import { useI18n } from "@/lib/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, Users, Video } from "lucide-react";
import { TimezoneNotice } from "@/components/booking/timezone-notice";

interface SessionCardProps {
  session: {
    id: string;
    title: string;
    description: string;
    date: string;
    time: string;
    duration: number;
    maxUsers: number;
    currentUsers: number;
    price: number;
    isPast?: boolean;
    hasRecording?: boolean;
  };
}

export function SessionCard({ session }: SessionCardProps) {
  const { dictionary: t } = useI18n();
  const spotsLeft = session.maxUsers - session.currentUsers;
  const isFull = spotsLeft <= 0;

  return (
    <Card className="transition-all hover:shadow-lg">
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">
              {session.title}
            </h3>
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
            <TimezoneNotice variant="compact" />
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {session.currentUsers}/{session.maxUsers} {t.liveSessions.participants}
          </span>
        </div>

        <div className="flex items-center justify-between">
          {!session.isPast && (
            <>
              {!isFull ? (
                <span className="text-sm text-primary font-medium">
                  {spotsLeft} {t.liveSessions.spotsLeft}
                </span>
              ) : (
                <span className="text-sm text-destructive font-medium">
                  {t.liveSessions.full}
                </span>
              )}
              <Button disabled={isFull} className="gap-2">
                <Video className="h-4 w-4" />
                {t.liveSessions.registerSession}
              </Button>
            </>
          )}
          {session.isPast && session.hasRecording && (
            <>
              <Badge variant="outline">{t.liveSessions.recording}</Badge>
              <Button variant="outline" className="gap-2 bg-transparent">
                <Video className="h-4 w-4" />
                {t.liveSessions.recording}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
