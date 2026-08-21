/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import {
  applyFilters,
  createSupabaseMock,
  has,
  makeRes,
  type TableHandler,
} from "./helpers/mocks";

// The reported bug: a parent who paid through Stripe got the booking email
// twice, and so did the doctor and every admin. Two paths confirm a paid
// consultation — the Stripe webhook and the /verify fallback the success page
// calls — and both used to notify. These cover the controllers on both sides of
// that race; lib/booking-notifications.ts itself is mocked out here.

const supabaseHolder = vi.hoisted(() => ({ current: null as any }));
vi.mock("../src/lib/supabase", () => ({
  get supabaseAdmin() {
    return supabaseHolder.current;
  },
}));

// syncGroupSessionCalendarEvent and notifyPackagePurchased are never asserted:
// they exist so the module mocks cover everything the controllers import.
const {
  notifyBookingConfirmed,
  syncAppointmentCalendarEvent,
  syncGroupSessionCalendarEvent,
  notifyPackagePurchased,
  getStripe,
} = vi.hoisted(() => ({
  notifyBookingConfirmed: vi.fn(async () => {}),
  syncAppointmentCalendarEvent: vi.fn(async () => {}),
  syncGroupSessionCalendarEvent: vi.fn(async () => {}),
  notifyPackagePurchased: vi.fn(async () => {}),
  getStripe: vi.fn(),
}));

vi.mock("../src/lib/booking-notifications", () => ({ notifyBookingConfirmed }));
vi.mock("../src/lib/google-calendar", () => ({
  syncAppointmentCalendarEvent,
  syncGroupSessionCalendarEvent,
}));
vi.mock("../src/lib/package-notifications", () => ({ notifyPackagePurchased }));
vi.mock("../src/lib/stripe", () => ({ getStripe }));

import { verifyAppointmentPayment } from "../src/controllers/appointments";
import { stripeWebhook } from "../src/controllers/packages";

const APPT_ID = "11111111-1111-4222-8333-444444444444";
const OTHER_APPT_ID = "33333333-1111-4222-8333-444444444444";
const PARENT_ID = "22222222-1111-4222-8333-444444444444";
const SESSION_ID = "cs_test_abc123";
const PAYMENT_INTENT = "pi_test_abc123";

interface ApptRow {
  id: string;
  parent_id: string;
  status: string;
  payment_status: string;
  stripe_checkout_session_id?: string | null;
}

function row(
  paymentStatus: string,
  status: string,
  overrides: Partial<ApptRow> = {}
): ApptRow {
  return {
    id: APPT_ID,
    parent_id: PARENT_ID,
    status,
    payment_status: paymentStatus,
    ...overrides,
  };
}

/**
 * Stands in for the appointments table.
 *
 * `read` is what a handler's opening SELECT sees and `current` is the state the
 * UPDATE actually lands on — they differ when the other path confirmed the
 * booking in between, which is the race that produced the duplicate email.
 * Anything read back *after* the update attempt sees `current` too, because by
 * then the stale read is behind us and both handlers re-read precisely to find
 * out what really happened.
 *
 * Filters go through applyFilters, so a guard like
 * .eq("payment_status", "pending") matches nothing against an already-paid row,
 * exactly as Postgres would — which is what makes these tests fail if the guard
 * is ever dropped.
 *
 * The `return=minimal` branch matters just as much. supabase-js only asks for
 * the updated rows back when .select() is chained; a bare update resolves with
 * data === null. Without modelling that, deleting .select("id") as an unused
 * call would leave every test green while silencing the booking email on both
 * paths in production — a worse bug than the duplicate this file exists for.
 */
function appointmentsTable(read: ApptRow, current: ApptRow = read): TableHandler {
  let updateAttempted = false;
  return (q) => {
    if (q.op === "update") {
      updateAttempted = true;
      if (!has(q, "select")) return { data: null };
      return applyFilters([current], q);
    }
    return applyFilters([updateAttempted ? current : read], q);
  };
}

/** The same table with the row gone, e.g. abandoned while Stripe settled. */
const missingAppointment: TableHandler = (q) => applyFilters([], q);

function verifyRequest(): Request {
  return {
    params: { id: APPT_ID },
    userId: PARENT_ID,
    body: { sessionId: SESSION_ID },
    query: {},
  } as unknown as Request;
}

