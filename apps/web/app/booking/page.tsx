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

type StepKey = "child" | "plan" | "datetime" | "symptoms" | "review";

// The plan step is only part of the flow when the user has no usable credit.
// With an active package credit the consultation is already paid for, so we drop
// the "Choose Plan" step entirely instead of showing then skipping it.
const FLOW_WITH_PLAN: StepKey[] = ["child", "plan", "datetime", "symptoms", "review"];
const FLOW_WITH_CREDIT: StepKey[] = ["child", "datetime", "symptoms", "review"];

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
  const [hasCredit, setHasCredit] = useState(false);
  // Gate rendering until the first credit check resolves, so the stepper never
  // flashes the plan step for a user who actually has credit.
  const [creditResolved, setCreditResolved] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

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

  // One-shot guard for the on-mount work (return-from-Stripe + credit check).
  const bootstrapped = useRef(false);

  const flow = hasCredit ? FLOW_WITH_CREDIT : FLOW_WITH_PLAN;
  const stepKey = flow[currentStep];

  const labelFor: Record<StepKey, string> = {
    child: t.booking.selectChild,
    plan: t.booking.planStepLabel,
    datetime: t.booking.selectDateTime,
    symptoms: t.booking.enterSymptoms,
    review: t.booking.reviewBooking,
  };
  const steps = flow.map((k) => labelFor[k]);

  const updateBooking = (data: Partial<typeof bookingData>) => {
    setBookingData((prev) => ({ ...prev, ...data }));
  };

  // On mount: handle a return from Stripe (?resume / ?cancelled) and establish
  // whether the user already holds a usable credit (which removes the plan step).
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    const params = new URLSearchParams(window.location.search);
    const cancelled = params.get("cancelled");
    const resume = params.get("resume");
    const childId = params.get("childId");
    const clearUrl = () =>
      window.history.replaceState({}, "", window.location.pathname);

    // Package purchased → wait for the credit, then drop the plan step and jump
    // straight to date/time.
    if (resume === "1" && childId) {
      clearUrl();
      setResuming(true);
      void (async () => {
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
              setHasCredit(true);
              setCreditResolved(true);
              setResuming(false);
              setCurrentStep(FLOW_WITH_CREDIT.indexOf("datetime"));
              return;
            }
          } catch {
            // ignore and retry
          }
          await delay(RESUME_POLL_INTERVAL_MS);
        }

        // Webhook still hasn't provisioned — fall back to the full flow so they
        // can retry or pay one-time.
        setResuming(false);
        setCreditResolved(true);
        setNotice(t.booking.resumeFailed);
      })();
      return;
    }

    void (async () => {
      // Checkout abandoned: release the pending one-time appointment (its id is
      // in the param) so its slot is freed; a package cancel carries "package".
      if (cancelled) {
        if (cancelled !== "package") {
          appointmentsApi.abandon(cancelled).catch(() => {});
        }
        setNotice(t.booking.paymentCancelledNotice);
        clearUrl();
      }

      try {
        const pkgs = await packagesApi.getMyPackages();
        if (hasActiveConsultCredit(pkgs)) {
          setHasCredit(true);
          setBookingData((prev) => ({ ...prev, typeId: "consultation" }));
        }
      } catch {
        // No/failed credit lookup → full flow with the plan step.
      } finally {
        setCreditResolved(true);
      }
    })();
  }, [t.booking.paymentCancelledNotice, t.booking.resumeFailed]);

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
    switch (stepKey) {
      case "child":
        return !!bookingData.childId;
      case "plan":
        // "Next" applies only to the one-time consult; buying a package
        // navigates away to Stripe from within the step.
        return bookingData.typeId === "consultation";
      case "datetime":
        return !!bookingData.date && !!bookingData.time;
      case "symptoms":
        return true;
      case "review":
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
      // webhook confirms the appointment and returns to /booking/success.
      if (requiresPayment) {
        try {
          const url = await appointmentsApi.checkout(appointment.id);
          window.location.href = url;
          return;
        } catch (checkoutErr) {
          await appointmentsApi.abandon(appointment.id).catch(() => {});
          throw checkoutErr;
        }
      }

      // Covered by a package credit → already confirmed.
      setConfirmedAppointmentId(appointment.id);
      setShowConfirmation(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t.booking.bookingFailedError;
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (stepKey) {
      case "child":
        return (
          <StepSelectChild
            selected={bookingData.childId}
            onSelect={handleChildSelect}
          />
        );
      case "plan":
        return (
          <StepSelectPlan
            childId={bookingData.childId}
            selected={bookingData.typeId}
            onSelectOneTime={() =>
              updateBooking({ typeId: "consultation", date: "", time: "" })
            }
          />
        );
      case "datetime":
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
      case "symptoms":
        return (
          <StepSymptoms
            value={bookingData.symptoms}
            onChange={(symptoms) => updateBooking({ symptoms })}
          />
        );
      case "review":
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

  const isLastStep = currentStep === flow.length - 1;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="mb-2 text-center text-2xl font-bold text-foreground sm:text-3xl">
            {t.booking.title}
          </h1>

          {resuming || !creditResolved ? (
            <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              {resuming && (
                <div>
                  <p className="font-medium text-foreground">{t.booking.resuming}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t.booking.resumingHint}
                  </p>
                </div>
              )}
            </div>
          ) : showConfirmation ? (
            <StepConfirmation
              appointmentId={confirmedAppointmentId}
              bookingData={{
                typeId: bookingData.typeId as string,
                date: bookingData.date,
                time: bookingData.time,
                childName: bookingData.childName,
              }}
            />
          ) : (
            <>
              <div className="mb-10 mt-6">
                <BookingStepper steps={steps} currentStep={currentStep} />
              </div>

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

              <div className="mt-8 flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                  disabled={currentStep === 0 || isSubmitting}
                >
                  {t.common.previous}
                </Button>

                {!isLastStep ? (
                  <Button
                    onClick={() =>
                      setCurrentStep(Math.min(flow.length - 1, currentStep + 1))
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
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
