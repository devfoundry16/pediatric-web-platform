/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  argOf,
  createSupabaseMock,
  has,
  makeRes,
  type RecordedQuery,
  type TableHandler,
} from "./helpers/mocks";

// The controller reads the supabaseAdmin singleton — route it to a per-test
// mock the way the other controller suites do.
const supabaseHolder = vi.hoisted(() => ({ current: null as any }));
vi.mock("../src/lib/supabase", () => ({
  get supabaseAdmin() {
    return supabaseHolder.current;
  },
}));

import { listPayments, listUserPackages } from "../src/controllers/admin";

const BUYER_A = "aaaaaaaa-1111-4222-8333-444444444444";
const BUYER_B = "bbbbbbbb-1111-4222-8333-444444444444";

const CATALOGUE = { id: "pkg-1", slug: "monthly_followup", name: "Monthly Follow-up", sessions: 4, price_aed: 750 };

/** Appointments on even days, packages on odd days, so a correct merge interleaves them. */
const APPOINTMENTS = [
  // Booked against a package credit, so no money moved and `price_aed` is 0
  // (see controllers/appointments.ts). The `.gt("price_aed", 0)` filter must
  // keep it out of the list AND out of `total`; nothing else here would notice
  // if that filter were dropped.
  { id: "appt-credit", price_aed: 0, payment_status: "package_credit", payment_reference: null, created_at: "2026-01-08T00:00:00Z", scheduled_date: "2026-01-08", parent_id: BUYER_A, doctors: { full_name: "Dr. Sahar" }, child_profiles: { first_name: "Lina", last_name: "K" } },
  { id: "appt-6", price_aed: 300, payment_status: "paid", payment_reference: "pi_6", created_at: "2026-01-06T00:00:00Z", scheduled_date: "2026-01-06", parent_id: BUYER_A, doctors: { full_name: "Dr. Sahar" }, child_profiles: { first_name: "Lina", last_name: "K" } },
  { id: "appt-4", price_aed: 300, payment_status: "paid", payment_reference: "pi_4", created_at: "2026-01-04T00:00:00Z", scheduled_date: "2026-01-04", parent_id: BUYER_A, doctors: { full_name: "Dr. Sahar" }, child_profiles: { first_name: "Lina", last_name: "K" } },
  { id: "appt-2", price_aed: 300, payment_status: "paid", payment_reference: "pi_2", created_at: "2026-01-02T00:00:00Z", scheduled_date: "2026-01-02", parent_id: BUYER_A, doctors: { full_name: "Dr. Sahar" }, child_profiles: { first_name: "Lina", last_name: "K" } },
];

const PACKAGES = [
  { id: "pkg-5", user_id: BUYER_B, credits_total: 4, credits_remaining: 4, expires_at: "2026-02-05T00:00:00Z", status: "active", purchased_at: "2026-01-05T00:00:00Z", stripe_checkout_session_id: "cs_5", consultation_packages: CATALOGUE },
  { id: "pkg-3", user_id: BUYER_B, credits_total: 8, credits_remaining: 2, expires_at: "2026-02-03T00:00:00Z", status: "active", purchased_at: "2026-01-03T00:00:00Z", stripe_checkout_session_id: "cs_3", consultation_packages: CATALOGUE },
  { id: "pkg-1", user_id: BUYER_B, credits_total: 4, credits_remaining: 0, expires_at: "2026-02-01T00:00:00Z", status: "refunded", purchased_at: "2026-01-01T00:00:00Z", stripe_checkout_session_id: "cs_1", consultation_packages: CATALOGUE },
];

const SESSION = {
  id: "gs-1",
  title: "Sleep & Toddlers",
  scheduled_at: "2026-02-10T09:00:00Z",
  price_aed: 120,
  doctors: { full_name: "Dr. Sahar" },
};

/**
 * Registrations sit on the half-day so they interleave with the whole-day
 * appointment and package fixtures rather than tying with them.
 */
