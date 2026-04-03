"use client";

import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { DashboardProfile } from "@/components/dashboard/dashboard-profile";

export default function ParentProfilePage() {
  return (
    <DashboardLayout role="parent">
      <DashboardProfile role="parent" />
    </DashboardLayout>
  );
}
