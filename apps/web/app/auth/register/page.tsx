"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n-context";
import { RegisterForm } from "@/components/auth/register-form";
import { Heart } from "lucide-react";

export default function RegisterPage() {
  const { dictionary: t } = useI18n();

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 bg-primary lg:flex lg:flex-col lg:items-center lg:justify-center lg:p-12">
        <div className="mx-auto max-w-md text-center">
          <div className="mb-8 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-foreground/10">
              <Heart className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-primary-foreground">
            {t.common.appName}
          </h2>
          <p className="mt-3 text-lg text-primary-foreground/80">
            {t.common.tagline}
          </p>
        </div>
      </div>

      <div className="flex w-full items-center justify-center px-4 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Heart className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">
              {t.common.appName}
            </span>
          </Link>

          <h1 className="text-2xl font-bold text-foreground">
            {t.auth.registerTitle}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t.auth.registerSubtitle}
          </p>

          <RegisterForm />

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t.auth.hasAccount}{" "}
            <Link
              href="/auth/login"
              className="font-medium text-primary hover:underline"
            >
              {t.auth.signIn}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
