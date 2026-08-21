"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, Package, CalendarDays, ArrowRight } from "lucide-react";
import { packagesApi } from "@/lib/api/packages";
import type { UserPackage } from "@/types/packages";
import { useI18n } from "@/lib/i18n/i18n-context";

export default function PackageSuccessPage() {
  const { dictionary: t } = useI18n();
  const router = useRouter();
  const [latestPackage, setLatestPackage] = useState<UserPackage | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLatest();
  }, []);

  async function loadLatest() {
    try {
      const packages = await packagesApi.getMyPackages();
      const active = packages.filter((p) => p.status === "active");
      if (active.length > 0) {
        setLatestPackage(active[0]);
      }
    } catch {
      // silently ignore — user can still navigate
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <DashboardLayout role="parent">
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-6 py-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/40">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>

            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-bold text-foreground">
                {t.packages.successTitle}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t.packages.successSubtitle}
              </p>
            </div>

            {isLoading ? (
              <Skeleton className="h-20 w-full rounded-xl" />
            ) : latestPackage ? (
              <div className="w-full rounded-xl border bg-muted/50 p-4 text-left">
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">
                      {latestPackage.consultation_packages.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t.packages.sessionsAvailable.replace(
                        "{count}",
                        String(latestPackage.credits_remaining)
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex w-full flex-col gap-2">
              <Button asChild className="w-full">
                <Link href="/booking">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {t.booking.title}
                </Link>
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link href="/dashboard/parent/packages">
                  <ArrowRight className="mr-2 h-4 w-4" />
                  {t.packages.viewMyPackages}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
