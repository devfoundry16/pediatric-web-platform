import axios from "axios";
import { createClient } from "@/lib/supabase/client";

function getBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
  return base.replace(/\/$/, "");
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
  meeting_url: string | null;
  created_at: string;
  child_profiles: {
    id: string;
    first_name: string;
    last_name: string;
    date_of_birth: string;
  } | null;
}

export interface DoctorStats {
  todayAppointments: number;
  totalPatients: number;
  pendingNotes: number;
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
}

// ─── API client ───────────────────────────────────────────────────────────────

export const doctorApi = {
  async getMe() {
    const { data } = await axios.get(`${getBaseUrl()}/doctor/me`, {
      headers: await authHeaders(),
    });
    return data.doctor;
  },

  async getStats(): Promise<DoctorStats> {
    const { data } = await axios.get<DoctorStats>(
      `${getBaseUrl()}/doctor/stats`,
      { headers: await authHeaders() }
    );
    return data;
  },

  async getAppointments(date?: string): Promise<DoctorAppointment[]> {
    const { data } = await axios.get<{ appointments: DoctorAppointment[] }>(
      `${getBaseUrl()}/doctor/appointments`,
      { headers: await authHeaders(), params: date ? { date } : {} }
    );
    return data.appointments;
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

  async getPatients(): Promise<DoctorPatient[]> {
    const { data } = await axios.get<{ patients: DoctorPatient[] }>(
      `${getBaseUrl()}/doctor/patients`,
      { headers: await authHeaders() }
    );
    return data.patients;
  },

  async getSchedule(): Promise<ScheduleRow[]> {
    const { data } = await axios.get<{ schedule: ScheduleRow[] }>(
      `${getBaseUrl()}/doctor/schedule`,
      { headers: await authHeaders() }
    );
    return data.schedule;
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
