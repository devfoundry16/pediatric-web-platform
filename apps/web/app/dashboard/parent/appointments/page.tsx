"use client";

import { RefreshButton } from "@/components/ui/refresh-button";
import { useRouter } from "next/navigation";

import { Suspense, useEffect, useState } from "react";
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
  RefreshCw,
  Loader2,
} from "lucide-react";
import { appointmentsApi, doctorsApi, type Slot } from "@/lib/api/appointments";
import type { Appointment, AppointmentStatus } from "@/types/appointment";
import { useI18n } from "@/lib/i18n/i18n-context";
import { getConsultationTypeLabel } from "@/lib/i18n/consultation-labels";
import { getAppointmentStatusLabel } from "@/lib/i18n/appointment-status";
import { TimezoneNotice } from "@/components/booking/timezone-notice";
import { useViewerTimezone } from "@/hooks/use-viewer-timezone";
import { useHighlightedAppointment } from "@/hooks/use-highlighted-appointment";
import { cn } from "@/lib/utils";
import {
  DEFAULT_TIMEZONE,
  calendarDayInTimezone,
  formatLocalDateYMD,
  formatShortDateInTimezone,
  formatStoredAppointment,
  formatTimeInTimezone,
  formatTimezoneLabel,
  parseLocalYMD,
  todayInTimezone,
} from "@/lib/timezone";

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
  // useSearchParams (via useHighlightedAppointment) needs a boundary, or the
  // route drops out of static prerendering — same pattern as the login page.
  return (
    <Suspense fallback={null}>
      <ParentAppointmentsContent />
    </Suspense>
  );
}

