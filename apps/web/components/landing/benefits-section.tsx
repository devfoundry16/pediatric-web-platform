"use client";

import { useI18n } from "@/lib/i18n/i18n-context";
import { Award, Shield, Clock, MapPin } from "lucide-react";

export function BenefitsSection() {
  const { dictionary: t } = useI18n();

  const benefits = [
    {
      icon: Award,
      title: t.landing.benefit1Title,
      desc: t.landing.benefit1Desc,
    },
    {
      icon: Shield,
      title: t.landing.benefit2Title,
      desc: t.landing.benefit2Desc,
    },
    {
      icon: Clock,
      title: t.landing.benefit3Title,
      desc: t.landing.benefit3Desc,
    },
    {
      icon: MapPin,
      title: t.landing.benefit4Title,
      desc: t.landing.benefit4Desc,
    },
  ];

  return (
    <section className="bg-background py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t.landing.whyChooseUs}
          </h2>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((benefit, i) => {
            const Icon = benefit.icon;
            return (
              <div key={i} className="flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  <Icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  {benefit.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {benefit.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
