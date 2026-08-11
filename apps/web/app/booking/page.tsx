"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/i18n-context";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { BookingStepper } from "@/components/booking/booking-stepper";
import { StepSelectChild } from "@/components/booking/step-select-child";
import { StepSelectPlan } from "@/components/booking/step-select-plan";
import { StepSelectDoctor } from "@/components/booking/step-select-doctor";
import { StepSelectDateTime } from "@/components/booking/step-select-datetime";
import { StepSymptoms } from "@/components/booking/step-symptoms";
import { StepReview } from "@/components/booking/step-review";
import { StepConfirmation } from "@/components/booking/step-confirmation";
import { Button } from "@/components/ui/button";
import { appointmentsApi } from "@/lib/api/appointments";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import { childrenApi } from "@/lib/api/children";
import { packagesApi } from "@/lib/api/packages";
import type { UserPackage } from "@/types/packages";
import type { ConsultationTypeId } from "@/types/appointment";
import { Loader2, AlertCircle } from "lucide-react";

type StepKey = "child" | "plan" | "buy" | "doctor" | "datetime" | "symptoms" | "review";

// Poll budget while waiting for the Stripe webhook to provision a just-purchased
// package after the customer returns from checkout.
const RESUME_POLL_ATTEMPTS = 12;
const RESUME_POLL_INTERVAL_MS = 1500;

// The step sequence depends on what (if anything) the user pre-selected on the
// landing page and whether they already hold a usable credit:
//  - no pre-selection  -> show the plan chooser (they haven't decided).
//  - one-time consult  -> straight to booking (pay 399, or 0 if they have a credit).
//  - package + credit  -> straight to booking; the credit is deducted at review.
//  - package + no credit -> a "buy" step to purchase the package first, then book.
function computeFlow(preselect: string | null, hasCredit: boolean): StepKey[] {
  if (!preselect) return ["child", "plan", "doctor", "datetime", "symptoms", "review"];
  if (preselect === "consultation") return ["child", "doctor", "datetime", "symptoms", "review"];
  // a package slug
  if (hasCredit) return ["child", "doctor", "datetime", "symptoms", "review"];
  return ["child", "buy", "doctor", "datetime", "symptoms", "review"];
}

function isPackageSlug(preselect: string | null): boolean {
  return !!preselect && preselect !== "consultation";
}

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
  const [preselect, setPreselect] = useState<string | null>(null);
  const [hasCredit, setHasCredit] = useState(false);
  // Gate rendering until the mount effect has read the URL and (when it matters)
  // resolved credit, so the flow/stepper never flash the wrong steps.
  const [ready, setReady] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const [bookingData, setBookingData] = useState({
    childId: "",
    childName: "",
    doctorId: "",
    typeId: "" as ConsultationTypeId | "",
    date: "",
    time: "",
    // The zone `date`/`time` above are wall-clock in — needed to render them
    // in the visitor's own zone on the review and confirmation steps.
    doctorTimezone: DEFAULT_TIMEZONE,
    symptoms: "",
  });
  const [confirmedAppointmentId, setConfirmedAppointmentId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const bootstrapped = useRef(false);

  const flow = computeFlow(preselect, hasCredit);
  const stepKey = flow[currentStep];

  const labelFor: Record<StepKey, string> = {
    child: t.booking.selectChild,
    plan: t.booking.planStepLabel,
    buy: t.booking.buyStepLabel,
    doctor: t.booking.selectDoctor,
    datetime: t.booking.selectDateTime,
    symptoms: t.booking.enterSymptoms,
    review: t.booking.reviewBooking,
  };
  const steps = flow.map((k) => labelFor[k]);

  const updateBooking = (data: Partial<typeof bookingData>) => {
    setBookingData((prev) => ({ ...prev, ...data }));
  };

  // On mount: read the pre-selected plan + handle a return from Stripe
  // (?resume / ?cancelled) + resolve credit before showing the flow.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    const params = new URLSearchParams(window.location.search);
    const plan = params.get("plan");
    const cancelled = params.get("cancelled");
    const resume = params.get("resume");
    const childId = params.get("childId");
    const clearUrl = () =>
      window.history.replaceState({}, "", window.location.pathname);

    if (plan) {
      setPreselect(plan);
      setBookingData((prev) => ({ ...prev, typeId: "consultation" }));
    }

    // Package purchased → wait for the credit, then jump to date/time.
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
              setResuming(false);
              setReady(true);
              setCurrentStep(computeFlow(plan, true).indexOf("datetime"));
              return;
            }
          } catch {
            // ignore and retry
          }
          await delay(RESUME_POLL_INTERVAL_MS);
        }

        // Webhook still hasn't provisioned — let them proceed / retry.
        setResuming(false);
        setReady(true);
        setNotice(t.booking.resumeFailed);
      })();
      return;
    }

    void (async () => {
      // Checkout abandoned: release the pending one-time appointment (id in the
      // param) so its slot frees up; a package cancel carries "package".
      if (cancelled) {
        if (cancelled !== "package") {
          appointmentsApi.abandon(cancelled).catch(() => {});
        }
        setNotice(t.booking.paymentCancelledNotice);
        clearUrl();
      }

      // Credit only changes the flow when a package was pre-selected (buy step
      // vs. straight to booking); otherwise we don't need to block on it.
      if (isPackageSlug(plan)) {
        try {
          const pkgs = await packagesApi.getMyPackages();
          setHasCredit(hasActiveConsultCredit(pkgs));
        } catch {
          setHasCredit(false);
        }
      }
      setReady(true);
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
      case "buy":
        // Must complete the purchase (in-step) to proceed — no "Next".
        return false;
      case "doctor":
        return !!bookingData.doctorId;
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
      case "buy":
        return (
          <StepSelectPlan
            childId={bookingData.childId}
            selected={bookingData.typeId}
            onSelectOneTime={() => {}}
            restrictToSlug={preselect ?? undefined}
          />
        );
      case "doctor":
        return (
          <StepSelectDoctor
            selected={bookingData.doctorId}
            onSelect={(id) => updateBooking({ doctorId: id })}
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
            // date comes back with the time: a slot's own doctor-local day is
            // authoritative, not whatever the calendar happens to be showing.
            onSelectSlot={({ date, time, timezone }) =>
              updateBooking({ date, time, doctorTimezone: timezone })
            }
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
              doctorTimezone: bookingData.doctorTimezone,
              symptoms: bookingData.symptoms,
            }}
          />
        );
      default:
        return null;
    }
  };

  const isLastStep = currentStep === flow.length - 1;
  // The "buy" step has no forward "Next" — the purchase button lives in-step.
  const showNext = !isLastStep && stepKey !== "buy";

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="mb-2 text-center text-2xl font-bold text-foreground sm:text-3xl">
            {t.booking.title}
          </h1>

          {resuming || !ready ? (
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
                doctorTimezone: bookingData.doctorTimezone,
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

                {showNext ? (
                  <Button
                    onClick={() =>
                      setCurrentStep(Math.min(flow.length - 1, currentStep + 1))
                    }
                    disabled={!isStepValid()}
                  >
                    {t.common.next}
                  </Button>
                ) : isLastStep ? (
                  <Button
                    onClick={handleConfirm}
                    disabled={isSubmitting}
                    className="gap-2"
                  >
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t.booking.payAndConfirm}
                  </Button>
                ) : (
                  <span />
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
