// Legacy tiers (quick/standard/extended) are kept in the union so historical
// appointments still type-check; new bookings use the single `consultation`.
export type ConsultationTypeId =
  | "quick"
  | "standard"
  | "extended"
  | "consultation";

export interface ConsultationType {
  id: ConsultationTypeId;
  name: string;
  duration: number;
  price: number;
}

// The single bookable consultation (booking redesign). Legacy tiers are no
// longer offered but remain valid values for existing records.
export const CONSULTATION_TYPES: ConsultationType[] = [
  { id: "consultation", name: "Consultation", duration: 30, price: 350 },
];

// Every consultation type, including retired tiers, for labelling historical
// appointments.
export const ALL_CONSULTATION_TYPES: ConsultationType[] = [
  { id: "consultation", name: "Consultation", duration: 30, price: 350 },
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
  /** Wall-clock in `timezone` below — not UTC, not the viewer's local time. */
  scheduled_date: string;
  scheduled_time: string;
  /**
   * IANA zone the two fields above are expressed in, snapshotted from the
   * doctor at booking time. Optional only for rows read before migration 018.
   */
  timezone?: string;
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
  /**
   * Documents already uploaded to Storage during the symptoms step. Only the
   * metadata travels here; the API verifies each path belongs to childId
   * before linking it to the new appointment.
   */
  attachments?: {
    fileName: string;
    fileType: string;
    storagePath: string;
    fileSizeBytes: number;
  }[];
}

export interface BookingFormData {
  childId: string;
  doctorId: string;
  typeId: ConsultationTypeId | "";
  date: string;
  time: string;
  symptoms: string;
}
