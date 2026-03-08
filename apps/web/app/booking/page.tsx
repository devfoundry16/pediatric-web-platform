"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/i18n-context";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { BookingStepper } from "@/components/booking/booking-stepper";
import { StepSelectChild } from "@/components/booking/step-select-child";
import { StepSelectType } from "@/components/booking/step-select-type";
import { StepSelectDateTime } from "@/components/booking/step-select-datetime";
import { StepSymptoms } from "@/components/booking/step-symptoms";
import { StepReview } from "@/components/booking/step-review";
import { Button } from "@/components/ui/button";

export default function BookingPage() {
  const { dictionary: t } = useI18n();
  const [currentStep, setCurrentStep] = useState(0);
  const [bookingData, setBookingData] = useState({
    childId: "",
    typeId: "",
    date: "",
    time: "",
    symptoms: "",
  });

  const steps = [
    t.booking.selectChild,
    t.booking.selectType,
    t.booking.selectDateTime,
    t.booking.enterSymptoms,
    t.booking.reviewBooking,
  ];

  const updateBooking = (data: Partial<typeof bookingData>) => {
    setBookingData((prev) => ({ ...prev, ...data }));
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <StepSelectChild
            selected={bookingData.childId}
            onSelect={(id) => updateBooking({ childId: id })}
          />
        );
      case 1:
        return (
          <StepSelectType
            selected={bookingData.typeId}
            onSelect={(id) => updateBooking({ typeId: id })}
          />
        );
      case 2:
        return (
          <StepSelectDateTime
            selectedDate={bookingData.date}
            selectedTime={bookingData.time}
            onSelectDate={(date) => updateBooking({ date })}
            onSelectTime={(time) => updateBooking({ time })}
          />
        );
      case 3:
        return (
          <StepSymptoms
            value={bookingData.symptoms}
            onChange={(symptoms) => updateBooking({ symptoms })}
          />
        );
      case 4:
        return <StepReview bookingData={bookingData} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="mb-2 text-center text-2xl font-bold text-foreground sm:text-3xl">
            {t.booking.title}
          </h1>

          <div className="mb-10 mt-6">
            <BookingStepper steps={steps} currentStep={currentStep} />
          </div>

          <div className="min-h-[400px]">{renderStep()}</div>

          <div className="mt-8 flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
            >
              {t.common.previous}
            </Button>
            {currentStep < steps.length - 1 ? (
              <Button
                onClick={() =>
                  setCurrentStep(Math.min(steps.length - 1, currentStep + 1))
                }
              >
                {t.common.next}
              </Button>
            ) : (
              <Button>{t.booking.confirmBooking}</Button>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
