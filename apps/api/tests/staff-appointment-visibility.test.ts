/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * An unpaid appointment is the reservation hold booking writes before Stripe
 * Checkout opens (controllers/appointments.ts) — it is not a scheduled
 * appointment, and nothing ever clears an abandoned one. The parent's own list
 * already excludes them; these are the staff-facing surfaces, which were still
 * showing them and so put a "Pending" row in front of the doctor and the admin
 * for a consultation nobody paid for.
 *
 * status "pending" only ever occurs together with payment_status "pending":
 * booking writes the pair, and every later write moves status off "pending".
 * That equivalence is what lets the UI drop its pending filters entirely.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyFilters, argOf, createSupabaseMock, makeRes } from "./helpers/mocks";

const supabaseHolder = vi.hoisted(() => ({ current: null as any }));
vi.mock("../src/lib/supabase", () => ({
  get supabaseAdmin() {
    return supabaseHolder.current;
  },
}));

import { getPatient, listAllAppointments } from "../src/controllers/admin";
import {
  getDoctorAppointments,
  getDoctorPatients,
  getDoctorStats,
  startSession,
} from "../src/controllers/doctor-dashboard";
import { BOOKED_PAYMENT_STATUSES } from "../src/lib/consultation";

const DOCTOR_USER = "dddddddd-1111-4111-8111-111111111111";
const DOCTOR_ID = "doc-1";
const CHILD_PAID = "child-paid";
const CHILD_HOLD = "child-hold";

/** One row per payment state, all for the same doctor. */
const APPOINTMENTS = [
  { id: "appt-paid", doctor_id: DOCTOR_ID, parent_id: "p1", child_id: CHILD_PAID, status: "confirmed", payment_status: "paid", price_aed: 350, scheduled_date: "2026-09-21", scheduled_time: "20:40:00", duration_minutes: 30, timezone: "Asia/Dubai", meeting_url: null, consultation_type: "consultation" },
  { id: "appt-credit", doctor_id: DOCTOR_ID, parent_id: "p1", child_id: CHILD_PAID, status: "confirmed", payment_status: "package_credit", price_aed: 0, scheduled_date: "2026-09-03", scheduled_time: "09:20:00", duration_minutes: 30, timezone: "Asia/Dubai", meeting_url: null, consultation_type: "consultation" },
  { id: "appt-done", doctor_id: DOCTOR_ID, parent_id: "p2", child_id: CHILD_PAID, status: "completed", payment_status: "paid", price_aed: 350, scheduled_date: "2026-08-21", scheduled_time: "16:00:00", duration_minutes: 30, timezone: "Asia/Dubai", meeting_url: null, consultation_type: "consultation" },
  // The hold. Never paid, never cleaned up, and the one that must not appear.
  { id: "appt-hold", doctor_id: DOCTOR_ID, parent_id: "p3", child_id: CHILD_HOLD, status: "pending", payment_status: "pending", price_aed: 350, scheduled_date: "2026-09-22", scheduled_time: "20:00:00", duration_minutes: 30, timezone: "Asia/Dubai", meeting_url: null, consultation_type: "consultation" },
  // A hold on a child who ALSO has paid appointments. Without this the patient
  // history assertion would pass merely because the only hold belonged to a
  // different child, not because the filter worked.
  { id: "appt-hold-2", doctor_id: DOCTOR_ID, parent_id: "p1", child_id: CHILD_PAID, status: "pending", payment_status: "pending", price_aed: 350, scheduled_date: "2026-09-23", scheduled_time: "11:00:00", duration_minutes: 30, timezone: "Asia/Dubai", meeting_url: null, consultation_type: "consultation" },
];

function mount(extra: Record<string, any> = {}) {
  const mock = createSupabaseMock({
    appointments: (q) => applyFilters(APPOINTMENTS, q),
    // resolveDoctor uses .maybeSingle(), which applyFilters honours — returning
    // a bare array here would give doctor.id === undefined and every assertion
    // below would pass against an empty result.
    doctors: (q: any) =>
      applyFilters([{ id: DOCTOR_ID, profile_id: DOCTOR_USER, timezone: "Asia/Dubai" }], q),
    profiles: () => ({ data: [] }),
    child_profiles: (q: any) =>
      applyFilters([{ id: CHILD_PAID, first_name: "Ward", last_name: "Qanbar" }], q),
    medical_records: () => ({ data: [] }),
    ...extra,
  });
  supabaseHolder.current = mock.client;
  return mock;
}

