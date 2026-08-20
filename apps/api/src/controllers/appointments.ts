import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { createMeetingToken } from "../lib/daily";
import { getStripe } from "../lib/stripe";
import {
  sendCancellationEmail,
  sendRescheduleEmail,
} from "../lib/resend";
import { notifyBookingConfirmed } from "../lib/booking-notifications";
import { syncAppointmentCalendarEvent } from "../lib/google-calendar";
import {
  appointmentJoinWindow,
  appointmentRoomName,
  deleteAppointmentRoom,
  ensureAppointmentRoom,
} from "../lib/appointment-room";
import {
  saveBookingAttachments,
  signMedicalFiles,
  validateAttachments,
} from "../lib/medical-storage";
import { CONSULTATION_CONFIG, isBlockingAppointment } from "../lib/consultation";
import { generateSlots } from "../lib/slots";
import { hhmmToMinutes } from "../lib/timezone";

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
      timezone,
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
      timezone,
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

  const { childId, doctorId, consultationType, date, time, symptoms, attachments } = req.body;

  if (!childId || !consultationType || !date || !time) {
    res.status(400).json({ error: "childId, consultationType, date, and time are required" });
    return;
  }

  const config = CONSULTATION_CONFIG[consultationType];
  if (!config) {
    res.status(400).json({ error: "Invalid consultationType" });
    return;
  }

  // Documents the parent attached while booking. Uploaded browser → Storage,
  // so the metadata arrives from the client and is checked before it is
  // trusted — in particular that each path sits under this child's folder.
  const parsedAttachments = validateAttachments(attachments, String(childId));
  if (!parsedAttachments.ok) {
    res.status(400).json({ error: parsedAttachments.error });
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

  // `time` must be a slot this doctor is actually offering, in THEIR timezone.
  // The client only echoes back a value the server produced, but the booking UI
  // now renders a converted time beside the canonical one — submitting the wrong
  // one would create a real, paid appointment hours off, and nothing downstream
  // would catch it (any "HH:MM" is a legal TIME, and the conflict check below is
  // exact-equality only). This also pins the zone the row is stored in.
  const { timezone: doctorTimezone, slots: offered } = await generateSlots(
    assignedDoctorId,
    date,
    consultationType
  );

  const requestedMinutes = hhmmToMinutes(time);
  if (!offered.some((s) => hhmmToMinutes(s.time) === requestedMinutes)) {
    res.status(400).json({ error: "That time is not available for this doctor" });
    return;
  }

  // Re-check immediately before insert to close the gap between slot generation
  // and this write (two parents booking the same slot concurrently).
  const { data: conflicts } = await supabaseAdmin
    .from("appointments")
    .select("id, status, payment_status, created_at")
    .eq("doctor_id", assignedDoctorId)
    .eq("scheduled_date", date)
    .eq("scheduled_time", time)
    .not("status", "in", '("cancelled","rescheduled")');

  const blocking = (conflicts ?? []).filter((c) => isBlockingAppointment(c));

  if (blocking.length > 0) {
    res.status(409).json({ error: "This time slot is no longer available" });
    return;
  }

  // Try to cover this booking with an active package credit matching the
  // consultation type; otherwise it becomes a one-time paid consult settled
  // through Stripe.
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

  // Atomically reserve a package credit BEFORE creating the appointment. This
  // guarded decrement (see consume_package_credit) prevents two concurrent
  // bookings from consuming the same credit. If reservation fails (exhausted,
  // expired, or lost the race), fall back to the one-time paid path.
  if (usedPackageId) {
    const { data: consumed, error: consumeError } = await supabaseAdmin.rpc(
      "consume_package_credit",
      { p_user_package_id: usedPackageId }
    );
    if (consumeError || consumed !== true) {
      usedPackageId = null;
    }
  }

  // Package credit → confirmed & free. No credit → pending, awaiting Stripe
  // payment (see createAppointmentCheckout + the webhook that flips it to paid).
  const paymentStatus = usedPackageId ? "package_credit" : "pending";
  const status = usedPackageId ? "confirmed" : "pending";
  const paymentReference = usedPackageId ? `PKG-${usedPackageId}` : null;

  const { data: appointment, error } = await supabaseAdmin
    .from("appointments")
    .insert({
      parent_id: req.userId,
      child_id: childId,
      doctor_id: assignedDoctorId,
      consultation_type: consultationType,
      scheduled_date: date,
      scheduled_time: time,
      // Snapshot the zone the wall clock above is expressed in, so a later
      // change to doctors.timezone doesn't reinterpret this appointment.
      timezone: doctorTimezone,
      duration_minutes: config.duration,
      price_aed: usedPackageId ? 0 : config.price,
      symptoms: symptoms ?? null,
      status,
      payment_status: paymentStatus,
      payment_reference: paymentReference,
    })
    .select("id, status, payment_status, payment_reference, scheduled_date, scheduled_time, timezone, consultation_type, price_aed")
    .single();

  if (error) {
    // Give back the reserved credit so it isn't lost when the booking fails.
    if (usedPackageId) {
      await supabaseAdmin.rpc("restore_package_credit", {
        p_user_package_id: usedPackageId,
      });
    }
    res.status(500).json({ error: error.message });
    return;
  }

  // Link the uploaded documents now that there is an appointment to hang them
  // off. Awaited so the doctor sees them the moment the booking appears, but
  // it never throws: the booking is committed and must not fail over a file.
  if (appointment) {
    await saveBookingAttachments({
      attachments: parsedAttachments.attachments,
      childId: String(childId),
      appointmentId: appointment.id as string,
      uploadedBy: req.userId!,
    });
  }

  // Credit was already reserved above — just record the usage log.
  if (usedPackageId && appointment) {
    await supabaseAdmin
      .from("package_usage_logs")
      .insert({
        user_package_id: usedPackageId,
        appointment_id: appointment.id,
        credits_used: 1,
      });
  }

  // Notify parent, doctor and admins — but only once the booking is actually
  // confirmed, which on the credit path is now. A one-time paid consult is
  // still pending here; it is notified when Stripe settles (webhook, or the
  // verify fallback).
  if (appointment && usedPackageId) {
    void notifyBookingConfirmed(appointment.id);
    void syncAppointmentCalendarEvent(appointment.id);
  }

  res.status(201).json({
    appointment,
    usedPackageCredit: !!usedPackageId,
    requiresPayment: !usedPackageId,
  });
}

