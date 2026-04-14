export interface ConsultationPackage {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sessions: number;
  duration_minutes: number;
  price_aed: number;
  validity_days: number;
  applicable_consultation_types: string[];
  is_active: boolean;
  created_at: string;
}

export type UserPackageStatus = "active" | "expired" | "exhausted" | "cancelled";

export interface UserPackage {
  id: string;
  credits_total: number;
  credits_remaining: number;
  expires_at: string;
  status: UserPackageStatus;
  purchased_at: string;
  stripe_checkout_session_id: string | null;
  consultation_packages: ConsultationPackage;
}

export interface PackageUsageLog {
  id: string;
  user_package_id: string;
  appointment_id: string | null;
  credits_used: number;
  created_at: string;
  appointments: {
    id: string;
    scheduled_date: string;
    scheduled_time: string;
    consultation_type: string;
    doctors: { full_name: string } | null;
  } | null;
  user_packages: {
    user_id: string;
    consultation_packages: { name: string; slug: string } | null;
  } | null;
}
