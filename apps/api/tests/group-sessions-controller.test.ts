/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyFilters,
  argOf,
  createFetchMock,
  createSupabaseMock,
  json,
  makeRes,
  type TableHandler,
} from "./helpers/mocks";

// The controller reads the supabaseAdmin singleton (directly, and indirectly
// through lib/group-session-room.ts and lib/daily.ts) — route it to a
// per-test mock the same way the lib-level suites do.
const supabaseHolder = vi.hoisted(() => ({ current: null as any }));
vi.mock("../src/lib/supabase", () => ({
  get supabaseAdmin() {
    return supabaseHolder.current;
  },
}));

const ROOMS = "https://api.daily.co/v1/rooms";
const TOKENS = "https://api.daily.co/v1/meeting-tokens";

const SESSION_ID = "99999999-1111-4222-8333-444444444444";
const DOCTOR_ID = "88888888-1111-4222-8333-444444444444";
const HOST_USER_ID = "77777777-1111-4222-8333-444444444444";
const PARENT_USER_ID = "66666666-1111-4222-8333-444444444444";
const OTHER_USER_ID = "55555555-1111-4222-8333-444444444444";
const ROOM_NAME = SESSION_ID; // groupSessionRoomName is the bare session id
const ROOM_URL = `https://littlecare.daily.co/${ROOM_NAME}`;

// scheduled_at 2026-09-01T05:00:00Z, 60-minute session: opens 15 min before
// start (04:45Z) and closes 30 min after the 06:00Z end (06:30Z).
const OPENS_AT_ISO = "2026-09-01T04:45:00.000Z";
const CLOSES_AT_ISO = "2026-09-01T06:30:00.000Z";
const OPENS_AT_EPOCH = Math.floor(Date.parse(OPENS_AT_ISO) / 1000);
const CLOSES_AT_EPOCH = Math.floor(Date.parse(CLOSES_AT_ISO) / 1000);

const DOCTORS = [{ id: DOCTOR_ID, profile_id: HOST_USER_ID }];
const REGISTRATIONS = [
  { id: "reg-1", session_id: SESSION_ID, user_id: PARENT_USER_ID, payment_status: "paid" },
];

function sessionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    status: "scheduled",
    scheduled_at: "2026-09-01T05:00:00Z",
    duration_minutes: 60,
    doctor_id: DOCTOR_ID,
    daily_room_name: ROOM_NAME,
    daily_room_url: ROOM_URL,
    ...overrides,
  };
}

/**
 * Both the controller and lib/group-session-room.ts read/write group_sessions,
 * with and without a doctor_id filter, and each expects the update payload
 * echoed back through .select().single(). One handler covers all of it.
 */
function groupSessionsHandler(row: Record<string, unknown>): TableHandler {
  return (q) => {
    if (q.op === "update") {
      return { data: { ...row, ...(q.payload as object) } };
    }
    const idFilter = argOf(q, "eq", "id");
    const doctorFilter = argOf(q, "eq", "doctor_id");
    if (idFilter !== undefined && idFilter !== row.id) return { data: null };
    if (doctorFilter !== undefined && doctorFilter !== row.doctor_id) return { data: null };
    return { data: row };
  };
}

function setup(opts: {
  session: Record<string, unknown>;
  registrations?: Array<Record<string, unknown>>;
  doctors?: Array<Record<string, unknown>>;
}) {
  const mock = createSupabaseMock({
    group_sessions: groupSessionsHandler(opts.session),
    doctors: (q) => applyFilters(opts.doctors ?? DOCTORS, q),
    session_registrations: (q) => applyFilters(opts.registrations ?? REGISTRATIONS, q),
  });
  supabaseHolder.current = mock.client;
  return mock;
}

async function loadController() {
  return import("../src/controllers/group-sessions");
}

