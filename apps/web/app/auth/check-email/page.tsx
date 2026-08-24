"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { Loader2, Mail } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";

function CheckEmailContent() {
  const { dictionary: t } = useI18n();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

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
          <Link href="/" className="mb-8 flex items-center justify-center lg:hidden">
            <BrandLogo className="h-9" />
          </Link>

          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Mail className="h-8 w-8 text-primary" aria-hidden />
          </div>

          <h1 className="text-2xl font-bold text-foreground">
            {t.auth.checkEmailTitle}
          </h1>

          <p className="mt-4 text-muted-foreground">
            {t.auth.checkEmailDescription}{" "}
            {email ? (
              <span className="font-medium text-foreground">{email}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
            .
          </p>

          <p className="mt-4 text-sm text-muted-foreground">{t.auth.checkEmailHint}</p>

          <Button asChild className="mt-8 w-full">
            <Link href="/auth/login">{t.auth.backToSignIn}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        </div>
      }
    >
      <CheckEmailContent />
    </Suspense>
  );
}
