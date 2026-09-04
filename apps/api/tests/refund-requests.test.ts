import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyFilters, createSupabaseMock, makeRes } from "./helpers/mocks";

const supabaseHolder = vi.hoisted(() => ({ current: null as any }));
vi.mock("../src/lib/supabase", () => ({
  get supabaseAdmin() {
    return supabaseHolder.current;
  },
}));

const stripeHolder = vi.hoisted(() => ({ current: null as any }));
vi.mock("../src/lib/stripe", () => ({
  getStripe: () => stripeHolder.current,
}));

// Notifications are exercised by their own suites; here they must simply not
// throw and not block the response.
vi.mock("../src/lib/refund-notifications", () => ({
  notifyRefundRequested: vi.fn(async () => {}),
  notifyRefundResolved: vi.fn(async () => {}),
  refundOptionLabel: (r: string) => (r === "refund" ? "a refund" : "a replacement session"),
}));
vi.mock("../src/lib/google-calendar", () => ({
  syncAppointmentCalendarEvent: vi.fn(async () => {}),
}));

const PARENT = "parent-1";
const DOCTOR_PROFILE = "doctor-profile-1";
const DOCTOR = "doctor-1";

const PAID_MISSED = {
  id: "appt-1",
  parent_id: PARENT,
  doctor_id: DOCTOR,
  status: "confirmed",
  payment_status: "paid",
  price_aed: 399,
  payment_reference: null,
  stripe_payment_intent: "pi_123",
  attendance_outcome: "doctor_only",
};

function makeReq(body: unknown, userId: string, params: Record<string, string> = { id: "appt-1" }) {
  return { body, params, query: {}, userId } as any;
}

beforeEach(() => {
  vi.resetModules();
  supabaseHolder.current = null;
  stripeHolder.current = null;
});

// ─── Parent: asking for a refund ──────────────────────────────────────────────

