"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, ArrowRight } from "lucide-react";

export function PackagesSection() {
  const { dictionary: t } = useI18n();

  const packages = [
    {
      name: t.landing.monthlyFollowUp,
      desc: t.landing.monthlyFollowUpDesc,
      sessions: 4,
      validity: 30,
      price: 750,
    },
    {
      name: t.landing.newbornCare,
      desc: t.landing.newbornCareDesc,
      sessions: 3,
      validity: 30,
      price: 600,
    },
    {
      name: t.landing.emergencyPriority,
      desc: t.landing.emergencyPriorityDesc,
      sessions: 1,
      validity: 7,
      price: 350,
    },
  ];

  return (
    <section id="packages" className="bg-card py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t.landing.packagesTitle}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {t.landing.packagesSubtitle}
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {packages.map((pkg, i) => (
            <Card
              key={i}
              className="border-border transition-all hover:shadow-lg"
            >
              <CardHeader className="pb-4 pt-6">
                <CardTitle className="text-xl">{pkg.name}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {pkg.desc}
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 pb-6">
                <div>
                  <span className="text-4xl font-bold text-foreground">
                    {pkg.price}
                  </span>
                  <span className="ms-1 text-sm text-muted-foreground">
                    {t.common.aed}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {pkg.sessions} {t.landing.sessions}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CalendarDays className="h-4 w-4" />
                    <span>
                      {t.landing.validFor} {pkg.validity} {t.landing.days}
                    </span>
                  </div>
                </div>
                <Link href="/booking">
                  <Button variant="outline" className="w-full gap-2 bg-transparent">
                    {t.common.bookNow}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
