"use client";

import { RefreshButton } from "@/components/ui/refresh-button";
import { useRouter } from "next/navigation";

import { useEffect, useState, useCallback } from "react";
import {
  DEFAULT_TIMEZONE,
  formatStoredAppointment,
  wallClockToInstant,
} from "@/lib/timezone";
import {
  appointmentOpensAt,
  appointmentStartMs,
  joinNotYetOpen,
  joinOpensAtLabel,
} from "@/lib/appointment-window";
import { useI18n } from "@/lib/i18n/i18n-context";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { getConsultationTypeLabel } from "@/lib/i18n/consultation-labels";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Video, FileText, CheckCircle, CalendarX } from "lucide-react";
import { TimezoneNotice } from "@/components/booking/timezone-notice";
import { doctorApi, type DoctorAppointment } from "@/lib/api/doctor";

/**
 * Whether the consultation's slot is happening now.
 *
 * This used to be inferred from meeting_url, back when a room only existed
 * once the doctor pressed Start. Rooms are now created when the booking is
 * confirmed, so meeting_url says nothing about whether the session is under
 * way — every confirmed appointment would have read "In Progress".
 */
function isUnderway(
  apt: DoctorAppointment,
  timezone: string,
  now: number = Date.now()
): boolean {
  const start = wallClockToInstant(apt.scheduled_date, apt.scheduled_time, timezone);
  if (isNaN(start.getTime())) return false;
  const end = start.getTime() + apt.duration_minutes * 60_000;
  return now >= start.getTime() && now <= end;
}

function getStatusDisplay(
  t: Dictionary,
  apt: DoctorAppointment,
  timezone: string
): {
  label: string;
  className: string;
  inProgress: boolean;
} {
  if (apt.status === "completed")
    return {
      label: t.doctorDashboard.statusCompleted,
      className: "bg-gray-100 text-gray-700",
      inProgress: false,
    };
  if (apt.status === "cancelled")
    return {
      label: t.doctorDashboard.statusCancelled,
      className: "bg-red-100 text-red-700",
      inProgress: false,
    };
  if (apt.status === "confirmed" && isUnderway(apt, timezone))
    return {
      label: t.doctorDashboard.statusInProgress,
      className: "bg-green-100 text-green-800",
      inProgress: true,
    };
  return {
    label: t.doctorDashboard.statusUpcoming,
    className: "bg-blue-100 text-blue-800",
    inProgress: false,
  };
}

export function TodaySchedule() {
  const router = useRouter();
  const { dictionary: t, dateLocale } = useI18n();
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const [doctorTimezone, setDoctorTimezone] = useState(DEFAULT_TIMEZONE);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // "today" is resolved server-side in the doctor's own timezone. Computing
      // it here would need the zone before the first response supplies it, and
      // toISOString() (the previous approach) gives the UTC day, which is
      // yesterday for the first hours of every Dubai day.
      const { appointments: data, timezone } = await doctorApi.getAppointments("today");
      setAppointments(data);
      if (timezone) setDoctorTimezone(timezone);
    } catch {
      // silently fail — error state handled by parent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStart(id: string) {
    setActionLoading(id);
    try {
      await doctorApi.startSession(id);
      await load();
      router.push(`/appointments/${id}/room`);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleComplete(id: string) {
    setActionLoading(id);
    try {
      await doctorApi.completeAppointment(id);
      await load();
    } finally {
      setActionLoading(null);
    }
  }

  // The call runs inside the app, which is what lets Leave return here
  // instead of stranding the doctor on daily.co.
  function handleJoin(id: string) {
    router.push(`/appointments/${id}/room`);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-lg">
          {t.doctorDashboard.todaySchedule}
        </CardTitle>
        <RefreshButton onRefresh={load} />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))
        ) : appointments.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
            <CalendarX className="h-8 w-8 opacity-40" />
            <p className="text-sm">{t.doctorDashboard.noAppointmentsToday}</p>
          </div>
        ) : (
          appointments.map((apt) => {
            const display = getStatusDisplay(t, apt, doctorTimezone);
            const shownAt = formatStoredAppointment(
              apt.scheduled_date,
              apt.scheduled_time,
              doctorTimezone,
              doctorTimezone,
              dateLocale
            );
            const childName = apt.child_profiles
              ? `${apt.child_profiles.first_name} ${apt.child_profiles.last_name}`
              : t.appointments.dash;
            // Start confirms a pending booking; a confirmed one is simply
            // joined. Neither depends on meeting_url any more, which is filled
            // in asynchronously once the booking is confirmed.
            const showStart = apt.status === "pending";
            const showJoin = apt.status === "confirmed";
            const showComplete = apt.status === "confirmed";

            // Announced only while still ahead, in the doctor's own zone
            // like everything else in this widget (rows carry no zone of
            // their own).
            const schedulable = { ...apt, timezone: doctorTimezone };
            const opensAt = showJoin ? appointmentOpensAt(schedulable) : null;
            const joinOpensText =
              opensAt && joinNotYetOpen(opensAt)
                ? joinOpensAtLabel(
                    t,
                    opensAt,
                    new Date(appointmentStartMs(schedulable)),
                    doctorTimezone,
                    dateLocale
                  )
                : null;

            return (
              <div
                key={apt.id}
                className="flex items-center justify-between rounded-lg border border-border p-4"
              >
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-foreground">
                    {childName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {apt.parent_name ?? t.appointments.dash}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {shownAt.time}
                    </span>
                    <TimezoneNotice timezone={doctorTimezone} variant="compact" />
                    <span>
                      {apt.duration_minutes} {t.common.minutes}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {getConsultationTypeLabel(t, apt.consultation_type)}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${display.className}`}
                    >
                      {display.label}
                    </span>
                    {showStart && (
                      <Button
                        size="sm"
                        className="gap-1.5"
                        disabled={actionLoading === apt.id}
                        onClick={() => handleStart(apt.id)}
                      >
                        <Video className="h-3.5 w-3.5" />
                        {t.doctorDashboard.startSession}
                      </Button>
                    )}
                    {showJoin && (
                      <Button
                        size="sm"
                        className="gap-1.5"
                        disabled={actionLoading === apt.id}
                        onClick={() => handleJoin(apt.id)}
                      >
                        <Video className="h-3.5 w-3.5" />
                        {t.doctorDashboard.joinSession}
                      </Button>
                    )}
                    {showComplete && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        disabled={actionLoading === apt.id}
                        onClick={() => handleComplete(apt.id)}
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        {t.doctorDashboard.completeSession}
                      </Button>
                    )}
                    {apt.symptoms && (
                      <Button size="sm" variant="ghost" title={apt.symptoms}>
                        <FileText className="h-3.5 w-3.5" />
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
      </CardContent>
    </Card>
  );
}