describe("requestAppointmentRefund", () => {
  function setup(appt: Record<string, unknown> | null, existingRequests: unknown[] = []) {
    const mock = createSupabaseMock({
      appointments: (q) => applyFilters(appt ? [appt] : [], q),
      refund_requests: (q) =>
        q.op === "insert"
          ? { data: { id: "req-1", requested_remedy: "refund", status: "pending" } }
          : applyFilters(existingRequests, q),
    });
    supabaseHolder.current = mock.client;
    return mock;
  }

  it("creates a pending request for a missed, paid consultation", async () => {
    const mock = setup(PAID_MISSED);
    const { requestAppointmentRefund } = await import("../src/controllers/appointments");
    const res = makeRes();

    await requestAppointmentRefund(makeReq({ requestedType: "refund", reason: " no one came " }, PARENT), res);

    expect(res.statusCode).toBe(201);
    const insert = mock.queries.find((q) => q.table === "refund_requests" && q.op === "insert")!;
    expect(insert.payload).toMatchObject({
      appointment_id: "appt-1",
      parent_id: PARENT,
      doctor_id: DOCTOR,
      requested_remedy: "refund",
      reason: "no one came",
    });
  });

  it("rejects a requested type it does not recognise", async () => {
    setup(PAID_MISSED);
    const { requestAppointmentRefund } = await import("../src/controllers/appointments");
    const res = makeRes();

    await requestAppointmentRefund(makeReq({ requestedType: "store_credit" }, PARENT), res);

    expect(res.statusCode).toBe(400);
  });

  it("will not let one parent claim against another parent's appointment", async () => {
    setup(PAID_MISSED);
    const { requestAppointmentRefund } = await import("../src/controllers/appointments");
    const res = makeRes();

    await requestAppointmentRefund(makeReq({ requestedType: "refund" }, "someone-else"), res);

    expect(res.statusCode).toBe(404);
  });

  it("refuses a consultation both sides attended", async () => {
    setup({ ...PAID_MISSED, attendance_outcome: "both_joined" });
    const { requestAppointmentRefund } = await import("../src/controllers/appointments");
    const res = makeRes();

    await requestAppointmentRefund(makeReq({ requestedType: "refund" }, PARENT), res);

    expect(res.statusCode).toBe(400);
  });

  it("refuses a consultation that has not been swept yet, rather than burning the claim", async () => {
    setup({ ...PAID_MISSED, attendance_outcome: null });
    const { requestAppointmentRefund } = await import("../src/controllers/appointments");
    const res = makeRes();

    await requestAppointmentRefund(makeReq({ requestedType: "refund" }, PARENT), res);

    expect(res.statusCode).toBe(409);
  });

  it("refuses a booking that was never paid for", async () => {
    setup({ ...PAID_MISSED, payment_status: "pending" });
    const { requestAppointmentRefund } = await import("../src/controllers/appointments");
    const res = makeRes();

    await requestAppointmentRefund(makeReq({ requestedType: "refund" }, PARENT), res);

    expect(res.statusCode).toBe(400);
  });

  it("refuses a second request while one is still awaiting a decision", async () => {
    setup(PAID_MISSED, [
      { id: "req-existing", appointment_id: "appt-1", status: "pending" },
    ]);
    const { requestAppointmentRefund } = await import("../src/controllers/appointments");
    const res = makeRes();

    await requestAppointmentRefund(makeReq({ requestedType: "free_session" }, PARENT), res);

    expect(res.statusCode).toBe(409);
  });

  it("refuses a second request once one has been approved", async () => {
    setup(PAID_MISSED, [
      { id: "req-existing", appointment_id: "appt-1", status: "approved" },
    ]);
    const { requestAppointmentRefund } = await import("../src/controllers/appointments");
    const res = makeRes();

    await requestAppointmentRefund(makeReq({ requestedType: "refund" }, PARENT), res);

    expect(res.statusCode).toBe(409);
  });

  it("lets a parent ask again after a decline, for the other option", async () => {
    // The reported bug: a parent asked for a replacement session, the doctor
    // declined, and the 409 then left them with no way to ask for their money
    // instead. A declined request settled nothing and must not lock the claim.
    const mock = setup(PAID_MISSED, [
      { id: "req-declined", appointment_id: "appt-1", status: "declined" },
    ]);
    const { requestAppointmentRefund } = await import("../src/controllers/appointments");
    const res = makeRes();

    await requestAppointmentRefund(makeReq({ requestedType: "refund" }, PARENT), res);

    expect(res.statusCode).toBe(201);
    const insert = mock.queries.find(
      (q) => q.table === "refund_requests" && q.op === "insert"
    );
    expect(insert?.payload).toMatchObject({ requested_remedy: "refund" });
  });

  it("only treats pending and approved requests as blocking", async () => {
    const mock = setup(PAID_MISSED, []);
    const { requestAppointmentRefund } = await import("../src/controllers/appointments");

    await requestAppointmentRefund(makeReq({ requestedType: "refund" }, PARENT), makeRes());

    const read = mock.queries.find(
      (q) => q.table === "refund_requests" && q.op === "select"
    )!;
    expect(read.calls).toContainEqual({
      method: "in",
      args: ["status", ["pending", "approved"]],
    });
  });

  it("turns the unique-constraint violation from a double submit into a 409", async () => {
    const mock = createSupabaseMock({
      appointments: (q) => applyFilters([PAID_MISSED], q),
      refund_requests: (q) =>
        q.op === "insert"
          ? { error: { message: "duplicate key", code: "23505" } as any }
          : applyFilters([], q),
    });
    supabaseHolder.current = mock.client;
    const { requestAppointmentRefund } = await import("../src/controllers/appointments");
    const res = makeRes();

    await requestAppointmentRefund(makeReq({ requestedType: "refund" }, PARENT), res);

    expect(res.statusCode).toBe(409);
  });
});

// ─── Doctor: answering a request ──────────────────────────────────────────────