const REGISTRATIONS = [
  { id: "reg-7", user_id: BUYER_A, payment_status: "paid", registered_at: "2026-01-07T00:00:00Z", stripe_session_id: "cs_reg_7", group_sessions: SESSION },
  { id: "reg-5", user_id: BUYER_A, payment_status: "pending", registered_at: "2026-01-05T12:00:00Z", stripe_session_id: null, group_sessions: SESSION },
  { id: "reg-4", user_id: BUYER_B, payment_status: "free", registered_at: "2026-01-04T12:00:00Z", stripe_session_id: null, group_sessions: SESSION },
  { id: "reg-2", user_id: BUYER_B, payment_status: "refunded", registered_at: "2026-01-02T12:00:00Z", stripe_session_id: "cs_reg_2", group_sessions: SESSION },
];

/** Every transaction, newest first — the free seat is never one of them. */
const MERGED = [
  "reg-7", "appt-6", "reg-5", "pkg-5", "appt-4", "pkg-3", "reg-2", "appt-2", "pkg-1",
];

const PROFILES = [
  { id: BUYER_A, full_name: "Parent A" },
  { id: BUYER_B, full_name: "Parent B" },
];

/** Honours the status/gt/order/limit chained onto the query, as PostgREST would. */
function streamHandler(rows: any[], statusField: string): TableHandler {
  return (q: RecordedQuery) => {
    let out = [...rows];
    const eq = argOf(q, "eq", statusField);
    if (eq !== undefined) out = out.filter((r) => r[statusField] === eq);
    const neq = argOf(q, "neq", statusField);
    if (neq !== undefined) out = out.filter((r) => r[statusField] !== neq);
    for (const call of q.calls.filter((c) => c.method === "gt")) {
      const [field, value] = call.args as [string, number];
      out = out.filter((r) => Number(r[field]) > value);
    }

    // Sorting for real is what makes the id-list assertions protect ordering
    // too: without it, ordering a stream by a column it does not have — or
    // ascending instead of descending — still returns the fixture order and
    // every test passes while production 500s or pages the oldest rows.
    const order = q.calls.find((c) => c.method === "order");
    if (order) {
      const [field, opts] = order.args as [string, { ascending?: boolean } | undefined];
      if (out.some((r) => r[field] === undefined)) {
        throw new Error(`ordered by "${field}", which this table's rows do not have`);
      }
      const dir = opts?.ascending ? 1 : -1;
      out.sort((a, b) => dir * String(a[field]).localeCompare(String(b[field])));
    }

    // `count` is the full match count; `data` is only the fetched prefix.
    const count = out.length;
    const limit = q.calls.find((c) => c.method === "limit")?.args[0] as number | undefined;
    if (limit !== undefined) out = out.slice(0, limit);
    return { data: out, count };
  };
}

function mount(overrides: Record<string, TableHandler> = {}) {
  const mock = createSupabaseMock({
    appointments: streamHandler(APPOINTMENTS, "payment_status"),
    user_packages: streamHandler(PACKAGES, "status"),
    session_registrations: streamHandler(REGISTRATIONS, "payment_status"),
    profiles: (q) => {
      const ids = argOf(q, "in", "id") as string[] | undefined;
      return { data: PROFILES.filter((p) => !ids || ids.includes(p.id)) };
    },
    ...overrides,
  });
  supabaseHolder.current = mock.client;
  return mock;
}

async function call(handler: any, query: Record<string, string>) {
  const res = makeRes();
  await handler({ query } as any, res as any);
  return res;
}

beforeEach(() => {
  supabaseHolder.current = null;
});

