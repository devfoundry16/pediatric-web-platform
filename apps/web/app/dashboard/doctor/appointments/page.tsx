"use client";

import { useEffect, useState, useCallback } from "react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
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
import { formatDateDisplayDubai } from "@/lib/timezone";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

type FilterTab = "all" | "today" | "upcoming" | "completed" | "cancelled";

function getStatusBadge(apt: DoctorAppointment): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  className: string;
} {
  if (apt.status === "completed")
    return {
      label: "Completed",
      variant: "secondary",
      className: "bg-gray-100 text-gray-700",
    };
  if (apt.status === "cancelled")
    return {
      label: "Cancelled",
      variant: "destructive",
      className: "bg-red-100 text-red-700",
    };
  if (apt.status === "confirmed" && apt.meeting_url)
    return {
      label: "In Progress",
      variant: "default",
      className: "bg-green-100 text-green-800",
    };
  if (apt.status === "confirmed")
    return {
      label: "Confirmed",
      variant: "default",
      className: "bg-blue-100 text-blue-800",
    };
  return {
    label: "Pending",
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
  const { dictionary: t } = useI18n();
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [symptomsApt, setSymptomsApt] = useState<DoctorAppointment | null>(
    null
  );

  const load = useCallback(async () => {
    setError(false);
    try {
      const data = await doctorApi.getAppointments();
      setAppointments(data);
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
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t.doctorDashboard.allAppointments}
          </h1>
          <TimezoneNotice variant="compact" />
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
              const badge = getStatusBadge(apt);
              const childName = apt.child_profiles
                ? `${apt.child_profiles.first_name} ${apt.child_profiles.last_name}`
                : "—";
              const showStart =
                (apt.status === "pending" || apt.status === "confirmed") &&
                !apt.meeting_url;
              const showJoin = apt.status === "confirmed" && !!apt.meeting_url;
              const showComplete = apt.status === "confirmed";

              return (
                <Card key={apt.id}>
                  <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">
                          {childName}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          &middot; {apt.parent_name ?? "—"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <span>{formatDateDisplayDubai(apt.scheduled_date)}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatTime(apt.scheduled_time)}
                        </span>
                        <span>
                          {apt.duration_minutes} {t.common.minutes}
                        </span>
                        <Badge variant="secondary" className="text-xs capitalize">
                          {apt.consultation_type}
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
                      {apt.symptoms && (
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
          <p className="text-sm text-foreground whitespace-pre-wrap">
            {symptomsApt?.symptoms ?? t.doctorDashboard.noSymptoms}
          </p>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
