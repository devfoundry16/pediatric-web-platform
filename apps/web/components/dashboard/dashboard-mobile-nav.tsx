"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DashboardSidebar } from "./dashboard-sidebar";
import { Menu } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";

interface DashboardMobileNavProps {
  role: "parent" | "doctor";
}

export function DashboardMobileNav({ role }: DashboardMobileNavProps) {
  const { dictionary: t, isRtl } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-card px-4 lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
            <span className="sr-only">{t.common.toggleSidebar}</span>
          </Button>
        </SheetTrigger>
        <SheetContent aria-describedby={undefined} side={isRtl ? "right" : "left"} className="w-64 p-0">
          <VisuallyHidden asChild>
            <SheetHeader>
              <SheetTitle>{t.common.navigation}</SheetTitle>
            </SheetHeader>
          </VisuallyHidden>
          <DashboardSidebar role={role} />
        </SheetContent>
      </Sheet>
      <Link href="/" className="flex items-center">
        <BrandLogo className="h-8" />
      </Link>
    </header>
  );
}
