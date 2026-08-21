"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, Heart, Loader2 } from "lucide-react";

import { useI18n } from "@/lib/i18n/i18n-context";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function createSchema(t: Dictionary) {
  return z
    .object({
      password: z.string().min(8, t.validation.passwordMin8),
      confirmPassword: z.string().min(1, t.validation.confirmPasswordRequired),
    })
    .refine((v) => v.password === v.confirmPassword, {
      message: t.validation.passwordsMismatch,
      path: ["confirmPassword"],
    });
}

type FormValues = z.infer<ReturnType<typeof createSchema>>;

export default function ResetPasswordPage() {
  const { dictionary: t } = useI18n();
  const router = useRouter();
  const { updateUserPassword, signOut } = useAuthStore();

  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // The recovery link is exchanged into a session by /auth/callback before we
  // get here. If there's no session, the link was invalid or expired.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
      setChecking(false);
    });
  }, []);

  const schema = useMemo(() => createSchema(t), [t]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    const { error } = await updateUserPassword(values.password);
    if (error) {
      toast.error(error);
      setSubmitting(false);
      return;
    }
    // Sign out so the user re-authenticates with the new password.
    await signOut();
    toast.success(t.auth.passwordUpdated);
    router.push("/auth/login");
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

          {checking ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
            </div>
          ) : !hasSession ? (
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground">
                {t.auth.resetPasswordTitle}
              </h1>
              <p className="mt-4 text-muted-foreground">
                {t.auth.resetLinkInvalid}
              </p>
              <Button asChild className="mt-8 w-full">
                <Link href="/auth/forgot-password">
                  {t.auth.sendResetLink}
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-foreground">
                {t.auth.resetPasswordTitle}
              </h1>
              <p className="mt-2 text-muted-foreground">
                {t.auth.resetPasswordSubtitle}
              </p>

              <form
                className="mt-8 flex flex-col gap-5"
                onSubmit={handleSubmit(onSubmit)}
              >
                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">{t.auth.newPassword}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      {...register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 end-0 flex items-center pe-3 text-muted-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-destructive">
                      {errors.password.message}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="confirmPassword">
                    {t.auth.confirmPassword}
                  </Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    {...register("confirmPassword")}
                  />
                  {errors.confirmPassword && (
                    <p className="text-xs text-destructive">
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? t.common.loading : t.auth.updatePassword}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
