import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { createMeetingToken } from "../lib/daily";
import {
  sendBookingConfirmation,
  sendCancellationEmail,
  sendRescheduleEmail,
} from "../lib/resend";

const CONSULTATION_CONFIG: Record<string, { duration: number; price: number }> = {
  quick: { duration: 15, price: 150 },
  standard: { duration: 30, price: 250 },
  extended: { duration: 45, price: 350 },
};

async function resolveParentEmail(userId: string): Promise<{ email: string; name: string } | null> {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = data?.user?.email ?? null;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .single();
  if (!email) return null;
  return { email, name: profile?.full_name ?? "Parent" };
}

export async function listAppointments(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select(`
      id,
      consultation_type,
      scheduled_date,
      scheduled_time,
      duration_minutes,
      price_aed,
      symptoms,
      status,
      payment_status,
      meeting_url,
      created_at,
      child_id,
      child_profiles!appointments_child_id_fkey (
        id,
        first_name,
        last_name
      ),
      doctors!appointments_doctor_id_fkey (
        id,
        full_name,
        specialty
      )
    `)
    .eq("parent_id", req.userId)
    .order("scheduled_date", { ascending: false })
    .order("scheduled_time", { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ appointments: data });
}

export async function getAppointment(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const { id } = req.params;

  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select(`
      id,
      consultation_type,
      scheduled_date,
      scheduled_time,
      duration_minutes,
      price_aed,
      symptoms,
      status,
      payment_status,
      payment_reference,
      meeting_url,
      cancellation_reason,
      created_at,
      child_profiles!appointments_child_id_fkey (
        id,
        first_name,
        last_name
      ),
      doctors!appointments_doctor_id_fkey (
        id,
        full_name,
        specialty,
        bio
      )
    `)
    .eq("id", id)
    .eq("parent_id", req.userId)
    .single();

  if (error) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  res.json({ appointment: data });
}

