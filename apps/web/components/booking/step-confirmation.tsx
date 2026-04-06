"use client";

import { useI18n } from "@/lib/i18n/i18n-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, CalendarDays, Clock, Mail } from "lucide-react";
import Link from "next/link";
import { CONSULTATION_TYPES } from "@/types/appointment";
import { getConsultationTypeLabel } from "@/lib/i18n/consultation-labels";
import { TimezoneNotice } from "@/components/booking/timezone-notice";

interface StepConfirmationProps {
  appointmentId: string;
  bookingData: {
    typeId: string;
    date: string;
    time: string;
    childName: string;
  };
}

export function StepConfirmation({
  appointmentId,
  bookingData,
}: StepConfirmationProps) {
  const { dictionary: t } = useI18n();
  const type = CONSULTATION_TYPES.find((c) => c.id === bookingData.typeId);
  const typeLabel = getConsultationTypeLabel(t, bookingData.typeId);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/40">
          <CheckCircle2 className="h-9 w-9 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">
          {t.booking.confirmationTitle}
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t.booking.confirmationSubtitle}
        </p>
      </div>

      <Card className="w-full">
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t.booking.bookingId}</span>
            <span className="font-mono font-medium text-foreground">
              #{appointmentId.slice(0, 8).toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">{t.booking.dateTime}</p>
              <p className="text-sm font-medium text-foreground">
                {bookingData.date} {t.booking.dateTimeAt} {bookingData.time}
              </p>
              <TimezoneNotice variant="compact" className="mt-1" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">
                {t.booking.labelConsultation}
              </p>
              <p className="text-sm font-medium text-foreground">
                {typeLabel} · {type?.duration} {t.appointments.minSuffix}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">
                {t.booking.labelPatient}
              </p>
              <p className="text-sm font-medium text-foreground">
                {bookingData.childName}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        {t.booking.videoLinkNotice}{" "}
        <Link
          href="/dashboard/parent/appointments"
          className="text-primary hover:underline"
        >
          {t.booking.appointmentsDashboardLink}
        </Link>
        .
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/dashboard/parent/appointments">
          <Button>{t.parentDashboard.upcomingAppointments}</Button>
        </Link>
        <Link href="/booking">
          <Button variant="outline">{t.booking.bookAnother}</Button>
        </Link>
      </div>
    </div>
  );
}
