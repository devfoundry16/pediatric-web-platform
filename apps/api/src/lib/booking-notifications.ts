import { supabaseAdmin } from "./supabase";
import {
  alreadySent,
  recordEmailFailure,
  sendBookingConfirmation,
  sendBookingNotification,
} from "./resend";
import { activeAdminRecipients } from "./recipients";
import { DEFAULT_TIMEZONE } from "./timezone";

function frontendUrl(): string {
  return process.env.FRONTEND_URL ?? "http://localhost:3333";
}

/**
 * Where each audience opens the appointment.
 *
 * Deliberately the app, not the Daily room. Two reasons:
 *
 * Rooms are private and entry needs a per-user token minted for an
 * authenticated request (see lib/daily.ts), so a room URL in an inbox is either
 * useless or, if rooms were opened up to make it work, a way into a paediatric
 * consultation for anyone holding the mail.
 *
 * And the room deliberately does not exist yet. It is created when the doctor
 * presses "Start session", and that absence is what stops a parent walking into
 * an empty room days early — the parent's Join button keys off meeting_url.
 * Provisioning it at booking time would quietly remove that guarantee. The
 * dashboard is the right destination: it shows Start or Join as appropriate.
 */
export function appointmentUrlFor(
  audience: "parent" | "doctor" | "admin",
  appointmentId: string
): string {
  // ?appointment= lets the dashboard scroll to and highlight this booking
  // rather than dropping the recipient on an undifferentiated list.
  return `${frontendUrl()}/dashboard/${audience}/appointments?appointment=${appointmentId}`;
}

/**
 * Tell the parent, the doctor and every active admin that the consultation is
 * confirmed, each with a link straight to it on their own dashboard.
 *
 * Called from every path that confirms a booking: package credit at creation,
 * the Stripe webhook, and the verify fallback. Safe to call more than once.
 * Never throws — the booking is already committed by this point.
 */
export async function notifyBookingConfirmed(appointmentId: string): Promise<void> {
  if (!supabaseAdmin) return;

  try {
    if (await alreadySent(appointmentId, "booking_confirmation")) return;

    const { data: appt } = await supabaseAdmin
      .from("appointments")
      .select(`
        id, parent_id, scheduled_date, scheduled_time, timezone, duration_minutes,
        consultation_type, price_aed, symptoms,
        child_profiles!appointments_child_id_fkey ( first_name, last_name ),
        doctors!appointments_doctor_id_fkey ( full_name, email )
      `)
      .eq("id", appointmentId)
      .single();

    if (!appt) return;

    const doctor = appt.doctors as unknown as { full_name: string; email: string | null } | null;
    const child = appt.child_profiles as unknown as { first_name: string; last_name: string } | null;
    const childName = child ? `${child.first_name} ${child.last_name}` : "the patient";

    // The address comes from the auth admin API, which needs a genuine service
    // role key — a key that is fine for table reads can still be refused here.
    // The error used to be discarded, so a refusal looked identical to "no
    // booking happened": no email, no log line, nothing to search for.
    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.getUserById(appt.parent_id);

    if (authError || !authUser?.user?.email) {
      const reason = authError
        ? `Could not resolve parent address: ${authError.message}`
        : "Parent auth user has no email address";
      console.error(`[booking] ${reason} (appointment ${appointmentId})`);
      await recordEmailFailure({
        emailType: "booking_confirmation",
        relatedId: appointmentId,
        recipientUserId: appt.parent_id,
        reason,
      });
    }
    const { data: parentProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", appt.parent_id)
      .single();
    const parentName = parentProfile?.full_name ?? "Parent";

    const shared = {
      appointmentId: appt.id,
      doctorName: doctor?.full_name ?? "Your doctor",
      scheduledDate: appt.scheduled_date,
      scheduledTime: appt.scheduled_time,
      timezone: appt.timezone ?? DEFAULT_TIMEZONE,
      consultationType: appt.consultation_type,
      durationMinutes: appt.duration_minutes,
    };

    if (authUser?.user?.email) {
      await sendBookingConfirmation({
        ...shared,
        parentEmail: authUser.user.email,
        parentName,
        parentUserId: appt.parent_id,
        priceAed: appt.price_aed,
        appointmentUrl: appointmentUrlFor("parent", appt.id),
      });
    }

    // Skipped when the doctor has no address on file — doctors.email is
    // optional because a doctor can be bookable without an auth account. Logged
    // so "the doctor got nothing" is answerable without reading the code.
    if (!doctor?.email) {
      await recordEmailFailure({
        emailType: "booking_notification",
        relatedId: appointmentId,
        reason: "Doctor has no notification address (doctors.email is empty)",
      });
    }

    if (doctor?.email) {
      await sendBookingNotification({
        ...shared,
        recipients: [{ email: doctor.email }],
        audience: "doctor",
        parentName,
        childName,
        symptoms: appt.symptoms,
        appointmentUrl: appointmentUrlFor("doctor", appt.id),
      });
    }

    const admins = await activeAdminRecipients();
    if (admins.length > 0) {
      await sendBookingNotification({
        ...shared,
        recipients: admins,
        audience: "admin",
        parentName,
        childName,
        symptoms: appt.symptoms,
        appointmentUrl: appointmentUrlFor("admin", appt.id),
      });
    }
  } catch (err) {
    console.error(`[booking] Notification failed for ${appointmentId}:`, String(err));
  }
}
