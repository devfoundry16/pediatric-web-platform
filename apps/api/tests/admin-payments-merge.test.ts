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

/** Honours the status/limit chained onto the query, as PostgREST would. */
function streamHandler(rows: any[], statusField: string): TableHandler {
  return (q: RecordedQuery) => {
    let out = [...rows];
    const eq = argOf(q, "eq", statusField);
    if (eq !== undefined) out = out.filter((r) => r[statusField] === eq);
    const neq = argOf(q, "neq", statusField);
    if (neq !== undefined) out = out.filter((r) => r[statusField] !== neq);
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
    const page1 = ((await call(listPayments, { page: "1", limit: "3" })).body as any).payments;
    const page2 = ((await call(listPayments, { page: "2", limit: "3" })).body as any).payments;
    const page3 = ((await call(listPayments, { page: "3", limit: "3" })).body as any).payments;

    const seen = [...page1, ...page2, ...page3].map((p: any) => p.id);
    expect(seen).toEqual(MERGED);
    expect(new Set(seen).size).toBe(9);
  });

  it("reads only the prefix each page can need", async () => {
    const mock = mount();
    await call(listPayments, { page: "2", limit: "2" });

    // Page 2 of a 2-per-page merge can only be built from the first 4 of each
    // stream, so neither query should ask for more.
    for (const q of mock.queries.filter((x) => x.table !== "profiles")) {
      expect(q.calls.find((c) => c.method === "limit")?.args[0]).toBe(4);
    }
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
