import axios from "axios";
import { createClient } from "@/lib/supabase/client";
import { getApiBaseUrl } from "./config";
import type {
  AttendanceOutcome,
  RefundOption,
  RefundRequestStatus,
} from "@/types/appointment";

function getBaseUrl(): string {
  return getApiBaseUrl();
}

async function authHeaders(): Promise<Record<string, string>> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DoctorAppointment {
  id: string;
  parent_id: string;
  parent_name: string | null;
  consultation_type: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  price_aed: number;
  symptoms: string | null;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "rescheduled";
  payment_status: string;
  attendance_outcome: AttendanceOutcome | null;
  /** At most one, per the UNIQUE constraint on refund_requests.appointment_id. */
  refund_requests?: Array<{
    id: string;
    requested_remedy: RefundOption;
    status: RefundRequestStatus;
  }>;
  meeting_url: string | null;
  created_at: string;
  child_profiles: {
    id: string;
    first_name: string;
    last_name: string;
    date_of_birth: string;
  } | null;
}

/** A request in the doctor's review queue, with the consultation it concerns. */
export interface DoctorRefundRequest {
  id: string;
  appointment_id: string;
  parent_id: string;
  parent_name: string | null;
  requested_remedy: RefundOption;
  reason: string | null;
  status: RefundRequestStatus;
  resolution_note: string | null;
  resolved_at: string | null;
  refund_amount_aed: number | null;
  created_at: string;
  appointments: {
    scheduled_date: string;
    scheduled_time: string;
    timezone: string | null;
    consultation_type: string;
    price_aed: number;
    payment_status: string;
    attendance_outcome: AttendanceOutcome | null;
    child_profiles: { first_name: string; last_name: string } | null;
  } | null;
}

export interface DoctorStats {
  todayAppointments: number;
  totalPatients: number;
  pendingNotes: number;
  monthlyRevenue: number;
}

export interface DoctorPatient {
  child_id: string;
  guardian_name: string;
  last_visit: string;
  total_appointments: number;
  child: {
    id: string;
    first_name: string;
    last_name: string;
    date_of_birth: string;
  } | null;
}

export interface ScheduleRow {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active?: boolean;
}

export interface DoctorHoliday {
  id: string;
  holiday_date: string;
  reason: string | null;
  created_at: string;
}

export interface DoctorProfile {
  id: string;
  full_name: string;
  specialty: string;
  bio: string | null;
  avatar_url: string | null;
  is_active: boolean;
  profile_id: string | null;
  /** IANA zone the doctor's working hours are expressed in. */
  timezone?: string;
  /** Where booking notifications go. Not a login — see migration 019. */
  email?: string | null;
}

// ─── API client ───────────────────────────────────────────────────────────────

export const doctorApi = {
  async getMe(): Promise<DoctorProfile> {
    const { data } = await axios.get<{ doctor: DoctorProfile }>(
      `${getBaseUrl()}/doctor/me`,
      { headers: await authHeaders() }
    );
    return data.doctor;
  },

  async getStats(): Promise<DoctorStats> {
    const { data } = await axios.get<DoctorStats>(
      `${getBaseUrl()}/doctor/stats`,
      { headers: await authHeaders() }
    );
    return data;
  },

  /** Appointments plus the doctor's timezone — the zone their times are in. */
  async getAppointments(
    date?: string
  ): Promise<{ appointments: DoctorAppointment[]; timezone: string }> {
    const { data } = await axios.get<{
      appointments: DoctorAppointment[];
      timezone: string;
    }>(`${getBaseUrl()}/doctor/appointments`, {
      headers: await authHeaders(),
      params: date ? { date } : {},
    });
    return { appointments: data.appointments, timezone: data.timezone };
  },

  async startSession(id: string): Promise<void> {
    await axios.patch(
      `${getBaseUrl()}/doctor/appointments/${id}/start`,
      {},
      { headers: await authHeaders() }
    );
  },

  async completeAppointment(id: string): Promise<void> {
    await axios.patch(
      `${getBaseUrl()}/doctor/appointments/${id}/complete`,
      {},
      { headers: await authHeaders() }
    );
  },

  // ── Refund requests ───────────────────────────────────────────────────────

  async getRefundRequests(status?: RefundRequestStatus): Promise<DoctorRefundRequest[]> {
    const { data } = await axios.get<{ requests: DoctorRefundRequest[] }>(
      `${getBaseUrl()}/doctor/refund-requests`,
      { headers: await authHeaders(), params: status ? { status } : undefined }
    );
    return data.requests;
  },

  async resolveRefundRequest(
    id: string,
    action: "approve" | "decline",
    note?: string
  ): Promise<void> {
    await axios.patch(
      `${getBaseUrl()}/doctor/refund-requests/${id}`,
      { action, note },
      { headers: await authHeaders() }
    );
  },

  async getPatients(): Promise<DoctorPatient[]> {
    const { data } = await axios.get<{ patients: DoctorPatient[] }>(
      `${getBaseUrl()}/doctor/patients`,
      { headers: await authHeaders() }
    );
    return data.patients;
  },

  /**
   * Working hours plus the timezone they are wall-clock in. The times are bare
   * TIME values, so the zone is required to interpret them.
   */
  async getSchedule(): Promise<{ schedule: ScheduleRow[]; timezone: string }> {
    const { data } = await axios.get<{ schedule: ScheduleRow[]; timezone: string }>(
      `${getBaseUrl()}/doctor/schedule`,
      { headers: await authHeaders() }
    );
    return { schedule: data.schedule, timezone: data.timezone };
  },

  async updateSchedule(rows: ScheduleRow[]): Promise<ScheduleRow[]> {
    const { data } = await axios.put<{ schedule: ScheduleRow[] }>(
      `${getBaseUrl()}/doctor/schedule`,
      { rows },
      { headers: await authHeaders() }
    );
    return data.schedule;
  },

  async updateProfile(payload: {
    full_name?: string;
    specialty?: string;
    bio?: string;
    avatar_url?: string;
    // Belongs to the doctor, not the schedule rows — deliberately not part of
    // updateSchedule, which replaces every row wholesale.
    timezone?: string;
    /** Notification address; empty string clears it. */
    email?: string;
  }): Promise<DoctorProfile> {
    const { data } = await axios.patch<{ doctor: DoctorProfile }>(
      `${getBaseUrl()}/doctor/profile`,
      payload,
      { headers: await authHeaders() }
    );
    return data.doctor;
  },

  async getHolidays(): Promise<DoctorHoliday[]> {
    const { data } = await axios.get<{ holidays: DoctorHoliday[] }>(
      `${getBaseUrl()}/doctor/holidays`,
      { headers: await authHeaders() }
    );
    return data.holidays;
  },

  async addHoliday(holiday_date: string, reason?: string): Promise<DoctorHoliday> {
    const { data } = await axios.post<{ holiday: DoctorHoliday }>(
      `${getBaseUrl()}/doctor/holidays`,
      { holiday_date, reason },
      { headers: await authHeaders() }
    );
    return data.holiday;
  },

  async deleteHoliday(id: string): Promise<void> {
    await axios.delete(`${getBaseUrl()}/doctor/holidays/${id}`, {
      headers: await authHeaders(),
    });
  },
};