/** A Stripe client whose checkout session is paid and belongs to `owns`. */
function paidSessionStripe(owns: string = APPT_ID) {
  return {
    checkout: {
      sessions: {
        retrieve: vi.fn(async () => ({
          id: SESSION_ID,
          payment_status: "paid",
          status: "complete",
          payment_intent: PAYMENT_INTENT,
          metadata: { appointmentId: owns },
        })),
      },
    },
  };
}

/** A Stripe client that hands back one checkout.session.completed event. */
function webhookStripe(metadata: Record<string, string>) {
  return {
    webhooks: {
      constructEvent: vi.fn(() => ({
        type: "checkout.session.completed",
        data: {
          object: { id: SESSION_ID, payment_intent: PAYMENT_INTENT, metadata },
        },
      })),
    },
  };
}

function webhookRequest(): Request {
  return {
    headers: { "stripe-signature": "sig_test" },
    body: Buffer.from("{}"),
  } as unknown as Request;
}

function appointmentEvent() {
  return webhookStripe({ type: "appointment", appointmentId: APPT_ID }) as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  process.env.STRIPE_SECRET_KEY = "sk_test";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  supabaseHolder.current = null;
});

describe("verifyAppointmentPayment", () => {
  // The success page calls /verify the moment the browser returns from Stripe,
  // which is normally after the webhook has already confirmed and notified.
  // Reaching this branch means somebody else did the confirming, so the mail
  // has already gone out.
  it("does not notify when the booking was already paid", async () => {
    supabaseHolder.current = createSupabaseMock({
      appointments: appointmentsTable(row("paid", "confirmed")),
    }).client;

    const res = makeRes();
    await verifyAppointmentPayment(verifyRequest(), res as unknown as Response);

    expect(res.body).toEqual({ paymentStatus: "paid", status: "confirmed" });
    expect(notifyBookingConfirmed).not.toHaveBeenCalled();
    // Reconciling is safe to repeat, so it still runs — that is the whole
    // distinction this fix rests on.
    expect(syncAppointmentCalendarEvent).toHaveBeenCalledTimes(1);
  });

  // The read says pending, but the webhook commits before our update lands, so
  // the guarded update matches nothing. The webhook is the notifier; we are not.
  it("does not notify when the webhook confirms it mid-request", async () => {
    getStripe.mockReturnValue(paidSessionStripe() as any);
    supabaseHolder.current = createSupabaseMock({
      appointments: appointmentsTable(row("pending", "pending"), row("paid", "confirmed")),
    }).client;

    const res = makeRes();
    await verifyAppointmentPayment(verifyRequest(), res as unknown as Response);

    expect(res.body).toEqual({ paymentStatus: "paid", status: "confirmed" });
    expect(notifyBookingConfirmed).not.toHaveBeenCalled();
    expect(syncAppointmentCalendarEvent).toHaveBeenCalledTimes(1);
    // Losing the race is the ordinary case and must not read as an incident.
    expect(console.error).not.toHaveBeenCalled();
  });

  it("notifies exactly once when it is the path that confirms the booking", async () => {
    getStripe.mockReturnValue(paidSessionStripe() as any);
    supabaseHolder.current = createSupabaseMock({
      appointments: appointmentsTable(row("pending", "pending")),
    }).client;

    const res = makeRes();
    await verifyAppointmentPayment(verifyRequest(), res as unknown as Response);

    expect(res.body).toEqual({ paymentStatus: "paid", status: "confirmed" });
    expect(notifyBookingConfirmed).toHaveBeenCalledTimes(1);
    expect(notifyBookingConfirmed).toHaveBeenCalledWith(APPT_ID);
    expect(syncAppointmentCalendarEvent).toHaveBeenCalledTimes(1);
  });

  // A cancelled booking keeps its checkout session, and Stripe still calls that
  // session paid, so reopening the bookmarked success URL walks straight past
  // the already-paid early return. The guarded update correctly refuses to
  // resurrect the row — but the reply has to say so rather than report the
  // paid/confirmed it just failed to write.
  it("reports the real state rather than claiming a refunded booking is confirmed", async () => {
    getStripe.mockReturnValue(paidSessionStripe() as any);
    supabaseHolder.current = createSupabaseMock({
      appointments: appointmentsTable(row("refunded", "cancelled")),
    }).client;

    const res = makeRes();
    await verifyAppointmentPayment(verifyRequest(), res as unknown as Response);

    expect(res.body).toEqual({ paymentStatus: "refunded", status: "cancelled" });
    expect(notifyBookingConfirmed).not.toHaveBeenCalled();
    // Money was captured against a booking nobody will be told about — the one
    // thing that must not happen quietly.
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(`appointment ${APPT_ID} is refunded/cancelled`)
    );
  });

  // Checkout sessions are retrievable with the platform secret key, so the id
  // in the request body proves nothing on its own. Without the ownership check
  // one payment would confirm an unrelated pending booking.
  it("refuses a checkout session belonging to a different appointment", async () => {
    getStripe.mockReturnValue(paidSessionStripe(OTHER_APPT_ID) as any);
    supabaseHolder.current = createSupabaseMock({
      appointments: appointmentsTable(row("pending", "pending")),
    }).client;

    const res = makeRes();
    await verifyAppointmentPayment(verifyRequest(), res as unknown as Response);

    expect(res.body).toEqual({ paymentStatus: "pending", status: "pending" });
    expect(notifyBookingConfirmed).not.toHaveBeenCalled();
    expect(syncAppointmentCalendarEvent).not.toHaveBeenCalled();
  });
});

