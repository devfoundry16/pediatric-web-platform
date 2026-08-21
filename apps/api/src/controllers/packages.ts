import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { getStripe } from "../lib/stripe";
import type {
  StripeCheckoutSession,
  StripeCharge,
  StripeDispute,
  StripeEvent,
} from "../lib/stripe";
import { notifyBookingConfirmed } from "../lib/booking-notifications";
import { notifyPackagePurchased } from "../lib/package-notifications";
import { frontendUrl } from "../lib/app-url";
import {
  syncAppointmentCalendarEvent,
  syncGroupSessionCalendarEvent,
} from "../lib/google-calendar";

// GET /api/packages
export async function listPackages(
  _req: Request,
  res: Response,
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("consultation_packages")
    .select("*")
    .eq("is_active", true)
    .order("price_aed", { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ packages: data });
}

// POST /api/packages/checkout
export async function createCheckoutSession(
  req: Request,
  res: Response,
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const stripe = getStripe();
  if (!stripe) {
    res.status(500).json({ error: "Payment service not configured" });
    return;
  }

  const { packageId, quantity, source, childId } = req.body;
  if (!packageId) {
    res.status(400).json({ error: "packageId is required" });
    return;
  }

  // Quantity: how many of this package to buy at once (N × price, N × credits).
  const qty = Number.isInteger(quantity) ? (quantity as number) : 1;
  if (qty < 1 || qty > 10) {
    res.status(400).json({ error: "quantity must be between 1 and 10" });
    return;
  }

  const { data: pkg, error: pkgError } = await supabaseAdmin
    .from("consultation_packages")
    .select("*")
    .eq("id", packageId)
    .eq("is_active", true)
    .single();

  if (pkgError || !pkg) {
    res.status(404).json({ error: "Package not found" });
    return;
  }

  const baseUrl = frontendUrl();

  // A booking-initiated purchase returns into the booking flow to pick a time;
  // the standalone packages page uses its own success/cancel pages.
  const isBooking = source === "booking";
  const successUrl = isBooking
    ? `${baseUrl}/booking?resume=1&plan=${encodeURIComponent(pkg.slug)}${childId ? `&childId=${encodeURIComponent(String(childId))}` : ""}`
    : `${baseUrl}/dashboard/parent/packages/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = isBooking
    ? `${baseUrl}/booking?cancelled=package`
    : `${baseUrl}/dashboard/parent/packages?cancelled=1`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: qty,
        price_data: {
          currency: "aed",
          unit_amount: Math.round(Number(pkg.price_aed) * 100),
          product_data: {
            name: pkg.name,
            description: pkg.description ?? undefined,
            metadata: { packageId: pkg.id, slug: pkg.slug },
          },
        },
      },
    ],
    metadata: {
      userId: req.userId!,
      packageId: pkg.id,
      quantity: String(qty),
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  res.json({ url: session.url });
}

// POST /api/packages/webhook
export async function stripeWebhook(
  req: Request,
  res: Response,
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const stripe = getStripe();
  if (!stripe) {
    res.status(500).json({ error: "Payment service not configured" });
    return;
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    res.status(500).json({ error: "Webhook secret not configured" });
    return;
  }
  const sig = req.headers["stripe-signature"] as string;
  let event: StripeEvent;

  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig,
      webhookSecret,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res
      .status(400)
      .json({ error: `Webhook signature verification failed: ${message}` });
    return;
  }
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as StripeCheckoutSession;
    const metadata = session.metadata ?? {};

    // ── Group session payment ──────────────────────────────────────────────
    if (metadata.type === "group_session") {
      const { sessionId, userId } = metadata;

      if (!sessionId || !userId) {
        res.status(400).json({ error: "Missing metadata on session" });
        return;
      }

      const { error: updateError } = await supabaseAdmin
        .from("session_registrations")
        .update({
          payment_status: "paid",
          stripe_session_id: session.id,
          stripe_payment_intent: session.payment_intent,
        })
        .eq("session_id", sessionId)
        .eq("user_id", userId);

      if (updateError) {
        console.error(
          "[webhook] Failed to confirm group session registration:",
          updateError.message,
        );
        res.status(500).json({ error: updateError.message });
        return;
      }

      // Add the newly paid registrant to the session's Google Calendar event.
      void syncGroupSessionCalendarEvent(sessionId);

      res.json({ received: true });
      return;
    }

    // ── One-time consultation payment ──────────────────────────────────────
    if (metadata.type === "appointment") {
      const { appointmentId } = metadata;

      if (!appointmentId) {
        res.status(400).json({ error: "Missing metadata on session" });
        return;
      }

      // Idempotent via the unique index on stripe_checkout_session_id
      // (migration 013): a redelivered webhook simply re-writes the same values.
      const { error: apptError } = await supabaseAdmin
        .from("appointments")
        .update({
          payment_status: "paid",
          status: "confirmed",
          stripe_checkout_session_id: session.id,
          stripe_payment_intent: session.payment_intent,
          payment_reference: session.payment_intent,
        })
        .eq("id", appointmentId);

      if (apptError) {
        console.error(
          "[webhook] Failed to confirm appointment payment:",
          apptError.message,
        );
        res.status(500).json({ error: apptError.message });
        return;
      }

      // The booking is confirmed only now for a paid consult, so this is where
      // parent/doctor/admins are told. Deduped against the verify fallback, and
      // never throws, so a redelivered webhook still returns 200.
      void notifyBookingConfirmed(appointmentId);
      void syncAppointmentCalendarEvent(appointmentId);

      res.json({ received: true });
      return;
    }

    // ── Consultation package payment ───────────────────────────────────────
    const { userId, packageId } = metadata;

    if (!userId || !packageId) {
      res.status(400).json({ error: "Missing metadata on session" });
      return;
    }

    // Quantity purchased (N × sessions of credit). Defaults to 1 for older
    // sessions minted before quantity support.
    const qty = Number.parseInt(metadata.quantity ?? "1", 10) || 1;

    const { data: pkg, error: pkgError } = await supabaseAdmin
      .from("consultation_packages")
      .select("sessions, validity_days")
      .eq("id", packageId)
      .single();

    if (pkgError || !pkg) {
      res.status(404).json({ error: "Package not found" });
      return;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + pkg.validity_days);

    // Idempotent fulfillment: Stripe delivers events at-least-once. The unique
    // index on stripe_checkout_session_id is PARTIAL (…WHERE NOT NULL), which
    // Postgres can't use for ON CONFLICT inference — so dedupe with an explicit
    // pre-check and treat a concurrent unique violation (23505) as a no-op.
    const { data: alreadyProvisioned } = await supabaseAdmin
      .from("user_packages")
      .select("id")
      .eq("stripe_checkout_session_id", session.id)
      .maybeSingle();

    if (!alreadyProvisioned) {
      const { data: provisioned, error: insertError } = await supabaseAdmin
        .from("user_packages")
        .insert({
          user_id: userId,
          package_id: packageId,
          credits_total: pkg.sessions * qty,
          credits_remaining: pkg.sessions * qty,
          stripe_checkout_session_id: session.id,
          stripe_payment_intent: session.payment_intent,
          expires_at: expiresAt.toISOString(),
          status: "active",
        })
        .select("id")
        .single();

      if (insertError && insertError.code !== "23505") {
        console.error(
          "[webhook] Failed to provision package:",
          insertError.message,
        );
        res.status(500).json({ error: insertError.message });
        return;
      }

      // Receipt the buyer and tell the clinic. Deduped on email_logs and never
      // throws, so a redelivered webhook still returns 200.
      if (provisioned) void notifyPackagePurchased(provisioned.id);
    } else {
      // A redelivery for a purchase already provisioned — retry the mail if the
      // first attempt failed, otherwise this is a no-op.
      void notifyPackagePurchased(alreadyProvisioned.id);
    }
  }

  // ── Refunds & disputes: revoke what was fulfilled ──────────────────────────
  // Stripe charge/dispute objects carry a payment_intent (not a checkout
  // session id), which we persisted at fulfillment. Matching on it lets us
  // revoke the corresponding package credits and/or session access.
  if (
    event.type === "charge.refunded" ||
    event.type === "charge.dispute.created" ||
    event.type === "charge.dispute.funds_withdrawn"
  ) {
    const obj = event.data.object as StripeCharge & StripeDispute;
    const paymentIntent = obj.payment_intent;

    if (paymentIntent) {
      const { error: pkgRevokeError } = await supabaseAdmin
        .from("user_packages")
        .update({ status: "refunded", credits_remaining: 0 })
        .eq("stripe_payment_intent", paymentIntent);
      if (pkgRevokeError) {
        console.error(
          "[webhook] Failed to revoke package:",
          pkgRevokeError.message,
        );
      }

      // .select() so the affected rows are known — these updates match on the
      // payment intent, and the calendar events to fix hang off the row ids.
      const { data: revokedRegs, error: regRevokeError } = await supabaseAdmin
        .from("session_registrations")
        .update({ payment_status: "refunded" })
        .eq("stripe_payment_intent", paymentIntent)
        .select("session_id");
      if (regRevokeError) {
        console.error(
          "[webhook] Failed to revoke session registration:",
          regRevokeError.message,
        );
      }
      for (const sessionId of new Set((revokedRegs ?? []).map((r) => r.session_id as string))) {
        // Drops the refunded registrant from the session's attendee list.
        void syncGroupSessionCalendarEvent(sessionId);
      }

      // One-time consultation appointments: refunding cancels the booking.
      const { data: revokedAppts, error: apptRevokeError } = await supabaseAdmin
        .from("appointments")
        .update({ payment_status: "refunded", status: "cancelled" })
        .eq("stripe_payment_intent", paymentIntent)
        .select("id");
      if (apptRevokeError) {
        console.error(
          "[webhook] Failed to revoke appointment:",
          apptRevokeError.message,
        );
      }
      for (const appt of revokedAppts ?? []) {
        // Removes the mirrored calendar event for the cancelled booking.
        void syncAppointmentCalendarEvent(appt.id as string);
      }
    }
  }

  res.json({ received: true });
}

// GET /api/packages/my
export async function getMyPackages(
  req: Request,
  res: Response,
): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  // Mark expired packages before returning
  await supabaseAdmin
    .from("user_packages")
    .update({ status: "expired" })
    .eq("user_id", req.userId)
    .eq("status", "active")
    .lt("expires_at", new Date().toISOString());

  const { data, error } = await supabaseAdmin
    .from("user_packages")
    .select(
      `
      id,
      credits_total,
      credits_remaining,
      expires_at,
      status,
      purchased_at,
      stripe_checkout_session_id,
      consultation_packages (
        id,
        slug,
        name,
        description,
        sessions,
        duration_minutes,
        price_aed,
        validity_days,
        applicable_consultation_types
      )
    `,
    )
    .eq("user_id", req.userId)
    .order("purchased_at", { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ userPackages: data });
}

// GET /api/packages/usage
export async function getUsageLogs(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("package_usage_logs")
    .select(
      `
      id,
      credits_used,
      created_at,
      user_package_id,
      appointment_id,
      appointments (
        id,
        scheduled_date,
        scheduled_time,
        consultation_type,
        doctors!appointments_doctor_id_fkey (
          full_name
        )
      ),
      user_packages!package_usage_logs_user_package_id_fkey (
        user_id,
        consultation_packages (
          name,
          slug
        )
      )
    `,
    )
    .eq("user_packages.user_id", req.userId)
    .order("created_at", { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Filter to only logs belonging to the requesting user (RLS on Supabase side;
  // this extra filter handles the join alias edge case)
  const filtered = (data ?? []).filter(
    (log: Record<string, unknown>) => log.user_packages !== null,
  );

  res.json({ usageLogs: filtered });
}
