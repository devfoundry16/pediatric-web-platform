"use client";

import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { DashboardProfile } from "@/components/dashboard/dashboard-profile";

export default function DoctorProfilePage() {
  return (
    <DashboardLayout role="doctor">
      <DashboardProfile role="doctor" />
    </DashboardLayout>
  );
}
