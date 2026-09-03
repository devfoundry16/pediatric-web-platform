import { Resend } from "resend";
import { supabaseAdmin } from "./supabase";
import { DEFAULT_TIMEZONE } from "./timezone";
import type { Recipient } from "./recipients";

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
  | "package_purchase"
  | "appointment_reminder"
  | "session_reminder"
  | "cancellation"
  | "reschedule"
  | "refund_requested"
  | "refund_resolved"
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

/**
 * A failed insert here used to pass silently, which is worse than it sounds:
 * email_logs is also the dedupe key, so a row that never lands means the same
 * email is considered unsent and goes out again on the next attempt. The usual
 * cause is a new email_type reaching a database whose CHECK constraint has not
 * been migrated yet, so say so loudly rather than mailing someone ten times.
 */
async function logEmail(entry: EmailLog): Promise<void> {
  if (!supabaseAdmin) return;
  const { error } = await supabaseAdmin.from("email_logs").insert(entry);
  if (error) {
    console.error(
      `[email] Could not record ${entry.email_type} for ${entry.related_id}: ${error.message}`
    );
  }
}

/**
 * Whether this email already went out for this record.
 *
 * Stripe delivers at-least-once and the client-side verify can race the
 * webhook, so fulfilment runs more than once by design. email_logs is already
 * the record of what was sent, so it doubles as the dedupe key rather than
 * needing a column of its own. Only 'sent' counts — a previous failure should
 * be retried, not suppressed.
 *
 * `recipientEmail` narrows the question to one address. Reminders concern a
 * single record but go to several people and are re-evaluated every minute,
 * so "has this already gone out" is only answerable per recipient there.
 */
export async function alreadySent(
  relatedId: string,
  emailType: EmailType,
  recipientEmail?: string
): Promise<boolean> {
  if (!supabaseAdmin) return false;
  let query = supabaseAdmin
    .from("email_logs")
    .select("id", { count: "exact", head: true })
    .eq("related_id", relatedId)
    .eq("email_type", emailType)
    .eq("status", "sent");

  if (recipientEmail) query = query.eq("recipient_email", recipientEmail);

  const { count } = await query;
  return (count ?? 0) > 0;
}

/**
 * Record that an email could not even be attempted.
 *
 * For failures that happen before there is an address to send to — resolving
 * the recipient failed — so they leave a trace instead of vanishing. Without
 * this, "no row in email_logs" is ambiguous between "the code never ran" and
 * "the recipient could not be resolved", which is exactly the ambiguity that
 * made a production outage untraceable.
 */
export async function recordEmailFailure(params: {
  emailType: EmailType;
  relatedId: string;
  reason: string;
  recipientEmail?: string;
  recipientUserId?: string | null;
}): Promise<void> {
  await logEmail({
    recipient_email: params.recipientEmail ?? "(unresolved)",
    recipient_user_id: params.recipientUserId ?? null,
    email_type: params.emailType,
    related_id: params.relatedId,
    status: "failed",
    error_message: params.reason,
  });
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
  /** Deep link to the appointment in the app, for managing it. */
  appointmentUrl?: string;
  /** Deep link that joins the video call. Prefer this on the action button. */
  meetingUrl?: string;
}

const FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@littlecare.ae";
const APP_NAME = "Drsahar Pediatrics";

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
    ${joinButton(data.meetingUrl ?? data.appointmentUrl, "Join the consultation")}
    <p style="margin-top:16px">The room opens 15 minutes before your appointment. Sign in with this email address to join.</p>
    ${data.meetingUrl && data.appointmentUrl ? `<p style="color:#666;font-size:12px">Manage this booking: ${data.appointmentUrl}</p>` : ""}
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
  /** Deep link that joins the video call — the doctor's primary action. */
  meetingUrl?: string;
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
    ${joinButton(forDoctor ? (data.meetingUrl ?? data.appointmentUrl) : data.appointmentUrl, forDoctor ? "Join the consultation" : "View the appointment")}
    ${forDoctor && data.meetingUrl && data.appointmentUrl ? `<p style="color:#666;font-size:12px">Manage this booking: ${data.appointmentUrl}</p>` : ""}
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

