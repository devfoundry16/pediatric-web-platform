"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CtaSection() {
  const { dictionary: t } = useI18n();

  return (
    <section className="bg-primary py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
            {t.landing.ctaTitle}
          </h2>
          <p className="mt-4 text-lg text-primary-foreground/80">
            {t.landing.ctaSubtitle}
          </p>
          <Link href="/auth/register">
            <Button
              size="lg"
              variant="secondary"
              className="mt-8 gap-2 text-base"
            >
              {t.landing.ctaAction}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
