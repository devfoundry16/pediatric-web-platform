"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";

import { useI18n } from "@/lib/i18n/i18n-context";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput, isValidPhoneNumber } from "@/components/ui/phone-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import GoogleIcon from "./google-icon";

const registerSchema = z
  .object({
    fullName: z.string().min(2, "Full name must be at least 2 characters"),
    email: z
      .string()
      .min(1, "Email is required")
      .pipe(z.email("Enter a valid email")),
    phone: z
      .string()
      .min(1, "Phone number is required")
      .refine((v) => isValidPhoneNumber(v), {
        message: "Enter a valid phone number",
      }),
    role: z.enum(["parent", "doctor"], {
      message: "Please select your role",
    }),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
    terms: z.literal(true, {
      message: "You must accept the terms",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const { dictionary: t } = useI18n();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const { signUp, isLoading, error, clearError } = useAuthStore();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (values: RegisterFormValues) => {
    clearError();
    await signUp(
      values.email,
      values.password,
      values.fullName,
      values.phone,
      values.role
    );

    const storeError = useAuthStore.getState().error;
    if (!storeError) {
      router.push(
        `/auth/check-email?email=${encodeURIComponent(values.email)}`
      );
    }
  };

  return (
    <form
      className="mt-8 flex flex-col gap-5"
      onSubmit={handleSubmit(onSubmit)}
    >
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="fullName">{t.auth.fullName}</Label>
        <Input
          id="fullName"
          type="text"
          placeholder="John Doe"
          {...register("fullName")}
        />
        {errors.fullName && (
          <p className="text-xs text-destructive">{errors.fullName.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="regEmail">{t.common.email}</Label>
        <Input
          id="regEmail"
          type="email"
          placeholder="name@example.com"
          autoComplete="email"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">{t.auth.phoneNumber}</Label>
        <Controller
          name="phone"
          control={control}
          render={({ field }) => (
            <PhoneInput
              id="phone"
              defaultCountry="AE"
              autoComplete="tel"
              searchPlaceholder={t.common.search}
              emptyText={t.common.noResults}
              {...field}
            />
          )}
        />
        {errors.phone && (
          <p className="text-xs text-destructive">{errors.phone.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="role">{t.auth.roleSelect}</Label>
        <Controller
          name="role"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger id="role">
                <SelectValue placeholder={t.auth.roleSelect} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="parent">{t.auth.parent}</SelectItem>
                <SelectItem value="doctor">{t.auth.doctor}</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        {errors.role && (
          <p className="text-xs text-destructive">{errors.role.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="regPassword">{t.common.password}</Label>
        <div className="relative">
          <Input
            id="regPassword"
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
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmPassword">{t.auth.confirmPassword}</Label>
        <Input
          id="confirmPassword"
          type="password"
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

      <div className="flex flex-col gap-1">
        <div className="flex items-start gap-2">
          <Controller
            name="terms"
            control={control}
            render={({ field }) => (
              <Checkbox
                id="terms"
                className="mt-0.5"
                checked={field.value === true}
                onCheckedChange={(checked) =>
                  field.onChange(checked === true ? true : false)
                }
              />
            )}
          />
          <Label
            htmlFor="terms"
            className="text-sm font-normal text-muted-foreground"
          >
            {t.auth.agreeTerms}
          </Label>
        </div>
        {errors.terms && (
          <p className="text-xs text-destructive">{errors.terms.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? t.common.loading : t.auth.signUp}
      </Button>

      {/* <div className="relative my-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            {t.auth.orContinueWith}
          </span>
        </div>
      </div>

      <Button type="button" variant="outline" className="w-full bg-transparent">
        <GoogleIcon />
        Google
      </Button> */}
    </form>
  );
}
