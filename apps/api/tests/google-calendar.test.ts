/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyFilters,
  createFetchMock,
  createMirrorStore,
  createSupabaseMock,
  empty,
  json,
  tokenRefreshRoute,
  type RecordedQuery,
} from "./helpers/mocks";

// The lib reads the supabaseAdmin singleton; route it to a per-test mock.
const supabaseHolder = vi.hoisted(() => ({ current: null as any }));
vi.mock("../src/lib/supabase", () => ({
  get supabaseAdmin() {
    return supabaseHolder.current;
  },
}));

const EVENTS = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

const APPT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const APPT_EVENT_ID = `appt${APPT_ID.replace(/-/g, "")}`;
const SESSION_ID = "11111111-2222-4333-8444-555555555555";
const SESSION_EVENT_ID = `gsess${SESSION_ID.replace(/-/g, "")}`;

const ADMIN_ID = "admin-1";
const PARENT_ID = "parent-1";
const OTHER_PARENT_ID = "parent-2";
const DOCTOR_PROFILE_ID = "doctor-profile-1";

const ADMIN_ACCOUNT = {
  id: "acct-admin",
  user_id: ADMIN_ID,
  google_email: "admin@example.com",
  refresh_token: "rt-admin",
  status: "connected",
  last_error: null,
  connected_at: "2026-08-01T00:00:00Z",
};

const PARENT_ACCOUNT = {
  id: "acct-parent",
  user_id: PARENT_ID,
  google_email: "parent@example.com",
  refresh_token: "rt-parent",
  status: "connected",
  last_error: null,
  connected_at: "2026-08-02T00:00:00Z",
};

const DOCTOR_ACCOUNT = {
  id: "acct-doctor",
  user_id: DOCTOR_PROFILE_ID,
  google_email: "doctor@example.com",
  refresh_token: "rt-doctor",
  status: "connected",
  last_error: null,
  connected_at: "2026-08-03T00:00:00Z",
};

const ACCESS_TOKENS = {
  "rt-admin": "at-admin",
  "rt-parent": "at-parent",
  "rt-doctor": "at-doctor",
  "rt-registrant": "at-registrant",
};

const PROFILES = [
  { id: ADMIN_ID, role: "admin", is_active: true, full_name: "Admin" },
  { id: PARENT_ID, role: "parent", is_active: true, full_name: "Parent One" },
  { id: OTHER_PARENT_ID, role: "parent", is_active: true, full_name: "Parent Two" },
  { id: DOCTOR_PROFILE_ID, role: "doctor", is_active: true, full_name: "Dr. Sahar" },
  { id: "u1", role: "parent", is_active: true, full_name: "Registrant One" },
  { id: "u2", role: "parent", is_active: true, full_name: "Registrant Two" },
];

function appointmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: APPT_ID,
    parent_id: PARENT_ID,
    status: "confirmed",
    payment_status: "package_credit",
    scheduled_date: "2026-09-01",
    scheduled_time: "09:00:00",
    timezone: "Asia/Dubai",
    duration_minutes: 30,
    doctors: {
      full_name: "Dr. Sahar",
      email: "doctor@example.com",
      profile_id: DOCTOR_PROFILE_ID,
    },
    ...overrides,
  };
}

function sessionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    title: "Newborn sleep basics",
    status: "scheduled",
    is_published: true,
    scheduled_at: "2026-09-05T15:00:00+00:00",
    duration_minutes: 60,
    doctors: {
      full_name: "Dr. Sahar",
      email: "doctor@example.com",
      profile_id: DOCTOR_PROFILE_ID,
      timezone: "Asia/Dubai",
    },
    session_registrations: [
      { user_id: "u1", payment_status: "paid" },
      { user_id: "u2", payment_status: "free" },
      { user_id: "u3", payment_status: "pending" },
    ],
    ...overrides,
  };
}

/**
 * Wire up supabase with a set of connected accounts, a stateful mirrors table,
 * profiles (so roles resolve), and whatever booking rows the test needs.
 */
