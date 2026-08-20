import { z } from "zod";

// ─── Domain types ─────────────────────────────────────────────────────────────

export const RECORD_TYPES = [
  "consultation_note",
  "prescription",
  "diagnosis",
  "vitals",
  "other",
] as const;

export type RecordType = (typeof RECORD_TYPES)[number];

export interface Vitals {
  weight_kg?: number | null;
  height_cm?: number | null;
  temp_c?: number | null;
  heart_rate?: number | null;
  oxygen_saturation?: number | null;
}

export interface MedicalRecordChild {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
}

export interface MedicalRecordDoctor {
  id: string;
  full_name: string;
  specialty: string;
}

export interface MedicalRecord {
  id: string;
  record_type: RecordType;
  title: string;
  notes: string | null;
  diagnosis: string | null;
  prescription: string | null;
  vitals: Vitals | null;
  created_at: string;
  updated_at: string;
  appointment_id: string | null;
  child_id: string;
  child_profiles: MedicalRecordChild | null;
  doctors: MedicalRecordDoctor | null;
}

export interface MedicalFile {
  id: string;
  file_name: string;
  file_type: string;
  /** Legacy column. The bucket is private, so this is not a usable link. */
  file_url: string;
  /** Short-lived signed URL minted by the API. Null if it could not be signed. */
  signed_url: string | null;
  storage_path: string | null;
  file_size_bytes: number | null;
  created_at: string;
  child_id: string;
  record_id: string | null;
  appointment_id: string | null;
  uploaded_by: string;
  child_profiles: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

// ─── Form schemas ─────────────────────────────────────────────────────────────

export const vitalsSchema = z.object({
  weight_kg: z.coerce.number().positive().optional().or(z.literal("")),
  height_cm: z.coerce.number().positive().optional().or(z.literal("")),
  temp_c: z.coerce.number().min(30).max(45).optional().or(z.literal("")),
  heart_rate: z.coerce.number().positive().optional().or(z.literal("")),
  oxygen_saturation: z.coerce.number().min(50).max(100).optional().or(z.literal("")),
});

export const medicalRecordFormSchema = z.object({
  childId: z.string().min(1, "Select a child"),
  appointmentId: z.string().optional(),
  recordType: z.enum(RECORD_TYPES),
  title: z.string().min(1, "Title is required").max(200),
  notes: z.string().max(5000).optional(),
  diagnosis: z.string().max(1000).optional(),
  prescription: z.string().max(2000).optional(),
  vitals: vitalsSchema.optional(),
});

export type MedicalRecordFormValues = z.infer<typeof medicalRecordFormSchema>;
