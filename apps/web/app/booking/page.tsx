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
import { StepConfirmation } from "@/components/booking/step-confirmation";
import { Button } from "@/components/ui/button";
import { appointmentsApi } from "@/lib/api/appointments";
import { childrenApi } from "@/lib/api/children";
import type { ConsultationTypeId } from "@/types/appointment";
import { Loader2 } from "lucide-react";

const TOTAL_STEPS = 5;

export default function BookingPage() {
  const { dictionary: t } = useI18n();
  const [currentStep, setCurrentStep] = useState(0);
  const [bookingData, setBookingData] = useState({
    childId: "",
    childName: "",
    doctorId: "",
    typeId: "" as ConsultationTypeId | "",
    date: "",
    time: "",
    symptoms: "",
  });
  const [confirmedAppointmentId, setConfirmedAppointmentId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  const handleChildSelect = async (id: string) => {
    updateBooking({ childId: id, childName: "" });
    try {
      const child = await childrenApi.getById(id);
      updateBooking({
        childId: id,
        childName: `${child.personalInfo.firstName} ${child.personalInfo.lastName}`,
      });
    } catch {
      updateBooking({ childId: id });
    }
  };

  const isStepValid = (): boolean => {
    switch (currentStep) {
      case 0:
        return !!bookingData.childId;
      case 1:
        return !!bookingData.typeId;
      case 2:
        return !!bookingData.date && !!bookingData.time;
      case 3:
        return true;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleConfirm = async () => {
    if (!bookingData.childId || !bookingData.typeId || !bookingData.date || !bookingData.time) {
      setSubmitError(t.booking.completeFieldsError);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const appointment = await appointmentsApi.create({
        childId: bookingData.childId,
        doctorId: bookingData.doctorId || undefined,
        consultationType: bookingData.typeId as ConsultationTypeId,
        date: bookingData.date,
        time: bookingData.time,
        symptoms: bookingData.symptoms || undefined,
      });

      setConfirmedAppointmentId(appointment.id);
      setCurrentStep(TOTAL_STEPS);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t.booking.bookingFailedError;
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    if (currentStep === TOTAL_STEPS) {
      return (
        <StepConfirmation
          appointmentId={confirmedAppointmentId}
          bookingData={{
            typeId: bookingData.typeId as string,
            date: bookingData.date,
            time: bookingData.time,
            childName: bookingData.childName,
          }}
        />
      );
    }

    switch (currentStep) {
      case 0:
        return (
          <StepSelectChild
            selected={bookingData.childId}
            onSelect={handleChildSelect}
          />
        );
      case 1:
        return (
          <StepSelectType
            selected={bookingData.typeId}
            onSelect={(id) => updateBooking({ typeId: id as ConsultationTypeId, date: "", time: "" })}
          />
        );
      case 2:
        return (
          <StepSelectDateTime
            doctorId={bookingData.doctorId}
            typeId={bookingData.typeId}
            selectedDate={bookingData.date}
            selectedTime={bookingData.time}
            onSelectDate={(date) => updateBooking({ date, time: "" })}
            onSelectTime={(time) => updateBooking({ time })}
            onDoctorResolved={(id) => updateBooking({ doctorId: id })}
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
        return (
          <StepReview
            bookingData={{
              childId: bookingData.childId,
              childName: bookingData.childName,
              typeId: bookingData.typeId,
              date: bookingData.date,
              time: bookingData.time,
              symptoms: bookingData.symptoms,
            }}
          />
        );
      default:
        return null;
    }
  };

  const isConfirmed = currentStep === TOTAL_STEPS;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="mb-2 text-center text-2xl font-bold text-foreground sm:text-3xl">
            {t.booking.title}
          </h1>

          {!isConfirmed && (
            <div className="mb-10 mt-6">
              <BookingStepper steps={steps} currentStep={currentStep} />
            </div>
          )}

          <div className="min-h-[400px]">{renderStep()}</div>

          {submitError && (
            <p className="mt-4 text-center text-sm text-destructive">
              {submitError}
            </p>
          )}

          {!isConfirmed && (
            <div className="mt-8 flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={currentStep === 0 || isSubmitting}
              >
                {t.common.previous}
              </Button>

              {currentStep < TOTAL_STEPS - 1 ? (
                <Button
                  onClick={() =>
                    setCurrentStep(Math.min(TOTAL_STEPS - 1, currentStep + 1))
                  }
                  disabled={!isStepValid()}
                >
                  {t.common.next}
                </Button>
              ) : (
                <Button
                  onClick={handleConfirm}
                  disabled={isSubmitting}
                  className="gap-2"
                >
                  {isSubmitting && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {t.booking.payAndConfirm}
                </Button>
              )}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