/** The room already exists with a window matching the schedule — no create/update needed. */
function existingRoomFetchMock(extraRoutes: Parameters<typeof createFetchMock>[0] = []) {
  return createFetchMock([
    {
      match: (m, u) => m === "GET" && u === `${ROOMS}/${ROOM_NAME}`,
      respond: () =>
        json(200, {
          name: ROOM_NAME,
          url: ROOM_URL,
          id: "r1",
          config: { nbf: OPENS_AT_EPOCH, exp: CLOSES_AT_EPOCH },
        }),
    },
    ...extraRoutes,
  ]);
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

describe("joinSession", () => {
  it("blocks a registered parent before the window opens, without touching Daily", async () => {
    vi.setSystemTime(new Date("2026-09-01T04:00:00.000Z"));
    setup({ session: sessionRow() });
    const fetchMock = createFetchMock([]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const { joinSession } = await loadController();
    const req = { params: { id: SESSION_ID }, userId: PARENT_USER_ID } as any;
    const res = makeRes();
    await joinSession(req, res as any);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe("This session is not open yet");
    expect(res.body.opensAt).toBe(OPENS_AT_ISO);
    expect(fetchMock.calls).toHaveLength(0);
  });

  it("mints a token and returns the room for a registered parent inside the window", async () => {
    vi.setSystemTime(new Date("2026-09-01T05:30:00.000Z"));
    setup({ session: sessionRow() });
    let tokenBody: any = null;
    const fetchMock = existingRoomFetchMock([
      {
        match: (m, u) => m === "POST" && u === TOKENS,
        respond: (call) => {
          tokenBody = call.body;
          return json(200, { token: "test-token" });
        },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const { joinSession } = await loadController();
    const req = { params: { id: SESSION_ID }, userId: PARENT_USER_ID } as any;
    const res = makeRes();
    await joinSession(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBe("test-token");
    expect(res.body.roomUrl).toBe(ROOM_URL);
    expect(tokenBody.properties.exp).toBe(CLOSES_AT_EPOCH);
    expect(tokenBody.properties.is_owner).toBeFalsy();
    expect(
      fetchMock.calls.some((c) => c.method === "GET" && c.url === `${ROOMS}/${ROOM_NAME}`)
    ).toBe(true);
  });

  it("blocks a registered parent after the window closes", async () => {
    vi.setSystemTime(new Date("2026-09-01T06:31:00.000Z"));
    setup({ session: sessionRow() });
    const fetchMock = createFetchMock([]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const { joinSession } = await loadController();
    const req = { params: { id: SESSION_ID }, userId: PARENT_USER_ID } as any;
    const res = makeRes();
    await joinSession(req, res as any);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe("This session has ended");
    expect(res.body.opensAt).toBeUndefined();
    expect(fetchMock.calls).toHaveLength(0);
  });

  it("blocks an unregistered user inside the window", async () => {
    vi.setSystemTime(new Date("2026-09-01T05:30:00.000Z"));
    setup({ session: sessionRow() });
    const fetchMock = createFetchMock([]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const { joinSession } = await loadController();
    const req = { params: { id: SESSION_ID }, userId: OTHER_USER_ID } as any;
    const res = makeRes();
    await joinSession(req, res as any);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe("You are not registered for this session");
    expect(fetchMock.calls).toHaveLength(0);
  });

  it("lets the host doctor join without a registration row, granted ownership", async () => {
    vi.setSystemTime(new Date("2026-09-01T05:30:00.000Z"));
    setup({ session: sessionRow(), registrations: [] });
    let tokenBody: any = null;
    const fetchMock = existingRoomFetchMock([
      {
        match: (m, u) => m === "POST" && u === TOKENS,
        respond: (call) => {
          tokenBody = call.body;
          return json(200, { token: "host-token" });
        },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const { joinSession } = await loadController();
    const req = { params: { id: SESSION_ID }, userId: HOST_USER_ID } as any;
    const res = makeRes();
    await joinSession(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBe("host-token");
    expect(tokenBody.properties.is_owner).toBe(true);
  });

  it("rejects joining a cancelled session before checking registration", async () => {
    vi.setSystemTime(new Date("2026-09-01T05:30:00.000Z"));
    setup({ session: sessionRow({ status: "cancelled" }) });
    const fetchMock = createFetchMock([]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const { joinSession } = await loadController();
    const req = { params: { id: SESSION_ID }, userId: PARENT_USER_ID } as any;
    const res = makeRes();
    await joinSession(req, res as any);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("This session is no longer available");
    expect(fetchMock.calls).toHaveLength(0);
  });
});

describe("goLive", () => {
  it("refuses to go live before the window opens, and does not flip status", async () => {
    vi.setSystemTime(new Date("2026-09-01T04:00:00.000Z"));
    const mock = setup({ session: sessionRow() });
    const fetchMock = createFetchMock([]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const { goLive } = await loadController();
    const req = { params: { id: SESSION_ID }, userId: HOST_USER_ID } as any;
    const res = makeRes();
    await goLive(req, res as any);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("This session cannot go live yet");
    expect(res.body.opensAt).toBe(OPENS_AT_ISO);
    expect(fetchMock.calls).toHaveLength(0);

    const liveUpdates = mock.queries.filter(
      (q) =>
        q.table === "group_sessions" &&
        q.op === "update" &&
        (q.payload as any)?.status === "live"
    );
    expect(liveUpdates).toHaveLength(0);
  });

  it("refuses to go live after the window closes", async () => {
    vi.setSystemTime(new Date("2026-09-01T06:31:00.000Z"));
    const mock = setup({ session: sessionRow() });
    const fetchMock = createFetchMock([]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const { goLive } = await loadController();
    const req = { params: { id: SESSION_ID }, userId: HOST_USER_ID } as any;
    const res = makeRes();
    await goLive(req, res as any);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe(
      "This session's scheduled time has passed — reschedule it first"
    );
    expect(fetchMock.calls).toHaveLength(0);

    const liveUpdates = mock.queries.filter(
      (q) =>
        q.table === "group_sessions" &&
        q.op === "update" &&
        (q.payload as any)?.status === "live"
    );
    expect(liveUpdates).toHaveLength(0);
  });

  it("goes live inside the window, creating the room since none exists yet", async () => {
    vi.setSystemTime(new Date("2026-09-01T05:30:00.000Z"));
    const mock = setup({
      session: sessionRow({ daily_room_name: null, daily_room_url: null }),
    });
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

    const { goLive } = await loadController();
    const req = { params: { id: SESSION_ID }, userId: HOST_USER_ID } as any;
    const res = makeRes();
    await goLive(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body.session.status).toBe("live");
    expect(created.name).toBe(ROOM_NAME);
    expect(
      fetchMock.calls.some((c) => c.method === "GET" && c.url === `${ROOMS}/${ROOM_NAME}`)
    ).toBe(true);
    expect(fetchMock.calls.some((c) => c.method === "POST" && c.url === ROOMS)).toBe(true);

    const liveUpdates = mock.queries.filter(
      (q) =>
        q.table === "group_sessions" &&
        q.op === "update" &&
        (q.payload as any)?.status === "live"
    );
    expect(liveUpdates).toHaveLength(1);
  });
});
