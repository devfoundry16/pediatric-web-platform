"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ChildProfileView } from "@/components/dashboard/parent/child-profile-view";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/i18n-context";
import { childrenApi } from "@/lib/api/children";
import type { ChildProfile } from "@/types/child";

export default function ChildDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const invalidId = !id;
  const { dictionary: t } = useI18n();
  const [profile, setProfile] = useState<ChildProfile | null>(null);
  const [loading, setLoading] = useState(() => !invalidId);
  const [error, setError] = useState<string | null>(() =>
    invalidId ? "Invalid id" : null
  );

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    childrenApi
      .getById(id)
      .then((data) => {
        if (!cancelled) {
          setProfile(data);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(t.childForm.loadError);
          setProfile(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, t.childForm.loadError]);

  return (
    <DashboardLayout role="parent">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="gap-1">
            <Link href="/dashboard/parent/children">
              <ChevronLeft className="h-4 w-4" />
              {t.childForm.backToList}
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            {t.common.loading}
          </div>
        ) : error || !profile ? (
          <p className="text-destructive">{error ?? t.childForm.loadError}</p>
        ) : (
          <ChildProfileView profile={profile} />
        )}
      </div>
    </DashboardLayout>
  );
}
