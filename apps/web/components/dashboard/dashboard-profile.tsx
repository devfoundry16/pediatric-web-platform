"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { useI18n } from "@/lib/i18n/i18n-context";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const personalSchema = z.object({
  fullName: z.string().min(2, "Enter your full name"),
  phone: z.string().min(7, "Enter a valid phone number"),
});

const emailSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .pipe(z.email("Enter a valid email")),
});

const passwordSchema = z
  .object({
    newPassword: z.string().min(6, "At least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type PersonalValues = z.infer<typeof personalSchema>;
type EmailValues = z.infer<typeof emailSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

interface DashboardProfileProps {
  role: "parent" | "doctor";
}

export function DashboardProfile({ role }: DashboardProfileProps) {
  const { dictionary: t } = useI18n();
  const p = t.profile;
  const user = useAuthStore((s) => s.user);
  const updateProfileMetadata = useAuthStore((s) => s.updateProfileMetadata);
  const updateUserEmail = useAuthStore((s) => s.updateUserEmail);
  const updateUserPassword = useAuthStore((s) => s.updateUserPassword);

  const personalForm = useForm<PersonalValues>({
    resolver: zodResolver(personalSchema),
    defaultValues: { fullName: "", phone: "" },
  });

  const emailForm = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!user) return;
    const fullName = (user.user_metadata?.full_name as string | undefined) ?? "";
    const phone = (user.user_metadata?.phone as string | undefined) ?? "";
    personalForm.reset({ fullName, phone });
    emailForm.reset({ email: user.email ?? "" });
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps -- sync forms when Supabase user changes

  const onPersonalSubmit = async (values: PersonalValues) => {
    const { error } = await updateProfileMetadata(values.fullName, values.phone);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(p.profileUpdated);
  };

  const onEmailSubmit = async (values: EmailValues) => {
    const { error } = await updateUserEmail(values.email);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(p.emailUpdateSent);
  };

  const onPasswordSubmit = async (values: PasswordValues) => {
    const { error } = await updateUserPassword(values.newPassword);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(p.passwordUpdated);
    passwordForm.reset({ newPassword: "", confirmPassword: "" });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{p.title}</h1>
        <p className="text-muted-foreground">{p.subtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{p.personalSection}</CardTitle>
          <CardDescription>
            {p.accountType}:{" "}
            {role === "doctor" ? p.doctorRole : p.parentRole}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex max-w-md flex-col gap-4"
            onSubmit={personalForm.handleSubmit(onPersonalSubmit)}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-fullName">{p.fullName}</Label>
              <Input
                id="profile-fullName"
                autoComplete="name"
                {...personalForm.register("fullName")}
              />
              {personalForm.formState.errors.fullName && (
                <p className="text-xs text-destructive">
                  {personalForm.formState.errors.fullName.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-phone">{p.phone}</Label>
              <Input
                id="profile-phone"
                type="tel"
                autoComplete="tel"
                {...personalForm.register("phone")}
              />
              {personalForm.formState.errors.phone && (
                <p className="text-xs text-destructive">
                  {personalForm.formState.errors.phone.message}
                </p>
              )}
            </div>
            <Button
              type="submit"
              disabled={personalForm.formState.isSubmitting}
            >
              {personalForm.formState.isSubmitting
                ? t.common.loading
                : p.saveProfile}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{p.emailSection}</CardTitle>
          <CardDescription>{p.emailHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex max-w-md flex-col gap-4"
            onSubmit={emailForm.handleSubmit(onEmailSubmit)}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-email">{p.newEmail}</Label>
              <Input
                id="profile-email"
                type="email"
                autoComplete="email"
                {...emailForm.register("email")}
              />
              {emailForm.formState.errors.email && (
                <p className="text-xs text-destructive">
                  {emailForm.formState.errors.email.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={emailForm.formState.isSubmitting}>
              {emailForm.formState.isSubmitting
                ? t.common.loading
                : p.updateEmail}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{p.passwordSection}</CardTitle>
          <CardDescription>{p.passwordHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex max-w-md flex-col gap-4"
            onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-new-password">{p.newPassword}</Label>
              <Input
                id="profile-new-password"
                type="password"
                autoComplete="new-password"
                {...passwordForm.register("newPassword")}
              />
              {passwordForm.formState.errors.newPassword && (
                <p className="text-xs text-destructive">
                  {passwordForm.formState.errors.newPassword.message}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-confirm-password">{p.confirmPassword}</Label>
              <Input
                id="profile-confirm-password"
                type="password"
                autoComplete="new-password"
                {...passwordForm.register("confirmPassword")}
              />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-xs text-destructive">
                  {passwordForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={passwordForm.formState.isSubmitting}>
              {passwordForm.formState.isSubmitting
                ? t.common.loading
                : p.updatePassword}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