// POST /api/appointments/:id/checkout
// Mints a Stripe Checkout session for a pending one-time consultation. The
// webhook (in controllers/packages.ts) flips the appointment to paid/confirmed
// once payment settles.
export async function createAppointmentCheckout(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const stripe = getStripe();
  if (!stripe) {
    res.status(500).json({ error: "Payment service not configured" });
    return;
  }

  const { id } = req.params;

  const { data: appt, error: apptError } = await supabaseAdmin
    .from("appointments")
    .select("id, price_aed, status, payment_status, consultation_type")
    .eq("id", id)
    .eq("parent_id", req.userId)
    .single();

  if (apptError || !appt) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  if (appt.payment_status !== "pending" || appt.status !== "pending") {
    res.status(400).json({ error: "Appointment is not awaiting payment" });
    return;
  }

  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3333";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "aed",
          unit_amount: Math.round(Number(appt.price_aed) * 100),
          product_data: {
            name: "Consultation",
            description: "One-time pediatric consultation",
            metadata: { appointmentId: appt.id },
          },
        },
      },
    ],
    metadata: {
      type: "appointment",
      appointmentId: appt.id,
      userId: req.userId!,
    },
    success_url: `${frontendUrl}/booking/success?appointment=${appt.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/booking?cancelled=${appt.id}`,
  });

  res.json({ url: session.url });
}

