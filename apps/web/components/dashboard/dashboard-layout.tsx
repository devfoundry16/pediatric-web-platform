"use client";

import React from "react";

import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardMobileNav } from "./dashboard-mobile-nav";

interface DashboardLayoutProps {
  role: "parent" | "doctor";
  children: React.ReactNode;
}

export function DashboardLayout({ role, children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden lg:block">
        <DashboardSidebar role={role} />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardMobileNav role={role} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
