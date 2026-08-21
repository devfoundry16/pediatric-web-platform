"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n/i18n-context";
import { coursesApi } from "@/lib/api/courses";
import { toast } from "sonner";
import { ChevronLeft, Loader2, AlertCircle } from "lucide-react";

export default function NewCoursePage() {
  const { dictionary: t } = useI18n();
  const tc = t.courses;
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [isFree, setIsFree] = useState(true);
  const [priceAed, setPriceAed] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const course = await coursesApi.createCourse({
        title: title.trim(),
        description: description.trim() || undefined,
        thumbnail_url: thumbnailUrl.trim() || undefined,
        is_free: isFree,
        price_aed: isFree ? 0 : parseFloat(priceAed) || 0,
      });
      toast.success(tc.courseCreated);
      router.push(`/dashboard/doctor/courses/${course.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : tc.createError;
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <DashboardLayout role="doctor">
      <div className="flex flex-col gap-6 p-6">
        <Link
          href="/dashboard/doctor/courses"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {t.common.back}
        </Link>

        <div>
          <h1 className="text-2xl font-bold text-foreground">{tc.createCourse}</h1>
          <p className="mt-1 text-muted-foreground">
            {tc.createSubtitle}
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="text-base">{tc.courseTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="title">{tc.courseTitle} *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={tc.courseTitlePlaceholder}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">{tc.courseDescription}</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={tc.courseDescriptionPlaceholder}
                  rows={4}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="thumbnail">{tc.thumbnailUrl}</Label>
                <Input
                  id="thumbnail"
                  type="url"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  placeholder={tc.thumbnailUrlPlaceholder}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="text-sm font-medium">{tc.isFree}</p>
                  <p className="text-xs text-muted-foreground">
                    {tc.isFreeHint}
                  </p>
                </div>
                <Switch checked={isFree} onCheckedChange={setIsFree} />
              </div>

              {!isFree && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="price">{tc.priceAed}</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={priceAed}
                    onChange={(e) => setPriceAed(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <Button type="submit" disabled={isSubmitting || !title.trim()}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {tc.saveCourse}
                </Button>
                <Button asChild variant="outline" type="button">
                  <Link href="/dashboard/doctor/courses">{t.common.cancel}</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