describe("listPayments — merging consultations, package sales and session tickets", () => {
  it("interleaves all three streams in date order", async () => {
    mount();
    const res = await call(listPayments, {});

    expect(res.statusCode).toBe(200);
    expect((res.body as any).payments.map((p: any) => p.id)).toEqual(MERGED);
    // Every stream's count, not just the appointments the old query could see.
    expect((res.body as any).total).toBe(9);
  });

  it("prices a package from the catalogue, multiplied by the quantity bought", async () => {
    mount();
    const res = await call(listPayments, {});
    const rows = (res.body as any).payments;

    // 4 credits of a 4-session AED 750 package == one bought.
    expect(rows.find((p: any) => p.id === "pkg-5").amount_aed).toBe(750);
    // 8 credits of that same package == two bought.
    expect(rows.find((p: any) => p.id === "pkg-3").amount_aed).toBe(1500);
  });

  it("labels each row and names the buyer of a package", async () => {
    mount();
    const rows = (await call(listPayments, {})).body as any;
    const pkg = rows.payments.find((p: any) => p.id === "pkg-5");
    const appt = rows.payments.find((p: any) => p.id === "appt-6");

    expect(pkg.kind).toBe("package");
    expect(pkg.package_name).toBe("Monthly Follow-up");
    expect(pkg.buyer_name).toBe("Parent B");
    expect(appt.kind).toBe("consultation");
    expect(appt.child_profiles.first_name).toBe("Lina");
  });

  it("pages across the merge without dropping or repeating a row", async () => {
    mount();
    // 2 per page over 9 rows keeps every stream TRUNCATED by its prefix on the
    // early pages (each holds 3 matching rows), which is the whole point: the
    // merge has to come out right from partial reads. A page size that happens
    // to reach past every stream's last row would prove nothing.
    const pages = [];
    for (let page = 1; page <= 5; page++) {
      pages.push(((await call(listPayments, { page: String(page), limit: "2" })).body as any).payments);
    }

    const seen = pages.flat().map((p: any) => p.id);
    expect(seen).toEqual(MERGED);
    expect(new Set(seen).size).toBe(9);
  });

  it("builds a page that falls inside one stream's rows", async () => {
    mount();
    // MERGED[6..7] — a boundary that splits the registrations stream rather
    // than landing on a stream edge.
    const rows = ((await call(listPayments, { page: "4", limit: "2" })).body as any).payments;
    expect(rows.map((p: any) => p.id)).toEqual(["reg-2", "appt-2"]);
  });

  it("reads only the prefix each page can need", async () => {
    const mock = mount();
    await call(listPayments, { page: "2", limit: "2" });

    // Page 2 of a 2-per-page merge can only be built from the first 4 of each
    // stream, so no query should ask for more.
    const streams = mock.queries.filter((x) => x.table !== "profiles");
    // All three, so a stream gated off by accident cannot pass this vacuously.
    expect(streams.length).toBe(3);
    for (const q of streams) {
      expect(q.calls.find((c) => c.method === "limit")?.args[0]).toBe(4);
    }
  });

  it("orders every stream newest-first on its own date column", async () => {
    const mock = mount();
    await call(listPayments, {});

    const orderOf = (table: string) =>
      mock.queries.find((q) => q.table === table)?.calls.find((c) => c.method === "order")?.args;

    expect(orderOf("appointments")).toEqual(["created_at", { ascending: false }]);
    expect(orderOf("user_packages")).toEqual(["purchased_at", { ascending: false }]);
    // Not `created_at` — session_registrations has no such column, so getting
    // this wrong is a 500 in production that the fixtures alone would not show.
    expect(orderOf("session_registrations")).toEqual(["registered_at", { ascending: false }]);
  });

  it("keeps package-credit consultations out of the money list entirely", async () => {
    mount();
    const all = (await call(listPayments, {})).body as any;
    const credit = (await call(listPayments, { status: "package_credit" })).body as any;

    // No cash moved, so it is not a transaction — and it must not inflate the count.
    expect(all.payments.some((p: any) => p.id === "appt-credit")).toBe(false);
    expect(all.total).toBe(9);
    // Consequently this status can never return a row, on any tab.
    expect(credit.payments).toEqual([]);
    expect(credit.total).toBe(0);
  });

  it("maps a refund onto the payment vocabulary and treats every other state as paid", async () => {
    mount();
    const rows = ((await call(listPayments, {})).body as any).payments;

    expect(rows.find((p: any) => p.id === "pkg-1").payment_status).toBe("refunded");
    expect(rows.find((p: any) => p.id === "pkg-5").payment_status).toBe("paid");
  });

  it("filtering to paid keeps live packages and excludes the refunded one", async () => {
    mount();
    const rows = ((await call(listPayments, { status: "paid" })).body as any).payments;
    expect(rows.map((p: any) => p.id)).toEqual([
      "reg-7", "appt-6", "pkg-5", "appt-4", "pkg-3", "appt-2",
    ]);
  });

  it("filtering to pending reaches consultations and tickets but not packages", async () => {
    const mock = mount();
    const res = await call(listPayments, { status: "pending" });

    // A package is never pending, so that stream is skipped outright; the other
    // two are asked. No appointment fixture is pending, hence the query check
    // rather than an assertion on the returned rows.
    expect(mock.queries.some((q) => q.table === "user_packages")).toBe(false);
    expect(mock.queries.some((q) => q.table === "appointments")).toBe(true);
    expect((res.body as any).payments.map((p: any) => p.id)).toEqual(["reg-5"]);
  });

  it("filtering to refunded interleaves the two streams that can hold one", async () => {
    mount();
    const res = await call(listPayments, { status: "refunded" });

    // The only status all three streams recognise, and the one where the
    // package translation (status -> payment_status) runs beside the
    // registration's native value.
    expect((res.body as any).payments.map((p: any) => p.id)).toEqual(["reg-2", "pkg-1"]);
    expect((res.body as any).total).toBe(2);
  });

  it("type=consultation drops the package and ticket streams entirely", async () => {
    const mock = mount();
    const res = await call(listPayments, { type: "consultation" });

    expect((res.body as any).payments.map((p: any) => p.id)).toEqual(["appt-6", "appt-4", "appt-2"]);
    expect((res.body as any).total).toBe(3);
    expect(mock.queries.some((q) => q.table === "user_packages")).toBe(false);
    expect(mock.queries.some((q) => q.table === "session_registrations")).toBe(false);
  });

  it("fails the whole request when a stream errors, rather than under-reporting", async () => {
    mount({ session_registrations: () => ({ error: { message: "boom" } }) });
    const res = await call(listPayments, {});

    // Silently degrading to the two healthy streams would hand an admin a
    // revenue total that looks complete and is not.
    expect(res.statusCode).toBe(500);
    expect((res.body as any).payments).toBeUndefined();
    expect((res.body as any).error).toBe("boom");
  });

  it("fails rather than pricing a ticket whose session did not resolve", async () => {
    mount({
      session_registrations: () => ({
        data: [{ ...REGISTRATIONS[0], group_sessions: null }],
        count: 1,
      }),
    });
    const res = await call(listPayments, {});

    // AED 0 is a real price, so it cannot double as "the embed broke".
    expect(res.statusCode).toBe(500);
    expect((res.body as any).error).toMatch(/missing its session/);
  });

  it("reports a genuinely zero-priced ticket instead of hiding it", async () => {
    mount({
      session_registrations: () => ({
        data: [{ ...REGISTRATIONS[0], group_sessions: { ...SESSION, price_aed: 0 } }],
        count: 1,
      }),
    });
    const res = await call(listPayments, { type: "live_session" });

    // A doctor can zero a session's price after tickets sold (updateSession).
    // Dropping such rows in JS would also desync `payments` from the DB count.
    expect((res.body as any).payments.map((p: any) => p.id)).toEqual(["reg-7"]);
    expect((res.body as any).payments[0].amount_aed).toBe(0);
    expect((res.body as any).total).toBe(1);
  });

  it("type=package drops the consultation and ticket streams entirely", async () => {
    const mock = mount();
    const rows = ((await call(listPayments, { type: "package" })).body as any).payments;

    expect(rows.map((p: any) => p.id)).toEqual(["pkg-5", "pkg-3", "pkg-1"]);
    expect(mock.queries.some((q) => q.table === "appointments")).toBe(false);
    expect(mock.queries.some((q) => q.table === "session_registrations")).toBe(false);
  });

  it("type=live_session drops the consultation and package streams entirely", async () => {
    const mock = mount();
    const res = await call(listPayments, { type: "live_session" });

    // The old gating tested by exclusion (`type !== "package"`), which would
    // have let both other streams through for an unrecognised third type.
    expect((res.body as any).payments.map((p: any) => p.id)).toEqual(["reg-7", "reg-5", "reg-2"]);
    expect((res.body as any).total).toBe(3);
    expect(mock.queries.some((q) => q.table === "appointments")).toBe(false);
    expect(mock.queries.some((q) => q.table === "user_packages")).toBe(false);
  });

  it("never bills a free seat as a transaction", async () => {
    mount();
    const unfiltered = ((await call(listPayments, {})).body as any).payments;
    const ticketsOnly = (await call(listPayments, { type: "live_session" })).body as any;
    const freeFiltered = (await call(listPayments, { status: "free" })).body as any;

    expect(unfiltered.some((p: any) => p.id === "reg-4")).toBe(false);
    expect(ticketsOnly.payments.some((p: any) => p.id === "reg-4")).toBe(false);
    // 'free' is not payment vocabulary at all — it matches nothing anywhere.
    expect(freeFiltered.payments).toEqual([]);
    expect(freeFiltered.total).toBe(0);
  });

  it("describes a ticket by its session, host and registrant", async () => {
    mount();
    const rows = ((await call(listPayments, {})).body as any).payments;
    const ticket = rows.find((p: any) => p.id === "reg-7");

    expect(ticket).toMatchObject({
      kind: "live_session",
      session_title: "Sleep & Toddlers",
      scheduled_at: "2026-02-10T09:00:00Z",
      buyer_name: "Parent A",
      payment_status: "paid",
      payment_reference: "cs_reg_7",
      // Read off the session — session_registrations stores no amount.
      amount_aed: 120,
    });
    expect(ticket.doctors.full_name).toBe("Dr. Sahar");
  });

  it("skips the ticket stream for a status no registration can hold", async () => {
    const mock = mount();
    await call(listPayments, { status: "package_credit" });

    expect(mock.queries.some((q) => q.table === "session_registrations")).toBe(false);
  });

  it("carries the package credit columns the packages tab needs", async () => {
    mount();
    const rows = ((await call(listPayments, {})).body as any).payments;

    expect(rows.find((p: any) => p.id === "pkg-3")).toMatchObject({
      credits_total: 8,
      credits_remaining: 2,
      expires_at: "2026-02-03T00:00:00Z",
    });
    // And the consultation date the consultations tab needs.
    expect(rows.find((p: any) => p.id === "appt-6").scheduled_date).toBe("2026-01-06");
  });
});

describe("listUserPackages", () => {
  it("returns purchases with buyer, credits and derived amount", async () => {
    mount();
    const res = await call(listUserPackages, {});
    const rows = (res.body as any).packages;

    expect(res.statusCode).toBe(200);
    expect((res.body as any).total).toBe(3);
    expect(rows[0]).toMatchObject({
      id: "pkg-5",
      buyer_name: "Parent B",
      credits_remaining: 4,
      credits_total: 4,
      amount_aed: 750,
    });
  });

  it("sweeps lapsed packages to expired before listing", async () => {
    const mock = mount();
    await call(listUserPackages, {});

    const sweep = mock.queries.find((q) => q.table === "user_packages" && q.op === "update");
    expect(sweep?.payload).toEqual({ status: "expired" });
    expect(argOf(sweep!, "eq", "status")).toBe("active");
    expect(has(sweep!, "lt")).toBe(true);
  });

  it("ignores a status filter that is not a real package state", async () => {
    const mock = mount();
    await call(listUserPackages, { status: "bogus" });

    const read = mock.queries.find((q) => q.table === "user_packages" && q.op === "select");
    expect(argOf(read!, "eq", "status")).toBeUndefined();
  });
});
