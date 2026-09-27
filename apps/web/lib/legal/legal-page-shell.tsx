import type { ReactNode } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

/**
 * Page chrome shared by the privacy and terms routes. Hook-free so the
 * English-only /privacy/en and /terms/en routes can stay server components;
 * the header and footer are client components and follow the visitor's locale.
 */
export function LegalPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
