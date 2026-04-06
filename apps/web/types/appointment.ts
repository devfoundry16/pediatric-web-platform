export type ConsultationTypeId = "quick" | "standard" | "extended";

export interface ConsultationType {
  id: ConsultationTypeId;
  name: string;
  duration: number;
  price: number;
}

export const CONSULTATION_TYPES: ConsultationType[] = [
  { id: "quick", name: "Quick Consultation", duration: 15, price: 150 },
  { id: "standard", name: "Standard Consultation", duration: 30, price: 250 },
  { id: "extended", name: "Extended Consultation", duration: 45, price: 350 },
];

export interface Doctor {
  id: string;
  full_name: string;
  specialty: string;
  bio?: string;
  avatar_url?: string;
}

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "rescheduled";

export type PaymentStatus = "pending" | "paid" | "refunded";

export interface AppointmentChild {
  id: string;
  first_name: string;
  last_name: string;
}

export interface Appointment {
  id: string;
  consultation_type: ConsultationTypeId;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  price_aed: number;
  symptoms: string | null;
  status: AppointmentStatus;
  payment_status: PaymentStatus;
  payment_reference?: string;
  meeting_url?: string | null;
  cancellation_reason?: string | null;
  created_at: string;
  child_id: string;
  child_profiles: AppointmentChild;
  doctors: Pick<Doctor, "id" | "full_name" | "specialty">;
}

export interface CreateAppointmentPayload {
  childId: string;
  doctorId?: string;
  consultationType: ConsultationTypeId;
  date: string;
  time: string;
  symptoms?: string;
}

export interface BookingFormData {
  childId: string;
  doctorId: string;
  typeId: ConsultationTypeId | "";
  date: string;
  time: string;
  symptoms: string;
}
