"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useI18n } from "@/lib/i18n/i18n-context";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { cn } from "@/lib/utils";
import {
  Heart,
  LayoutDashboard,
  Users,
  CalendarDays,
  Clock,
  Stethoscope,
  UserRoundCog,
  CreditCard,
  Baby,
  ClipboardList,
  Bell,
  Plug,
  Settings,
  LogOut,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  href: string;
  labelKey: keyof Dictionary["admin"]["nav"];
  icon: LucideIcon;
}

const adminNav: NavItem[] = [
  { href: "/dashboard/admin", labelKey: "overview", icon: LayoutDashboard },
  { href: "/dashboard/admin/users", labelKey: "users", icon: Users },
  { href: "/dashboard/admin/appointments", labelKey: "appointments", icon: CalendarDays },
  { href: "/dashboard/admin/doctors", labelKey: "doctors", icon: UserRoundCog },
  { href: "/dashboard/admin/availability", labelKey: "availability", icon: Clock },
  { href: "/dashboard/admin/consultation-types", labelKey: "consultationTypes", icon: Stethoscope },
  { href: "/dashboard/admin/payments", labelKey: "payments", icon: CreditCard },
  { href: "/dashboard/admin/patients", labelKey: "patients", icon: Baby },
  { href: "/dashboard/admin/notes", labelKey: "notes", icon: ClipboardList },
  { href: "/dashboard/admin/notifications", labelKey: "notifications", icon: Bell },
  { href: "/dashboard/admin/integrations", labelKey: "integrations", icon: Plug },
  { href: "/dashboard/admin/settings", labelKey: "settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { dictionary: t } = useI18n();
  const signOut = useAuthStore((s) => s.signOut);
  const isSigningOut = useAuthStore((s) => s.isLoading);

  const handleSignOut = async () => {
    await signOut();
    if (!useAuthStore.getState().error) {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <aside className="flex h-screen w-64 flex-col border-e border-border bg-card">
      <div className="flex h-16 items-center gap-2 border-b border-border px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Heart className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold leading-tight text-foreground">{t.common.appName}</span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t.admin.nav.adminBadge}</span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {adminNav.map((item) => {
            const isOverview = item.href === "/dashboard/admin";
            const isActive = isOverview
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {t.admin.nav[item.labelKey]}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border p-3">
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {isSigningOut ? t.admin.nav.signingOut : t.admin.nav.signOut}
        </button>
      </div>
    </aside>
  );
}
