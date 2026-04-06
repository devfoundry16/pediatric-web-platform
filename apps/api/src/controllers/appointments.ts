import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";

const CONSULTATION_CONFIG: Record<string, { duration: number; price: number }> = {
  quick: { duration: 15, price: 150 },
  standard: { duration: 30, price: 250 },
  extended: { duration: 45, price: 350 },
};

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

  // Mock payment reference
  const paymentReference = `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

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
      price_aed: config.price,
      symptoms: symptoms ?? null,
      status: "confirmed",
      // Mock payment: mark as paid immediately
      // TODO: Replace with real payment gateway (Stripe/Telr) before production
      payment_status: "paid",
      payment_reference: paymentReference,
    })
    .select("id, status, payment_reference, scheduled_date, scheduled_time, consultation_type, price_aed")
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(201).json({ appointment });
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

  res.json({ message: "Appointment cancelled successfully" });
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

  res.json({ appointment: updated });
}
