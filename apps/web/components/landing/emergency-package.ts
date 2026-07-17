"use client";

import { useI18n } from "@/lib/i18n/i18n-context";

/**
 * Single source of truth for the "Emergency Priority" care package, shared
 * between the Hero section (highlighted callout) and the Care Packages
 * section (full pricing card) so the two stay in sync.
 */
export function useEmergencyPackage() {
  const { dictionary: t } = useI18n();

  return {
    slug: "emergency_priority",
    name: t.landing.emergencyPriority,
    desc: t.landing.emergencyPriorityDesc,
    sessions: 1,
    validity: 7,
    price: 350,
  };
}
