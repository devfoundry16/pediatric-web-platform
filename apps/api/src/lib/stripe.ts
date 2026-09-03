// Shared Stripe client + minimal type surface used by the packages webhook and
// the one-time-consultation checkout. Loaded require-style so TypeScript treats
// Stripe as a value under CJS NodeNext.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const StripeLib: new (key: string) => StripeClient = require("stripe");

export interface StripePrice {
  currency: string;
  unit_amount: number;
  product_data: { name: string; description?: string; metadata: Record<string, string> };
}

export interface StripeLineItem {
  quantity: number;
  price_data: StripePrice;
}

export interface StripeSessionCreate {
  mode: "payment";
  line_items: StripeLineItem[];
  metadata: Record<string, string>;
  success_url: string;
  cancel_url: string;
}

export interface StripeCheckoutSession {
  id: string;
  payment_intent: string | null;
  metadata: Record<string, string> | null;
}

// Shape returned by checkout.sessions.retrieve — used to verify payment on the
// return page as a fallback when the webhook is delayed or unreachable (e.g.
// local dev without `stripe listen`).
export interface StripeRetrievedSession {
  id: string;
  payment_status: string; // "paid" | "unpaid" | "no_payment_required"
  status: string; // "complete" | "open" | "expired"
  payment_intent: string | null;
  metadata: Record<string, string> | null;
}

export interface StripeCharge {
  payment_intent: string | null;
}

// Params/result for refunds.create. Only `payment_intent` is sent: an amount is
// deliberately never passed, so Stripe refunds the full charge. Partial refunds
// would need a per-session price, and user_packages stores none -- see the
// caveat on packageAmountAed() in controllers/admin.ts.
export interface StripeRefundCreate {
  payment_intent: string;
  metadata?: Record<string, string>;
}

export interface StripeRefund {
  id: string;
  amount: number; // minor units (fils)
  currency: string;
  status: string; // "succeeded" | "pending" | "failed" | "canceled"
}

export interface StripeDispute {
  payment_intent: string | null;
}

export interface StripeEvent {
  type: string;
  data: { object: unknown };
}

export interface StripeClient {
  checkout: {
    sessions: {
      create(params: StripeSessionCreate): Promise<{ url: string | null }>;
      retrieve(id: string): Promise<StripeRetrievedSession>;
    };
  };
  refunds: {
    create(params: StripeRefundCreate): Promise<StripeRefund>;
  };
  webhooks: {
    constructEvent(payload: Buffer, sig: string, secret: string): StripeEvent;
  };
}

export function getStripe(): StripeClient | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new StripeLib(key);
}