describe("stripeWebhook, one-time consultation", () => {
  it("notifies exactly once when it is the path that confirms the booking", async () => {
    getStripe.mockReturnValue(appointmentEvent());
    supabaseHolder.current = createSupabaseMock({
      appointments: appointmentsTable(row("pending", "pending")),
    }).client;

    const res = makeRes();
    await stripeWebhook(webhookRequest(), res as unknown as Response);

    expect(res.body).toEqual({ received: true });
    expect(notifyBookingConfirmed).toHaveBeenCalledTimes(1);
    expect(syncAppointmentCalendarEvent).toHaveBeenCalledTimes(1);
  });

  // Stripe delivers at-least-once, and /verify may have confirmed it first.
  // Either way the booking is no longer pending, so there is nothing to
  // announce — the redelivery must stay silent and still return 200.
  it("stays silent on a redelivered event for a booking already confirmed", async () => {
    getStripe.mockReturnValue(appointmentEvent());
    supabaseHolder.current = createSupabaseMock({
      appointments: appointmentsTable(
        row("paid", "confirmed", { stripe_checkout_session_id: SESSION_ID })
      ),
    }).client;

    const res = makeRes();
    await stripeWebhook(webhookRequest(), res as unknown as Response);

    expect(res.body).toEqual({ received: true });
    expect(notifyBookingConfirmed).not.toHaveBeenCalled();
    expect(syncAppointmentCalendarEvent).toHaveBeenCalledTimes(1);
    // A plain redelivery is the expected case and must not cry wolf.
    expect(console.error).not.toHaveBeenCalled();
  });

  // The webhook has no SELECT of its own, so "no row matched" is the only
  // signal it gets. A booking abandoned while the payment settled looks exactly
  // like a redelivery from here, and it means Stripe captured money for an
  // appointment that no longer exists.
  it("logs when the payment settles against a booking that no longer exists", async () => {
    getStripe.mockReturnValue(appointmentEvent());
    supabaseHolder.current = createSupabaseMock({
      appointments: missingAppointment,
    }).client;

    const res = makeRes();
    await stripeWebhook(webhookRequest(), res as unknown as Response);

    // Still 200 — a Stripe retry cannot conjure the appointment back.
    expect(res.body).toEqual({ received: true });
    expect(notifyBookingConfirmed).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("no longer exists")
    );
  });

  // 500 is the only thing that makes Stripe retry. If this branch ever softened
  // to 200 a failed write would drop the booking for good: parent charged,
  // appointment stuck pending, nobody emailed and nothing to replay.
  it("returns 500 without notifying when the update itself fails", async () => {
    getStripe.mockReturnValue(appointmentEvent());
    supabaseHolder.current = createSupabaseMock({
      appointments: () => ({ error: { message: "boom" } }),
    }).client;

    const res = makeRes();
    await stripeWebhook(webhookRequest(), res as unknown as Response);

    expect(res.statusCode).toBe(500);
    expect(notifyBookingConfirmed).not.toHaveBeenCalled();
    expect(syncAppointmentCalendarEvent).not.toHaveBeenCalled();
  });
});
