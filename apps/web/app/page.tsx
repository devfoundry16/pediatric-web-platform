"use client";

import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { HeroSection } from "@/components/landing/hero-section";
import { ServicesSection } from "@/components/landing/services-section";
import { ConsultationSection } from "@/components/landing/consultation-section";
import { PackagesSection } from "@/components/landing/packages-section";
import { BenefitsSection } from "@/components/landing/benefits-section";
import { CtaSection } from "@/components/landing/cta-section";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <HeroSection />
        <ServicesSection />
        <ConsultationSection />
        <BenefitsSection />
        <PackagesSection />
        <CtaSection />
      </main>
      <SiteFooter />
    </div>
  );
}
