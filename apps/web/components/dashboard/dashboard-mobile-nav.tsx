"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DashboardSidebar } from "./dashboard-sidebar";
import { Menu, Heart } from "lucide-react";

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
            <span className="sr-only">Toggle sidebar</span>
          </Button>
        </SheetTrigger>
        <SheetContent side={isRtl ? "right" : "left"} className="w-64 p-0">
          <DashboardSidebar role={role} />
        </SheetContent>
      </Sheet>
      <Link href="/" className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
          <Heart className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <span className="font-bold text-foreground">{t.common.appName}</span>
      </Link>
    </header>
  );
}
