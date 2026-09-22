/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * A parent's appointment list must not show the reservation hold that booking
 * writes before Stripe Checkout opens (controllers/appointments.ts). Nothing
 * ever cleans an abandoned hold up — abandonAppointment only runs if the parent
 * comes back through Stripe's cancel_url — so before this filter existed the
 * list accumulated a grey "Pending" card for every checkout ever walked away
 * from, and the parent read it as a real booking.
 *
 * The same rows stay readable by id, because the checkout handshake depends on
 * it: checkout, verify and abandon all address the hold directly.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyFilters, argOf, createSupabaseMock, makeRes } from "./helpers/mocks";

const supabaseHolder = vi.hoisted(() => ({ current: null as any }));
vi.mock("../src/lib/supabase", () => ({
  get supabaseAdmin() {
    return supabaseHolder.current;
  },
}));

import { getAppointment, listAppointments } from "../src/controllers/appointments";
import { BOOKED_PAYMENT_STATUSES } from "../src/lib/consultation";

const PARENT = "11111111-1111-4111-8111-111111111111";
const OTHER_PARENT = "22222222-2222-4222-8222-222222222222";

/** One row per payment state the column allows, plus another parent's booking. */
const APPOINTMENTS = [
  { id: "appt-paid", parent_id: PARENT, status: "confirmed", payment_status: "paid", price_aed: 350 },
  // Booked with a package credit: no cash moved and price_aed is 0, but it is a
  // confirmed booking and the parent must still see it.
  { id: "appt-credit", parent_id: PARENT, status: "confirmed", payment_status: "package_credit", price_aed: 0 },
  // Paid, then refunded — status is 'cancelled'. Real history the parent keeps.
  { id: "appt-refunded", parent_id: PARENT, status: "cancelled", payment_status: "refunded", price_aed: 350 },
  // The hold. Never paid, never cleaned up.
  { id: "appt-hold", parent_id: PARENT, status: "pending", payment_status: "pending", price_aed: 350 },
  { id: "appt-other", parent_id: OTHER_PARENT, status: "confirmed", payment_status: "paid", price_aed: 350 },
];

function mount() {
  const mock = createSupabaseMock({
    appointments: (q) => applyFilters(APPOINTMENTS, q),
  });
  supabaseHolder.current = mock.client;
  return mock;
}

async function call(handler: any, req: Record<string, unknown>) {
  const res = makeRes();
  await handler({ userId: PARENT, params: {}, ...req } as any, res as any);
  return res;
}

beforeEach(() => {
  supabaseHolder.current = null;
});

describe("listAppointments", () => {
  it("returns the parent's bookings and never the unpaid hold", async () => {
    mount();
    const res = await call(listAppointments, {});

    expect(res.statusCode).toBe(200);
    expect((res.body as any).appointments.map((a: any) => a.id)).toEqual([
      "appt-paid",
      "appt-credit",
      "appt-refunded",
    ]);
  });

  it("keeps a credit-booked consultation, which moved no money but is confirmed", async () => {
    mount();
    const ids = ((await call(listAppointments, {})).body as any).appointments.map((a: any) => a.id);

    // price_aed is 0 here, so a filter written against price rather than
    // payment status would silently drop a real booking.
    expect(ids).toContain("appt-credit");
  });

  it("keeps a refunded booking as cancelled history", async () => {
    mount();
    const ids = ((await call(listAppointments, {})).body as any).appointments.map((a: any) => a.id);

    // The parent paid real money for this one and it was undone; hiding it
    // would lose the record of a booking that actually happened.
    expect(ids).toContain("appt-refunded");
  });

  it("filters on the booked set itself, not an exclusion of today's states", async () => {
    const mock = mount();
    await call(listAppointments, {});
    const q = mock.queries.find((x) => x.table === "appointments")!;

    // An inclusion list is only safe if it IS the inclusion list: a payment
    // state added later must opt in rather than default to visible.
    expect(argOf(q, "in", "payment_status")).toEqual([...BOOKED_PAYMENT_STATUSES]);
    expect(argOf(q, "in", "payment_status")).not.toContain("pending");
  });

  it("still scopes to the caller — the new filter did not displace ownership", async () => {
    const mock = mount();
    const res = await call(listAppointments, {});
    const q = mock.queries.find((x) => x.table === "appointments")!;

    expect(argOf(q, "eq", "parent_id")).toBe(PARENT);
    expect((res.body as any).appointments.some((a: any) => a.id === "appt-other")).toBe(false);
  });
});

describe("getAppointment", () => {
  it("still returns an unpaid hold by id, which checkout depends on", async () => {
    mount();
    const res = await call(getAppointment, { params: { id: "appt-hold" } });

    // createAppointmentCheckout, verifyAppointmentPayment and
    // abandonAppointment all read the hold directly. Hoisting the list filter
    // into a shared select would break paying for a booking at all, and the
    // list tests above would keep passing.
    expect(res.statusCode).toBe(200);
    expect((res.body as any).appointment.id).toBe("appt-hold");
  });
});
