/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyFilters, createFetchMock, createSupabaseMock, json } from "./helpers/mocks";

// The lib reads the supabaseAdmin singleton; route it to a per-test mock.
const supabaseHolder = vi.hoisted(() => ({ current: null as any }));
vi.mock("../src/lib/supabase", () => ({
  get supabaseAdmin() {
    return supabaseHolder.current;
  },
}));

const ROOMS = "https://api.daily.co/v1/rooms";
const APPT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const ROOM_NAME = `appt-${APPT_ID}`;
const ROOM_URL = `https://littlecare.daily.co/${ROOM_NAME}`;

// 09:00 Asia/Dubai on 2026-09-01 is 05:00Z; a 30-minute consultation therefore
// opens at 04:45Z (15 min before) and closes at 06:00Z (30 min after the end).
const OPENS_AT = Date.parse("2026-09-01T04:45:00Z") / 1000;
const CLOSES_AT = Date.parse("2026-09-01T06:00:00Z") / 1000;

function appointmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: APPT_ID,
    status: "confirmed",
    scheduled_date: "2026-09-01",
    scheduled_time: "09:00:00",
    timezone: "Asia/Dubai",
    duration_minutes: 30,
    meeting_url: null,
    ...overrides,
  };
}

function setup(appointment: any) {
  const mock = createSupabaseMock({
    appointments: (q) => (q.op === "select" ? { data: appointment } : {}),
  });
  supabaseHolder.current = mock.client;
  return mock;
}

async function loadLib() {
  return import("../src/lib/appointment-room");
}

