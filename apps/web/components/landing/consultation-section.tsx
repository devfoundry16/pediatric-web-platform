"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, ArrowRight } from "lucide-react";

export function ConsultationSection() {
  const { dictionary: t } = useI18n();

  const consultations = [
    {
      name: t.landing.quick,
      desc: t.landing.quickDesc,
      duration: 15,
      price: 150,
      popular: false,
    },
    {
      name: t.landing.standard,
      desc: t.landing.standardDesc,
      duration: 30,
      price: 250,
      popular: true,
    },
    {
      name: t.landing.extended,
      desc: t.landing.extendedDesc,
      duration: 45,
      price: 350,
      popular: false,
    },
  ];

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

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {consultations.map((item, i) => (
            <Card
              key={i}
              className={`relative border-border transition-all hover:shadow-lg ${
                item.popular
                  ? "border-primary ring-1 ring-primary/20"
                  : ""
              }`}
            >
              {item.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  {t.landing.popular}
                </Badge>
              )}
              <CardHeader className="pb-4 pt-6 text-center">
                <CardTitle className="text-xl">{item.name}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.desc}
                </p>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4 pb-6">
                <div className="text-center">
                  <span className="text-4xl font-bold text-foreground">
                    {item.price}
                  </span>
                  <span className="ms-1 text-sm text-muted-foreground">
                    {t.common.aed}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>
                    {item.duration} {t.common.minutes}
                  </span>
                </div>
                <Link href="/booking" className="w-full">
                  <Button
                    className="w-full gap-2"
                    variant={item.popular ? "default" : "outline"}
                  >
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
