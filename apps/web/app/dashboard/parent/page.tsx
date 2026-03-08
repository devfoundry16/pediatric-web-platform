"use client";

import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ParentOverview } from "@/components/dashboard/parent/parent-overview";

export default function ParentDashboardPage() {
  return (
    <DashboardLayout role="parent">
      <ParentOverview />
    </DashboardLayout>
  );
}