beforeEach(() => {
  vi.resetModules();
  process.env.DAILY_API_KEY = "test-daily-key";
  supabaseHolder.current = null;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("appointmentJoinWindow", () => {
  it("opens 15 minutes before and closes 30 minutes after, in the booking's zone", async () => {
    const lib = await loadLib();
    const window = lib.appointmentJoinWindow(appointmentRow() as any)!;

    expect(window.start.toISOString()).toBe("2026-09-01T05:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-09-01T05:30:00.000Z");
    expect(window.opensAt.toISOString()).toBe("2026-09-01T04:45:00.000Z");
    expect(window.closesAt.toISOString()).toBe("2026-09-01T06:00:00.000Z");
  });

  it("reads the booking's own timezone rather than the server's", async () => {
    const lib = await loadLib();
    const dubai = lib.appointmentJoinWindow(appointmentRow() as any)!;
    const london = lib.appointmentJoinWindow(
      appointmentRow({ timezone: "Europe/London" }) as any
    )!;

    // Same wall clock, different zones — so different instants.
    expect(dubai.start.toISOString()).not.toBe(london.start.toISOString());
    expect(london.start.toISOString()).toBe("2026-09-01T08:00:00.000Z");
  });

  it("returns null for an unreadable schedule", async () => {
    const lib = await loadLib();
    expect(lib.appointmentJoinWindow(appointmentRow({ scheduled_date: "nonsense" }) as any)).toBeNull();
  });
});

describe("ensureAppointmentRoom", () => {
  it("creates a private room whose window matches the appointment", async () => {
    const mock = setup(appointmentRow());
    let created: any = null;
    const fetchMock = createFetchMock([
      { match: (m, u) => m === "GET" && u === `${ROOMS}/${ROOM_NAME}`, respond: () => json(404, {}) },
      {
        match: (m, u) => m === "POST" && u === ROOMS,
        respond: (call) => {
          created = call.body;
          return json(200, { name: ROOM_NAME, url: ROOM_URL, id: "r1" });
        },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await expect(lib.ensureAppointmentRoom(APPT_ID)).resolves.toBe(ROOM_URL);

    expect(created.name).toBe(ROOM_NAME);
    expect(created.privacy).toBe("private");
    expect(created.properties.nbf).toBe(OPENS_AT);
    expect(created.properties.exp).toBe(CLOSES_AT);

    // The URL is written back so emails and the dashboard can use it.
    const writes = mock.queries.filter((q) => q.table === "appointments" && q.op === "update");
    expect(writes).toHaveLength(1);
    expect((writes[0].payload as any).meeting_url).toBe(ROOM_URL);
  });

  it("reuses an existing room without recreating it", async () => {
    setup(appointmentRow({ meeting_url: ROOM_URL }));
    const fetchMock = createFetchMock([
      {
        match: (m, u) => m === "GET" && u === `${ROOMS}/${ROOM_NAME}`,
        respond: () =>
          json(200, {
            name: ROOM_NAME,
            url: ROOM_URL,
            id: "r1",
            config: { nbf: OPENS_AT, exp: CLOSES_AT },
          }),
      },
    ]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await expect(lib.ensureAppointmentRoom(APPT_ID)).resolves.toBe(ROOM_URL);
    expect(fetchMock.calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("moves the window when the appointment was rescheduled", async () => {
    setup(appointmentRow({ meeting_url: ROOM_URL }));
    let updated: any = null;
    const fetchMock = createFetchMock([
      {
        match: (m, u) => m === "GET" && u === `${ROOMS}/${ROOM_NAME}`,
        respond: () =>
          json(200, {
            name: ROOM_NAME,
            url: ROOM_URL,
            id: "r1",
            // Yesterday's slot — the room would refuse entry at the new time.
            config: { nbf: OPENS_AT - 86_400, exp: CLOSES_AT - 86_400 },
          }),
      },
      {
        match: (m, u) => m === "POST" && u === `${ROOMS}/${ROOM_NAME}`,
        respond: (call) => {
          updated = call.body;
          return json(200, { name: ROOM_NAME, url: ROOM_URL, id: "r1" });
        },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await lib.ensureAppointmentRoom(APPT_ID);

    expect(updated.properties.nbf).toBe(OPENS_AT);
    expect(updated.properties.exp).toBe(CLOSES_AT);
  });

  it("refuses to give a cancelled appointment a room", async () => {
    setup(appointmentRow({ status: "cancelled" }));
    const fetchMock = createFetchMock([]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await expect(lib.ensureAppointmentRoom(APPT_ID)).resolves.toBeNull();
    expect(fetchMock.calls).toHaveLength(0);
  });

  it("never throws when Daily is unreachable — a booking must not fail over video", async () => {
    setup(appointmentRow());
    const fetchMock = createFetchMock([
      { match: () => true, respond: () => json(500, { error: "daily is down" }) },
    ]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await expect(lib.ensureAppointmentRoom(APPT_ID)).resolves.toBeNull();
  });
});

describe("deleteAppointmentRoom", () => {
  it("removes the room and clears the stored URL", async () => {
    const mock = setup(appointmentRow({ meeting_url: ROOM_URL }));
    const fetchMock = createFetchMock([
      { match: (m) => m === "DELETE", respond: () => json(200, { deleted: true }) },
    ]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await lib.deleteAppointmentRoom(APPT_ID);

    expect(fetchMock.calls.some((c) => c.method === "DELETE")).toBe(true);
    const writes = mock.queries.filter((q) => q.table === "appointments" && q.op === "update");
    expect((writes[0].payload as any).meeting_url).toBeNull();
  });

  it("treats an already-deleted room as success", async () => {
    setup(appointmentRow());
    const fetchMock = createFetchMock([
      { match: (m) => m === "DELETE", respond: () => json(404, { error: "not found" }) },
    ]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await expect(lib.deleteAppointmentRoom(APPT_ID)).resolves.toBeUndefined();
  });
});

describe("meeting tokens", () => {
  it("carries the participant's name, so Daily does not label them Guest", async () => {
    let body: any = null;
    const fetchMock = createFetchMock([
      {
        match: (m, u) => m === "POST" && u === "https://api.daily.co/v1/meeting-tokens",
        respond: (call) => {
          body = call.body;
          return json(200, { token: "tok" });
        },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const { createMeetingToken } = await import("../src/lib/daily");
    await createMeetingToken({
      roomName: ROOM_NAME,
      userId: "user-1",
      userName: "Amal Hassan",
      isOwner: false,
      expiryEpoch: CLOSES_AT,
      notBeforeEpoch: OPENS_AT,
    });

    expect(body.properties.user_name).toBe("Amal Hassan");
    expect(body.properties.room_name).toBe(ROOM_NAME);
    expect(body.properties.is_owner).toBe(false);
    expect(body.properties.nbf).toBe(OPENS_AT);
    expect(body.properties.exp).toBe(CLOSES_AT);
  });

  it("grants recording only to the host", async () => {
    const bodies: any[] = [];
    const fetchMock = createFetchMock([
      {
        match: (m) => m === "POST",
        respond: (call) => {
          bodies.push(call.body);
          return json(200, { token: "tok" });
        },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const { createMeetingToken } = await import("../src/lib/daily");
    const base = { roomName: ROOM_NAME, userId: "u", userName: "N", expiryEpoch: CLOSES_AT };
    await createMeetingToken({ ...base, isOwner: true });
    await createMeetingToken({ ...base, isOwner: false });

    expect(bodies[0].properties.enable_recording).toBe("cloud");
    expect(bodies[1].properties.enable_recording).toBeUndefined();
  });
});

/**
 * The mock's applyFilters is exercised indirectly above; this keeps the import
 * honest so an unused-import lint never silently removes it.
 */
describe("test helpers", () => {
  it("filters rows by eq", () => {
    const rows = [{ id: "a" }, { id: "b" }];
    expect(applyFilters(rows, { table: "t", op: "select", calls: [{ method: "eq", args: ["id", "b"] }] })).toEqual({
      data: [{ id: "b" }],
      count: 1,
    });
  });
});
