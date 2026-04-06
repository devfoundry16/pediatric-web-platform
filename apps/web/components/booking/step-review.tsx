"use client";

import { useI18n } from "@/lib/i18n/i18n-context";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, User, CreditCard, ShieldCheck, Lock } from "lucide-react";
import { CONSULTATION_TYPES } from "@/types/appointment";
import { getConsultationTypeLabel } from "@/lib/i18n/consultation-labels";
import { TimezoneNotice } from "@/components/booking/timezone-notice";

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
            <p className="text-xl font-bold text-foreground">
              {type?.price ?? 0}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                {t.common.aed}
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Mock Payment Form */}
      <Card>
        <CardContent className="flex flex-col gap-5 p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">
              {t.booking.paymentDetails}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              {t.booking.securePayment}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="card-number">{t.booking.cardNumber}</Label>
              <div className="relative">
                <Input
                  id="card-number"
                  placeholder="4242 4242 4242 4242"
                  defaultValue="4242 4242 4242 4242"
                  readOnly
                  className="pr-24 font-mono text-sm"
                />
                <Badge
                  variant="outline"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs"
                >
                  VISA
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="expiry">{t.booking.expiryDate}</Label>
                <Input
                  id="expiry"
                  placeholder="MM/YY"
                  defaultValue="12/28"
                  readOnly
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cvv">{t.booking.cvv}</Label>
                <Input
                  id="cvv"
                  placeholder="123"
                  defaultValue="123"
                  readOnly
                  className="font-mono text-sm"
                  type="password"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="card-name">{t.booking.nameOnCard}</Label>
              <Input
                id="card-name"
                placeholder="Card holder name"
                defaultValue="Test User"
                readOnly
                className="text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-400">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>{t.booking.demoPaymentNotice}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