// POST /api/appointments/:id/verify
// Fallback for when the Stripe webhook is delayed or unreachable (e.g. local dev
// without `stripe listen`): the return page passes the checkout session id, and
// we confirm the appointment straight from Stripe. Idempotent with the webhook.
export async function verifyAppointmentPayment(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const { id } = req.params;
  const sessionId = (req.body?.sessionId ?? req.query?.session_id) as string | undefined;

  const { data: appt, error: apptError } = await supabaseAdmin
    .from("appointments")
    .select("id, status, payment_status")
    .eq("id", id)
    .eq("parent_id", req.userId)
    .single();

  if (apptError || !appt) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  // Already settled (e.g. the webhook won the race) — nothing to update, but
  // still hand off to the notifier. If the webhook's send failed (Resend down,
  // migration not yet applied), this is the only other chance to deliver it;
  // it dedupes on email_logs, so a successful send is not repeated.
  if (appt.payment_status === "paid") {
    void notifyBookingConfirmed(id as string);
    void syncAppointmentCalendarEvent(id as string);
    res.json({ paymentStatus: "paid", status: appt.status });
    return;
  }

  const stripe = getStripe();
  if (!stripe || !sessionId) {
    res.json({ paymentStatus: appt.payment_status, status: appt.status });
    return;
  }

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    res.json({ paymentStatus: appt.payment_status, status: appt.status });
    return;
  }

  // Only honour a session that actually belongs to this appointment and is paid.
  if (session.metadata?.appointmentId !== id || session.payment_status !== "paid") {
    res.json({ paymentStatus: appt.payment_status, status: appt.status });
    return;
  }

  const { error: updateError } = await supabaseAdmin
    .from("appointments")
    .update({
      payment_status: "paid",
      status: "confirmed",
      stripe_checkout_session_id: session.id,
      stripe_payment_intent: session.payment_intent,
      payment_reference: session.payment_intent,
    })
    .eq("id", id)
    .eq("parent_id", req.userId);

  if (updateError) {
    res.status(500).json({ error: updateError.message });
    return;
  }

  // Fallback for a delayed or unreachable webhook: whichever path confirms the
  // booking first sends the notifications. Deduped against the webhook via
  // email_logs.
  void notifyBookingConfirmed(id as string);
  void syncAppointmentCalendarEvent(id as string);

  res.json({ paymentStatus: "paid", status: "confirmed" });
}

// DELETE /api/appointments/:id
// Releases a pending, unpaid appointment (e.g. the parent abandoned checkout) so
// its slot is freed immediately rather than waiting for the stale-hold window.
export async function abandonAppointment(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const { id } = req.params;

  const { error } = await supabaseAdmin
    .from("appointments")
    .delete()
    .eq("id", id)
    .eq("parent_id", req.userId)
    .eq("status", "pending")
    .eq("payment_status", "pending");

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ message: "Pending appointment released" });
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

  // Remove the mirrored Google Calendar event and the video room (non-blocking)
  void syncAppointmentCalendarEvent(id as string);
  void deleteAppointmentRoom(id as string);

  // Fire cancellation email (non-blocking)
  resolveParentEmail(req.userId!).then(async (parent) => {
    if (!parent) return;
    const { data: apptFull } = await supabaseAdmin!
      .from("appointments")
      .select("scheduled_date, scheduled_time, timezone, doctors!appointments_doctor_id_fkey(full_name)")
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
      timezone: apptFull.timezone,
      consultationType: "",
      durationMinutes: 0,
    }).catch(() => {});
  }).catch(() => {});

  res.json({ message: "Appointment cancelled successfully" });
}

// GET /api/appointments/:id/files
// Documents the parent attached to this booking, each with a short-lived signed
// URL. The bucket is private, so this endpoint is the only way to reach them —
// and only for the parent who booked, the treating doctor, or an admin.
export async function listAppointmentFiles(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const { id } = req.params;

  const { data: appt } = await supabaseAdmin
    .from("appointments")
    .select("id, parent_id, doctor_id")
    .eq("id", id)
    .single();

  if (!appt) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  let allowed = appt.parent_id === req.userId;

  if (!allowed) {
    const { data: doctorRow } = await supabaseAdmin
      .from("doctors")
      .select("id")
      .eq("profile_id", req.userId)
      .maybeSingle();
    allowed = !!doctorRow && appt.doctor_id === doctorRow.id;
  }

  if (!allowed) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", req.userId)
      .maybeSingle();
    allowed = profile?.role === "admin";
  }

  if (!allowed) {
    res.status(403).json({ error: "Not authorized to view these documents" });
    return;
  }

  const { data: files } = await supabaseAdmin
    .from("medical_files")
    .select("id, file_name, file_type, file_size_bytes, storage_path, created_at")
    .eq("appointment_id", id)
    .order("created_at", { ascending: true });

  res.json({ files: await signMedicalFiles(files ?? []) });
}

