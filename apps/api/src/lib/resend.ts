import { Resend } from "resend";
import { supabaseAdmin } from "./supabase";

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!resendClient) resendClient = new Resend(key);
  return resendClient;
}

type EmailType =
  | "booking_confirmation"
  | "appointment_reminder"
  | "cancellation"
  | "reschedule"
  | "other";

interface EmailLog {
  recipient_email: string;
  recipient_user_id?: string | null;
  email_type: EmailType;
  related_id?: string | null;
  status: "sent" | "failed";
  resend_id?: string | null;
  error_message?: string | null;
}

async function logEmail(entry: EmailLog): Promise<void> {
  if (!supabaseAdmin) return;
  await supabaseAdmin.from("email_logs").insert(entry);
}

interface AppointmentEmailData {
  appointmentId: string;
  parentEmail: string;
  parentName: string;
  parentUserId?: string;
  doctorName: string;
  scheduledDate: string;
  scheduledTime: string;
  consultationType: string;
  durationMinutes: number;
  priceAed: number;
}

const FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@littlecare.ae";
const APP_NAME = "LittleCare";

export async function sendBookingConfirmation(data: AppointmentEmailData): Promise<void> {
  const resend = getResend();
  const subject = `${APP_NAME} – Appointment Confirmed`;
  const html = `
    <h2>Your appointment is confirmed</h2>
    <p>Hello ${data.parentName},</p>
    <p>Your appointment has been booked successfully.</p>
    <table style="border-collapse:collapse;margin-top:16px">
      <tr><td style="padding:4px 12px 4px 0;color:#666">Doctor</td><td><strong>${data.doctorName}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666">Date</td><td><strong>${data.scheduledDate}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666">Time</td><td><strong>${data.scheduledTime}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666">Type</td><td><strong>${data.consultationType} (${data.durationMinutes} min)</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666">Amount</td><td><strong>AED ${data.priceAed}</strong></td></tr>
    </table>
    <p style="margin-top:24px">The doctor will start the video call at your scheduled time. You will receive a join link in your dashboard.</p>
    <p>Thank you for choosing ${APP_NAME}.</p>
  `;

  if (!resend) {
    await logEmail({
      recipient_email: data.parentEmail,
      recipient_user_id: data.parentUserId,
      email_type: "booking_confirmation",
      related_id: data.appointmentId,
      status: "failed",
      error_message: "RESEND_API_KEY not configured",
    });
    return;
  }

  try {
    const { data: result, error } = await resend.emails.send({
      from: FROM,
      to: data.parentEmail,
      subject,
      html,
    });
    await logEmail({
      recipient_email: data.parentEmail,
      recipient_user_id: data.parentUserId,
      email_type: "booking_confirmation",
      related_id: data.appointmentId,
      status: error ? "failed" : "sent",
      resend_id: result?.id ?? null,
      error_message: error ? String(error) : null,
    });
  } catch (err) {
    await logEmail({
      recipient_email: data.parentEmail,
      recipient_user_id: data.parentUserId,
      email_type: "booking_confirmation",
      related_id: data.appointmentId,
      status: "failed",
      error_message: String(err),
    });
  }
}

export async function sendCancellationEmail(data: Omit<AppointmentEmailData, "priceAed">): Promise<void> {
  const resend = getResend();
  const subject = `${APP_NAME} – Appointment Cancelled`;
  const html = `
    <h2>Appointment Cancelled</h2>
    <p>Hello ${data.parentName},</p>
    <p>Your appointment with <strong>${data.doctorName}</strong> on <strong>${data.scheduledDate}</strong> at <strong>${data.scheduledTime}</strong> has been cancelled.</p>
    <p>If you need to book a new appointment, please visit your dashboard.</p>
    <p>Thank you for using ${APP_NAME}.</p>
  `;

  if (!resend) {
    await logEmail({
      recipient_email: data.parentEmail,
      recipient_user_id: data.parentUserId,
      email_type: "cancellation",
      related_id: data.appointmentId,
      status: "failed",
      error_message: "RESEND_API_KEY not configured",
    });
    return;
  }

  try {
    const { data: result, error } = await resend.emails.send({
      from: FROM,
      to: data.parentEmail,
      subject,
      html,
    });
    await logEmail({
      recipient_email: data.parentEmail,
      recipient_user_id: data.parentUserId,
      email_type: "cancellation",
      related_id: data.appointmentId,
      status: error ? "failed" : "sent",
      resend_id: result?.id ?? null,
      error_message: error ? String(error) : null,
    });
  } catch (err) {
    await logEmail({
      recipient_email: data.parentEmail,
      recipient_user_id: data.parentUserId,
      email_type: "cancellation",
      related_id: data.appointmentId,
      status: "failed",
      error_message: String(err),
    });
  }
}

export async function sendRescheduleEmail(data: Omit<AppointmentEmailData, "priceAed">): Promise<void> {
  const resend = getResend();
  const subject = `${APP_NAME} – Appointment Rescheduled`;
  const html = `
    <h2>Appointment Rescheduled</h2>
    <p>Hello ${data.parentName},</p>
    <p>Your appointment with <strong>${data.doctorName}</strong> has been rescheduled to <strong>${data.scheduledDate}</strong> at <strong>${data.scheduledTime}</strong>.</p>
    <p>Thank you for using ${APP_NAME}.</p>
  `;

  if (!resend) {
    await logEmail({
      recipient_email: data.parentEmail,
      recipient_user_id: data.parentUserId,
      email_type: "reschedule",
      related_id: data.appointmentId,
      status: "failed",
      error_message: "RESEND_API_KEY not configured",
    });
    return;
  }

  try {
    const { data: result, error } = await resend.emails.send({
      from: FROM,
      to: data.parentEmail,
      subject,
      html,
    });
    await logEmail({
      recipient_email: data.parentEmail,
      recipient_user_id: data.parentUserId,
      email_type: "reschedule",
      related_id: data.appointmentId,
      status: error ? "failed" : "sent",
      resend_id: result?.id ?? null,
      error_message: error ? String(error) : null,
    });
  } catch (err) {
    await logEmail({
      recipient_email: data.parentEmail,
      recipient_user_id: data.parentUserId,
      email_type: "reschedule",
      related_id: data.appointmentId,
      status: "failed",
      error_message: String(err),
    });
  }
}