export async function createAppointment(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const { childId, doctorId, consultationType, date, time, symptoms } = req.body;

  if (!childId || !consultationType || !date || !time) {
    res.status(400).json({ error: "childId, consultationType, date, and time are required" });
    return;
  }

  const config = CONSULTATION_CONFIG[consultationType];
  if (!config) {
    res.status(400).json({ error: "consultationType must be quick, standard, or extended" });
    return;
  }

  // Verify the child belongs to this parent
  const { data: child, error: childError } = await supabaseAdmin
    .from("child_profiles")
    .select("id")
    .eq("id", childId)
    .eq("parent_id", req.userId)
    .single();

  if (childError || !child) {
    res.status(403).json({ error: "Child not found or not owned by this user" });
    return;
  }

  // If no doctorId provided, auto-assign the first available doctor
  let assignedDoctorId = doctorId;
  if (!assignedDoctorId) {
    const { data: doctors } = await supabaseAdmin
      .from("doctors")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!doctors) {
      res.status(503).json({ error: "No doctors available" });
      return;
    }
    assignedDoctorId = doctors.id;
  }

  // Verify the slot is still available (prevent double booking)
  const { data: conflict } = await supabaseAdmin
    .from("appointments")
    .select("id")
    .eq("doctor_id", assignedDoctorId)
    .eq("scheduled_date", date)
    .eq("scheduled_time", time)
    .not("status", "in", '("cancelled","rescheduled")')
    .limit(1);

  if (conflict && conflict.length > 0) {
    res.status(409).json({ error: "This time slot is no longer available" });
    return;
  }

  // Check if the parent has an active package credit matching this consultation type
  let paymentStatus = "paid";
  let paymentReference = `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  let usedPackageId: string | null = null;

  const now = new Date().toISOString();
  const { data: matchingPackages } = await supabaseAdmin
    .from("user_packages")
    .select("id, credits_remaining, consultation_packages(applicable_consultation_types)")
    .eq("user_id", req.userId)
    .eq("status", "active")
    .gt("credits_remaining", 0)
    .gt("expires_at", now)
    .order("expires_at", { ascending: true })
    .limit(10);

  if (matchingPackages) {
    for (const up of matchingPackages) {
      const pkg = up.consultation_packages as unknown as { applicable_consultation_types: string[] } | null;
      if (pkg?.applicable_consultation_types?.includes(consultationType)) {
        usedPackageId = up.id as string;
        break;
      }
    }
  }

  if (usedPackageId) {
    paymentStatus = "package_credit";
    paymentReference = `PKG-${usedPackageId}`;
  }

  const { data: appointment, error } = await supabaseAdmin
    .from("appointments")
    .insert({
      parent_id: req.userId,
      child_id: childId,
      doctor_id: assignedDoctorId,
      consultation_type: consultationType,
      scheduled_date: date,
      scheduled_time: time,
      duration_minutes: config.duration,
      price_aed: usedPackageId ? 0 : config.price,
      symptoms: symptoms ?? null,
      status: "confirmed",
      payment_status: paymentStatus,
      payment_reference: paymentReference,
    })
    .select("id, status, payment_reference, scheduled_date, scheduled_time, consultation_type, price_aed")
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Deduct credit from the matched package and log usage
  if (usedPackageId && appointment) {
    const { data: currentPkg } = await supabaseAdmin
      .from("user_packages")
      .select("credits_remaining")
      .eq("id", usedPackageId)
      .single();

    if (currentPkg) {
      const newRemaining = (currentPkg.credits_remaining as number) - 1;
      await supabaseAdmin
        .from("user_packages")
        .update({
          credits_remaining: newRemaining,
          status: newRemaining === 0 ? "exhausted" : "active",
        })
        .eq("id", usedPackageId);

      await supabaseAdmin
        .from("package_usage_logs")
        .insert({
          user_package_id: usedPackageId,
          appointment_id: appointment.id,
          credits_used: 1,
        });
    }
  }

  // Fire confirmation email (non-blocking)
  if (appointment) {
    resolveParentEmail(req.userId!).then(async (parent) => {
      if (!parent) return;
      const { data: doctor } = await supabaseAdmin!
        .from("doctors")
        .select("full_name")
        .eq("id", assignedDoctorId)
        .single();
      sendBookingConfirmation({
        appointmentId: appointment.id,
        parentEmail: parent.email,
        parentName: parent.name,
        parentUserId: req.userId,
        doctorName: doctor?.full_name ?? "Your doctor",
        scheduledDate: date,
        scheduledTime: time,
        consultationType: consultationType,
        durationMinutes: config.duration,
        priceAed: usedPackageId ? 0 : config.price,
      }).catch(() => {});
    }).catch(() => {});
  }

  res.status(201).json({
    appointment,
    usedPackageCredit: !!usedPackageId,
  });
}

export async function cancelAppointment(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const { id } = req.params;
  const { reason } = req.body;

  const { data: existing } = await supabaseAdmin
    .from("appointments")
    .select("id, status, scheduled_date, scheduled_time")
    .eq("id", id)
    .eq("parent_id", req.userId)
    .single();

  if (!existing) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  if (["cancelled", "completed"].includes(existing.status)) {
    res.status(400).json({ error: `Cannot cancel an appointment with status: ${existing.status}` });
    return;
  }

  const { error } = await supabaseAdmin
    .from("appointments")
    .update({
      status: "cancelled",
      cancellation_reason: reason ?? null,
      payment_status: "refunded",
    })
    .eq("id", id)
    .eq("parent_id", req.userId);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Fire cancellation email (non-blocking)
  resolveParentEmail(req.userId!).then(async (parent) => {
    if (!parent) return;
    const { data: apptFull } = await supabaseAdmin!
      .from("appointments")
      .select("scheduled_date, scheduled_time, doctors!appointments_doctor_id_fkey(full_name)")
      .eq("id", id)
      .single();
    if (!apptFull) return;
    const doc = apptFull.doctors as unknown as { full_name: string } | null;
    sendCancellationEmail({
      appointmentId: id as string,
      parentEmail: parent.email,
      parentName: parent.name,
      parentUserId: req.userId,
      doctorName: doc?.full_name ?? "Your doctor",
      scheduledDate: apptFull.scheduled_date,
      scheduledTime: apptFull.scheduled_time,
      consultationType: "",
      durationMinutes: 0,
    }).catch(() => {});
  }).catch(() => {});

  res.json({ message: "Appointment cancelled successfully" });
}

export async function joinAppointment(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const { id } = req.params;

  const { data: appt } = await supabaseAdmin
    .from("appointments")
    .select("id, status, meeting_url, parent_id, doctor_id, scheduled_date, scheduled_time, duration_minutes")
    .eq("id", id)
    .single();

  if (!appt) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  // Only the parent or the doctor can join
  const isParent = appt.parent_id === req.userId;
  if (!isParent) {
    // Check if user is the doctor for this appointment
    const { data: doctorRow } = await supabaseAdmin
      .from("doctors")
      .select("id")
      .eq("profile_id", req.userId)
      .single();
    const isDoctor = doctorRow && appt.doctor_id === doctorRow.id;
    if (!isDoctor) {
      res.status(403).json({ error: "Not authorized to join this appointment" });
      return;
    }
  }

  if (!appt.meeting_url) {
    res.status(400).json({ error: "Meeting room has not been started yet" });
    return;
  }

  const roomName = `appt-${id}`;
  const expiryEpoch = Math.floor(Date.now() / 1000) + 4 * 60 * 60;

  try {
    const token = await createMeetingToken(roomName, req.userId!, false, expiryEpoch);
    res.json({ tokenUrl: `${appt.meeting_url}?t=${token}` });
  } catch {
    // If token generation fails, return the base URL
    res.json({ tokenUrl: appt.meeting_url });
  }
}

export async function rescheduleAppointment(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const { id } = req.params;
  const { newDate, newTime } = req.body;

  if (!newDate || !newTime) {
    res.status(400).json({ error: "newDate and newTime are required" });
    return;
  }

  const { data: existing } = await supabaseAdmin
    .from("appointments")
    .select("id, status, doctor_id, consultation_type")
    .eq("id", id)
    .eq("parent_id", req.userId)
    .single();

  if (!existing) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  if (["cancelled", "completed", "rescheduled"].includes(existing.status)) {
    res.status(400).json({ error: `Cannot reschedule an appointment with status: ${existing.status}` });
    return;
  }

  // Check new slot is available
  const { data: conflict } = await supabaseAdmin
    .from("appointments")
    .select("id")
    .eq("doctor_id", existing.doctor_id)
    .eq("scheduled_date", newDate)
    .eq("scheduled_time", newTime)
    .not("status", "in", '("cancelled","rescheduled")')
    .neq("id", id)
    .limit(1);

  if (conflict && conflict.length > 0) {
    res.status(409).json({ error: "The requested time slot is not available" });
    return;
  }

  const { data: updated, error } = await supabaseAdmin
    .from("appointments")
    .update({
      scheduled_date: newDate,
      scheduled_time: newTime,
      status: "confirmed",
    })
    .eq("id", id)
    .eq("parent_id", req.userId)
    .select("id, scheduled_date, scheduled_time, status")
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Fire reschedule email (non-blocking)
  resolveParentEmail(req.userId!).then(async (parent) => {
    if (!parent) return;
    const { data: docRow } = await supabaseAdmin!
      .from("doctors")
      .select("full_name")
      .eq("id", existing.doctor_id)
      .single();
    sendRescheduleEmail({
      appointmentId: id as string,
      parentEmail: parent.email,
      parentName: parent.name,
      parentUserId: req.userId,
      doctorName: docRow?.full_name ?? "Your doctor",
      scheduledDate: newDate as string,
      scheduledTime: newTime as string,
      consultationType: existing.consultation_type as string,
      durationMinutes: 0,
    }).catch(() => {});
  }).catch(() => {});

  res.json({ appointment: updated });
}
