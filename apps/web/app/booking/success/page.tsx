"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n-context";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, CalendarDays, ArrowLeft, Loader2, Clock } from "lucide-react";
import { appointmentsApi } from "@/lib/api/appointments";

type VerifyState = "verifying" | "paid" | "pending";

// Stripe returns here after a one-time consultation payment. The webhook flips
// the appointment to paid/confirmed; as a fallback we also verify the session
// straight from Stripe so confirmation doesn't depend on webhook delivery.
export default function BookingSuccessPage() {
  const { dictionary: t } = useI18n();
  const [state, setState] = useState<VerifyState>("verifying");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      const params = new URLSearchParams(window.location.search);
      const appointmentId = params.get("appointment");
      const sessionId = params.get("session_id");

      if (!appointmentId || !sessionId) {
        setState("pending");
        return;
      }

      try {
        const r = await appointmentsApi.verifyPayment(appointmentId, sessionId);
        setState(r.paymentStatus === "paid" ? "paid" : "pending");
      } catch {
        setState("pending");
      }
    })();
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-6 py-10 text-center">
            {state === "verifying" ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="font-medium text-foreground">
                  {t.booking.verifyingLabel}
                </p>
              </>
            ) : (
              <>
                <div
                  className={
                    state === "paid"
                      ? "flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/40"
                      : "flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40"
                  }
                >
                  {state === "paid" ? (
                    <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                  ) : (
                    <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <h1 className="text-xl font-bold text-foreground">
                    {state === "paid" ? t.booking.paidTitle : t.booking.pendingTitle}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {state === "paid"
                      ? t.booking.paidSubtitle
                      : t.booking.pendingSubtitle}
                  </p>
                </div>

                <div className="flex w-full flex-col gap-2">
                  <Button asChild className="w-full">
                    <Link href="/dashboard/parent/appointments">
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {t.booking.viewAppointments}
                    </Link>
                  </Button>
                  <Button variant="outline" asChild className="w-full">
                    <Link href="/dashboard/parent">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      {t.booking.backToDashboard}
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}