/**
 * What a missed consultation leads to.
 *
 * Two templates, both keyed on the refund request rather than the appointment:
 * a request is answered once, and email_logs dedupes on related_id — keying on
 * the appointment would collide with the booking and cancellation mail already
 * logged against it.
 */

export interface RemedyRequestEmailData {
  requestId: string;
  appointmentId: string;
  /** "refund" | "free_session", already phrased for a reader. */
  remedyLabel: string;
  recipientEmail: string;
  recipientName: string;
  recipientUserId?: string | null;
  childName: string;
  scheduledDate: string;
  scheduledTime: string;
  timezone?: string;
  reason?: string | null;
  /** Deep link to where the recipient acts on it. */
  actionUrl?: string;
}

export async function sendRemedyRequestedEmail(data: RemedyRequestEmailData): Promise<void> {
  const html = `
    <h2>A patient has requested ${data.remedyLabel}</h2>
    <p>Hello ${data.recipientName},</p>
    <p>The consultation for <strong>${data.childName}</strong> on <strong>${data.scheduledDate}</strong> at <strong>${data.scheduledTime}</strong> (${zoneLabel(data.timezone)}) was recorded as missed.</p>
    <p>The parent has asked for <strong>${data.remedyLabel}</strong>.</p>
    ${data.reason ? `<p><em>“${data.reason}”</em></p>` : ""}
    <p>Nothing happens until you approve or decline the request.</p>
    ${joinButton(data.actionUrl, "Review the request")}
    <p>Thank you for using ${APP_NAME}.</p>
  `;

  await deliver({
    to: data.recipientEmail,
    subject: `${APP_NAME} – A patient requested ${data.remedyLabel}`,
    html,
    emailType: "refund_requested",
    relatedId: data.requestId,
    recipientUserId: data.recipientUserId,
  });
}

export interface RemedyResolvedEmailData extends RemedyRequestEmailData {
  approved: boolean;
  /** What the parent actually got, phrased for a reader. Approved requests only. */
  outcomeLabel?: string;
  note?: string | null;
}

export async function sendRemedyResolvedEmail(data: RemedyResolvedEmailData): Promise<void> {
  const heading = data.approved
    ? "Your request has been approved"
    : "Your request has not been approved";

  const body = data.approved
    ? `<p>${data.outcomeLabel ?? "Your remedy has been applied."}</p>`
    : `<p>Your doctor has reviewed your request for ${data.remedyLabel} and was not able to approve it.</p>`;

  const html = `
    <h2>${heading}</h2>
    <p>Hello ${data.recipientName},</p>
    <p>This concerns the consultation for <strong>${data.childName}</strong> on <strong>${data.scheduledDate}</strong> at <strong>${data.scheduledTime}</strong> (${zoneLabel(data.timezone)}).</p>
    ${body}
    ${data.note ? `<p><em>“${data.note}”</em></p>` : ""}
    ${joinButton(data.actionUrl, "View your appointments")}
    <p>Thank you for using ${APP_NAME}.</p>
  `;

  await deliver({
    to: data.recipientEmail,
    subject: `${APP_NAME} – ${heading}`,
    html,
    emailType: "refund_resolved",
    relatedId: data.requestId,
    recipientUserId: data.recipientUserId,
  });
}

/**
 * The nudge that goes out shortly before something starts.
 *
 * One template for both kinds of session and both audiences: a consultation and
 * a group session differ only in what the row above the time says, and the
 * doctor's copy differs from the parent's only in whose name it leads with and
 * that it asks them to open the room rather than join it.
 *
 * `startsIn` is rendered rather than computed here so the caller — which
 * already knows the exact instant and the window it matched — decides how it
 * reads ("in 10 minutes").
 */
