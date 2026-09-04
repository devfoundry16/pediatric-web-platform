import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyFilters, createSupabaseMock, makeRes } from "./helpers/mocks";

const supabaseHolder = vi.hoisted(() => ({ current: null as any }));
vi.mock("../src/lib/supabase", () => ({
  get supabaseAdmin() {
    return supabaseHolder.current;
  },
}));

const ADMIN = { id: "admin-1", role: "admin", is_active: true };

/**
 * @param flagRow  the feature_flags row for admin_email_notifications, or null
 *                 to model the key never having been written.
 */
function setup(flagRow: { key: string; enabled: boolean } | null) {
  const mock = createSupabaseMock({
    profiles: (q) => applyFilters([ADMIN], q),
    feature_flags: (q) =>
      q.op === "upsert"
        ? { data: q.payload }
        : applyFilters(flagRow ? [flagRow] : [], q),
  });
  mock.getUserById.mockImplementation(async () => ({ data: { user: null }, error: null }));
  // listUsers is what resolves admin addresses.
  (mock.client as any).auth.admin.listUsers = vi.fn(async () => ({
    data: { users: [{ id: "admin-1", email: "admin@clinic.ae" }] },
    error: null,
  }));
  supabaseHolder.current = mock.client;
  return mock;
}

beforeEach(() => {
  vi.resetModules();
  supabaseHolder.current = null;
});

describe("activeAdminRecipients", () => {
  it("returns admins when the switch is on", async () => {
    setup({ key: "admin_email_notifications", enabled: true });
    const { activeAdminRecipients } = await import("../src/lib/recipients");

    expect(await activeAdminRecipients()).toEqual([
      { email: "admin@clinic.ae", userId: "admin-1" },
    ]);
  });

  it("returns nobody when the switch is off", async () => {
    setup({ key: "admin_email_notifications", enabled: false });
    const { activeAdminRecipients } = await import("../src/lib/recipients");

    expect(await activeAdminRecipients()).toEqual([]);
  });

  it("does not even look up addresses when the switch is off", async () => {
    // The gate runs before the auth admin API, so turning it off costs one
    // cheap read rather than a full user listing on every notification.
    const mock = setup({ key: "admin_email_notifications", enabled: false });
    const { activeAdminRecipients } = await import("../src/lib/recipients");

    await activeAdminRecipients();

    expect((mock.client as any).auth.admin.listUsers).not.toHaveBeenCalled();
    expect(mock.queries.some((q) => q.table === "profiles")).toBe(false);
  });

  it("defaults to sending when the key has never been written", async () => {
    setup(null);
    const { activeAdminRecipients } = await import("../src/lib/recipients");

    expect(await activeAdminRecipients()).toHaveLength(1);
  });

  it("defaults to sending when the flag read fails", async () => {
    // A broken read must not silently stop clinic mail.
    const mock = createSupabaseMock({
      profiles: (q) => applyFilters([ADMIN], q),
      feature_flags: () => ({ error: { message: "connection reset" } }),
    });
    (mock.client as any).auth.admin.listUsers = vi.fn(async () => ({
      data: { users: [{ id: "admin-1", email: "admin@clinic.ae" }] },
      error: null,
    }));
    supabaseHolder.current = mock.client;
    const { activeAdminRecipients } = await import("../src/lib/recipients");

    expect(await activeAdminRecipients()).toHaveLength(1);
  });
});

describe("feature flag exposure", () => {
  it("keeps operational settings out of the public response", async () => {
    setup({ key: "admin_email_notifications", enabled: false });
    const { listFeatureFlags } = await import("../src/controllers/feature-flags");
    const res = makeRes();

    await listFeatureFlags({} as any, res);

    const flags = (res.body as { flags: Record<string, boolean> }).flags;
    expect(Object.keys(flags)).toEqual(["courses"]);
    expect(flags).not.toHaveProperty("admin_email_notifications");
  });

  it("returns operational settings on the admin route", async () => {
    setup({ key: "admin_email_notifications", enabled: false });
    const { listAdminSettings } = await import("../src/controllers/feature-flags");
    const res = makeRes();

    await listAdminSettings({} as any, res);

    expect((res.body as { settings: Record<string, boolean> }).settings).toEqual({
      admin_email_notifications: false,
    });
  });

  it("accepts the setting key on the admin write", async () => {
    const mock = setup({ key: "admin_email_notifications", enabled: true });
    const { updateFeatureFlag } = await import("../src/controllers/feature-flags");
    const res = makeRes();

    await updateFeatureFlag(
      { params: { key: "admin_email_notifications" }, body: { enabled: false }, userId: "u1" } as any,
      res
    );

    const write = mock.queries.find((q) => q.table === "feature_flags" && q.op === "upsert")!;
    expect(write.payload).toMatchObject({
      key: "admin_email_notifications",
      enabled: false,
    });
  });

  it("still rejects a key nothing reads", async () => {
    setup(null);
    const { updateFeatureFlag } = await import("../src/controllers/feature-flags");
    const res = makeRes();

    await updateFeatureFlag(
      { params: { key: "no_such_switch" }, body: { enabled: true } } as any,
      res
    );

    expect(res.statusCode).toBe(400);
  });
});
