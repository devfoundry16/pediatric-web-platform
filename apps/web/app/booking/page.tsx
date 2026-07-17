"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n-context";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { BookingStepper } from "@/components/booking/booking-stepper";
import { StepSelectChild } from "@/components/booking/step-select-child";
import { StepSelectPlan } from "@/components/booking/step-select-plan";
import { StepSelectDateTime } from "@/components/booking/step-select-datetime";
import { StepSymptoms } from "@/components/booking/step-symptoms";
import { StepReview } from "@/components/booking/step-review";
import { StepConfirmation } from "@/components/booking/step-confirmation";
import { Button } from "@/components/ui/button";
import { appointmentsApi } from "@/lib/api/appointments";
import { childrenApi } from "@/lib/api/children";
import { packagesApi } from "@/lib/api/packages";
import type { UserPackage } from "@/types/packages";
import type { ConsultationTypeId } from "@/types/appointment";
import { Loader2, AlertCircle } from "lucide-react";

const TOTAL_STEPS = 5;
// Step index of the plan-selection screen (child → PLAN → date/time → …).
const PLAN_STEP = 1;
const DATETIME_STEP = 2;

// Poll budget while waiting for the Stripe webhook to provision a just-purchased
// package after the customer returns from checkout.
const RESUME_POLL_ATTEMPTS = 12;
const RESUME_POLL_INTERVAL_MS = 1500;

function hasActiveConsultCredit(pkgs: UserPackage[]): boolean {
  const now = Date.now();
  return pkgs.some(
    (p) =>
      p.status === "active" &&
      p.credits_remaining > 0 &&
      new Date(p.expires_at).getTime() > now &&
      p.consultation_packages.applicable_consultation_types.includes("consultation")
  );
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  const [notice, setNotice] = useState<string | null>(null);
  const [resuming, setResuming] = useState(false);

  // Auto-skip the plan step at most once, so a parent who presses "Previous"
  // from date/time isn't bounced straight forward again.
  const autoSkipChecked = useRef(false);
  // One-shot guard for the on-mount query-param handling (resume / cancel).
  const returnHandled = useRef(false);

  const steps = [
    t.booking.selectChild,
    t.booking.planStepLabel,
    t.booking.selectDateTime,
    t.booking.enterSymptoms,
    t.booking.reviewBooking,
  ];

  const updateBooking = (data: Partial<typeof bookingData>) => {
    setBookingData((prev) => ({ ...prev, ...data }));
  };

  // Handle a return from Stripe: ?resume=1 (package bought → continue booking)
  // or ?cancelled=<id|package> (checkout abandoned).
  useEffect(() => {
    if (returnHandled.current) return;
    returnHandled.current = true;

    const params = new URLSearchParams(window.location.search);
    const cancelled = params.get("cancelled");
    const resume = params.get("resume");
    const childId = params.get("childId");

    const clearUrl = () =>
      window.history.replaceState({}, "", window.location.pathname);

    if (cancelled) {
      // A one-time consult cancel carries the pending appointment id — release it
      // so its slot is freed immediately. A package cancel carries "package".
      if (cancelled !== "package") {
        appointmentsApi.abandon(cancelled).catch(() => {});
      }
      setNotice(t.booking.paymentCancelledNotice);
      clearUrl();
      return;
    }

    if (resume === "1" && childId) {
      clearUrl();
      autoSkipChecked.current = true; // resume owns navigation to date/time
      setResuming(true);
      (async () => {
        // Restore the child, then wait for the purchased credit to land.
        try {
          const child = await childrenApi.getById(childId);
          setBookingData((prev) => ({
            ...prev,
            childId,
            childName: `${child.personalInfo.firstName} ${child.personalInfo.lastName}`,
            typeId: "consultation",
          }));
        } catch {
          setBookingData((prev) => ({ ...prev, childId, typeId: "consultation" }));
        }

        for (let i = 0; i < RESUME_POLL_ATTEMPTS; i++) {
          try {
            const pkgs = await packagesApi.getMyPackages();
            if (hasActiveConsultCredit(pkgs)) {
              setResuming(false);
              setCurrentStep(DATETIME_STEP);
              return;
            }
          } catch {
            // ignore and retry
          }
          await delay(RESUME_POLL_INTERVAL_MS);
        }

        // Webhook still hasn't provisioned — let them proceed manually.
        setResuming(false);
        setNotice(t.booking.resumeFailed);
        setCurrentStep(PLAN_STEP);
      })();
    }
  }, [t.booking.paymentCancelledNotice, t.booking.resumeFailed]);

  // Skip the plan step when the parent already holds a usable package credit.
  useEffect(() => {
    if (currentStep !== PLAN_STEP || resuming) return;
    if (autoSkipChecked.current) return;
    let cancelled = false;
    packagesApi
      .getMyPackages()
      .then((pkgs) => {
        if (cancelled) return;
        autoSkipChecked.current = true;
        if (hasActiveConsultCredit(pkgs)) {
          setBookingData((prev) => ({ ...prev, typeId: "consultation" }));
          setCurrentStep(DATETIME_STEP);
        }
      })
      .catch(() => {
        autoSkipChecked.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [currentStep, resuming]);

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
      case PLAN_STEP:
        // Advancing via "Next" only applies to the one-time consult; buying a
        // package navigates away to Stripe from within the step.
        return bookingData.typeId === "consultation";
      case DATETIME_STEP:
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
      const { appointment, requiresPayment } = await appointmentsApi.create({
        childId: bookingData.childId,
        doctorId: bookingData.doctorId || undefined,
        consultationType: bookingData.typeId as ConsultationTypeId,
        date: bookingData.date,
        time: bookingData.time,
        symptoms: bookingData.symptoms || undefined,
      });

      // One-time consult with no package credit → settle through Stripe. The
      // webhook confirms the appointment and returns the user to /booking/success.
      if (requiresPayment) {
        try {
          const url = await appointmentsApi.checkout(appointment.id);
          window.location.href = url;
          return;
        } catch (checkoutErr) {
          // Don't leave the pending appointment holding the slot if we couldn't
          // even start checkout.
          await appointmentsApi.abandon(appointment.id).catch(() => {});
          throw checkoutErr;
        }
      }

      // Covered by a package credit → already confirmed.
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
      case PLAN_STEP:
        return (
          <StepSelectPlan
            childId={bookingData.childId}
            selected={bookingData.typeId}
            onSelectOneTime={() => updateBooking({ typeId: "consultation", date: "", time: "" })}
          />
        );
      case DATETIME_STEP:
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

          {resuming ? (
            <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div>
                <p className="font-medium text-foreground">{t.booking.resuming}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.booking.resumingHint}
                </p>
              </div>
            </div>
          ) : (
            <>
              {!isConfirmed && (
                <div className="mb-10 mt-6">
                  <BookingStepper steps={steps} currentStep={currentStep} />
                </div>
              )}

              {notice && (
                <div className="mb-6 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {notice}
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
                      {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      {t.booking.payAndConfirm}
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
