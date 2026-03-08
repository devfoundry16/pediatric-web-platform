"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/i18n-context";
import { LanguageSwitcher } from "@/components/language-switcher";
import { cn } from "@/lib/utils";
import {
  Heart,
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
      href: "/dashboard/parent/files",
      label: t.parentDashboard.files,
      icon: Paperclip,
    },
  ];

  const doctorNav: NavItem[] = [
    {
      href: "/dashboard/doctor",
      label: t.doctorDashboard.todaySchedule,
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
    {
      href: "/dashboard/doctor/revenue",
      label: t.doctorDashboard.revenue,
      icon: DollarSign,
    },
  ];

  const navItems = role === "parent" ? parentNav : doctorNav;

  return (
    <aside className="flex h-screen w-64 flex-col border-e border-border bg-card">
      <div className="flex h-16 items-center gap-2 border-b border-border px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Heart className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold text-foreground">
            {t.common.appName}
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
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
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center justify-between">
          <LanguageSwitcher />
          <button className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <LogOut className="h-4 w-4" />
            <span className="sr-only">{t.common.logout}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