function ParentAppointmentsContent() {
  const router = useRouter();
  const { dictionary: t } = useI18n();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reschedule dialog
  const [rescheduleAppt, setRescheduleAppt] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>();
  const [rescheduleSlots, setRescheduleSlots] = useState<Slot[]>([]);
  const [rescheduleSlot, setRescheduleSlot] = useState<Slot | null>(null);
  const [rescheduleTimezone, setRescheduleTimezone] = useState(DEFAULT_TIMEZONE);
  const [isSlotsLoading, setIsSlotsLoading] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);

  const { timezone: viewerTimezone } = useViewerTimezone(DEFAULT_TIMEZONE);
  const rescheduleToday = parseLocalYMD(todayInTimezone(rescheduleTimezone));
  const { highlightedId, highlightRef } = useHighlightedAppointment(!isLoading);

  // `silent` keeps the list on screen for a manual refresh; without it the
  // content is replaced by skeletons and the page jumps.
  const loadAppointments = (silent = false) => {
    if (!silent) setIsLoading(true);
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
    const dateStr = formatLocalDateYMD(rescheduleDate);
    setIsSlotsLoading(true);
    setRescheduleSlot(null);
    doctorsApi
      .getSlots(rescheduleAppt.doctors.id, dateStr, rescheduleAppt.consultation_type)
      .then(({ slots, timezone }) => {
        setRescheduleSlots(slots);
        if (timezone) setRescheduleTimezone(timezone);
      })
      .catch(() => setRescheduleSlots([]))
      .finally(() => setIsSlotsLoading(false));
  }, [rescheduleDate, rescheduleAppt]);

  const handleReschedule = async () => {
    if (!rescheduleAppt || !rescheduleSlot) return;
    setIsRescheduling(true);
    try {
      // Submit the slot's own doctor-local values, not the calendar selection —
      // near a day boundary the two can disagree.
      await appointmentsApi.reschedule(
        rescheduleAppt.id,
        rescheduleSlot.date,
        rescheduleSlot.time
      );
      setRescheduleAppt(null);
      setRescheduleDate(undefined);
      setRescheduleSlot(null);
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
    const canReschedule = ["pending", "confirmed"].includes(appt.status) && isUpcoming;
    // Stored wall clock belongs to the doctor's zone; show it in the parent's.
    const shownAt = formatStoredAppointment(
      appt.scheduled_date,
      appt.scheduled_time,
      appt.timezone ?? DEFAULT_TIMEZONE,
      viewerTimezone
    );

    const isHighlighted = appt.id === highlightedId;

    return (
      <Card
        key={appt.id}
        ref={isHighlighted ? highlightRef : undefined}
        className={cn(
          "transition-shadow hover:shadow-sm",
          isHighlighted && "ring-2 ring-primary shadow-md"
        )}
      >
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
                {shownAt.date}
              </span>
              <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {shownAt.time} · {appt.duration_minutes}{" "}
                {t.appointments.minSuffix}
                <TimezoneNotice timezone={viewerTimezone} variant="compact" />
              </span>
            </div>

            <p className="text-sm font-semibold text-foreground">
              {appt.price_aed} {t.common.aed}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
            {/* Keyed off status alone. meeting_url is filled in by a background
                job just after payment settles, so gating on it hid Join until
                the page happened to be reloaded. The room page handles the rest:
                it creates the room if it is somehow missing and says when the
                room opens if you are early. */}
            {appt.status === "confirmed" && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => router.push(`/appointments/${appt.id}/room`)}
              >
                <Video className="h-3.5 w-3.5" />
                {t.appointments.join}
              </Button>
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
                  setRescheduleSlot(null);
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t.appointments.reschedule}
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
          <div className="flex items-center gap-1">
            <RefreshButton variant="rotate" onRefresh={() => loadAppointments(true)} />
            <Link href="/booking">
              <Button size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                {t.parentDashboard.bookAppointment}
              </Button>
            </Link>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-foreground">{t.appointments.title}</h1>
        <p className="text-xs text-muted-foreground">
          {t.booking.timezoneHint.replace("{timezone}", formatTimezoneLabel(viewerTimezone))}
        </p>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-4 py-16">
            <p className="text-sm text-destructive">{error}</p>
            {/* Wrapped: passing the loader directly would hand the click event
                in as `silent`. */}
            <Button variant="outline" onClick={() => loadAppointments()}>
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

      {/* Reschedule Dialog */}
      <Dialog
        open={!!rescheduleAppt}
        onOpenChange={() => {
          setRescheduleAppt(null);
          setRescheduleDate(undefined);
          setRescheduleSlots([]);
          setRescheduleSlot(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.appointments.rescheduleTitle}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {t.booking.timezoneHint.replace("{timezone}", formatTimezoneLabel(viewerTimezone))}
          </p>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-center">
              <Calendar
                mode="single"
                selected={rescheduleDate}
                onSelect={setRescheduleDate}
                // The grid means the DOCTOR's calendar days, so bound it by the
                // doctor's today rather than the viewer's.
                disabled={(d) => (rescheduleToday ? d < rescheduleToday : false)}
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
                    {rescheduleSlots.map((slot) => {
                      const shiftedDay =
                        calendarDayInTimezone(slot.startsAt, viewerTimezone) !== slot.date
                          ? formatShortDateInTimezone(slot.startsAt, viewerTimezone)
                          : null;
                      return (
                        <Button
                          key={slot.startsAt}
                          size="sm"
                          variant={
                            rescheduleSlot?.startsAt === slot.startsAt ? "default" : "outline"
                          }
                          className="h-auto flex-col gap-0 py-1.5 text-xs"
                          onClick={() => setRescheduleSlot(slot)}
                        >
                          <span>{formatTimeInTimezone(slot.startsAt, viewerTimezone)}</span>
                          {shiftedDay && (
                            <span className="text-[10px] opacity-70">{shiftedDay}</span>
                          )}
                        </Button>
                      );
                    })}
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
                setRescheduleSlot(null);
              }}
            >
              {t.common.cancel}
            </Button>
            <Button
              onClick={handleReschedule}
              disabled={!rescheduleSlot || isRescheduling}
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
