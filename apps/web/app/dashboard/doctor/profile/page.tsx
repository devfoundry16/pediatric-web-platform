"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { DashboardProfile } from "@/components/dashboard/dashboard-profile";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { doctorApi, type DoctorProfile } from "@/lib/api/doctor";

// ─── Professional info form ───────────────────────────────────────────────────

const professionalSchema = z.object({
  specialty: z.string().min(2, "Enter your specialty"),
  bio: z.string().max(600, "Max 600 characters").optional(),
  avatar_url: z
    .string()
    .url("Enter a valid URL")
    .optional()
    .or(z.literal("")),
});

type ProfessionalValues = z.infer<typeof professionalSchema>;

function ProfessionalInfoCard() {
  const { dictionary: t } = useI18n();
  const d = t.doctorDashboard;
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const form = useForm<ProfessionalValues>({
    resolver: zodResolver(professionalSchema),
    defaultValues: { specialty: "", bio: "", avatar_url: "" },
  });

  useEffect(() => {
    doctorApi
      .getMe()
      .then((doc: DoctorProfile) => {
        setProfile(doc);
        form.reset({
          specialty: doc.specialty ?? "",
          bio: doc.bio ?? "",
          avatar_url: doc.avatar_url ?? "",
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const avatarUrl = form.watch("avatar_url");
  const displayName = profile?.full_name ?? "";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const onSubmit = async (values: ProfessionalValues) => {
    try {
      const updated = await doctorApi.updateProfile({
        specialty: values.specialty,
        bio: values.bio || undefined,
        avatar_url: values.avatar_url || undefined,
      });
      setProfile(updated);
      toast.success(d.professionalSaved);
    } catch {
      toast.error(d.loadError);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-24 w-full max-w-md" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{d.professionalInfo}</CardTitle>
        <CardDescription>{d.professionalInfoDesc}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex max-w-md flex-col gap-5"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          {/* Avatar preview */}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {avatarUrl && (
                <AvatarImage src={avatarUrl} alt={displayName || "Doctor"} />
              )}
              <AvatarFallback className="bg-primary/10 text-primary text-lg">
                {initials || "DR"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Label htmlFor="avatar_url">{d.avatarUrl}</Label>
              <Input
                id="avatar_url"
                type="url"
                placeholder={d.avatarUrlPlaceholder}
                className="mt-1"
                {...form.register("avatar_url")}
              />
              {form.formState.errors.avatar_url && (
                <p className="mt-0.5 text-xs text-destructive">
                  {form.formState.errors.avatar_url.message}
                </p>
              )}
            </div>
          </div>

          {/* Specialty */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="specialty">{d.specialty}</Label>
            <Input
              id="specialty"
              placeholder={d.specialtyPlaceholder}
              {...form.register("specialty")}
            />
            {form.formState.errors.specialty && (
              <p className="text-xs text-destructive">
                {form.formState.errors.specialty.message}
              </p>
            )}
          </div>

          {/* Bio */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="bio">{d.bio}</Label>
            <Textarea
              id="bio"
              rows={4}
              placeholder={d.bioPlaceholder}
              {...form.register("bio")}
            />
            {form.formState.errors.bio && (
              <p className="text-xs text-destructive">
                {form.formState.errors.bio.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {(form.watch("bio") ?? "").length} / 600
            </p>
          </div>

          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? t.common.loading : d.saveProfessional}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DoctorProfilePage() {
  return (
    <DashboardLayout role="doctor">
      <div className="flex flex-col gap-6">
        <DashboardProfile role="doctor" />
        <ProfessionalInfoCard />
      </div>
    </DashboardLayout>
  );
}