async function call(handler: any, req: Record<string, unknown> = {}) {
  const res = makeRes();
  await handler({ userId: DOCTOR_USER, params: {}, query: {}, body: {}, ...req } as any, res as any);
  return res;
}

/** The payment_status inclusion list a query applied, if any. */
function bookedFilterOf(mock: any, table = "appointments") {
  const q = mock.queries.filter((x: any) => x.table === table);
  return q.map((x: any) => argOf(x, "in", "payment_status"));
}

beforeEach(() => {
  supabaseHolder.current = null;
});

describe("admin appointment surfaces", () => {
  it("leaves the unpaid hold out of the admin appointments table", async () => {
    const mock = mount();
    const res = await call(listAllAppointments);

    const ids = (res.body as any).appointments.map((a: any) => a.id);
    expect(ids).not.toContain("appt-hold");
    expect(ids).not.toContain("appt-hold-2");
    expect(ids.sort()).toEqual(["appt-credit", "appt-done", "appt-paid"]);
    expect(bookedFilterOf(mock)[0]).toEqual([...BOOKED_PAYMENT_STATUSES]);
  });

  it("leaves it out of a patient's appointment history too", async () => {
    mount();
    const res = await call(getPatient, { params: { id: CHILD_PAID } });

    // This child has three real appointments and one abandoned hold.
    const ids = ((res.body as any).appointments as any[]).map((a) => a.id);
    expect(ids).not.toContain("appt-hold-2");
    expect(ids.sort()).toEqual(["appt-credit", "appt-done", "appt-paid"]);
  });
});

describe("doctor appointment surfaces", () => {
  it("keeps the unpaid hold off the doctor's list", async () => {
    const mock = mount();
    const res = await call(getDoctorAppointments);

    const ids = (res.body as any).appointments.map((a: any) => a.id);
    expect(ids).not.toContain("appt-hold");
    expect(ids).not.toContain("appt-hold-2");
    expect(ids.sort()).toEqual(["appt-credit", "appt-done", "appt-paid"]);
    expect(bookedFilterOf(mock)[0]).toEqual([...BOOKED_PAYMENT_STATUSES]);
  });

  it("does not count the hold as today's appointment or as a patient", async () => {
    const mock = mount();
    await call(getDoctorStats);

    // Every appointments read this endpoint makes must carry the filter —
    // the tiles are three separate queries and any one of them counting
    // holds puts a wrong number on the dashboard.
    const filters = bookedFilterOf(mock);
    expect(filters.length).toBe(3);
    for (const f of filters) expect(f).toEqual([...BOOKED_PAYMENT_STATUSES]);
  });

  it("does not turn an abandoned checkout into one of the doctor's patients", async () => {
    const mock = mount();
    const res = await call(getDoctorPatients);

    const body = res.body as any;
    const patients = body.patients ?? body;
    expect(JSON.stringify(patients)).not.toContain(CHILD_HOLD);
    expect(bookedFilterOf(mock)[0]).toEqual([...BOOKED_PAYMENT_STATUSES]);
  });
});

describe("startSession", () => {
  it("refuses to start an unpaid hold, which would confirm it for free", async () => {
    mount();
    const res = await call(startSession, { params: { id: "appt-hold" } });

    // Starting writes status "confirmed" without touching payment_status, so
    // without this guard the doctor hands out a free consultation.
    expect(res.statusCode).toBe(400);
    expect((res.body as any).error).toMatch(/awaiting payment/i);
  });

  it("reads payment_status, so the guard cannot be vacuously true", async () => {
    const mock = mount();
    await call(startSession, { params: { id: "appt-hold" } });

    const q = mock.queries.find((x: any) => x.table === "appointments");
    const selected = String(q.calls.find((c: any) => c.method === "select")?.args[0] ?? "");
    expect(selected).toContain("payment_status");
  });
});
