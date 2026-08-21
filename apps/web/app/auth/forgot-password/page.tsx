"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Heart, Mail } from "lucide-react";

import { useI18n } from "@/lib/i18n/i18n-context";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().min(1, "Email is required").pipe(z.email("Enter a valid email")),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const { dictionary: t } = useI18n();
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    const supabase = createClient();
    // Route through the callback so the recovery code is exchanged into a
    // session before the user lands on the reset-password page.
    await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    });
    // Always show the same confirmation regardless of whether the email exists,
    // to avoid leaking which addresses have accounts.
    setSent(true);
    setSubmitting(false);
  };

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

          {sent ? (
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Mail className="h-8 w-8 text-primary" aria-hidden />
              </div>
              <h1 className="text-2xl font-bold text-foreground">
                {t.auth.resetLinkSentTitle}
              </h1>
              <p className="mt-4 text-muted-foreground">
                {t.auth.resetLinkSentDescription}
              </p>
              <Button asChild className="mt-8 w-full">
                <Link href="/auth/login">{t.auth.backToSignIn}</Link>
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-foreground">
                {t.auth.forgotPasswordTitle}
              </h1>
              <p className="mt-2 text-muted-foreground">
                {t.auth.forgotPasswordSubtitle}
              </p>

              <form
                className="mt-8 flex flex-col gap-5"
                onSubmit={handleSubmit(onSubmit)}
              >
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">{t.common.email}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t.auth.emailPlaceholder}
                    autoComplete="email"
                    {...register("email")}
                  />
                  {errors.email && (
                    <p className="text-xs text-destructive">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? t.common.loading : t.auth.sendResetLink}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                <Link
                  href="/auth/login"
                  className="font-medium text-primary hover:underline"
                >
                  {t.auth.backToSignIn}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
