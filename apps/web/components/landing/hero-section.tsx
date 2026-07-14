"use client";

import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Video, Shield, Clock, Zap } from "lucide-react";
import { useEmergencyPackage } from "@/components/landing/emergency-package";

export function HeroSection() {
  const { dictionary: t } = useI18n();
  const emergencyPackage = useEmergencyPackage();

  return (
    <section className="relative overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.08),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(var(--accent)/0.15),transparent_50%)]" />

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
        <div className="flex flex-col items-center gap-12 lg:flex-row lg:gap-16">
          {/* Copy column */}
          <div className="flex-1 text-center lg:text-start">
            <Badge
              variant="secondary"
              className="mb-6 px-4 py-1.5 text-sm font-medium"
            >
              {t.landing.trustedBy}
            </Badge>

            <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              {t.landing.heroTitle}
            </h1>

            <p className="mt-6 text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
              {t.landing.heroSubtitle}
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row lg:justify-start">
              <Link href="/booking">
                <Button size="lg" className="gap-2 text-base">
                  {t.landing.heroAction}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/#services">
                <Button
                  variant="outline"
                  size="lg"
                  className="text-base bg-transparent"
                >
                  {t.landing.heroSecondary}
                </Button>
              </Link>
            </div>

            <div className="mt-8 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 text-start">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground">
                      {emergencyPackage.name}
                    </p>
                    <Badge variant="secondary">{t.landing.priorityBadge}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {emergencyPackage.desc}
                  </p>
                </div>
              </div>
              <Link href="/booking" className="shrink-0">
                <Button size="sm" className="w-full gap-1.5 sm:w-auto">
                  {t.common.bookNow}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 lg:items-start">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Video className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  {t.landing.service1Title}
                </p>
              </div>
              <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 lg:items-start">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  {t.landing.benefit2Title}
                </p>
              </div>
              <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 lg:items-start">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  {t.landing.benefit3Title}
                </p>
              </div>
            </div>
          </div>

          {/* Doctor photo column */}
          <div className="relative shrink-0 lg:w-[420px]">
            <div className="absolute -inset-4 rounded-3xl bg-[radial-gradient(ellipse_at_center,hsl(var(--accent)/0.35),transparent_70%)]" />
            <div className="relative overflow-hidden rounded-3xl shadow-2xl">
              <Image
                src="/dr-sahar.png"
                alt="Dr. Sahar"
                width={420}
                height={560}
                className="w-full object-cover object-top"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
