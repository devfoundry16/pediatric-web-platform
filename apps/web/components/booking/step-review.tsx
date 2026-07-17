"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CalendarDays, Clock, User, CreditCard, Ticket } from "lucide-react";
import { CONSULTATION_TYPES } from "@/types/appointment";
import { getConsultationTypeLabel } from "@/lib/i18n/consultation-labels";
import { TimezoneNotice } from "@/components/booking/timezone-notice";
import { packagesApi } from "@/lib/api/packages";
import type { UserPackage } from "@/types/packages";

interface StepReviewProps {
  bookingData: {
    childId: string;
    childName: string;
    typeId: string;
    date: string;
    time: string;
    symptoms: string;
  };
}

export function StepReview({ bookingData }: StepReviewProps) {
  const { dictionary: t } = useI18n();
  const type = CONSULTATION_TYPES.find((c) => c.id === bookingData.typeId);
  const typeLabel = bookingData.typeId
    ? getConsultationTypeLabel(t, bookingData.typeId)
    : t.booking.notSelected;

  const [matchingPackage, setMatchingPackage] = useState<UserPackage | null>(null);
  const [packageChecked, setPackageChecked] = useState(false);

  useEffect(() => {
    if (!bookingData.typeId) return;
    packagesApi
      .getMyPackages()
      .then((packages) => {
        const match = packages.find(
          (up) =>
            up.status === "active" &&
            up.credits_remaining > 0 &&
            new Date(up.expires_at) > new Date() &&
            up.consultation_packages.applicable_consultation_types.includes(bookingData.typeId)
        );
        setMatchingPackage(match ?? null);
      })
      .catch(() => setMatchingPackage(null))
      .finally(() => setPackageChecked(true));
  }, [bookingData.typeId]);

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold text-foreground">
        {t.booking.bookingSummary}
      </h2>

      {/* Booking Summary */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">{t.booking.child}</p>
              <p className="font-medium text-foreground">
                {bookingData.childName || t.booking.notSelected}
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">
                {t.booking.consultationType}
              </p>
              <p className="font-medium text-foreground">
                {type
                  ? `${typeLabel} (${type.duration} ${t.common.minutes})`
                  : t.booking.notSelected}
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">
                {t.booking.dateTime}
              </p>
              <p className="font-medium text-foreground">
                {bookingData.date || t.booking.notSelected}{" "}
                {t.booking.dateTimeAt}{" "}
                {bookingData.time || t.booking.notSelected}
              </p>
              <TimezoneNotice variant="compact" className="mt-1.5" />
            </div>
          </div>
          {bookingData.symptoms && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">
                  {t.booking.enterSymptoms}
                </p>
                <p className="mt-1 text-sm text-foreground">
                  {bookingData.symptoms}
                </p>
              </div>
            </>
          )}
          <Separator />
          <div className="flex items-center justify-between rounded-lg bg-muted p-4">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-primary" />
              <p className="font-medium text-foreground">
                {t.booking.totalAmount}
              </p>
            </div>
            {packageChecked && matchingPackage ? (
              <div className="flex items-center gap-2">
                <s className="text-sm text-muted-foreground">
                  {type?.price ?? 0} {t.common.aed}
                </s>
                <span className="text-xl font-bold text-green-600 dark:text-green-400">
                  0{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    {t.common.aed}
                  </span>
                </span>
              </div>
            ) : (
              <p className="text-xl font-bold text-foreground">
                {type?.price ?? 0}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  {t.common.aed}
                </span>
              </p>
            )}
          </div>

          {packageChecked && matchingPackage && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-400">
              <Ticket className="h-4 w-4 shrink-0" />
              <span>
                1 credit will be deducted from your{" "}
                <strong>{matchingPackage.consultation_packages.name}</strong>{" "}
                ({matchingPackage.credits_remaining} remaining)
              </span>
            </div>
          )}

          {packageChecked && !matchingPackage && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
              <CreditCard className="h-4 w-4 shrink-0" />
              <span>
                No active package — full price applies.{" "}
                <a
                  href="/dashboard/parent/packages"
                  className="underline underline-offset-2 hover:no-underline"
                >
                  Browse packages
                </a>{" "}
                to save on future sessions.
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
