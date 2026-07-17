"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, ArrowRight, Video } from "lucide-react";
import { CONSULTATION_TYPES } from "@/types/appointment";

export function ConsultationSection() {
  const { dictionary: t } = useI18n();

  // Single bookable consultation — kept in sync with the booking flow.
  const consult = CONSULTATION_TYPES[0];

  return (
    <section className="bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t.landing.consultationTitle}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {t.landing.consultationSubtitle}
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-md">
          <Card className="relative border-primary ring-1 ring-primary/20 transition-all hover:shadow-lg">
            <CardHeader className="pb-4 pt-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Video className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-xl">{t.booking.oneTimeTitle}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.booking.oneTimeDescription}
              </p>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4 pb-8">
              <div className="text-center">
                <span className="text-4xl font-bold text-foreground">
                  {consult.price}
                </span>
                <span className="ms-1 text-sm text-muted-foreground">
                  {t.common.aed}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  {consult.duration} {t.common.minutes}
                </span>
              </div>
              <Link href="/booking?plan=consultation" className="w-full">
                <Button className="w-full gap-2">
                  {t.common.bookNow}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
