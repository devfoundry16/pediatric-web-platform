"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

import { useI18n } from "@/lib/i18n/i18n-context";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { ACCOUNT_DEACTIVATED, useAuthStore } from "@/lib/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import GoogleIcon from "./google-icon";

function createLoginSchema(t: Dictionary) {
  return z.object({
    email: z
      .string()
      .min(1, t.validation.emailRequired)
      .pipe(z.email(t.validation.emailInvalid)),
    password: z.string().min(6, t.validation.passwordMin6),
  });
}

type LoginFormValues = z.infer<ReturnType<typeof createLoginSchema>>;

export function LoginForm() {
  const { dictionary: t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);

  const { signIn, signInWithGoogle, isLoading, error, clearError } =
    useAuthStore();

  // Surface failures from the email-confirmation callback (invalid/expired link).
  const confirmationFailed =
    searchParams.get("error") === "confirmation_failed";

  // Set by the OAuth callback and by middleware when a live session belongs to
  // an account that has since been deactivated.
  const deactivated =
    searchParams.get("deactivated") === "1" || error === ACCOUNT_DEACTIVATED;

  const loginSchema = useMemo(() => createLoginSchema(t), [t]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginFormValues) => {
    clearError();
    await signIn(values.email, values.password);

    const { user } = useAuthStore.getState();
    if (user) {
      toast.success(t.auth.signIn);
      const redirectTo = searchParams.get("redirectTo");
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        const role = user.user_metadata?.role as string | undefined;
        router.push(role === "doctor" ? "/dashboard/doctor" : "/dashboard/parent");
      }
    }
  };

  return (
    <form
      className="mt-8 flex flex-col gap-5"
      onSubmit={handleSubmit(onSubmit)}
    >
      {deactivated && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t.auth.accountDeactivated}
        </p>
      )}

      {error && !deactivated && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {!error && !deactivated && confirmationFailed && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t.auth.confirmationFailed}
        </p>
      )}

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
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{t.common.password}</Label>
          <Link
            href="/auth/forgot-password"
            className="text-xs text-primary hover:underline"
          >
            {t.auth.forgotPassword}
          </Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="current-password"
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
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? t.common.loading : t.auth.signIn}
      </Button>

      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            {t.auth.orContinueWith}
          </span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full bg-transparent"
        disabled={isLoading}
        onClick={() => {
          clearError();
          // Same destination the password form honours, so arriving from a
          // consultation link ends up at the consultation either way.
          signInWithGoogle(searchParams.get("redirectTo") ?? undefined);
        }}
      >
        <GoogleIcon />
        Google
      </Button>
    </form>
  );
}
