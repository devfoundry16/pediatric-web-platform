"use client";

import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { XCircle, Package, ArrowLeft } from "lucide-react";

export default function PackageCancelPage() {
  return (
    <DashboardLayout role="parent">
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-6 py-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <XCircle className="h-8 w-8 text-muted-foreground" />
            </div>

            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-bold text-foreground">Payment Cancelled</h1>
              <p className="text-sm text-muted-foreground">
                Your payment was not processed. No charges were made.
                You can try again whenever you&apos;re ready.
              </p>
            </div>

            <div className="flex w-full flex-col gap-2">
              <Button asChild className="w-full">
                <Link href="/dashboard/parent/packages">
                  <Package className="mr-2 h-4 w-4" />
                  Browse Packages
                </Link>
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link href="/dashboard/parent">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Dashboard
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
