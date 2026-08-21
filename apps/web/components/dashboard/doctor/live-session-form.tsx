"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm, type SubmitHandler, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimezoneNotice } from "@/components/booking/timezone-notice";
import { useI18n } from "@/lib/i18n/i18n-context";
import { useViewerTimezone } from "@/hooks/use-viewer-timezone";
import { todayInTimezone, wallClockToInstant } from "@/lib/timezone";
import type { CreateSessionPayload } from "@/lib/api/live-sessions";
import { Video } from "lucide-react";

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

export type LiveSessionFormValues = z.infer<typeof schema>;

const EMPTY_VALUES: LiveSessionFormValues = {
  title: "",
  description: "",
  scheduled_date: "",
  scheduled_time: "",
  duration_minutes: 60,
  max_participants: 30,
  price_aed: 0,
  is_published: true,
};

interface LiveSessionFormProps {
  defaultValues?: Partial<LiveSessionFormValues>;
  submitLabel: string;
  onSubmit: (payload: CreateSessionPayload) => Promise<void>;
}

/**
 * Shared by the new-session and edit-session pages so the two cannot drift.
 *
 * The date and time inputs are wall clock in the doctor's viewing zone and are
 * converted to an instant on submit — group_sessions.scheduled_at is a real
 * TIMESTAMPTZ, and parsing "2026-08-20T14:00" with the Date constructor would
 * silently reinterpret it in whatever zone the browser happens to be in.
 */
export function LiveSessionForm({
  defaultValues,
  submitLabel,
  onSubmit,
}: LiveSessionFormProps) {
  const { dictionary: t } = useI18n();
  const { timezone: viewerTimezone } = useViewerTimezone();
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<LiveSessionFormValues>({
    resolver: zodResolver(schema) as Resolver<LiveSessionFormValues>,
    defaultValues: { ...EMPTY_VALUES, ...defaultValues },
  });

  const isPublished = watch("is_published");

  // A session already scheduled for an earlier date must stay editable, so the
  // floor is whichever comes first: today or the date it already holds.
  const today = todayInTimezone(viewerTimezone);
  const existingDate = defaultValues?.scheduled_date;
  const minDate = existingDate && existingDate < today ? existingDate : today;

  const submit: SubmitHandler<LiveSessionFormValues> = async (values) => {
    setSaving(true);
    try {
      await onSubmit({
        title: values.title,
        description: values.description,
        scheduled_at: wallClockToInstant(
          values.scheduled_date,
          values.scheduled_time,
          viewerTimezone
        ).toISOString(),
        duration_minutes: values.duration_minutes,
        max_participants: values.max_participants,
        price_aed: values.price_aed,
        is_published: values.is_published,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
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
              placeholder={t.liveSessions.sessionTitlePlaceholder}
              {...register("title")}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">
              {t.liveSessions.sessionDescription}
            </Label>
            <Textarea
              id="description"
              placeholder={t.liveSessions.sessionDescriptionPlaceholder}
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
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <TimezoneNotice timezone={viewerTimezone} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="scheduled_date">{t.common.date} *</Label>
            <Input
              id="scheduled_date"
              type="date"
              min={minDate}
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
            <Label htmlFor="price_aed">{t.liveSessions.sessionPrice}</Label>
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
              {t.liveSessions.sessionPriceHint}
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

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/doctor/live-sessions">{t.common.cancel}</Link>
        </Button>
        <Button type="submit" disabled={saving} className="gap-2">
          <Video className="h-4 w-4" />
          {saving ? t.common.loading : submitLabel}
        </Button>
      </div>
    </form>
  );
}