describe("resolveRefundRequest", () => {
  const REQUEST = {
    id: "req-1",
    appointment_id: "appt-1",
    parent_id: PARENT,
    doctor_id: DOCTOR,
    requested_remedy: "refund",
    status: "pending",
  };

  function setup(opts: {
    request?: Record<string, unknown>;
    appointment?: Record<string, unknown>;
    refundsCreate?: ReturnType<typeof vi.fn>;
    restoreError?: { message: string };
  } = {}) {
    const request = opts.request ?? REQUEST;
    const appointment = opts.appointment ?? PAID_MISSED;

    const mock = createSupabaseMock(
      {
        doctors: (q) => applyFilters([{ id: DOCTOR, profile_id: DOCTOR_PROFILE, timezone: "Asia/Dubai" }], q),
        refund_requests: (q) =>
          q.op === "update" ? { data: { id: "req-1", status: "approved" } } : applyFilters([request], q),
        appointments: (q) => (q.op === "update" ? { data: [] } : applyFilters([appointment], q)),
        consultation_packages: (q) =>
          applyFilters([{ id: "pkg-replacement", slug: "replacement_session", validity_days: 60 }], q),
        user_packages: (q) => (q.op === "insert" ? { data: { id: "up-new" } } : applyFilters([], q)),
        package_usage_logs: () => ({ data: [] }),
      },
      {
        restore_package_credit: () => (opts.restoreError ? { error: opts.restoreError } : { data: null }),
      }
    );
    supabaseHolder.current = mock.client;

    const refundsCreate =
      opts.refundsCreate ??
      vi.fn(async () => ({ id: "re_1", amount: 39900, currency: "aed", status: "succeeded" }));
    stripeHolder.current = { refunds: { create: refundsCreate } };

    return { mock, refundsCreate };
  }

  it("refunds a directly-paid consultation through Stripe", async () => {
    const { mock, refundsCreate } = setup();
    const { resolveRefundRequest } = await import("../src/controllers/doctor-dashboard");
    const res = makeRes();

    await resolveRefundRequest(makeReq({ action: "approve" }, DOCTOR_PROFILE, { id: "req-1" }), res);

    expect(res.statusCode).toBe(200);
    expect(refundsCreate).toHaveBeenCalledTimes(1);
    expect(refundsCreate.mock.calls[0][0]).toMatchObject({ payment_intent: "pi_123" });

    const update = mock.queries.find((q) => q.table === "refund_requests" && q.op === "update")!;
    expect(update.payload).toMatchObject({
      status: "approved",
      stripe_refund_id: "re_1",
      refund_amount_aed: 399,
    });
  });

  it("leaves payment_status to the charge.refunded webhook rather than writing it twice", async () => {
    const { mock } = setup();
    const { resolveRefundRequest } = await import("../src/controllers/doctor-dashboard");

    await resolveRefundRequest(makeReq({ action: "approve" }, DOCTOR_PROFILE, { id: "req-1" }), makeRes());

    const apptUpdates = mock.queries.filter((q) => q.table === "appointments" && q.op === "update");
    expect(apptUpdates).toHaveLength(0);
  });

  it("keeps the request pending when Stripe refuses the refund", async () => {
    const refundsCreate = vi.fn(async () => {
      throw new Error("card_declined");
    });
    const { mock } = setup({ refundsCreate });
    const { resolveRefundRequest } = await import("../src/controllers/doctor-dashboard");
    const res = makeRes();

    await resolveRefundRequest(makeReq({ action: "approve" }, DOCTOR_PROFILE, { id: "req-1" }), res);

    expect(res.statusCode).toBe(502);
    expect(mock.queries.some((q) => q.table === "refund_requests" && q.op === "update")).toBe(false);
  });

  it("returns the credit instead of cash when the booking used one", async () => {
    const { mock, refundsCreate } = setup({
      appointment: {
        ...PAID_MISSED,
        payment_status: "package_credit",
        price_aed: 0,
        stripe_payment_intent: null,
        payment_reference: "PKG-up-7",
      },
    });
    const { resolveRefundRequest } = await import("../src/controllers/doctor-dashboard");
    const res = makeRes();

    await resolveRefundRequest(makeReq({ action: "approve" }, DOCTOR_PROFILE, { id: "req-1" }), res);

    expect(res.statusCode).toBe(200);
    expect(refundsCreate).not.toHaveBeenCalled();
    expect(mock.rpcs).toContainEqual({
      fn: "restore_package_credit",
      args: { p_user_package_id: "up-7" },
    });
  });

  it("removes the usage log so the credit is not still recorded as spent", async () => {
    const { mock } = setup({
      appointment: {
        ...PAID_MISSED,
        payment_status: "package_credit",
        stripe_payment_intent: null,
        payment_reference: "PKG-up-7",
      },
    });
    const { resolveRefundRequest } = await import("../src/controllers/doctor-dashboard");

    await resolveRefundRequest(makeReq({ action: "approve" }, DOCTOR_PROFILE, { id: "req-1" }), makeRes());

    expect(
      mock.queries.some((q) => q.table === "package_usage_logs" && q.op === "delete")
    ).toBe(true);
  });

  it("does not approve when the credit could not be restored", async () => {
    const { mock } = setup({
      appointment: {
        ...PAID_MISSED,
        payment_status: "package_credit",
        stripe_payment_intent: null,
        payment_reference: "PKG-up-7",
      },
      restoreError: { message: "row not found" },
    });
    const { resolveRefundRequest } = await import("../src/controllers/doctor-dashboard");
    const res = makeRes();

    await resolveRefundRequest(makeReq({ action: "approve" }, DOCTOR_PROFILE, { id: "req-1" }), res);

    expect(res.statusCode).toBe(500);
    expect(mock.queries.some((q) => q.table === "refund_requests" && q.op === "update")).toBe(false);
  });

  it("grants one credit, expiring, when a replacement session was asked for", async () => {
    const { mock, refundsCreate } = setup({
      request: { ...REQUEST, requested_remedy: "free_session" },
    });
    const { resolveRefundRequest } = await import("../src/controllers/doctor-dashboard");
    const res = makeRes();

    await resolveRefundRequest(makeReq({ action: "approve" }, DOCTOR_PROFILE, { id: "req-1" }), res);

    expect(res.statusCode).toBe(200);
    expect(refundsCreate).not.toHaveBeenCalled();

    const grant = mock.queries.find((q) => q.table === "user_packages" && q.op === "insert")!;
    expect(grant.payload).toMatchObject({
      user_id: PARENT,
      package_id: "pkg-replacement",
      credits_total: 1,
      credits_remaining: 1,
      // Never bought, so it must not collide with the purchased-session index.
      stripe_checkout_session_id: null,
      granted_by_appointment_id: "appt-1",
      granted_by_profile_id: DOCTOR_PROFILE,
    });
    expect(typeof (grant.payload as any).expires_at).toBe("string");
  });

  it("declines without moving money or granting anything", async () => {
    const { mock, refundsCreate } = setup();
    const { resolveRefundRequest } = await import("../src/controllers/doctor-dashboard");
    const res = makeRes();

    await resolveRefundRequest(
      makeReq({ action: "decline", note: "Patient rebooked" }, DOCTOR_PROFILE, { id: "req-1" }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(refundsCreate).not.toHaveBeenCalled();
    expect(mock.queries.some((q) => q.table === "user_packages" && q.op === "insert")).toBe(false);

    const update = mock.queries.find((q) => q.table === "refund_requests" && q.op === "update")!;
    expect(update.payload).toMatchObject({ status: "declined", resolution_note: "Patient rebooked" });
  });

  it("records who decided and when", async () => {
    const { mock } = setup();
    const { resolveRefundRequest } = await import("../src/controllers/doctor-dashboard");

    await resolveRefundRequest(makeReq({ action: "approve" }, DOCTOR_PROFILE, { id: "req-1" }), makeRes());

    const update = mock.queries.find((q) => q.table === "refund_requests" && q.op === "update")!;
    expect((update.payload as any).resolved_by).toBe(DOCTOR_PROFILE);
    expect(typeof (update.payload as any).resolved_at).toBe("string");
  });

  it("will not let a doctor resolve another doctor's request", async () => {
    const { mock } = setup();
    const { resolveRefundRequest } = await import("../src/controllers/doctor-dashboard");

    await resolveRefundRequest(makeReq({ action: "approve" }, DOCTOR_PROFILE, { id: "req-1" }), makeRes());

    const read = mock.queries.find((q) => q.table === "refund_requests" && q.op === "select")!;
    expect(read.calls).toContainEqual({ method: "eq", args: ["doctor_id", DOCTOR] });
  });

  it("refuses to answer a request that was already answered", async () => {
    setup({ request: { ...REQUEST, status: "approved" } });
    const { resolveRefundRequest } = await import("../src/controllers/doctor-dashboard");
    const res = makeRes();

    await resolveRefundRequest(makeReq({ action: "approve" }, DOCTOR_PROFILE, { id: "req-1" }), res);

    expect(res.statusCode).toBe(400);
  });

  it("guards the approval write on the request still being pending", async () => {
    const { mock } = setup();
    const { resolveRefundRequest } = await import("../src/controllers/doctor-dashboard");

    await resolveRefundRequest(makeReq({ action: "approve" }, DOCTOR_PROFILE, { id: "req-1" }), makeRes());

    const update = mock.queries.find((q) => q.table === "refund_requests" && q.op === "update")!;
    expect(update.calls).toContainEqual({ method: "eq", args: ["status", "pending"] });
  });
});

// ─── Completing settles attendance ────────────────────────────────────────────

describe("completeAppointment", () => {
  it("classifies attendance so a missed call is claimable straight away", async () => {
    // The regression this guards: the doctor pressed Complete on a call nobody
    // joined, the sweep skipped 'completed' rows, attendance_outcome stayed
    // NULL, and the parent's claim button never appeared.
    const mock = createSupabaseMock({
      doctors: (q) =>
        applyFilters([{ id: DOCTOR, profile_id: DOCTOR_PROFILE, timezone: "Asia/Dubai" }], q),
      appointments: (q) =>
        q.op === "update"
          ? { data: q.calls.some((c) => c.method === "is") ? [{ id: "appt-1" }] : { id: "appt-1", status: "completed" } }
          : applyFilters([{ id: "appt-1", status: "confirmed", doctor_id: DOCTOR }], q),
      appointment_join_events: (q) => applyFilters([], q),
    });
    supabaseHolder.current = mock.client;

    const { completeAppointment } = await import("../src/controllers/doctor-dashboard");
    const res = makeRes();

    await completeAppointment(makeReq({}, DOCTOR_PROFILE, { id: "appt-1" }), res);

    expect(res.statusCode).toBe(200);

    // Two writes: the status transition, then the attendance verdict.
    const updates = mock.queries.filter((q) => q.table === "appointments" && q.op === "update");
    expect(updates.map((u) => u.payload)).toContainEqual({ status: "completed" });
    expect(updates.map((u) => u.payload)).toContainEqual({ attendance_outcome: "neither" });
  });
});
