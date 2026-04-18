"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type SubmitHandler, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/i18n-context";
import { liveSessionsApi } from "@/lib/api/live-sessions";
import { toast } from "sonner";
import { ArrowLeft, Video } from "lucide-react";
import Link from "next/link";

const schema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  scheduled_date: z.string().min(1, "Date is required"),
  scheduled_time: z.string().min(1, "Time is required"),
  duration_minutes: z.coerce
    .number()
    .int()
    .min(15, "Minimum 15 minutes")
    .max(480, "Maximum 8 hours"),
  max_participants: z.coerce
    .number()
    .int()
    .min(2, "At least 2 participants")
    .max(500),
  price_aed: z.coerce.number().min(0, "Price cannot be negative"),
  is_published: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export default function NewLiveSessionPage() {
  const { dictionary: t } = useI18n();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      duration_minutes: 60,
      max_participants: 30,
      price_aed: 0,
      is_published: false,
    },
  });

  const isPublished = watch("is_published");

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    setSaving(true);
    try {
      const scheduledAt = new Date(
        `${values.scheduled_date}T${values.scheduled_time}`
      ).toISOString();

      const session = await liveSessionsApi.createSession({
        title: values.title,
        description: values.description,
        scheduled_at: scheduledAt,
        duration_minutes: values.duration_minutes,
        max_participants: values.max_participants,
        price_aed: values.price_aed,
        is_published: values.is_published,
      });

      toast.success(t.liveSessions.sessionCreated);
      router.push(`/dashboard/doctor/live-sessions`);
      void session;
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to create session";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout role="doctor">
      <div className="flex flex-col gap-6 max-w-2xl">
        <div>
          <Link
            href="/dashboard/doctor/live-sessions"
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t.liveSessions.manageSessions}
          </Link>
          <h1 className="text-2xl font-bold text-foreground">
            {t.liveSessions.newSession}
          </h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Video className="h-4 w-4" />
                {t.liveSessions.sessionTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="title">{t.liveSessions.sessionTitle} *</Label>
                <Input
                  id="title"
                  placeholder="e.g. Child Nutrition Workshop"
                  {...register("title")}
                />
                {errors.title && (
                  <p className="text-xs text-destructive">
                    {errors.title.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">
                  {t.liveSessions.sessionDescription}
                </Label>
                <Textarea
                  id="description"
                  placeholder="Describe what participants will learn..."
                  rows={4}
                  {...register("description")}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {t.liveSessions.sessionDate}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="scheduled_date">{t.common.date} *</Label>
                <Input
                  id="scheduled_date"
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  {...register("scheduled_date")}
                />
                {errors.scheduled_date && (
                  <p className="text-xs text-destructive">
                    {errors.scheduled_date.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="scheduled_time">{t.common.time} *</Label>
                <Input
                  id="scheduled_time"
                  type="time"
                  {...register("scheduled_time")}
                />
                {errors.scheduled_time && (
                  <p className="text-xs text-destructive">
                    {errors.scheduled_time.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="duration_minutes">
                  {t.liveSessions.sessionDuration}
                </Label>
                <Input
                  id="duration_minutes"
                  type="number"
                  min={15}
                  max={480}
                  step={15}
                  {...register("duration_minutes")}
                />
                {errors.duration_minutes && (
                  <p className="text-xs text-destructive">
                    {errors.duration_minutes.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="max_participants">
                  {t.liveSessions.sessionMaxParticipants}
                </Label>
                <Input
                  id="max_participants"
                  type="number"
                  min={2}
                  max={500}
                  {...register("max_participants")}
                />
                {errors.max_participants && (
                  <p className="text-xs text-destructive">
                    {errors.max_participants.message}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t.common.price}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="price_aed">
                  {t.liveSessions.sessionPrice}
                </Label>
                <Input
                  id="price_aed"
                  type="number"
                  min={0}
                  step={1}
                  {...register("price_aed")}
                />
                {errors.price_aed && (
                  <p className="text-xs text-destructive">
                    {errors.price_aed.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Set to 0 for a free session
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  id="is_published"
                  checked={isPublished}
                  onCheckedChange={(v) => setValue("is_published", v)}
                />
                <Label htmlFor="is_published" className="cursor-pointer">
                  {t.liveSessions.publishSession}
                </Label>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" asChild>
              <Link href="/dashboard/doctor/live-sessions">
                {t.common.cancel}
              </Link>
            </Button>
            <Button type="submit" disabled={saving} className="gap-2">
              <Video className="h-4 w-4" />
              {saving ? t.common.loading : t.liveSessions.saveSession}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