function setup(options: {
  accounts?: any[];
  mirrors?: any[];
  appointment?: any;
  session?: any;
  extra?: Record<string, (q: RecordedQuery) => any>;
}) {
  const mirrorStore = createMirrorStore(options.mirrors ?? []);
  const accounts = options.accounts ?? [];

  const mock = createSupabaseMock({
    profiles: (q) => applyFilters(PROFILES, q),
    google_calendar_accounts: (q) => {
      if (q.op === "update" || q.op === "insert" || q.op === "delete") return {};
      return applyFilters(accounts, q);
    },
    calendar_event_mirrors: mirrorStore.handler,
    calendar_event_logs: () => ({}),
    appointments: (q) =>
      options.appointment !== undefined && q.op === "select" ? { data: options.appointment } : {},
    group_sessions: (q) =>
      options.session !== undefined && q.op === "select" ? { data: options.session } : {},
    ...(options.extra ?? {}),
  });

  supabaseHolder.current = mock.client;
  return { mock, mirrors: mirrorStore.rows, accounts };
}

function logInserts(mock: ReturnType<typeof createSupabaseMock>) {
  return mock.queries.filter((q) => q.table === "calendar_event_logs" && q.op === "insert");
}

/** Body of the POST that created an event in a given calendar. */
function createdIn(fetchMock: ReturnType<typeof createFetchMock>, accessToken: string) {
  return fetchMock.calls.find(
    (c) =>
      c.method === "POST" && c.url.startsWith(EVENTS) && c.authorization === `Bearer ${accessToken}`
  )?.body;
}

/** Standard "no event exists yet, creation succeeds" Google stub. */
function createRoutes(eventId: string) {
  return [
    tokenRefreshRoute(ACCESS_TOKENS),
    { match: (m: string) => m === "GET", respond: () => json(404, {}) },
    { match: (m: string) => m === "POST", respond: () => json(200, { id: eventId }) },
  ];
}

async function loadLib() {
  return import("../src/lib/google-calendar");
}

