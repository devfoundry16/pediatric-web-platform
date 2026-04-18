import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";

// Use require-style so TypeScript treats Stripe as a value with CJS NodeNext
// eslint-disable-next-line @typescript-eslint/no-require-imports
const StripeLib: new (key: string) => StripeClient = require("stripe");

interface StripePrice {
  currency: string;
  unit_amount: number;
  product_data: { name: string; description?: string; metadata: Record<string, string> };
}

interface StripeLineItem {
  quantity: number;
  price_data: StripePrice;
}

interface StripeSessionCreate {
  mode: "payment";
  line_items: StripeLineItem[];
  metadata: Record<string, string>;
  success_url: string;
  cancel_url: string;
}

interface StripeCheckoutSession {
  id: string;
  metadata: Record<string, string> | null;
}

interface StripeEvent {
  type: string;
  data: { object: unknown };
}

interface StripeClient {
  checkout: {
    sessions: {
      create(params: StripeSessionCreate): Promise<{ url: string | null }>;
    };
  };
  webhooks: {
    constructEvent(payload: Buffer, sig: string, secret: string): StripeEvent;
  };
}

function getStripe(): StripeClient | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new StripeLib(key);
}

// GET /api/packages
export async function listPackages(_req: Request, res: Response): Promise<void> {
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
export async function createCheckoutSession(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) {
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const stripe = getStripe();
  if (!stripe) {
    res.status(500).json({ error: "Payment service not configured" });
    return;
  }

  const { packageId } = req.body;
  if (!packageId) {
    res.status(400).json({ error: "packageId is required" });
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

  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3333";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
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
    },
    success_url: `${frontendUrl}/dashboard/parent/packages/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/dashboard/parent/packages?cancelled=1`,
  });

  res.json({ url: session.url });
}

// POST /api/packages/webhook
export async function stripeWebhook(req: Request, res: Response): Promise<void> {
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
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(400).json({ error: `Webhook signature verification failed: ${message}` });
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
        .update({ payment_status: "paid", stripe_session_id: session.id })
        .eq("session_id", sessionId)
        .eq("user_id", userId);

      if (updateError) {
        console.error(
          "[webhook] Failed to confirm group session registration:",
          updateError.message
        );
        res.status(500).json({ error: updateError.message });
        return;
      }

      res.json({ received: true });
      return;
    }

    // ── Consultation package payment ───────────────────────────────────────
    const { userId, packageId } = metadata;

    if (!userId || !packageId) {
      res.status(400).json({ error: "Missing metadata on session" });
      return;
    }

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

    const { error: insertError } = await supabaseAdmin
      .from("user_packages")
      .insert({
        user_id: userId,
        package_id: packageId,
        credits_total: pkg.sessions,
        credits_remaining: pkg.sessions,
        stripe_checkout_session_id: session.id,
        expires_at: expiresAt.toISOString(),
        status: "active",
      });

    if (insertError) {
      console.error("[webhook] Failed to provision package:", insertError.message);
      res.status(500).json({ error: insertError.message });
      return;
    }
  }

  res.json({ received: true });
}

// GET /api/packages/my
export async function getMyPackages(req: Request, res: Response): Promise<void> {
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
    .select(`
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
    `)
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
    .select(`
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
    `)
    .eq("user_packages.user_id", req.userId)
    .order("created_at", { ascending: false });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  // Filter to only logs belonging to the requesting user (RLS on Supabase side;
  // this extra filter handles the join alias edge case)
  const filtered = (data ?? []).filter(
    (log: Record<string, unknown>) =>
      log.user_packages !== null
  );

  res.json({ usageLogs: filtered });
}
