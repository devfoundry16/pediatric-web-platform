"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n-context";
import { useAuthStore } from "@/lib/stores/auth-store";
import { LanguageSwitcher } from "@/components/language-switcher";
import { UserNavMenu } from "@/components/layout/user-nav-menu";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Heart } from "lucide-react";
import { useState } from "react";

export function SiteHeader() {
  const { dictionary: t, isRtl } = useI18n();
  const [open, setOpen] = useState(false);
  const user = useAuthStore((s) => s.user);

  const navLinks = [
    { href: "/", label: t.common.home },
    { href: "/#services", label: t.common.services },
    { href: "/#packages", label: t.common.packages },
    { href: "/courses", label: t.common.courses },
    { href: "/live-sessions", label: t.common.liveSessions },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Heart className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold text-foreground">
            {t.common.appName}
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {user ? (
            <UserNavMenu user={user} />
          ) : (
            <>
              <Link href="/auth/login" className="hidden sm:block">
                <Button variant="ghost" size="sm">
                  {t.common.login}
                </Button>
              </Link>
              <Link href="/auth/register" className="hidden sm:block">
                <Button size="sm">{t.common.register}</Button>
              </Link>
            </>
          )}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side={isRtl ? "right" : "left"}>
              <nav className="flex flex-col gap-4 pt-8">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="text-lg font-medium text-foreground"
                  >
                    {link.label}
                  </Link>
                ))}
                {!user && (
                  <div className="mt-4 flex flex-col gap-2">
                    <Link href="/auth/login" onClick={() => setOpen(false)}>
                      <Button
                        variant="outline"
                        className="w-full bg-transparent"
                      >
                        {t.common.login}
                      </Button>
                    </Link>
                    <Link
                      href="/auth/register"
                      onClick={() => setOpen(false)}
                    >
                      <Button className="w-full">{t.common.register}</Button>
                    </Link>
                  </div>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
