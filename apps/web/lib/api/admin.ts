import axios from "axios";
import { createClient } from "@/lib/supabase/client";
import { getApiBaseUrl } from "./config";

function getBaseUrl(): string {
  return getApiBaseUrl();
}

async function authHeaders(): Promise<Record<string, string>> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

async function get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const { data } = await axios.get<T>(`${getBaseUrl()}/admin${path}`, {
    headers: await authHeaders(),
    params,
  });
  return data;
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const { data } = await axios.patch<T>(`${getBaseUrl()}/admin${path}`, body, {
    headers: await authHeaders(),
  });
  return data;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const { data } = await axios.post<T>(`${getBaseUrl()}/admin${path}`, body, {
    headers: await authHeaders(),
  });
  return data;
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const { data } = await axios.put<T>(`${getBaseUrl()}/admin${path}`, body, {
    headers: await authHeaders(),
  });
  return data;
}

async function del(path: string): Promise<void> {
  await axios.delete(`${getBaseUrl()}/admin${path}`, { headers: await authHeaders() });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: "parent" | "doctor" | "admin";
  is_active: boolean;
  email: string | null;
  created_at: string;
  doctor?: AdminDoctorRow | null;
}

export interface AdminDoctorRow {
  id: string;
  full_name: string;
  specialty: string | null;
  bio?: string | null;
  is_active: boolean;
  /** Linked auth user. Null means the doctor is bookable but cannot sign in. */
  profile_id: string | null;
  avatar_url: string | null;
  /** IANA zone this doctor's working hours are expressed in. */
  timezone?: string;
  /** Where booking notifications go. Not a login. */
  email?: string | null;
}

/**
 * Result of syncing the doctors table with a role change. `ok: false` means the
 * role changed but the record did not follow — the user can sign in but their
 * doctor dashboard will not work, so it must not be reported as a success.
 */
export interface DoctorSyncNotice {
  ok: boolean;
  text: string;
}

export interface CreateDoctorPayload {
  full_name: string;
  specialty?: string;
  bio?: string;
  avatar_url?: string;
  /** Notification address. */
  email?: string;
  timezone?: string;
  /** Supply to give the doctor a login; omit for a bookable-only record. */
  account_email?: string;
  account_password?: string;
}

export interface AdminAppointment {
  id: string;
  consultation_type: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  price_aed: number;
  symptoms: string | null;
  status: string;
  payment_status: string;
  payment_reference: string | null;
  meeting_url: string | null;
  cancellation_reason: string | null;
  created_at: string;
  parent_id: string;
  // Only the appointment list resolves this; endpoints that return a lighter
  // appointment row (dashboard stats) leave it undefined.
  parent_name?: string | null;
  child_profiles: { id: string; first_name: string; last_name: string } | null;
  doctors: { id: string; full_name: string; specialty: string | null } | null;
}

export interface ConsultationType {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_aed: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  price_aed: number;
  payment_status: string;
  payment_reference: string | null;
  created_at: string;
  scheduled_date: string;
  parent_id: string;
  doctors: { full_name: string } | null;
  child_profiles: { first_name: string; last_name: string } | null;
}

export interface ChildProfile {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string | null;
  parent_id: string;
  created_at: string;
  [key: string]: unknown;
}

export interface MedicalNote {
  id: string;
  record_type: string;
  title: string;
  chief_complaint: string | null;
  diagnosis: string | null;
  treatment_plan: string | null;
  follow_up_date: string | null;
  follow_up_notes: string | null;
  outcome: string | null;
  created_at: string;
  doctors: { id: string; full_name: string } | null;
  child_profiles: { id: string; first_name: string; last_name: string } | null;
}

export interface EmailLog {
  id: string;
  recipient_email: string;
  recipient_user_id: string | null;
  email_type: string;
  related_id: string | null;
  status: "sent" | "failed";
  resend_id: string | null;
  error_message: string | null;
  created_at: string;
}

export interface CalendarIntegrationStatus {
  /** False when the server is missing the GOOGLE_* env vars entirely. */
  configured: boolean;
  connected: boolean;
  email?: string;
  status?: "connected" | "error";
  lastError?: string | null;
  connectedAt?: string;
}

export interface CalendarAccount {
  id: string;
  googleEmail: string;
  status: "connected" | "error";
  lastError: string | null;
  connectedAt: string;
  /** userId is null for the clinic-wide account. */
  owner: { userId: string | null; fullName: string | null; role: string };
}

export interface CalendarEventLog {
  id: string;
  action: "create" | "update" | "delete";
  related_type: "appointment" | "group_session";
  related_id: string | null;
  google_event_id: string | null;
  status: "sent" | "failed";
  error_message: string | null;
  created_at: string;
}

export interface AdminStats {
  totalBookings: number | null;
  todayAppointments: number | null;
  recentPayments: Payment[];
  newUsers: number | null;
  recentAppointments: AdminAppointment[];
}

