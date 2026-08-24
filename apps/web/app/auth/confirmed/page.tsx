"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n-context";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";

export default function ConfirmedPage() {
  const { dictionary: t } = useI18n();

  // The confirmation link is exchanged into a session by /auth/callback before
  // we get here. Use the role to send the user to the right dashboard on
  // Continue; fall back to login if there's no session.
  const [continueHref, setContinueHref] = useState("/auth/login");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      const role = session.user.user_metadata?.role as string | undefined;
      setContinueHref(
        role === "doctor"
          ? "/dashboard/doctor"
          : role === "admin"
            ? "/dashboard/admin"
            : "/dashboard/parent",
      );
    });
  }, []);

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 bg-primary lg:flex lg:flex-col lg:items-center lg:justify-center lg:p-12">
        <div className="mx-auto max-w-md text-center">
          <div className="mb-8 flex justify-center">
            <div className="rounded-2xl bg-white px-6 py-5 shadow-sm">
              <BrandLogo className="h-16" />
            </div>
          </div>
          <p className="text-lg text-primary-foreground/80">
            {t.common.tagline}
          </p>
        </div>
      </div>

      <div className="flex w-full items-center justify-center px-4 py-12 lg:w-1/2">
        <div className="w-full max-w-md text-center">
          <Link
            href="/"
            className="mb-8 flex items-center justify-center lg:hidden"
          >
            <BrandLogo className="h-9" />
          </Link>

          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <CheckCircle2 className="h-8 w-8 text-primary" aria-hidden />
          </div>

          <h1 className="text-2xl font-bold text-foreground">
            {t.auth.confirmedTitle}
          </h1>

          <p className="mt-4 text-muted-foreground">
            {t.auth.confirmedDescription}
          </p>

          <Button asChild className="mt-8 w-full">
            <Link href={continueHref}>{t.auth.continue}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
