"use client";

import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { DoctorOverview } from "@/components/dashboard/doctor/doctor-overview";

export default function DoctorDashboardPage() {
  return (
    <DashboardLayout role="doctor">
      <DoctorOverview />
    </DashboardLayout>
  );
}