export async function sendSessionReminder(data: {
  /** Registration id, or appointment id — whatever the dedupe is keyed on. */
  relatedId: string;
  recipient: Recipient;
  audience: "parent" | "doctor";
  emailType: "session_reminder" | "appointment_reminder";
  recipientName: string;
  /** "Live session" title, or the consultation type and patient. */
  sessionTitle: string;
  counterpartName: string;
  scheduledDate: string;
  scheduledTime: string;
  timezone?: string;
  durationMinutes: number;
  startsIn: string;
  sessionUrl?: string;
}): Promise<void> {
  const forDoctor = data.audience === "doctor";

  const html = `
    <h2>Starting ${data.startsIn}</h2>
    <p>Hello ${data.recipientName},</p>
    <p>
      <strong>${data.sessionTitle}</strong> starts ${data.startsIn}${
        forDoctor ? "" : ` with <strong>${data.counterpartName}</strong>`
      }.
    </p>
    <table style="border-collapse:collapse;margin-top:16px">
      ${forDoctor ? `<tr><td style="padding:4px 12px 4px 0;color:#666">With</td><td><strong>${data.counterpartName}</strong></td></tr>` : ""}
      <tr><td style="padding:4px 12px 4px 0;color:#666">Date</td><td><strong>${data.scheduledDate}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666">Time</td><td><strong>${data.scheduledTime}</strong> (${zoneLabel(data.timezone)})</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666">Duration</td><td><strong>${data.durationMinutes} min</strong></td></tr>
    </table>
    ${joinButton(data.sessionUrl, forDoctor ? "Open the session" : "Go to the session")}
    <p style="margin-top:16px">Sign in with this email address to join.</p>
  `;

  await deliver({
    to: data.recipient.email,
    subject: `${APP_NAME} – ${data.sessionTitle} starts ${data.startsIn}`,
    html,
    emailType: data.emailType,
    relatedId: data.relatedId,
    recipientUserId: data.recipient.userId,
  });
}

/**
 * Receipt for a package purchase, and the clinic's copy of it.
 *
 * The buyer's version tells them what they now hold and when it lapses; the
 * admin version is a sale notice. Both are the same underlying event, so they
 * share a template with the audience-specific bits swapped.
 */
export async function sendPackagePurchase(data: {
  userPackageId: string;
  recipients: Recipient[];
  audience: "buyer" | "admin";
  buyerName: string;
  packageName: string;
  credits: number;
  priceAed: number;
  expiresAt: string;
  bookingUrl?: string;
}): Promise<void> {
  const forBuyer = data.audience === "buyer";

  const html = `
    <h2>${forBuyer ? "Your package is ready" : "New package purchase"}</h2>
    ${forBuyer ? `<p>Hello ${data.buyerName},</p><p>Thank you for your purchase.</p>` : `<p><strong>${data.buyerName}</strong> purchased a package.</p>`}
    <table style="border-collapse:collapse;margin-top:16px">
      ${forBuyer ? "" : `<tr><td style="padding:4px 12px 4px 0;color:#666">Buyer</td><td><strong>${data.buyerName}</strong></td></tr>`}
      <tr><td style="padding:4px 12px 4px 0;color:#666">Package</td><td><strong>${data.packageName}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666">Consultations</td><td><strong>${data.credits}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666">Valid until</td><td><strong>${data.expiresAt}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666">Amount</td><td><strong>AED ${data.priceAed}</strong></td></tr>
    </table>
    ${forBuyer ? joinButton(data.bookingUrl, "Book a consultation") : ""}
    ${forBuyer ? `<p style="margin-top:16px">Your credits are applied automatically when you book — those bookings cost nothing further.</p><p>Thank you for choosing ${APP_NAME}.</p>` : ""}
  `;

  const subject = forBuyer
    ? `${APP_NAME} – Package confirmed: ${data.packageName}`
    : `${APP_NAME} – Package purchased by ${data.buyerName}`;

  for (const recipient of data.recipients) {
    await deliver({
      to: recipient.email,
      subject,
      html,
      emailType: "package_purchase",
      relatedId: data.userPackageId,
      recipientUserId: recipient.userId,
    });
  }
}
