"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, Clock, Video, Plus } from "lucide-react";
import { appointmentsApi } from "@/lib/api/appointments";
import type { Appointment } from "@/types/appointment";
import { getConsultationTypeLabel } from "@/lib/i18n/consultation-labels";
import { getAppointmentStatusLabel } from "@/lib/i18n/appointment-status";
import { TimezoneNotice } from "@/components/booking/timezone-notice";
import { useViewerTimezone } from "@/hooks/use-viewer-timezone";
import { DEFAULT_TIMEZONE, formatStoredAppointment } from "@/lib/timezone";

export function UpcomingAppointments() {
  const { dictionary: t } = useI18n();
  const { timezone: viewerTimezone } = useViewerTimezone(DEFAULT_TIMEZONE);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  async function handleJoin(id: string) {
    setJoiningId(id);
    const url = await appointmentsApi.join(id);
    setJoiningId(null);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    appointmentsApi
      .list()
      .then((all) => {
        const upcoming = all
          .filter(
            (a) =>
              !["cancelled", "completed"].includes(a.status) &&
              new Date(a.scheduled_date) >= today
          )
          .sort(
            (a, b) =>
              new Date(a.scheduled_date).getTime() -
              new Date(b.scheduled_date).getTime()
          )
          .slice(0, 3);
        setAppointments(upcoming);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">
          {t.parentDashboard.upcomingAppointments}
        </CardTitle>
        <Link href="/booking">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            {t.parentDashboard.bookAppointment}
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isLoading ? (
          <>
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </>
        ) : appointments.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t.parentDashboard.noUpcomingAppointmentsWidget}
            </p>
            <Link href="/booking">
              <Button variant="outline" size="sm">
                {t.parentDashboard.bookFirstConsultation}
              </Button>
            </Link>
          </div>
        ) : (
          appointments.map((appt) => {
            const typeLabel = getConsultationTypeLabel(t, appt.consultation_type);
            const childName = appt.child_profiles
              ? `${appt.child_profiles.first_name}`
              : t.appointments.dash;

            // Stored wall clock is the doctor's; show it in the parent's zone.
            const shownAt = formatStoredAppointment(
              appt.scheduled_date,
              appt.scheduled_time,
              appt.timezone ?? DEFAULT_TIMEZONE,
              viewerTimezone
            );

            return (
              <div
                key={appt.id}
                className="flex items-center justify-between rounded-lg border border-border p-4"
              >
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-foreground">
                    {childName} — {typeLabel}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {shownAt.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {shownAt.time}
                    </span>
                    <TimezoneNotice timezone={viewerTimezone} variant="compact" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      appt.status === "confirmed" ? "default" : "secondary"
                    }
                  >
                    {getAppointmentStatusLabel(t, appt.status)}
                  </Badge>
                  {appt.status === "confirmed" && appt.meeting_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 bg-transparent"
                      disabled={joiningId === appt.id}
                      onClick={() => handleJoin(appt.id)}
                    >
                      <Video className="h-3.5 w-3.5" />
                      {t.appointments.join}
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {appointments.length > 0 && (
          <Link
            href="/dashboard/parent/appointments"
            className="text-center text-xs text-primary hover:underline"
          >
            {t.parentDashboard.viewAllAppointments}
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
