"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ChildForm } from "@/components/dashboard/parent/child-form/child-form";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/i18n-context";

export default function AddChildPage() {
  const { dictionary: t } = useI18n();

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
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t.childForm.addTitle}
          </h1>
          <p className="text-muted-foreground">{t.patient.personalInfo}</p>
        </div>
        <ChildForm mode="add" />
      </div>
    </DashboardLayout>
  );
}
