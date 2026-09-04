import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyFilters, createSupabaseMock, has } from "./helpers/mocks";

const supabaseHolder = vi.hoisted(() => ({ current: null as any }));
vi.mock("../src/lib/supabase", () => ({
  get supabaseAdmin() {
    return supabaseHolder.current;
  },
}));

// A consultation at 10:00 Dubai on 2026-03-10, 30 minutes long. Its join window
// therefore closes at 11:00 Dubai (30 min after the 10:30 end), i.e. 07:00 UTC.
const APPT = {
  id: "appt-1",
  scheduled_date: "2026-03-10",
  scheduled_time: "10:00:00",
  timezone: "Asia/Dubai",
  duration_minutes: 30,
  // Both are filtered on by the sweep's select, so the fixture carries them.
  status: "confirmed",
  attendance_outcome: null,
};

const AFTER_WINDOW = new Date("2026-03-10T08:00:00Z");
const DURING_WINDOW = new Date("2026-03-10T06:30:00Z");

function setup(joinEvents: Array<{ appointment_id: string; role: string }>, appts = [APPT]) {
  const mock = createSupabaseMock({
    appointments: (q) => (q.op === "update" ? { data: [{ id: APPT.id }] } : applyFilters(appts, q)),
    appointment_join_events: (q) => applyFilters(joinEvents, q),
  });
  supabaseHolder.current = mock.client;
  return mock;
}

beforeEach(() => {
  vi.resetModules();
  supabaseHolder.current = null;
});

describe("classifyAttendance", () => {
  it("reports both_joined when each side asked for a token", async () => {
    const { classifyAttendance } = await import("../src/lib/attendance");
    expect(classifyAttendance([{ role: "parent" }, { role: "doctor" }])).toBe("both_joined");
  });

  it("reports parent_only when the doctor never joined", async () => {
    const { classifyAttendance } = await import("../src/lib/attendance");
    expect(classifyAttendance([{ role: "parent" }])).toBe("parent_only");
  });

  it("reports doctor_only when the patient never joined", async () => {
    const { classifyAttendance } = await import("../src/lib/attendance");
    expect(classifyAttendance([{ role: "doctor" }])).toBe("doctor_only");
  });

  it("reports neither when nobody joined", async () => {
    const { classifyAttendance } = await import("../src/lib/attendance");
    expect(classifyAttendance([])).toBe("neither");
  });

  it("collapses repeat joins by the same side", async () => {
    const { classifyAttendance } = await import("../src/lib/attendance");
    // Reconnecting after a dropped call must not read as two people.
    expect(classifyAttendance([{ role: "parent" }, { role: "parent" }])).toBe("parent_only");
  });
});

describe("isMissedOutcome", () => {
  it("treats an unswept appointment as undecided, not as a no-show", async () => {
    const { isMissedOutcome } = await import("../src/lib/attendance");
    expect(isMissedOutcome(null)).toBe(false);
    expect(isMissedOutcome(undefined)).toBe(false);
  });

  it("treats an attended call as not missed", async () => {
    const { isMissedOutcome } = await import("../src/lib/attendance");
    expect(isMissedOutcome("both_joined")).toBe(false);
  });

  it("treats every one-sided or empty outcome as missed", async () => {
    const { isMissedOutcome } = await import("../src/lib/attendance");
    expect(isMissedOutcome("parent_only")).toBe(true);
    expect(isMissedOutcome("doctor_only")).toBe(true);
    expect(isMissedOutcome("neither")).toBe(true);
  });
});

describe("recordJoinEvent", () => {
  it("writes one row carrying the appointment, user and role", async () => {
    const mock = setup([]);
    const { recordJoinEvent } = await import("../src/lib/attendance");

    await recordJoinEvent("appt-1", "user-9", "doctor");

    const insert = mock.queries.find(
      (q) => q.table === "appointment_join_events" && q.op === "insert"
    );
    expect(insert?.payload).toEqual({
      appointment_id: "appt-1",
      user_id: "user-9",
      role: "doctor",
    });
  });

  it("never throws when the insert fails, so a call is still joinable", async () => {
    const mock = createSupabaseMock({
      appointment_join_events: () => ({ error: { message: "constraint violation" } }),
    });
    supabaseHolder.current = mock.client;
    const { recordJoinEvent } = await import("../src/lib/attendance");

    await expect(recordJoinEvent("appt-1", "user-9", "parent")).resolves.toBeUndefined();
  });
});

