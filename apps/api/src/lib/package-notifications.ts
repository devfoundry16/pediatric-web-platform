import { supabaseAdmin } from "./supabase";
import { alreadySent, recordEmailFailure, sendPackagePurchase } from "./resend";
import { activeAdminRecipients } from "./recipients";
import { DEFAULT_TIMEZONE } from "./timezone";
import { frontendUrl } from "./app-url";

/** Expiry shown as a plain clinic-local date rather than a raw timestamp. */
function formatExpiry(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-AE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: DEFAULT_TIMEZONE,
  });
}

/**
 * Receipt the buyer and tell the admins a package was sold.
 *
 * Buying a package used to send nothing at all — the buyer got no confirmation
 * that their money had bought anything, and the clinic learned about the sale
 * only when a credit was later spent.
 *
 * Called from Stripe fulfilment, which is at-least-once, so this is safe to
 * call repeatedly: it dedupes on email_logs. Never throws — the credits are
 * already provisioned by this point and must not be rolled back because mail
 * failed.
 */
export async function notifyPackagePurchased(userPackageId: string): Promise<void> {
  if (!supabaseAdmin) return;

  try {
    if (await alreadySent(userPackageId, "package_purchase")) return;

    const { data: up } = await supabaseAdmin
      .from("user_packages")
      .select(`
        id, user_id, credits_total, expires_at,
        consultation_packages ( name, sessions, price_aed )
      `)
      .eq("id", userPackageId)
      .single();

    if (!up) return;

    const pkg = up.consultation_packages as unknown as
      | { name: string; sessions: number; price_aed: number }
      | null;

    // Packages can be bought several at a time (N × price, N × credits), and
    // the row only records the resulting credit total. Recover the quantity so
    // the receipt shows what was actually charged rather than the unit price.
    const quantity =
      pkg && pkg.sessions > 0 ? Math.max(1, Math.round(up.credits_total / pkg.sessions)) : 1;

    const { data: buyerAuth, error: authError } =
      await supabaseAdmin.auth.admin.getUserById(up.user_id);
    const { data: buyerProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", up.user_id)
      .single();

    const buyerName = buyerProfile?.full_name ?? "Customer";

    const shared = {
      userPackageId: up.id,
      buyerName,
      packageName:
        quantity > 1
          ? `${pkg?.name ?? "Consultation package"} × ${quantity}`
          : (pkg?.name ?? "Consultation package"),
      credits: up.credits_total,
      priceAed: pkg ? Number(pkg.price_aed) * quantity : 0,
      expiresAt: formatExpiry(up.expires_at),
    };

    if (buyerAuth?.user?.email) {
      await sendPackagePurchase({
        ...shared,
        recipients: [{ email: buyerAuth.user.email, userId: up.user_id }],
        audience: "buyer",
        bookingUrl: `${frontendUrl()}/booking`,
      });
    } else {
      // Same trap as the booking path: a service key that reads tables fine can
      // still be refused by the auth admin API, and silence looked identical to
      // "nobody bought anything".
      const reason = authError
        ? `Could not resolve buyer address: ${authError.message}`
        : "Buyer auth user has no email address";
      console.error(`[package] ${reason} (user_package ${userPackageId})`);
      await recordEmailFailure({
        emailType: "package_purchase",
        relatedId: userPackageId,
        recipientUserId: up.user_id,
        reason,
      });
    }

    const admins = await activeAdminRecipients();
    if (admins.length > 0) {
      await sendPackagePurchase({ ...shared, recipients: admins, audience: "admin" });
    }
  } catch (err) {
    console.error(`[package] Notification failed for ${userPackageId}:`, String(err));
  }
}
