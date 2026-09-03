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

export type PaymentStatus =
  | "pending"
  | "paid"
  | "refunded"
  | "package_credit";

/**
 * Who joined a consultation, decided by the attendance sweep once the join
 * window closed. `null` means not yet decided — never read it as "nobody came".
 */
export type AttendanceOutcome =
  | "both_joined"
  | "parent_only"
  | "doctor_only"
  | "neither";

/** What a parent can ask for after a missed consultation. */
export type RemedyKind = "refund" | "free_session";

export type RemedyStatus = "pending" | "approved" | "declined";

export interface RemedyRequest {
  id: string;
  requested_remedy: RemedyKind;
  status: RemedyStatus;
  reason: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
}

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
  attendance_outcome?: AttendanceOutcome | null;
  /**
   * The claim raised against this consultation, if any. Embedded as an array by
   * PostgREST because the FK points this way, but the UNIQUE constraint on
   * refund_requests.appointment_id means it holds at most one row.
   */
  refund_requests?: RemedyRequest[];
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
