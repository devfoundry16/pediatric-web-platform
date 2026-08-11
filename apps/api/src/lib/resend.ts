import { Resend } from "resend";
import { supabaseAdmin } from "./supabase";
import { DEFAULT_TIMEZONE } from "./timezone";

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!resendClient) resendClient = new Resend(key);
  return resendClient;
}

type EmailType =
  | "booking_confirmation"
  | "booking_notification"
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

/**
 * Send one email and record the outcome, including when Resend is not
 * configured at all. Every send goes through here so email_logs stays a
 * complete record — a missing row means the code path never ran, not that
 * delivery quietly failed.
 *
 * Never throws: notifications are fired alongside a booking that has already
 * been committed, and must not be able to fail it.
 */
async function deliver(params: {
  to: string;
  subject: string;
  html: string;
  emailType: EmailType;
  relatedId: string;
  recipientUserId?: string | null;
}): Promise<void> {
  const base = {
    recipient_email: params.to,
    recipient_user_id: params.recipientUserId ?? null,
    email_type: params.emailType,
    related_id: params.relatedId,
  };

  const resend = getResend();
  if (!resend) {
    await logEmail({ ...base, status: "failed", error_message: "RESEND_API_KEY not configured" });
    return;
  }

  try {
    const { data: result, error } = await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    await logEmail({
      ...base,
      status: error ? "failed" : "sent",
      resend_id: result?.id ?? null,
      error_message: error ? String(error) : null,
    });
  } catch (err) {
    await logEmail({ ...base, status: "failed", error_message: String(err) });
  }
}

interface AppointmentEmailData {
  appointmentId: string;
  parentEmail: string;
  parentName: string;
  parentUserId?: string;
  doctorName: string;
  scheduledDate: string;
  scheduledTime: string;
  /** IANA zone scheduledDate/scheduledTime are wall-clock in. */
  timezone?: string;
  consultationType: string;
  durationMinutes: number;
  priceAed: number;
  /** Deep link to the appointment in the app, where the call is joined. */
  appointmentUrl?: string;
}

const FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@littlecare.ae";
const APP_NAME = "LittleCare";

/**
 * Email is rendered server-side with no idea where the recipient is, so it
 * shows the appointment's own zone — and must say so. These times used to be
 * printed bare, which reads as local time to anyone outside the UAE.
 */
function zoneLabel(timezone: string | undefined): string {
  const tz = timezone || DEFAULT_TIMEZONE;
  const city = tz.split("/").pop()?.replace(/_/g, " ") ?? tz;
  let offset = "";
  try {
    offset =
      new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" })
        .formatToParts(new Date())
        .find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    // Unknown zone — fall back to the bare identifier.
  }
  return offset ? `${city} time, ${offset}` : `${city} time`;
}

/**
 * Join button.
 *
 * This links to the appointment in the app, NOT to the Daily room URL. Rooms
 * are created private (see lib/daily.ts) precisely so that holding the URL
 * grants nothing — entry requires a short-lived, per-user meeting token minted
 * for an authenticated request. A room link in an inbox would either not work
 * or, if rooms were made public to make it work, would let anyone who received
 * or forwarded the mail walk into a paediatric consultation.
 */
function joinButton(appointmentUrl: string | undefined, label: string): string {
  if (!appointmentUrl) return "";
  return `
    <p style="margin-top:24px">
      <a href="${appointmentUrl}"
         style="background:#0d9488;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">
        ${label}
      </a>
    </p>
    <p style="color:#666;font-size:12px">
      Or paste this into your browser: ${appointmentUrl}
    </p>
  `;
}

export async function sendBookingConfirmation(data: AppointmentEmailData): Promise<void> {
  const html = `
    <h2>Your appointment is confirmed</h2>
    <p>Hello ${data.parentName},</p>
    <p>Your appointment has been booked successfully.</p>
    <table style="border-collapse:collapse;margin-top:16px">
      <tr><td style="padding:4px 12px 4px 0;color:#666">Doctor</td><td><strong>${data.doctorName}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666">Date</td><td><strong>${data.scheduledDate}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666">Time</td><td><strong>${data.scheduledTime}</strong> (${zoneLabel(data.timezone)})</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666">Type</td><td><strong>${data.consultationType} (${data.durationMinutes} min)</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666">Amount</td><td><strong>AED ${data.priceAed}</strong></td></tr>
    </table>
    ${joinButton(data.appointmentUrl, "Join the consultation")}
    <p style="margin-top:16px">The video room opens at your scheduled time. Sign in with this email address to join.</p>
    <p>Thank you for choosing ${APP_NAME}.</p>
  `;

  await deliver({
    to: data.parentEmail,
    subject: `${APP_NAME} – Appointment Confirmed`,
    html,
    emailType: "booking_confirmation",
    relatedId: data.appointmentId,
    recipientUserId: data.parentUserId,
  });
}

