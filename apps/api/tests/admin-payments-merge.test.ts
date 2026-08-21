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

describe("listPayments — merging consultations and package sales", () => {
  it("interleaves both streams in date order", async () => {
    mount();
    const res = await call(listPayments, {});

    expect(res.statusCode).toBe(200);
    expect((res.body as any).payments.map((p: any) => p.id)).toEqual([
      "appt-6", "pkg-5", "appt-4", "pkg-3", "appt-2", "pkg-1",
    ]);
    // Both counts, not just the appointments the old query could see.
    expect((res.body as any).total).toBe(6);
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
    const page1 = ((await call(listPayments, { page: "1", limit: "2" })).body as any).payments;
    const page2 = ((await call(listPayments, { page: "2", limit: "2" })).body as any).payments;
    const page3 = ((await call(listPayments, { page: "3", limit: "2" })).body as any).payments;

    const seen = [...page1, ...page2, ...page3].map((p: any) => p.id);
    expect(seen).toEqual(["appt-6", "pkg-5", "appt-4", "pkg-3", "appt-2", "pkg-1"]);
    expect(new Set(seen).size).toBe(6);
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
    expect(rows.map((p: any) => p.id)).toEqual(["appt-6", "pkg-5", "appt-4", "pkg-3", "appt-2"]);
  });

  it("filtering to an appointment-only status returns no packages", async () => {
    mount();
    const res = await call(listPayments, { status: "pending" });
    expect(((res.body as any).payments as any[]).every((p) => p.kind === "consultation")).toBe(true);
  });

  it("type=package drops the consultation stream entirely", async () => {
    const mock = mount();
    const rows = ((await call(listPayments, { type: "package" })).body as any).payments;

    expect(rows.map((p: any) => p.id)).toEqual(["pkg-5", "pkg-3", "pkg-1"]);
    expect(mock.queries.some((q) => q.table === "appointments")).toBe(false);
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
