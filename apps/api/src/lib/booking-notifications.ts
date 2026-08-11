import { supabaseAdmin } from "./supabase";
import { sendBookingConfirmation, sendBookingNotification } from "./resend";
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
function appointmentUrlFor(audience: "parent" | "doctor" | "admin"): string {
  return `${frontendUrl()}/dashboard/${audience}/appointments`;
}

async function activeAdminRecipients(): Promise<{ email: string; userId: string }[]> {
  if (!supabaseAdmin) return [];

  const { data: admins } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("is_active", true);

  if (!admins || admins.length === 0) return [];

  const wanted = new Set(admins.map((a) => a.id));
  const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

  return (data?.users ?? [])
    .filter((u) => wanted.has(u.id) && !!u.email)
    .map((u) => ({ email: u.email as string, userId: u.id }));
}

/**
 * Whether this appointment has already had its confirmation sent.
 *
 * The paid path can be confirmed twice — once by the Stripe webhook and once by
 * the client-side verify fallback, whichever wins the race — and both call
 * this module. email_logs is the existing record of what went out, so it also
 * serves as the dedupe key rather than adding a column for it.
 */
async function alreadyNotified(appointmentId: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const { count } = await supabaseAdmin
    .from("email_logs")
    .select("id", { count: "exact", head: true })
    .eq("related_id", appointmentId)
    .eq("email_type", "booking_confirmation")
    .eq("status", "sent");
  return (count ?? 0) > 0;
}

/**
 * Provision the video room and tell the parent, the doctor and every active
 * admin that the consultation is confirmed.
 *
 * Called from every path that confirms a booking: package credit at creation,
 * the Stripe webhook, and the verify fallback. Safe to call more than once.
 * Never throws — the booking is already committed by this point.
 */
export async function notifyBookingConfirmed(appointmentId: string): Promise<void> {
  if (!supabaseAdmin) return;

  try {
    if (await alreadyNotified(appointmentId)) return;

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

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(appt.parent_id);
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
        appointmentUrl: appointmentUrlFor("parent"),
      });
    }

    // Skipped silently when the doctor has no address on file — doctors.email
    // is optional because a doctor can be bookable without an auth account.
    if (doctor?.email) {
      await sendBookingNotification({
        ...shared,
        recipients: [{ email: doctor.email }],
        audience: "doctor",
        parentName,
        childName,
        symptoms: appt.symptoms,
        appointmentUrl: appointmentUrlFor("doctor"),
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
        appointmentUrl: appointmentUrlFor("admin"),
      });
    }
  } catch (err) {
    console.error(`[booking] Notification failed for ${appointmentId}:`, String(err));
  }
}
