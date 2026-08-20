/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFetchMock, createSupabaseMock, json } from "./helpers/mocks";

// The lib reads the supabaseAdmin singleton; route it to a per-test mock.
const supabaseHolder = vi.hoisted(() => ({ current: null as any }));
vi.mock("../src/lib/supabase", () => ({
  get supabaseAdmin() {
    return supabaseHolder.current;
  },
}));

const ROOMS = "https://api.daily.co/v1/rooms";
const SESSION_ID = "cccccccc-dddd-4eee-8fff-000000000000";
const ROOM_NAME = SESSION_ID;
const ROOM_URL = `https://littlecare.daily.co/${ROOM_NAME}`;

// scheduled_at 2026-09-01T05:00:00Z, 60-minute session: opens 15 min before
// start (04:45Z) and closes 30 min after the 06:00Z end (06:30Z).
const OPENS_AT = Date.parse("2026-09-01T04:45:00Z") / 1000;
const CLOSES_AT = Date.parse("2026-09-01T06:30:00Z") / 1000;

function sessionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    status: "scheduled",
    scheduled_at: "2026-09-01T05:00:00Z",
    duration_minutes: 60,
    daily_room_name: null,
    daily_room_url: null,
    ...overrides,
  };
}

function setup(session: any) {
  const mock = createSupabaseMock({
    group_sessions: (q) => (q.op === "select" ? { data: session } : {}),
  });
  supabaseHolder.current = mock.client;
  return mock;
}

async function loadLib() {
  return import("../src/lib/group-session-room");
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

describe("groupSessionJoinWindow", () => {
  it("opens 15 minutes before and closes 30 minutes after", async () => {
    const lib = await loadLib();
    const window = lib.groupSessionJoinWindow(sessionRow() as any)!;

    expect(window.start.toISOString()).toBe("2026-09-01T05:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-09-01T06:00:00.000Z");
    expect(window.opensAt.toISOString()).toBe("2026-09-01T04:45:00.000Z");
    expect(window.closesAt.toISOString()).toBe("2026-09-01T06:30:00.000Z");
  });

  it("returns null for an unparsable schedule", async () => {
    const lib = await loadLib();
    expect(lib.groupSessionJoinWindow(sessionRow({ scheduled_at: "nonsense" }) as any)).toBeNull();
  });
});

describe("ensureGroupSessionRoom", () => {
  it("creates a private room named the bare session id, with the join window", async () => {
    const mock = setup(sessionRow());
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
    await expect(lib.ensureGroupSessionRoom(SESSION_ID)).resolves.toBe(ROOM_URL);

    expect(created.name).toBe(ROOM_NAME);
    expect(created.privacy).toBe("private");
    expect(created.properties.nbf).toBe(OPENS_AT);
    expect(created.properties.exp).toBe(CLOSES_AT);

    const writes = mock.queries.filter((q) => q.table === "group_sessions" && q.op === "update");
    expect(writes).toHaveLength(1);
    expect((writes[0].payload as any).daily_room_name).toBe(ROOM_NAME);
    expect((writes[0].payload as any).daily_room_url).toBe(ROOM_URL);
  });

  it("reuses an existing room without recreating it", async () => {
    const mock = setup(sessionRow({ daily_room_name: ROOM_NAME, daily_room_url: ROOM_URL }));
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
    await expect(lib.ensureGroupSessionRoom(SESSION_ID)).resolves.toBe(ROOM_URL);
    expect(fetchMock.calls.filter((c) => c.method === "POST")).toHaveLength(0);

    // Row already matches (bare id + url), and the room's window matches the
    // schedule, so nothing warrants a write — the skip guard must not fire a
    // no-op update.
    const writes = mock.queries.filter((q) => q.table === "group_sessions" && q.op === "update");
    expect(writes).toHaveLength(0);
  });

  it("leaves a live session's drifted room window alone", async () => {
    setup(sessionRow({ status: "live", daily_room_name: ROOM_NAME, daily_room_url: ROOM_URL }));
    const fetchMock = createFetchMock([
      {
        match: (m, u) => m === "GET" && u === `${ROOMS}/${ROOM_NAME}`,
        respond: () =>
          json(200, {
            name: ROOM_NAME,
            url: ROOM_URL,
            id: "r1",
            // goLive-era window: nbf=now, exp=now+duration+3600 — drifted
            // from (and wider than) the schedule-derived window.
            config: { nbf: OPENS_AT - 86_400, exp: CLOSES_AT + 86_400 },
          }),
      },
    ]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await expect(lib.ensureGroupSessionRoom(SESSION_ID)).resolves.toBe(ROOM_URL);
    expect(fetchMock.calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("moves the window when the session was rescheduled", async () => {
    setup(sessionRow({ daily_room_name: ROOM_NAME, daily_room_url: ROOM_URL }));
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
    await lib.ensureGroupSessionRoom(SESSION_ID);

    expect(updated.properties.nbf).toBe(OPENS_AT);
    expect(updated.properties.exp).toBe(CLOSES_AT);
  });

  it("refuses to give a cancelled session a room", async () => {
    setup(sessionRow({ status: "cancelled" }));
    const fetchMock = createFetchMock([]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await expect(lib.ensureGroupSessionRoom(SESSION_ID)).resolves.toBeNull();
    expect(fetchMock.calls).toHaveLength(0);
  });

  it("refuses to give an ended session a room", async () => {
    setup(sessionRow({ status: "ended" }));
    const fetchMock = createFetchMock([]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await expect(lib.ensureGroupSessionRoom(SESSION_ID)).resolves.toBeNull();
    expect(fetchMock.calls).toHaveLength(0);
  });

  it("resolves null when Daily is unreachable — never throws", async () => {
    setup(sessionRow());
    const fetchMock = createFetchMock([
      { match: () => true, respond: () => json(500, { error: "daily is down" }) },
    ]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await expect(lib.ensureGroupSessionRoom(SESSION_ID)).resolves.toBeNull();
  });
});

describe("deleteGroupSessionRoom", () => {
  it("deletes the room and clears both stored columns", async () => {
    const mock = setup(sessionRow({ daily_room_name: ROOM_NAME, daily_room_url: ROOM_URL }));
    const fetchMock = createFetchMock([
      { match: (m) => m === "DELETE", respond: () => json(200, { deleted: true }) },
    ]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await lib.deleteGroupSessionRoom(SESSION_ID);

    expect(fetchMock.calls.some((c) => c.method === "DELETE" && c.url === `${ROOMS}/${ROOM_NAME}`)).toBe(
      true
    );
    const writes = mock.queries.filter((q) => q.table === "group_sessions" && q.op === "update");
    expect(writes).toHaveLength(1);
    expect((writes[0].payload as any).daily_room_name).toBeNull();
    expect((writes[0].payload as any).daily_room_url).toBeNull();
  });

  it("treats an already-deleted room as success and still nulls the columns", async () => {
    const mock = setup(sessionRow({ daily_room_name: ROOM_NAME, daily_room_url: ROOM_URL }));
    const fetchMock = createFetchMock([
      { match: (m) => m === "DELETE", respond: () => json(404, { error: "not found" }) },
    ]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await expect(lib.deleteGroupSessionRoom(SESSION_ID)).resolves.toBeUndefined();

    const writes = mock.queries.filter((q) => q.table === "group_sessions" && q.op === "update");
    expect(writes).toHaveLength(1);
    expect((writes[0].payload as any).daily_room_name).toBeNull();
  });
});
