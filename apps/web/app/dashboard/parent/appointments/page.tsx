"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import {
  ChevronLeft,
  Plus,
  CalendarDays,
  Clock,
  Video,
  User,
  Stethoscope,
  X,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { appointmentsApi, doctorsApi } from "@/lib/api/appointments";
import type { Appointment, AppointmentStatus } from "@/types/appointment";
import { useI18n } from "@/lib/i18n/i18n-context";
import { getConsultationTypeLabel } from "@/lib/i18n/consultation-labels";
import { getAppointmentStatusLabel } from "@/lib/i18n/appointment-status";
import { TimezoneNotice } from "@/components/booking/timezone-notice";

const STATUS_VARIANTS: Record<
  AppointmentStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  confirmed: "default",
  completed: "outline",
  cancelled: "destructive",
  rescheduled: "secondary",
};

export default function ParentAppointmentsPage() {
  const { dictionary: t } = useI18n();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cancel dialog
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Reschedule dialog
  const [rescheduleAppt, setRescheduleAppt] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>();
  const [rescheduleSlots, setRescheduleSlots] = useState<string[]>([]);
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [isSlotsLoading, setIsSlotsLoading] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);

  const loadAppointments = () => {
    setIsLoading(true);
    setError(null);
    appointmentsApi
      .list()
      .then(setAppointments)
      .catch(() => setError(t.appointments.loadError))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadAppointments();
  }, []);

  // Fetch slots when reschedule date changes
  useEffect(() => {
    if (!rescheduleDate || !rescheduleAppt) return;
    const dateStr = rescheduleDate.toISOString().split("T")[0];
    setIsSlotsLoading(true);
    setRescheduleTime("");
    doctorsApi
      .getSlots(rescheduleAppt.doctors.id, dateStr, rescheduleAppt.consultation_type)
      .then(setRescheduleSlots)
      .catch(() => setRescheduleSlots([]))
      .finally(() => setIsSlotsLoading(false));
  }, [rescheduleDate, rescheduleAppt]);

  const handleCancel = async () => {
    if (!cancelId) return;
    setIsCancelling(true);
    try {
      await appointmentsApi.cancel(cancelId);
      setCancelId(null);
      loadAppointments();
    } catch {
      // keep dialog open on error
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleAppt || !rescheduleDate || !rescheduleTime) return;
    setIsRescheduling(true);
    try {
      await appointmentsApi.reschedule(
        rescheduleAppt.id,
        rescheduleDate.toISOString().split("T")[0],
        rescheduleTime
      );
      setRescheduleAppt(null);
      setRescheduleDate(undefined);
      setRescheduleTime("");
      loadAppointments();
    } catch {
      // keep dialog open on error
    } finally {
      setIsRescheduling(false);
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = appointments.filter(
    (a) =>
      !["cancelled", "completed"].includes(a.status) &&
      new Date(a.scheduled_date) >= today
  );
  const past = appointments.filter(
    (a) =>
      ["cancelled", "completed"].includes(a.status) ||
      new Date(a.scheduled_date) < today
  );

  const renderAppointmentCard = (appt: Appointment) => {
    const typeLabel = getConsultationTypeLabel(t, appt.consultation_type);
    const childName = appt.child_profiles
      ? `${appt.child_profiles.first_name} ${appt.child_profiles.last_name}`
      : t.appointments.dash;
    const isUpcoming =
      !["cancelled", "completed"].includes(appt.status) &&
      new Date(appt.scheduled_date) >= today;
    const canCancel = ["pending", "confirmed"].includes(appt.status) && isUpcoming;
    const canReschedule = ["pending", "confirmed"].includes(appt.status) && isUpcoming;

    return (
      <Card key={appt.id} className="transition-shadow hover:shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_VARIANTS[appt.status]}>
                {getAppointmentStatusLabel(t, appt.status)}
              </Badge>
              <span className="text-xs text-muted-foreground">{typeLabel}</span>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span className="flex items-center gap-1.5 text-sm text-foreground">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                {childName}
              </span>
              <span className="flex items-center gap-1.5 text-sm text-foreground">
                <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
                {appt.doctors?.full_name ?? t.appointments.dash}
              </span>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                {appt.scheduled_date}
              </span>
              <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {appt.scheduled_time} · {appt.duration_minutes}{" "}
                {t.appointments.minSuffix}
                <TimezoneNotice variant="compact" />
              </span>
            </div>

            <p className="text-sm font-semibold text-foreground">
              {appt.price_aed} {t.common.aed}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
            {appt.status === "confirmed" && appt.meeting_url && (
              <a href={appt.meeting_url} target="_blank" rel="noopener noreferrer">
                <Button size="sm" className="gap-1.5">
                  <Video className="h-3.5 w-3.5" />
                  {t.appointments.join}
                </Button>
              </a>
            )}
            {canReschedule && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  setRescheduleAppt(appt);
                  setRescheduleDate(undefined);
                  setRescheduleSlots([]);
                  setRescheduleTime("");
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t.appointments.reschedule}
              </Button>
            )}
            {canCancel && (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={() => setCancelId(appt.id)}
              >
                <X className="h-3.5 w-3.5" />
                {t.appointments.cancel}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout role="parent">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="gap-1">
              <Link href="/dashboard/parent">
                <ChevronLeft className="h-4 w-4" />
                {t.common.dashboard}
              </Link>
            </Button>
          </div>
          <Link href="/booking">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              {t.parentDashboard.bookAppointment}
            </Button>
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-foreground">{t.appointments.title}</h1>
        <p className="text-xs text-muted-foreground">{t.booking.timezoneHint}</p>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-4 py-16">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" onClick={loadAppointments}>
              {t.appointments.tryAgain}
            </Button>
          </div>
        ) : appointments.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <CalendarDays className="h-12 w-12 text-muted-foreground/40" />
            <p className="font-medium text-foreground">{t.appointments.emptyTitle}</p>
            <p className="text-sm text-muted-foreground">
              {t.appointments.emptySubtitle}
            </p>
            <Link href="/booking">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                {t.parentDashboard.bookAppointment}
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="text-base font-semibold text-foreground">
                  {t.appointments.upcomingSection} ({upcoming.length})
                </h2>
                {upcoming.map(renderAppointmentCard)}
              </section>
            )}

            {past.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="text-base font-semibold text-foreground">
                  {t.appointments.pastSection} ({past.length})
                </h2>
                {past.map(renderAppointmentCard)}
              </section>
            )}
          </>
        )}
      </div>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={!!cancelId} onOpenChange={() => setCancelId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.appointments.cancelTitle}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t.appointments.cancelBody}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelId(null)}>
              {t.appointments.keepAppointment}
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={isCancelling}
              className="gap-2"
            >
              {isCancelling && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.appointments.yesCancel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog
        open={!!rescheduleAppt}
        onOpenChange={() => {
          setRescheduleAppt(null);
          setRescheduleDate(undefined);
          setRescheduleSlots([]);
          setRescheduleTime("");
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.appointments.rescheduleTitle}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">{t.booking.timezoneHint}</p>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-center">
              <Calendar
                mode="single"
                selected={rescheduleDate}
                onSelect={setRescheduleDate}
                disabled={(d) => d < today}
                className="rounded-md border"
              />
            </div>

            {rescheduleDate && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-foreground">
                  {t.appointments.availableSlotsLabel}
                </p>
                {isSlotsLoading ? (
                  <div className="flex flex-wrap gap-2">
                    {[...Array(6)].map((_, i) => (
                      <Skeleton key={i} className="h-8 w-20 rounded-md" />
                    ))}
                  </div>
                ) : rescheduleSlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t.appointments.noSlotsThisDate}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {rescheduleSlots.map((slot) => (
                      <Button
                        key={slot}
                        size="sm"
                        variant={rescheduleTime === slot ? "default" : "outline"}
                        className="text-xs"
                        onClick={() => setRescheduleTime(slot)}
                      >
                        {slot}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRescheduleAppt(null);
                setRescheduleDate(undefined);
                setRescheduleSlots([]);
                setRescheduleTime("");
              }}
            >
              {t.common.cancel}
            </Button>
            <Button
              onClick={handleReschedule}
              disabled={!rescheduleDate || !rescheduleTime || isRescheduling}
              className="gap-2"
            >
              {isRescheduling && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.appointments.confirmReschedule}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
