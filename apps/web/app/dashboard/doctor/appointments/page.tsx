"use client";

import { RefreshButton } from "@/components/ui/refresh-button";
import { useRouter } from "next/navigation";

import { Suspense, useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useHighlightedAppointment } from "@/hooks/use-highlighted-appointment";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { AppointmentDocuments } from "@/components/dashboard/appointment-documents";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Clock,
  Video,
  CheckCircle,
  FileText,
  CalendarX,
  User,
} from "lucide-react";
import { TimezoneNotice } from "@/components/booking/timezone-notice";
import { doctorApi, type DoctorAppointment } from "@/lib/api/doctor";
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
  joinWindowHintText,
} from "@/lib/appointment-window";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { getConsultationTypeLabel } from "@/lib/i18n/consultation-labels";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type FilterTab = "all" | "today" | "upcoming" | "completed" | "cancelled";

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

function getStatusBadge(
  t: Dictionary,
  apt: DoctorAppointment,
  timezone: string
): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  className: string;
} {
  if (apt.status === "completed")
    return {
      label: t.doctorDashboard.statusCompleted,
      variant: "secondary",
      className: "bg-gray-100 text-gray-700",
    };
  if (apt.status === "cancelled")
    return {
      label: t.doctorDashboard.statusCancelled,
      variant: "destructive",
      className: "bg-red-100 text-red-700",
    };
  if (apt.status === "confirmed" && isUnderway(apt, timezone))
    return {
      label: t.doctorDashboard.statusInProgress,
      variant: "default",
      className: "bg-green-100 text-green-800",
    };
  if (apt.status === "confirmed")
    return {
      label: t.appointments.statusConfirmed,
      variant: "default",
      className: "bg-blue-100 text-blue-800",
    };
  return {
    label: t.doctorDashboard.statusPending,
    variant: "outline",
    className: "bg-yellow-50 text-yellow-800",
  };
}

function filterAppointments(
  appointments: DoctorAppointment[],
  tab: FilterTab
): DoctorAppointment[] {
  const today = new Date().toISOString().split("T")[0];
  switch (tab) {
    case "today":
      return appointments.filter((a) => a.scheduled_date === today);
    case "upcoming":
      return appointments.filter(
        (a) =>
          a.scheduled_date >= today &&
          !["completed", "cancelled", "rescheduled"].includes(a.status)
      );
    case "completed":
      return appointments.filter((a) => a.status === "completed");
    case "cancelled":
      return appointments.filter(
        (a) => a.status === "cancelled" || a.status === "rescheduled"
      );
    default:
      return appointments;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DoctorAppointmentsPage() {
  // useSearchParams (via useHighlightedAppointment) needs a boundary, or the
  // route drops out of static prerendering — same pattern as the login page.
  return (
    <Suspense fallback={null}>
      <DoctorAppointmentsContent />
    </Suspense>
  );
}

function DoctorAppointmentsContent() {
  const router = useRouter();
  const { dictionary: t, dateLocale } = useI18n();
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Times below are the doctor's own wall clock; label them with their zone
  // rather than asserting GST for everyone.
  const [doctorTimezone, setDoctorTimezone] = useState(DEFAULT_TIMEZONE);
  const { highlightedId, highlightRef } = useHighlightedAppointment(!loading);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [symptomsApt, setSymptomsApt] = useState<DoctorAppointment | null>(
    null
  );

  const load = useCallback(async () => {
    setError(false);
    try {
      const { appointments: data, timezone } = await doctorApi.getAppointments();
      setAppointments(data);
      if (timezone) setDoctorTimezone(timezone);
    } catch {
      setError(true);
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

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: t.doctorDashboard.filterAll },
    { key: "today", label: t.doctorDashboard.filterToday },
    { key: "upcoming", label: t.doctorDashboard.filterUpcoming },
    { key: "completed", label: t.doctorDashboard.filterCompleted },
    { key: "cancelled", label: t.doctorDashboard.filterCancelled },
  ];

  const visible = filterAppointments(appointments, activeTab);

  return (
    <DashboardLayout role="doctor">
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {t.doctorDashboard.allAppointments}
            </h1>
            <TimezoneNotice timezone={doctorTimezone} variant="compact" />
            <p className="mt-1 text-xs text-muted-foreground">
              {joinWindowHintText(t)}
            </p>
          </div>
          <RefreshButton onRefresh={load} />
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              {t.doctorDashboard.loadError}
            </CardContent>
          </Card>
        ) : visible.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-14">
              <CalendarX className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-muted-foreground">
                {t.doctorDashboard.noAppointmentsToday}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {visible.map((apt) => {
              const badge = getStatusBadge(t, apt, doctorTimezone);
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
              // joined. Neither depends on meeting_url any more, which is
              // filled in asynchronously once the booking is confirmed.
              const showStart = apt.status === "pending";
              const showJoin = apt.status === "confirmed";
              const showComplete = apt.status === "confirmed";

              // Announced only while still ahead, in the doctor's own zone
              // like everything else on this page (rows carry no zone of
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

              const isHighlighted = apt.id === highlightedId;

              return (
                <Card
                  key={apt.id}
                  ref={isHighlighted ? highlightRef : undefined}
                  className={cn(isHighlighted && "ring-2 ring-primary shadow-md")}
                >
                  <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">
                          {childName}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          &middot; {apt.parent_name ?? t.appointments.dash}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <span>{shownAt.date}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {shownAt.time}
                        </span>
                        <span>
                          {apt.duration_minutes} {t.common.minutes}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {getConsultationTypeLabel(t, apt.consultation_type)}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-0.5 text-xs font-medium ${badge.className}`}
                      >
                        {badge.label}
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
                          {t.doctorDashboard.joinSession2}
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
                      {(
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5"
                          onClick={() => setSymptomsApt(apt)}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {t.doctorDashboard.viewSymptoms}
                        </Button>
                      )}
                      {joinOpensText && (
                        <p className="basis-full text-xs text-muted-foreground">
                          {joinOpensText}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Symptoms dialog */}
      <Dialog
        open={!!symptomsApt}
        onOpenChange={(open) => !open && setSymptomsApt(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.doctorDashboard.symptoms}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {symptomsApt?.symptoms ?? t.doctorDashboard.noSymptoms}
            </p>
            {symptomsApt && (
              <AppointmentDocuments key={symptomsApt.id} appointmentId={symptomsApt.id} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
