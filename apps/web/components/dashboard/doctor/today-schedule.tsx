"use client";

import { useEffect, useState, useCallback } from "react";
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
import { Clock, Video, FileText, CheckCircle, CalendarX } from "lucide-react";
import { TimezoneNotice } from "@/components/booking/timezone-notice";
import { doctorApi, type DoctorAppointment } from "@/lib/api/doctor";

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

function consultationLabel(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function getStatusDisplay(apt: DoctorAppointment): {
  label: string;
  className: string;
  inProgress: boolean;
} {
  if (apt.status === "completed")
    return {
      label: "Completed",
      className: "bg-gray-100 text-gray-700",
      inProgress: false,
    };
  if (apt.status === "cancelled")
    return {
      label: "Cancelled",
      className: "bg-red-100 text-red-700",
      inProgress: false,
    };
  if (apt.status === "confirmed" && apt.meeting_url)
    return {
      label: "In Progress",
      className: "bg-green-100 text-green-800",
      inProgress: true,
    };
  return {
    label: "Upcoming",
    className: "bg-blue-100 text-blue-800",
    inProgress: false,
  };
}

export function TodaySchedule() {
  const { dictionary: t } = useI18n();
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const data = await doctorApi.getAppointments(today);
      setAppointments(data);
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

  async function handleJoin(id: string) {
    setActionLoading(id);
    const url = await doctorApi.joinAppointment(id);
    setActionLoading(null);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {t.doctorDashboard.todaySchedule}
        </CardTitle>
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
            const display = getStatusDisplay(apt);
            const childName = apt.child_profiles
              ? `${apt.child_profiles.first_name} ${apt.child_profiles.last_name}`
              : "—";
            const showStart =
              (apt.status === "pending" || apt.status === "confirmed") &&
              !apt.meeting_url;
            const showJoin = apt.status === "confirmed" && !!apt.meeting_url;
            const showComplete = apt.status === "confirmed";

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
                    {apt.parent_name ?? "—"}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(apt.scheduled_time)}
                    </span>
                    <TimezoneNotice variant="compact" />
                    <span>
                      {apt.duration_minutes} {t.common.minutes}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {consultationLabel(apt.consultation_type)}
                    </Badge>
                  </div>
                </div>
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
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
