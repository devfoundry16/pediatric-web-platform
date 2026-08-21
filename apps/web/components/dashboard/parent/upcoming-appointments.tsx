"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshButton } from "@/components/ui/refresh-button";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import {
  appointmentOpensAt,
  appointmentStartMs,
  isUpcomingAppointment,
  joinNotYetOpen,
  joinOpensAtLabel,
} from "@/lib/appointment-window";

export function UpcomingAppointments() {
  const { dictionary: t, dateLocale } = useI18n();
  const router = useRouter();
  const { timezone: viewerTimezone } = useViewerTimezone(DEFAULT_TIMEZONE);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // The call runs inside the app, which is what lets Leave return here
  // instead of stranding the parent on daily.co.
  function handleJoin(id: string) {
    router.push(`/appointments/${id}/room`);
  }

  // Extracted from the effect so the refresh control can call it too.
  const load = useCallback(() => {
    return appointmentsApi
      .list()
      .then((all) => {
        // Same rule as the full list: still joinable means still upcoming,
        // and sorting uses the real start instant rather than the bare date.
        const upcoming = all
          .filter((a) => isUpcomingAppointment(a))
          .sort((a, b) => appointmentStartMs(a) - appointmentStartMs(b))
          .slice(0, 3);
        setAppointments(upcoming);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">
          {t.parentDashboard.upcomingAppointments}
        </CardTitle>
        <div className="flex items-center gap-1">
          <RefreshButton onRefresh={load} />
          <Link href="/booking">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              {t.parentDashboard.bookAppointment}
            </Button>
          </Link>
        </div>
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

            // Announced only while still ahead — once the window is open the
            // Join button speaks for itself.
            const opensAt = appointmentOpensAt(appt);
            const joinOpensText =
              appt.status === "confirmed" &&
              opensAt &&
              joinNotYetOpen(opensAt)
                ? joinOpensAtLabel(
                    t,
                    opensAt,
                    new Date(appointmentStartMs(appt)),
                    viewerTimezone,
                    dateLocale
                  )
                : null;

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
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        appt.status === "confirmed" ? "default" : "secondary"
                      }
                    >
                      {getAppointmentStatusLabel(t, appt.status)}
                    </Badge>
                    {/* Status alone — see the appointments list for why. */}
                    {appt.status === "confirmed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 bg-transparent"
                        onClick={() => handleJoin(appt.id)}
                      >
                        <Video className="h-3.5 w-3.5" />
                        {t.appointments.join}
                      </Button>
                    )}
                  </div>
                  {joinOpensText && (
                    <p className="text-xs text-muted-foreground">
                      {joinOpensText}
                    </p>
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
