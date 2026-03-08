"use client";

import { useI18n } from "@/lib/i18n/i18n-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CalendarDays, Clock, User, CreditCard } from "lucide-react";

interface StepReviewProps {
  bookingData: {
    childId: string;
    typeId: string;
    date: string;
    time: string;
    symptoms: string;
  };
}

const childNames: Record<string, string> = {
  "1": "Ahmed Al-Rashid",
  "2": "Layla Al-Rashid",
};

const typeDetails: Record<string, { name: string; price: number; duration: number }> = {
  quick: { name: "Quick Consultation", price: 150, duration: 15 },
  standard: { name: "Standard Consultation", price: 250, duration: 30 },
  extended: { name: "Extended Consultation", price: 350, duration: 45 },
};

export function StepReview({ bookingData }: StepReviewProps) {
  const { dictionary: t } = useI18n();
  const child = childNames[bookingData.childId] || "Not selected";
  const type = typeDetails[bookingData.typeId] || { name: "Not selected", price: 0, duration: 0 };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-foreground">
        {t.booking.bookingSummary}
      </h2>
      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">{t.booking.child}</p>
              <p className="font-medium text-foreground">{child}</p>
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
                {type.name} ({type.duration} {t.common.minutes})
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
                {bookingData.date || "Not selected"} at{" "}
                {bookingData.time || "Not selected"}
              </p>
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
              {type.price} {t.common.aed}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