describe("sweepAttendance", () => {
  it("classifies an appointment whose window has closed", async () => {
    const mock = setup([{ appointment_id: "appt-1", role: "parent" }]);
    const { sweepAttendance } = await import("../src/lib/attendance");

    const run = await sweepAttendance(AFTER_WINDOW);

    expect(run).toEqual({ considered: 1, classified: 1 });
    const update = mock.queries.find((q) => q.table === "appointments" && q.op === "update");
    expect(update?.payload).toEqual({ attendance_outcome: "parent_only" });
  });

  it("leaves an appointment alone while its room is still joinable", async () => {
    const mock = setup([]);
    const { sweepAttendance } = await import("../src/lib/attendance");

    const run = await sweepAttendance(DURING_WINDOW);

    expect(run).toEqual({ considered: 0, classified: 0 });
    expect(mock.queries.some((q) => q.table === "appointments" && q.op === "update")).toBe(false);
  });

  it("resolves the window in the appointment's own zone, not the server's", async () => {
    // Same wall-clock time, but in Los Angeles the window closes 12 hours later
    // than it does in Dubai — so at 08:00 UTC this one is still open.
    setup([], [{ ...APPT, timezone: "America/Los_Angeles" }]);
    const { sweepAttendance } = await import("../src/lib/attendance");

    expect(await sweepAttendance(AFTER_WINDOW)).toEqual({ considered: 0, classified: 0 });
  });

  it("considers confirmed AND completed, unclassified appointments", async () => {
    const mock = setup([]);
    const { sweepAttendance } = await import("../src/lib/attendance");

    await sweepAttendance(AFTER_WINDOW);

    const read = mock.queries.find((q) => q.table === "appointments" && q.op === "select")!;
    // 'completed' must be in scope: it is the status the doctor's own
    // "Complete Session" button writes, and excluding it let that button void
    // every claim against them.
    expect(read.calls).toContainEqual({
      method: "in",
      args: ["status", ["confirmed", "completed"]],
    });
    expect(read.calls).toContainEqual({ method: "is", args: ["attendance_outcome", null] });
  });

  it("classifies a completed appointment even before its window shuts", async () => {
    // The doctor scheduled a call, then immediately pressed Complete. Nobody
    // joined, and nobody now can -- the parent should not wait until the
    // original end time plus grace to be able to claim.
    const mock = setup([], [{ ...APPT, status: "completed" }]);
    const { sweepAttendance } = await import("../src/lib/attendance");

    const run = await sweepAttendance(DURING_WINDOW);

    expect(run).toEqual({ considered: 1, classified: 1 });
    const update = mock.queries.find((q) => q.table === "appointments" && q.op === "update");
    expect(update?.payload).toEqual({ attendance_outcome: "neither" });
  });

  it("still waits for the window on a confirmed appointment nobody ended", async () => {
    const mock = setup([], [{ ...APPT, status: "confirmed" }]);
    const { sweepAttendance } = await import("../src/lib/attendance");

    expect(await sweepAttendance(DURING_WINDOW)).toEqual({ considered: 0, classified: 0 });
    expect(mock.queries.some((q) => q.table === "appointments" && q.op === "update")).toBe(false);
  });

  it("does not call a completed consultation missed when both sides joined", async () => {
    const mock = setup(
      [
        { appointment_id: "appt-1", role: "parent" },
        { appointment_id: "appt-1", role: "doctor" },
      ],
      [{ ...APPT, status: "completed" }]
    );
    const { sweepAttendance } = await import("../src/lib/attendance");

    await sweepAttendance(DURING_WINDOW);

    const update = mock.queries.find((q) => q.table === "appointments" && q.op === "update");
    expect(update?.payload).toEqual({ attendance_outcome: "both_joined" });
  });

  it("guards the write so two overlapping runs cannot both claim a row", async () => {
    const mock = setup([]);
    const { sweepAttendance } = await import("../src/lib/attendance");

    await sweepAttendance(AFTER_WINDOW);

    const update = mock.queries.find((q) => q.table === "appointments" && q.op === "update")!;
    expect(update.calls).toContainEqual({ method: "is", args: ["attendance_outcome", null] });
  });

  it("does not count a row another run had already claimed", async () => {
    const mock = createSupabaseMock({
      appointments: (q) =>
        q.op === "update" ? { data: [] } : applyFilters([APPT], q),
      appointment_join_events: (q) => applyFilters([], q),
    });
    supabaseHolder.current = mock.client;
    const { sweepAttendance } = await import("../src/lib/attendance");

    expect(await sweepAttendance(AFTER_WINDOW)).toEqual({ considered: 1, classified: 0 });
  });

  it("bounds the batch so one run cannot walk the whole table", async () => {
    const mock = setup([]);
    const { sweepAttendance } = await import("../src/lib/attendance");

    await sweepAttendance(AFTER_WINDOW);

    const read = mock.queries.find((q) => q.table === "appointments" && q.op === "select")!;
    expect(has(read, "limit")).toBe(true);
  });
});


describe("classifyAppointment", () => {
  it("writes the outcome for a single appointment", async () => {
    const mock = setup([{ appointment_id: "appt-1", role: "doctor" }]);
    const { classifyAppointment } = await import("../src/lib/attendance");

    expect(await classifyAppointment("appt-1")).toBe("doctor_only");
    const update = mock.queries.find((q) => q.table === "appointments" && q.op === "update");
    expect(update?.payload).toEqual({ attendance_outcome: "doctor_only" });
  });

  it("guards on the outcome still being NULL, so a second caller is a no-op", async () => {
    const mock = createSupabaseMock({
      appointments: (q) => (q.op === "update" ? { data: [] } : applyFilters([APPT], q)),
      appointment_join_events: (q) => applyFilters([], q),
    });
    supabaseHolder.current = mock.client;
    const { classifyAppointment } = await import("../src/lib/attendance");

    // Already classified by the sweep or the other caller: reports no change.
    expect(await classifyAppointment("appt-1")).toBeNull();
    const update = mock.queries.find((q) => q.table === "appointments" && q.op === "update")!;
    expect(update.calls).toContainEqual({ method: "is", args: ["attendance_outcome", null] });
  });

  it("never throws, so it cannot fail the transition that called it", async () => {
    const mock = createSupabaseMock({
      appointment_join_events: () => ({ error: { message: "boom" } }),
      appointments: () => ({ error: { message: "boom" } }),
    });
    supabaseHolder.current = mock.client;
    const { classifyAppointment } = await import("../src/lib/attendance");

    await expect(classifyAppointment("appt-1")).resolves.toBeNull();
  });
});
