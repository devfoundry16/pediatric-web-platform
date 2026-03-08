"use client";

import { useI18n } from "@/lib/i18n/i18n-context";
import { Card, CardContent } from "@/components/ui/card";
import {
  Video,
  FileText,
  Package,
  Users,
  GraduationCap,
  CalendarDays,
} from "lucide-react";

const iconMap = [Video, FileText, Package, Users, GraduationCap, CalendarDays];

export function ServicesSection() {
  const { dictionary: t } = useI18n();

  const services = [
    { title: t.landing.service1Title, desc: t.landing.service1Desc },
    { title: t.landing.service2Title, desc: t.landing.service2Desc },
    { title: t.landing.service3Title, desc: t.landing.service3Desc },
    { title: t.landing.service4Title, desc: t.landing.service4Desc },
    { title: t.landing.service5Title, desc: t.landing.service5Desc },
    { title: t.landing.service6Title, desc: t.landing.service6Desc },
  ];

  return (
    <section id="services" className="bg-card py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t.landing.servicesTitle}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {t.landing.servicesSubtitle}
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service, i) => {
            const Icon = iconMap[i];
            return (
              <Card
                key={i}
                className="group border-border transition-all hover:border-primary/30 hover:shadow-md"
              >
                <CardContent className="p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/15">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">
                    {service.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {service.desc}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
