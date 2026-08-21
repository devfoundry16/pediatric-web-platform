"use client";

import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { XCircle, Package, ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n/i18n-context";

export default function PackageCancelPage() {
  const { dictionary: t } = useI18n();
  return (
    <DashboardLayout role="parent">
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-6 py-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <XCircle className="h-8 w-8 text-muted-foreground" />
            </div>

            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-bold text-foreground">
                {t.packages.cancelTitle}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t.packages.cancelSubtitle}
              </p>
            </div>

            <div className="flex w-full flex-col gap-2">
              <Button asChild className="w-full">
                <Link href="/dashboard/parent/packages">
                  <Package className="mr-2 h-4 w-4" />
                  {t.packages.browsePackages}
                </Link>
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link href="/dashboard/parent">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t.booking.backToDashboard}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
