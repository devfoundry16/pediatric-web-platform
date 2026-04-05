"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ChildrenList } from "@/components/dashboard/parent/children-list";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/i18n-context";

export default function ParentChildrenPage() {
  const { dictionary: t } = useI18n();

  return (
    <DashboardLayout role="parent">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="gap-1">
            <Link href="/dashboard/parent">
              <ChevronLeft className="h-4 w-4" />
              {t.common.dashboard}
            </Link>
          </Button>
        </div>
        <ChildrenList title={t.childForm.childrenListTitle} />
      </div>
    </DashboardLayout>
  );
}