/**
 * Tell the doctor and the admins that a consultation has been booked.
 *
 * Sent per recipient rather than as one multi-address message so a bad address
 * only fails its own delivery, and so email_logs records each outcome.
 */
export async function sendBookingNotification(data: {
  appointmentId: string;
  recipients: { email: string; userId?: string | null }[];
  audience: "doctor" | "admin";
  doctorName: string;
  parentName: string;
  childName: string;
  scheduledDate: string;
  scheduledTime: string;
  timezone?: string;
  consultationType: string;
  durationMinutes: number;
  symptoms?: string | null;
  appointmentUrl?: string;
}): Promise<void> {
  const forDoctor = data.audience === "doctor";
  const heading = forDoctor ? "You have a new appointment" : "New appointment booked";

  const html = `
    <h2>${heading}</h2>
    <p>A consultation has been booked${forDoctor ? "" : ` with <strong>${data.doctorName}</strong>`}.</p>
    <table style="border-collapse:collapse;margin-top:16px">
      ${forDoctor ? "" : `<tr><td style="padding:4px 12px 4px 0;color:#666">Doctor</td><td><strong>${data.doctorName}</strong></td></tr>`}
      <tr><td style="padding:4px 12px 4px 0;color:#666">Patient</td><td><strong>${data.childName}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666">Parent</td><td><strong>${data.parentName}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666">Date</td><td><strong>${data.scheduledDate}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666">Time</td><td><strong>${data.scheduledTime}</strong> (${zoneLabel(data.timezone)})</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666">Type</td><td><strong>${data.consultationType} (${data.durationMinutes} min)</strong></td></tr>
      ${data.symptoms ? `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top">Reason</td><td>${data.symptoms}</td></tr>` : ""}
    </table>
    ${joinButton(data.appointmentUrl, forDoctor ? "Open the consultation" : "View the appointment")}
    <p style="margin-top:16px">Sign in with this email address to open the appointment.</p>
  `;

  const subject = forDoctor
    ? `${APP_NAME} – New appointment on ${data.scheduledDate}`
    : `${APP_NAME} – New booking: ${data.doctorName}, ${data.scheduledDate}`;

  for (const recipient of data.recipients) {
    await deliver({
      to: recipient.email,
      subject,
      html,
      emailType: "booking_notification",
      relatedId: data.appointmentId,
      recipientUserId: recipient.userId,
    });
  }
}

export async function sendCancellationEmail(data: Omit<AppointmentEmailData, "priceAed">): Promise<void> {
  const html = `
    <h2>Appointment Cancelled</h2>
    <p>Hello ${data.parentName},</p>
    <p>Your appointment with <strong>${data.doctorName}</strong> on <strong>${data.scheduledDate}</strong> at <strong>${data.scheduledTime}</strong> (${zoneLabel(data.timezone)}) has been cancelled.</p>
    <p>If you need to book a new appointment, please visit your dashboard.</p>
    <p>Thank you for using ${APP_NAME}.</p>
  `;

  await deliver({
    to: data.parentEmail,
    subject: `${APP_NAME} – Appointment Cancelled`,
    html,
    emailType: "cancellation",
    relatedId: data.appointmentId,
    recipientUserId: data.parentUserId,
  });
}

export async function sendRescheduleEmail(data: Omit<AppointmentEmailData, "priceAed">): Promise<void> {
  const html = `
    <h2>Appointment Rescheduled</h2>
    <p>Hello ${data.parentName},</p>
    <p>Your appointment with <strong>${data.doctorName}</strong> has been rescheduled to <strong>${data.scheduledDate}</strong> at <strong>${data.scheduledTime}</strong> (${zoneLabel(data.timezone)}).</p>
    ${joinButton(data.appointmentUrl, "View the appointment")}
    <p>Thank you for using ${APP_NAME}.</p>
  `;

  await deliver({
    to: data.parentEmail,
    subject: `${APP_NAME} – Appointment Rescheduled`,
    html,
    emailType: "reschedule",
    relatedId: data.appointmentId,
    recipientUserId: data.parentUserId,
  });
}
