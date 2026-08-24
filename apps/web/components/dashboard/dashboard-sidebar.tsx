"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/i18n-context";
import { useAuthStore } from "@/lib/stores/auth-store";
import { LanguageSwitcher } from "@/components/language-switcher";
import { BrandLogo } from "@/components/layout/brand-logo";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Baby,
  CalendarDays,
  FileText,
  Package,
  GraduationCap,
  Paperclip,
  LogOut,
  Users,
  ClipboardList,
  Video,
  DollarSign,
  UserCircle,
  CalendarClock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface DashboardSidebarProps {
  role: "parent" | "doctor";
}

export function DashboardSidebar({ role }: DashboardSidebarProps) {
  const { dictionary: t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);
  const isSigningOut = useAuthStore((s) => s.isLoading);

  const handleSignOut = async () => {
    await signOut();
    if (!useAuthStore.getState().error) {
      router.push("/");
      router.refresh();
    }
  };

  const parentNav: NavItem[] = [
    {
      href: "/dashboard/parent",
      label: t.parentDashboard.overview,
      icon: LayoutDashboard,
    },
    {
      href: "/dashboard/parent/children",
      label: t.parentDashboard.myChildren,
      icon: Baby,
    },
    {
      href: "/dashboard/parent/appointments",
      label: t.parentDashboard.appointments,
      icon: CalendarDays,
    },
    {
      href: "/dashboard/parent/records",
      label: t.parentDashboard.medicalRecords,
      icon: FileText,
    },
    {
      href: "/dashboard/parent/packages",
      label: t.parentDashboard.myPackages,
      icon: Package,
    },
    {
      href: "/dashboard/parent/courses",
      label: t.parentDashboard.myCourses,
      icon: GraduationCap,
    },
    {
      href: "/dashboard/parent/live-sessions",
      label: t.parentDashboard.liveSessions,
      icon: Video,
    },
    {
      href: "/dashboard/parent/files",
      label: t.parentDashboard.files,
      icon: Paperclip,
    },
    {
      href: "/dashboard/parent/profile",
      label: t.profile.title,
      icon: UserCircle,
    },
  ];

  const doctorNav: NavItem[] = [
    {
      href: "/dashboard/doctor",
      label: t.doctorDashboard.overview,
      icon: LayoutDashboard,
    },
    {
      href: "/dashboard/doctor/patients",
      label: t.doctorDashboard.patients,
      icon: Users,
    },
    {
      href: "/dashboard/doctor/appointments",
      label: t.doctorDashboard.appointments,
      icon: CalendarDays,
    },
    {
      href: "/dashboard/doctor/schedule",
      label: t.doctorDashboard.scheduleTitle,
      icon: CalendarClock,
    },
    {
      href: "/dashboard/doctor/notes",
      label: t.doctorDashboard.medicalNotes,
      icon: ClipboardList,
    },
    {
      href: "/dashboard/doctor/live-sessions",
      label: t.doctorDashboard.liveSessions,
      icon: Video,
    },
    {
      href: "/dashboard/doctor/courses",
      label: t.doctorDashboard.courses,
      icon: GraduationCap,
    },
    // {
    //   href: "/dashboard/doctor/revenue",
    //   label: t.doctorDashboard.revenue,
    //   icon: DollarSign,
    // },
    {
      href: "/dashboard/doctor/profile",
      label: t.profile.title,
      icon: UserCircle,
    },
  ];

  const navItems = role === "parent" ? parentNav : doctorNav;

  return (
    <aside className="flex h-screen w-64 flex-col border-e border-border bg-card">
      <div className="flex h-16 items-center gap-2 border-b border-border px-4">
        <Link href="/" className="flex items-center">
          <BrandLogo className="h-10" />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isOverviewHref =
              item.href === "/dashboard/parent" ||
              item.href === "/dashboard/doctor";
            const isActive = isOverviewHref
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
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <LanguageSwitcher />
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {isSigningOut ? t.common.loading : t.common.logout}
          </button>
        </div>
      </div>
    </aside>
  );
}
