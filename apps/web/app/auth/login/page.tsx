"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n-context";
import { LoginForm } from "@/components/auth/login-form";
import { BrandLogo } from "@/components/layout/brand-logo";

export default function LoginPage() {
  const { dictionary: t } = useI18n();

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 bg-primary lg:flex lg:flex-col lg:items-center lg:justify-center lg:p-12">
        <div className="mx-auto max-w-md text-center">
          <Link href="/" className="mb-8 flex justify-center">
            <div className="rounded-2xl bg-white px-6 py-5 shadow-sm">
              <BrandLogo className="h-16" />
            </div>
          </Link>
          <p className="text-lg text-primary-foreground/80">
            {t.common.tagline}
          </p>
        </div>
      </div>

      <div className="flex w-full items-center justify-center px-4 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center lg:hidden">
            <BrandLogo className="h-9" />
          </Link>

          <h1 className="text-2xl font-bold text-foreground">
            {t.auth.loginTitle}
          </h1>
          <p className="mt-2 text-muted-foreground">{t.auth.loginSubtitle}</p>

          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t.auth.noAccount}{" "}
            <Link
              href="/auth/register"
              className="font-medium text-primary hover:underline"
            >
              {t.auth.signUp}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