beforeEach(() => {
  vi.resetModules();
  process.env.GOOGLE_CLIENT_ID = "test-client";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";
  process.env.GOOGLE_REDIRECT_URI = "http://localhost:4000/api/google-calendar/callback";
  process.env.JWT_SECRET = "test-jwt-secret";
  process.env.FRONTEND_URL = "http://localhost:3333";
  supabaseHolder.current = null;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ─── State tokens ─────────────────────────────────────────────────────────────

describe("OAuth state tokens", () => {
  it("round-trips a userId", async () => {
    const lib = await loadLib();
    const state = lib.signState("user-42");
    expect(lib.verifyState(state!)).toEqual({ userId: "user-42" });
  });

  it("rejects a tampered payload", async () => {
    const lib = await loadLib();
    const state = lib.signState("user-42")!;
    const sig = state.slice(state.lastIndexOf(".") + 1);
    const forged =
      Buffer.from(JSON.stringify({ u: "attacker", t: Date.now() })).toString("base64url") +
      "." +
      sig;
    expect(lib.verifyState(forged)).toBeNull();
  });

  it("rejects a tampered signature and garbage", async () => {
    const lib = await loadLib();
    const state = lib.signState("user-42")!;
    expect(lib.verifyState(state.slice(0, -2) + "xx")).toBeNull();
    expect(lib.verifyState("garbage")).toBeNull();
    expect(lib.verifyState(undefined)).toBeNull();
  });

  it("rejects an expired state", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-18T10:00:00Z"));
    const lib = await loadLib();
    const state = lib.signState("user-42")!;
    vi.setSystemTime(new Date("2026-08-18T10:11:00Z")); // TTL is 10 minutes
    expect(lib.verifyState(state)).toBeNull();
  });

  it("fails closed without JWT_SECRET", async () => {
    delete process.env.JWT_SECRET;
    const lib = await loadLib();
    expect(lib.signState("user-42")).toBeNull();
    expect(lib.verifyState("anything.x")).toBeNull();
  });
});

// ─── Ids and auth URL ─────────────────────────────────────────────────────────

describe("event ids and auth url", () => {
  it("derives valid base32hex ids from row uuids", async () => {
    const lib = await loadLib();
    expect(lib.appointmentEventId(APPT_ID)).toBe(APPT_EVENT_ID);
    expect(lib.groupSessionEventId(SESSION_ID)).toBe(SESSION_EVENT_ID);
    expect(lib.appointmentEventId(APPT_ID)).toMatch(/^[a-v0-9]+$/);
    expect(lib.groupSessionEventId(SESSION_ID)).toMatch(/^[a-v0-9]+$/);
  });

  it("requests offline access with forced consent and the calendar scope", async () => {
    const lib = await loadLib();
    const url = new URL(lib.buildAuthUrl("the-state")!);
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("scope")).toContain(
      "https://www.googleapis.com/auth/calendar.events"
    );
  });

  it("exchanges a code for a refresh token and the account email", async () => {
    const idToken = [
      Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url"),
      Buffer.from(JSON.stringify({ email: "someone@example.com" })).toString("base64url"),
      "sig",
    ].join(".");
    const fetchMock = createFetchMock([
      {
        match: (m, u) => m === "POST" && u.startsWith("https://oauth2.googleapis.com/token"),
        respond: () => json(200, { access_token: "at", refresh_token: "rt-new", id_token: idToken }),
      },
    ]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await expect(lib.exchangeCode("the-code")).resolves.toEqual({
      refreshToken: "rt-new",
      email: "someone@example.com",
    });
  });
});

// ─── Who receives which booking ───────────────────────────────────────────────

describe("appointment visibility by role", () => {
  it("writes nothing when nobody has connected a calendar", async () => {
    const { mock } = setup({ accounts: [], appointment: appointmentRow() });
    const fetchMock = createFetchMock([]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await lib.syncAppointmentCalendarEvent(APPT_ID);

    expect(fetchMock.calls).toHaveLength(0);
    expect(logInserts(mock)).toHaveLength(0);
  });

  it("gives the parent and the doctor their own private copies", async () => {
    const { mirrors } = setup({
      accounts: [PARENT_ACCOUNT, DOCTOR_ACCOUNT],
      appointment: appointmentRow(),
    });
    const fetchMock = createFetchMock(createRoutes(APPT_EVENT_ID));
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await lib.syncAppointmentCalendarEvent(APPT_ID);

    const parentEvent = createdIn(fetchMock, "at-parent");
    const doctorEvent = createdIn(fetchMock, "at-doctor");
    expect(parentEvent).toBeDefined();
    expect(doctorEvent).toBeDefined();

    // Nobody is an attendee anywhere, so no address is shared between them.
    expect(parentEvent.attendees).toEqual([]);
    expect(doctorEvent.attendees).toEqual([]);

    // 09:00 Asia/Dubai (UTC+4) on 2026-09-01 → 05:00Z, 30 minutes long.
    expect(Date.parse(parentEvent.start.dateTime)).toBe(Date.parse("2026-09-01T05:00:00Z"));
    expect(Date.parse(parentEvent.end.dateTime)).toBe(Date.parse("2026-09-01T05:30:00Z"));

    expect(mirrors.map((m) => m.account_id).sort()).toEqual(["acct-doctor", "acct-parent"]);
  });

  it("never puts one parent's appointment on another parent's calendar", async () => {
    // The booking belongs to OTHER_PARENT; only PARENT_ID has connected.
    const { mirrors } = setup({
      accounts: [PARENT_ACCOUNT],
      appointment: appointmentRow({ parent_id: OTHER_PARENT_ID }),
    });
    const fetchMock = createFetchMock(createRoutes(APPT_EVENT_ID));
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await lib.syncAppointmentCalendarEvent(APPT_ID);

    expect(fetchMock.calls.filter((c) => c.url.startsWith(EVENTS))).toHaveLength(0);
    expect(mirrors).toHaveLength(0);
  });

  it("never puts an appointment on an unrelated doctor's calendar", async () => {
    const { mirrors } = setup({
      accounts: [DOCTOR_ACCOUNT],
      appointment: appointmentRow({
        doctors: { full_name: "Other Doctor", email: null, profile_id: "some-other-doctor" },
      }),
    });
    const fetchMock = createFetchMock(createRoutes(APPT_EVENT_ID));
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await lib.syncAppointmentCalendarEvent(APPT_ID);

    expect(fetchMock.calls.filter((c) => c.url.startsWith(EVENTS))).toHaveLength(0);
    expect(mirrors).toHaveLength(0);
  });

  it("gives an admin every booking, including ones they take no part in", async () => {
    setup({
      accounts: [ADMIN_ACCOUNT],
      appointment: appointmentRow({ parent_id: OTHER_PARENT_ID }),
    });
    const fetchMock = createFetchMock(createRoutes(APPT_EVENT_ID));
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await lib.syncAppointmentCalendarEvent(APPT_ID);

    const adminEvent = createdIn(fetchMock, "at-admin");
    expect(adminEvent).toBeDefined();
    expect(adminEvent.attendees).toEqual([]);
    expect(adminEvent.description).toContain("/dashboard/admin/appointments?appointment=");
  });

  it("skips an admin whose calendar is disconnected but keeps the participants", async () => {
    setup({
      accounts: [PARENT_ACCOUNT, { ...ADMIN_ACCOUNT, status: "error" }],
      appointment: appointmentRow(),
    });
    const fetchMock = createFetchMock(createRoutes(APPT_EVENT_ID));
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await lib.syncAppointmentCalendarEvent(APPT_ID);

    expect(createdIn(fetchMock, "at-parent")).toBeDefined();
    expect(createdIn(fetchMock, "at-admin")).toBeUndefined();
  });

  it("shows each calendar only the link its owner can open", async () => {
    setup({
      accounts: [PARENT_ACCOUNT, DOCTOR_ACCOUNT, ADMIN_ACCOUNT],
      appointment: appointmentRow(),
    });
    const fetchMock = createFetchMock(createRoutes(APPT_EVENT_ID));
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await lib.syncAppointmentCalendarEvent(APPT_ID);

    const parentDesc = createdIn(fetchMock, "at-parent").description;
    expect(parentDesc).toContain("/dashboard/parent/appointments?appointment=");
    expect(parentDesc).not.toContain("/dashboard/doctor/");
    expect(parentDesc).not.toContain("/dashboard/admin/");

    const doctorDesc = createdIn(fetchMock, "at-doctor").description;
    expect(doctorDesc).toContain("/dashboard/doctor/appointments?appointment=");
    expect(doctorDesc).not.toContain("/dashboard/parent/");

    const adminDesc = createdIn(fetchMock, "at-admin").description;
    expect(adminDesc).toContain("/dashboard/admin/appointments?appointment=");
    expect(adminDesc).not.toContain("/dashboard/parent/");
  });

  it("keeps the participant link when an admin is also the doctor on the booking", async () => {
    // Same person is the host and an admin — the host link is the useful one.
    const adminIsDoctor = { ...ADMIN_ACCOUNT, user_id: DOCTOR_PROFILE_ID };
    setup({ accounts: [adminIsDoctor], appointment: appointmentRow() });
    const fetchMock = createFetchMock(createRoutes(APPT_EVENT_ID));
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await lib.syncAppointmentCalendarEvent(APPT_ID);

    const created = fetchMock.calls.filter((c) => c.method === "POST" && c.url.startsWith(EVENTS));
    expect(created).toHaveLength(1); // one copy, not two
    expect(created[0].body.description).toContain("/dashboard/doctor/appointments?appointment=");
  });

  it("keeps per-account access tokens separate", async () => {
    setup({ accounts: [PARENT_ACCOUNT, DOCTOR_ACCOUNT], appointment: appointmentRow() });
    const fetchMock = createFetchMock(createRoutes(APPT_EVENT_ID));
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await lib.syncAppointmentCalendarEvent(APPT_ID);

    const refreshes = fetchMock.calls.filter((c) =>
      c.url.startsWith("https://oauth2.googleapis.com/token")
    );
    expect(refreshes.map((c) => c.body.refresh_token).sort()).toEqual(["rt-doctor", "rt-parent"]);
    const used = new Set(
      fetchMock.calls.filter((c) => c.url.startsWith(EVENTS)).map((c) => c.authorization)
    );
    expect(used).toEqual(new Set(["Bearer at-parent", "Bearer at-doctor"]));
  });
});

// ─── Lifecycle ────────────────────────────────────────────────────────────────

describe("appointment lifecycle", () => {
  it("creates no event for a confirmed but unpaid appointment", async () => {
    setup({
      accounts: [PARENT_ACCOUNT],
      appointment: appointmentRow({ payment_status: "pending" }),
    });
    const fetchMock = createFetchMock([]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await lib.syncAppointmentCalendarEvent(APPT_ID);
    expect(fetchMock.calls).toHaveLength(0);
  });

  it("leaves a completed appointment's events untouched", async () => {
    setup({
      accounts: [PARENT_ACCOUNT],
      appointment: appointmentRow({ status: "completed" }),
      mirrors: [
        {
          account_id: "acct-parent",
          related_type: "appointment",
          related_id: APPT_ID,
          google_event_id: APPT_EVENT_ID,
        },
      ],
    });
    const fetchMock = createFetchMock([]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await lib.syncAppointmentCalendarEvent(APPT_ID);
    expect(fetchMock.calls).toHaveLength(0);
  });

  it("deletes from every mirrored calendar when the appointment is cancelled", async () => {
    const { mirrors } = setup({
      accounts: [PARENT_ACCOUNT, ADMIN_ACCOUNT],
      appointment: appointmentRow({ status: "cancelled", payment_status: "refunded" }),
      mirrors: [
        {
          account_id: "acct-admin",
          related_type: "appointment",
          related_id: APPT_ID,
          google_event_id: APPT_EVENT_ID,
        },
        {
          account_id: "acct-parent",
          related_type: "appointment",
          related_id: APPT_ID,
          google_event_id: APPT_EVENT_ID,
        },
      ],
    });
    const fetchMock = createFetchMock([
      tokenRefreshRoute(ACCESS_TOKENS),
      { match: (m) => m === "DELETE", respond: () => empty(204) },
    ]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await lib.syncAppointmentCalendarEvent(APPT_ID);

    const deletes = fetchMock.calls.filter((c) => c.method === "DELETE");
    expect(deletes.map((c) => c.authorization).sort()).toEqual([
      "Bearer at-admin",
      "Bearer at-parent",
    ]);
    expect(mirrors).toHaveLength(0);
  });

  it("removes the copy of someone who disconnected", async () => {
    const { mirrors } = setup({
      accounts: [PARENT_ACCOUNT, { ...DOCTOR_ACCOUNT, user_id: "left-the-clinic" }],
      appointment: appointmentRow(),
      mirrors: [
        {
          account_id: "acct-doctor",
          related_type: "appointment",
          related_id: APPT_ID,
          google_event_id: APPT_EVENT_ID,
        },
      ],
    });
    const fetchMock = createFetchMock([
      ...createRoutes(APPT_EVENT_ID),
      { match: (m: string) => m === "DELETE", respond: () => empty(204) },
    ]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await lib.syncAppointmentCalendarEvent(APPT_ID);

    expect(
      fetchMock.calls.some((c) => c.method === "DELETE" && c.authorization === "Bearer at-doctor")
    ).toBe(true);
    expect(mirrors.some((m) => m.account_id === "acct-doctor")).toBe(false);
  });

  it("treats deleting an already-gone event as success without logging", async () => {
    const { mock } = setup({
      accounts: [PARENT_ACCOUNT],
      appointment: appointmentRow({ status: "cancelled" }),
      mirrors: [
        {
          account_id: "acct-parent",
          related_type: "appointment",
          related_id: APPT_ID,
          google_event_id: APPT_EVENT_ID,
        },
      ],
    });
    const fetchMock = createFetchMock([
      tokenRefreshRoute(ACCESS_TOKENS),
      { match: (m) => m === "DELETE", respond: () => json(404, { error: "gone" }) },
    ]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await lib.syncAppointmentCalendarEvent(APPT_ID);
    expect(logInserts(mock)).toHaveLength(0);
  });

  it("does not PATCH (or re-notify) when the existing event already matches", async () => {
    setup({ accounts: [PARENT_ACCOUNT], appointment: appointmentRow() });
    let created: any = null;
    let existsNow = false;
    const fetchMock = createFetchMock([
      tokenRefreshRoute(ACCESS_TOKENS),
      {
        match: (m, u) => m === "GET" && u.startsWith(`${EVENTS}/${APPT_EVENT_ID}`),
        respond: () =>
          existsNow
            ? json(200, {
                ...created,
                status: "confirmed",
                // Same instants, different representation — must compare equal.
                start: { dateTime: "2026-09-01T09:00:00+04:00", timeZone: "Asia/Dubai" },
                end: { dateTime: "2026-09-01T09:30:00+04:00", timeZone: "Asia/Dubai" },
              })
            : json(404, {}),
      },
      {
        match: (m, u) => m === "POST" && u.startsWith(`${EVENTS}?`),
        respond: (call) => {
          created = call.body;
          existsNow = true;
          return json(200, { id: APPT_EVENT_ID });
        },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await lib.syncAppointmentCalendarEvent(APPT_ID);
    await lib.syncAppointmentCalendarEvent(APPT_ID); // replay (verify-page reload)

    expect(
      fetchMock.calls.filter((c) => c.method === "POST" && c.url.startsWith(EVENTS))
    ).toHaveLength(1);
    expect(fetchMock.calls.filter((c) => c.method === "PATCH")).toHaveLength(0);
  });

  it("patches on a real change and strips any guests a previous version carried", async () => {
    const { mock } = setup({ accounts: [PARENT_ACCOUNT], appointment: appointmentRow() });
    let patched: any = null;
    const fetchMock = createFetchMock([
      tokenRefreshRoute(ACCESS_TOKENS),
      {
        match: (m) => m === "GET",
        respond: () =>
          json(200, {
            id: APPT_EVENT_ID,
            status: "confirmed",
            summary: "Drsahar Pediatrics – Consultation with Dr. Sahar",
            description: "stale",
            start: { dateTime: "2026-09-01T04:00:00Z", timeZone: "Asia/Dubai" },
            end: { dateTime: "2026-09-01T04:30:00Z", timeZone: "Asia/Dubai" },
            attendees: [{ email: "someone-else@example.com", responseStatus: "accepted" }],
          }),
      },
      {
        match: (m) => m === "PATCH",
        respond: (call) => {
          patched = call.body;
          return json(200, { id: APPT_EVENT_ID });
        },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await lib.syncAppointmentCalendarEvent(APPT_ID);

    expect(Date.parse(patched.start.dateTime)).toBe(Date.parse("2026-09-01T05:00:00Z"));
    expect(patched.status).toBe("confirmed"); // resurrect-capable
    expect(patched.attendees).toEqual([]); // old guests removed
    expect(logInserts(mock)[0].payload).toMatchObject({ action: "update", status: "sent" });
  });

  it("converges through PATCH when a concurrent create wins the race (insert 409)", async () => {
    const { mock } = setup({ accounts: [PARENT_ACCOUNT], appointment: appointmentRow() });
    let patchCount = 0;
    const fetchMock = createFetchMock([
      tokenRefreshRoute(ACCESS_TOKENS),
      { match: (m) => m === "GET", respond: () => json(404, {}) },
      {
        match: (m) => m === "POST",
        respond: () => json(409, { error: "The requested identifier already exists." }),
      },
      {
        match: (m) => m === "PATCH",
        respond: () => {
          patchCount += 1;
          return json(200, { id: APPT_EVENT_ID });
        },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await lib.syncAppointmentCalendarEvent(APPT_ID);

    expect(patchCount).toBe(1);
    expect(logInserts(mock)[0].payload).toMatchObject({ action: "create", status: "sent" });
  });

  it("marks only the broken account on invalid_grant and still syncs the others", async () => {
    const { mock } = setup({
      accounts: [PARENT_ACCOUNT, DOCTOR_ACCOUNT],
      appointment: appointmentRow(),
    });
    const fetchMock = createFetchMock([
      {
        match: (m, u) => m === "POST" && u.startsWith("https://oauth2.googleapis.com/token"),
        respond: (call) =>
          call.body.refresh_token === "rt-parent"
            ? json(400, { error: "invalid_grant" })
            : json(200, { access_token: "at-doctor", expires_in: 3600 }),
      },
      { match: (m) => m === "GET", respond: () => json(404, {}) },
      { match: (m) => m === "POST", respond: () => json(200, { id: APPT_EVENT_ID }) },
    ]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await lib.syncAppointmentCalendarEvent(APPT_ID);

    const updates = mock.queries.filter(
      (q) => q.table === "google_calendar_accounts" && q.op === "update"
    );
    expect(updates.length).toBeGreaterThan(0);
    expect((updates[0].payload as any).status).toBe("error");
    expect(createdIn(fetchMock, "at-doctor")).toBeDefined();
  });
});

// ─── Group sessions ───────────────────────────────────────────────────────────

describe("live session visibility", () => {
  it("gives the host and each confirmed registrant a private copy", async () => {
    const registrant = {
      id: "acct-u1",
      user_id: "u1",
      google_email: "one@example.com",
      refresh_token: "rt-registrant",
      status: "connected",
      last_error: null,
      connected_at: "2026-08-04T00:00:00Z",
    };
    setup({ accounts: [DOCTOR_ACCOUNT, registrant], session: sessionRow() });
    const fetchMock = createFetchMock(createRoutes(SESSION_EVENT_ID));
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await lib.syncGroupSessionCalendarEvent(SESSION_ID);

    const hostEvent = createdIn(fetchMock, "at-doctor");
    const registrantEvent = createdIn(fetchMock, "at-registrant");
    expect(hostEvent.summary).toBe("Newborn sleep basics");
    // No attendees anywhere: registrants never learn each other's addresses.
    expect(hostEvent.attendees).toEqual([]);
    expect(registrantEvent.attendees).toEqual([]);
    expect(Date.parse(hostEvent.start.dateTime)).toBe(Date.parse("2026-09-05T15:00:00Z"));
    expect(Date.parse(hostEvent.end.dateTime)).toBe(Date.parse("2026-09-05T16:00:00Z"));
    expect(hostEvent.description).toContain(`/live-sessions/${SESSION_ID}`);
  });

  it("skips a registrant whose payment is still pending", async () => {
    const pending = {
      id: "acct-u3",
      user_id: "u3",
      google_email: "three@example.com",
      refresh_token: "rt-pending",
      status: "connected",
      last_error: null,
      connected_at: "2026-08-04T00:00:00Z",
    };
    setup({ accounts: [pending], session: sessionRow() });
    const fetchMock = createFetchMock(createRoutes(SESSION_EVENT_ID));
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await lib.syncGroupSessionCalendarEvent(SESSION_ID);

    expect(fetchMock.calls.filter((c) => c.url.startsWith(EVENTS))).toHaveLength(0);
  });

  it("gives an admin every published session", async () => {
    setup({ accounts: [ADMIN_ACCOUNT], session: sessionRow() });
    const fetchMock = createFetchMock(createRoutes(SESSION_EVENT_ID));
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await lib.syncGroupSessionCalendarEvent(SESSION_ID);

    expect(createdIn(fetchMock, "at-admin")).toBeDefined();
  });

  it("removes the event when the session is cancelled", async () => {
    const { mirrors } = setup({
      accounts: [DOCTOR_ACCOUNT],
      session: sessionRow({ status: "cancelled" }),
      mirrors: [
        {
          account_id: "acct-doctor",
          related_type: "group_session",
          related_id: SESSION_ID,
          google_event_id: SESSION_EVENT_ID,
        },
      ],
    });
    const fetchMock = createFetchMock([
      tokenRefreshRoute(ACCESS_TOKENS),
      { match: (m) => m === "DELETE", respond: () => empty(204) },
    ]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await lib.syncGroupSessionCalendarEvent(SESSION_ID);

    expect(fetchMock.calls.some((c) => c.method === "DELETE")).toBe(true);
    expect(mirrors).toHaveLength(0);
  });

  it("keeps unpublished drafts off every calendar", async () => {
    setup({ accounts: [DOCTOR_ACCOUNT], session: sessionRow({ is_published: false }) });
    const fetchMock = createFetchMock([
      tokenRefreshRoute(ACCESS_TOKENS),
      { match: (m) => m === "DELETE", respond: () => json(404, {}) },
    ]);
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    await lib.syncGroupSessionCalendarEvent(SESSION_ID);

    expect(fetchMock.calls.some((c) => c.method === "POST" && c.url.startsWith(EVENTS))).toBe(false);
  });
});

// ─── Sweep ────────────────────────────────────────────────────────────────────

describe("sweepMissedCalendarEvents", () => {
  it("does nothing when not configured", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    setup({});
    const lib = await loadLib();
    await expect(lib.sweepMissedCalendarEvents()).resolves.toEqual({ considered: 0, synced: 0 });
  });

  it("does nothing when no account is connected", async () => {
    setup({ accounts: [] });
    const lib = await loadLib();
    await expect(lib.sweepMissedCalendarEvents()).resolves.toEqual({ considered: 0, synced: 0 });
  });

  it("re-syncs upcoming bookings", async () => {
    setup({
      accounts: [PARENT_ACCOUNT],
      appointment: appointmentRow(),
      extra: {
        appointments: (q: RecordedQuery) => {
          // The sweep lists ids; the reconciler then fetches the single row.
          if (q.op === "select" && !q.calls.some((c) => c.method === "single")) {
            return { data: [{ id: APPT_ID }] };
          }
          return { data: appointmentRow() };
        },
        group_sessions: () => ({ data: [] }),
      },
    });
    const fetchMock = createFetchMock(createRoutes(APPT_EVENT_ID));
    vi.stubGlobal("fetch", fetchMock.fn);

    const lib = await loadLib();
    const run = await lib.sweepMissedCalendarEvents();

    expect(run.considered).toBe(1);
    expect(createdIn(fetchMock, "at-parent")).toBeDefined();
  });
});