export async function joinAppointment(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const { id } = req.params;

  const { data: appt } = await supabaseAdmin
    .from("appointments")
    .select(
      "id, status, meeting_url, parent_id, doctor_id, scheduled_date, scheduled_time, timezone, duration_minutes"
    )
    .eq("id", id)
    .single();

  if (!appt) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  // Only the parent or the doctor can join
  const isParent = appt.parent_id === req.userId;
  let isDoctor = false;
  if (!isParent) {
    // Check if user is the doctor for this appointment
    const { data: doctorRow } = await supabaseAdmin
      .from("doctors")
      .select("id")
      .eq("profile_id", req.userId)
      .single();
    isDoctor = !!doctorRow && appt.doctor_id === doctorRow.id;
    if (!isDoctor) {
      res.status(403).json({ error: "Not authorized to join this appointment" });
      return;
    }
  }

  if (["cancelled", "rescheduled"].includes(appt.status as string)) {
    res.status(400).json({ error: "This appointment is no longer scheduled" });
    return;
  }

  const window = appointmentJoinWindow(appt);
  if (!window) {
    res.status(500).json({ error: "Appointment has an unreadable schedule" });
    return;
  }

  // The room now exists from booking time, so the window — not the room's
  // absence — is what stops anyone arriving days early or rejoining long after.
  const now = Date.now();
  if (now < window.opensAt.getTime()) {
    res.status(403).json({
      error: "This consultation is not open yet",
      opensAt: window.opensAt.toISOString(),
    });
    return;
  }
  if (now > window.closesAt.getTime()) {
    res.status(403).json({ error: "This consultation has ended" });
    return;
  }

  // Recovers bookings made before rooms were created eagerly, and any booking
  // whose room creation failed at confirmation time.
  const roomUrl = appt.meeting_url ?? (await ensureAppointmentRoom(id as string));
  if (!roomUrl) {
    res.status(502).json({ error: "Video room is unavailable, please try again" });
    return;
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", req.userId)
    .maybeSingle();

  try {
    // Returned separately, not as `${url}?t=${token}`: the token belongs in
    // daily-js join(), and a token in the URL is what breaks Daily's hosted
    // leave flow (it reloads the room without it, and a private room with no
    // token reports that the meeting does not exist).
    const token = await createMeetingToken({
      roomName: appointmentRoomName(id as string),
      userId: req.userId!,
      userName: profile?.full_name ?? (isDoctor ? "Doctor" : "Patient"),
      isOwner: isDoctor,
      expiryEpoch: Math.floor(window.closesAt.getTime() / 1000),
    });
    res.json({ roomUrl, token });
  } catch (err) {
    res.status(502).json({ error: "Could not authorise you for the video room", detail: String(err) });
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

  // newTime is fully client-supplied here, so it needs the same check as
  // booking: it must be a slot the doctor is offering, in the doctor's zone.
  const { timezone: doctorTimezone, slots: offered } = await generateSlots(
    existing.doctor_id as string,
    newDate,
    existing.consultation_type as string
  );

  const requestedMinutes = hhmmToMinutes(newTime);
  if (!offered.some((s) => hhmmToMinutes(s.time) === requestedMinutes)) {
    res.status(400).json({ error: "That time is not available for this doctor" });
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
      // Re-snapshot: the doctor may have changed zones since the original booking.
      timezone: doctorTimezone,
      status: "confirmed",
    })
    .eq("id", id)
    .eq("parent_id", req.userId)
    .select("id, scheduled_date, scheduled_time, timezone, status")
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Move the mirrored Google Calendar event (non-blocking). The reconciler
  // only creates an event for settled bookings, so rescheduling an unpaid
  // pending row (whose status is force-set to confirmed above) stays event-less.
  void syncAppointmentCalendarEvent(id as string);
  // The room's joinable window still points at the old slot until this runs.
  void ensureAppointmentRoom(id as string);

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
      appointmentUrl: `${process.env.FRONTEND_URL ?? "http://localhost:3333"}/dashboard/parent/appointments?appointment=${id}`,
      doctorName: docRow?.full_name ?? "Your doctor",
      scheduledDate: newDate as string,
      scheduledTime: newTime as string,
      timezone: doctorTimezone,
      consultationType: existing.consultation_type as string,
      durationMinutes: 0,
    }).catch(() => {});
  }).catch(() => {});

  res.json({ appointment: updated });
}
