"use client";

import { useState } from "react";
import Link from "next/link";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AdminSidebar } from "@/components/dashboard/admin-sidebar";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Menu, Heart } from "lucide-react";
import { useI18n } from "@/lib/i18n/i18n-context";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { dictionary: t } = useI18n();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <AdminSidebar />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex h-14 items-center gap-4 border-b border-border bg-card px-4 lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">{t.admin.nav.toggleSidebar}</span>
              </Button>
            </SheetTrigger>
            <SheetContent aria-describedby={undefined} side="left" className="w-64 p-0">
              <VisuallyHidden asChild>
                <SheetHeader>
                  <SheetTitle>{t.admin.nav.navigationLabel}</SheetTitle>
                </SheetHeader>
              </VisuallyHidden>
              <AdminSidebar />
            </SheetContent>
          </Sheet>
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <Heart className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground">{t.admin.nav.brandAdmin}</span>
          </Link>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
