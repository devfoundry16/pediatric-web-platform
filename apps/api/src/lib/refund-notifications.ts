import { supabaseAdmin } from "./supabase";
import {
  recordEmailFailure,
  sendRefundRequestedEmail,
  sendRefundResolvedEmail,
} from "./resend";
import { appointmentUrlFor } from "./booking-notifications";
import { DEFAULT_TIMEZONE } from "./timezone";

/**
 * Telling each side what happened to a refund request.
 *
 * Both functions load everything they need from the request id, so a caller
 * only has to hand over the row it just wrote. Neither throws: the request has
 * already been committed, and failing to mail about it must not undo it.
 */

/** How a requested option reads in a sentence. */
export function refundOptionLabel(requestedType: string): string {
  return requestedType === "refund" ? "a refund" : "a replacement session";
}

interface RequestContext {
  request: {
    id: string;
    appointment_id: string;
    parent_id: string;
    doctor_id: string;
    requested_remedy: string;
    reason: string | null;
    status: string;
    resolution_note: string | null;
  };
  appointment: {
    id: string;
    scheduled_date: string;
    scheduled_time: string;
    timezone: string | null;
  };
  childName: string;
  doctorEmail: string | null;
  doctorName: string;
}

async function loadContext(requestId: string): Promise<RequestContext | null> {
  if (!supabaseAdmin) return null;

  const { data: request } = await supabaseAdmin
    .from("refund_requests")
    .select(
      "id, appointment_id, parent_id, doctor_id, requested_remedy, reason, status, resolution_note"
    )
    .eq("id", requestId)
    .maybeSingle();

  if (!request) return null;

  const { data: appointment } = await supabaseAdmin
    .from("appointments")
    .select(
      `id, scheduled_date, scheduled_time, timezone,
       child_profiles!appointments_child_id_fkey ( first_name, last_name )`
    )
    .eq("id", request.appointment_id)
    .maybeSingle();

  if (!appointment) return null;

  const child = appointment.child_profiles as unknown as
    | { first_name: string; last_name: string }
    | null;

  const { data: doctor } = await supabaseAdmin
    .from("doctors")
    .select("full_name, email")
    .eq("id", request.doctor_id)
    .maybeSingle();

  return {
    request,
    appointment,
    childName: child ? `${child.first_name} ${child.last_name}` : "your patient",
    doctorEmail: doctor?.email ?? null,
    doctorName: doctor?.full_name ?? "your doctor",
  };
}

/** Tell the doctor a claim is waiting on them. */
export async function notifyRefundRequested(requestId: string): Promise<void> {
  try {
    const ctx = await loadContext(requestId);
    if (!ctx) return;

    // doctors.email is optional — a doctor can be bookable with no auth
    // account. Logged so "the doctor never heard about it" is answerable
    // without reading the code. The request still stands and is visible in
    // their dashboard.
    if (!ctx.doctorEmail) {
      await recordEmailFailure({
        emailType: "refund_requested",
        relatedId: requestId,
        reason: "Doctor has no notification address (doctors.email is empty)",
      });
      return;
    }

    await sendRefundRequestedEmail({
      requestId,
      appointmentId: ctx.appointment.id,
      optionLabel: refundOptionLabel(ctx.request.requested_remedy),
      recipientEmail: ctx.doctorEmail,
      recipientName: ctx.doctorName,
      childName: ctx.childName,
      scheduledDate: ctx.appointment.scheduled_date,
      scheduledTime: ctx.appointment.scheduled_time,
      timezone: ctx.appointment.timezone ?? DEFAULT_TIMEZONE,
      reason: ctx.request.reason,
      actionUrl: appointmentUrlFor("doctor", ctx.appointment.id),
    });
  } catch (err) {
    console.error(`[refund] Could not notify doctor of request ${requestId}:`, err);
  }
}

/** Tell the parent what the doctor decided, and what they got. */
export async function notifyRefundResolved(
  requestId: string,
  outcomeLabel?: string
): Promise<void> {
  try {
    const ctx = await loadContext(requestId);
    if (!ctx || !supabaseAdmin) return;

    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.getUserById(ctx.request.parent_id);

    if (authError || !authUser?.user?.email) {
      const reason = authError
        ? `Could not resolve parent address: ${authError.message}`
        : "Parent auth user has no email address";
      console.error(`[refund] ${reason} (request ${requestId})`);
      await recordEmailFailure({
        emailType: "refund_resolved",
        relatedId: requestId,
        recipientUserId: ctx.request.parent_id,
        reason,
      });
      return;
    }

    const { data: parentProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", ctx.request.parent_id)
      .maybeSingle();

    await sendRefundResolvedEmail({
      requestId,
      appointmentId: ctx.appointment.id,
      optionLabel: refundOptionLabel(ctx.request.requested_remedy),
      recipientEmail: authUser.user.email,
      recipientName: parentProfile?.full_name ?? "there",
      recipientUserId: ctx.request.parent_id,
      childName: ctx.childName,
      scheduledDate: ctx.appointment.scheduled_date,
      scheduledTime: ctx.appointment.scheduled_time,
      timezone: ctx.appointment.timezone ?? DEFAULT_TIMEZONE,
      approved: ctx.request.status === "approved",
      outcomeLabel,
      note: ctx.request.resolution_note,
      actionUrl: appointmentUrlFor("parent", ctx.appointment.id),
    });
  } catch (err) {
    console.error(`[refund] Could not notify parent of resolution ${requestId}:`, err);
  }
}