export interface DoctorScheduleSlot {
  id?: string;
  doctor_id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const adminApi = {
  // Stats
  getStats: () => get<AdminStats>("/stats"),

  // Users
  listUsers: (params?: { role?: string; search?: string; page?: number; limit?: number }) =>
    get<{ users: AdminUser[]; total: number; page: number; limit: number }>("/users", params as Record<string, string | number | undefined>),
  getUser: (id: string) => get<{ user: AdminUser }>(`/users/${id}`),
  // `notice` explains any side effect of a role change — promoting to doctor
  // creates their (inactive) doctor record, demoting retires it.
  updateUser: (id: string, data: Partial<Pick<AdminUser, "full_name" | "phone" | "is_active" | "role">>) =>
    patch<{ user: AdminUser; notice?: DoctorSyncNotice | null }>(`/users/${id}`, data),
  createUser: (data: {
    email: string;
    password: string;
    full_name?: string;
    phone?: string;
    role: AdminUser["role"];
  }) => post<{ user: AdminUser; notice?: DoctorSyncNotice | null }>("/users", data),
  deleteUser: (id: string) => del(`/users/${id}`),

  // Appointments
  listAppointments: (params?: { date?: string; doctorId?: string; status?: string; page?: number; limit?: number }) =>
    get<{ appointments: AdminAppointment[]; total: number; page: number; limit: number }>("/appointments", params as Record<string, string | number | undefined>),
  updateAppointment: (id: string, action: string, extras?: { newDate?: string; newTime?: string; cancellationReason?: string }) =>
    patch<{ appointment: AdminAppointment }>(`/appointments/${id}`, { action, ...extras }),

  // Doctors
  listDoctors: () => get<{ doctors: AdminDoctorRow[] }>("/doctors"),
  // The timezone is a doctor attribute, not part of the schedule collection:
  // bundling it into the schedule PUT (which deletes and reinserts every row)
  // would let a mid-load doctor switch write one doctor's zone onto another.
  createDoctor: (data: CreateDoctorPayload) =>
    post<{ doctor: AdminDoctorRow }>("/doctors", data),
  updateDoctor: (
    doctorId: string,
    data: Partial<
      Pick<
        AdminDoctorRow,
        "full_name" | "specialty" | "bio" | "avatar_url" | "email" | "timezone" | "is_active"
      >
    >
  ) => patch<{ doctor: AdminDoctorRow }>(`/doctors/${doctorId}`, data),
  /** Create or link the login for an existing doctor record. */
  linkDoctorAccount: (
    doctorId: string,
    data: { account_email: string; account_password?: string }
  ) => post<{ doctor: AdminDoctorRow; created: boolean }>(`/doctors/${doctorId}/account`, data),
  getDoctorSchedule: (doctorId: string) =>
    get<{ schedule: DoctorScheduleSlot[]; timezone: string }>(`/doctors/${doctorId}/schedule`),
  updateDoctorSchedule: (doctorId: string, slots: Omit<DoctorScheduleSlot, "id" | "doctor_id">[]) =>
    put<{ ok: boolean }>(`/doctors/${doctorId}/schedule`, { slots }),
  getDoctorHolidays: (doctorId: string) => get<{ holidays: Array<{ id: string; doctor_id: string; holiday_date: string; reason: string | null }> }>(`/doctors/${doctorId}/holidays`),
  addDoctorHoliday: (doctorId: string, holiday_date: string, reason?: string) =>
    post<{ holiday: { id: string } }>(`/doctors/${doctorId}/holidays`, { holiday_date, reason }),
  deleteDoctorHoliday: (holidayId: string) => del(`/holidays/${holidayId}`),

  // Consultation types
  listConsultationTypes: () => get<{ consultationTypes: ConsultationType[] }>("/consultation-types"),
  createConsultationType: (data: Omit<ConsultationType, "id" | "created_at" | "updated_at">) =>
    post<{ consultationType: ConsultationType }>("/consultation-types", data),
  updateConsultationType: (id: string, data: Partial<ConsultationType>) =>
    patch<{ consultationType: ConsultationType }>(`/consultation-types/${id}`, data),

  // Payments
  listPayments: (params?: { status?: string; page?: number; limit?: number }) =>
    get<{ payments: Payment[]; total: number; page: number; limit: number }>("/payments", params as Record<string, string | number | undefined>),

  // Patients
  listPatients: (params?: { search?: string; page?: number; limit?: number }) =>
    get<{ patients: ChildProfile[]; total: number; page: number; limit: number }>("/patients", params as Record<string, string | number | undefined>),
  getPatient: (id: string) =>
    get<{ child: ChildProfile; parent: AdminUser; files: unknown[]; records: unknown[]; appointments: unknown[] }>(`/patients/${id}`),

  // Notes
  listNotes: (params?: { doctorId?: string; childId?: string; page?: number; limit?: number }) =>
    get<{ notes: MedicalNote[]; total: number; page: number; limit: number }>("/notes", params as Record<string, string | number | undefined>),

  // Email logs
  listEmailLogs: (params?: { status?: string; email_type?: string; page?: number; limit?: number }) =>
    get<{ emailLogs: EmailLog[]; total: number; page: number; limit: number }>("/email-logs", params as Record<string, string | number | undefined>),

  // Google Calendar integration
  getGoogleCalendarStatus: () => get<CalendarIntegrationStatus>("/google-calendar/status"),
  connectGoogleCalendar: () => post<{ url: string }>("/google-calendar/connect", {}),
  disconnectGoogleCalendar: () => del("/google-calendar"),
  listCalendarAccounts: () => get<{ accounts: CalendarAccount[] }>("/google-calendar/accounts"),
  listCalendarLogs: (params?: { status?: string; related_type?: string; page?: number; limit?: number }) =>
    get<{ calendarLogs: CalendarEventLog[]; total: number; page: number; limit: number }>("/calendar-logs", params as Record<string, string | number | undefined>),
};
