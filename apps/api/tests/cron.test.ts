import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

const { sendDueReminders, sweepMissedCalendarEvents } = vi.hoisted(() => ({
  sendDueReminders: vi.fn(async () => ({ considered: 3, sent: 2, failed: 1 })),
  sweepMissedCalendarEvents: vi.fn(async () => ({ considered: 4, synced: 4 })),
}));

vi.mock("../src/lib/supabase", () => ({ supabaseAdmin: {} }));
vi.mock("../src/lib/reminder-notifications", () => ({ sendDueReminders }));
vi.mock("../src/lib/google-calendar", () => ({ sweepMissedCalendarEvents }));

import { makeRes } from "./helpers/mocks";
import { requireCronSecret } from "../src/middleware/cron";
import { runCalendarSweep, runReminders } from "../src/controllers/cron";

function guard(authorization?: string) {
  const req = { headers: authorization ? { authorization } : {} } as Request;
  const res = makeRes();
  const next = vi.fn() as unknown as NextFunction;
  requireCronSecret(req, res as unknown as Response, next);
  return { res, next };
}

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("requireCronSecret", () => {
  // These routes make the API send mail, so an unset secret has to close them.
  // Falling open would leave a public trigger for the whole reminder sweep.
  it("closes the route when no secret is configured", () => {
    delete process.env.CRON_SECRET;

    const { res, next } = guard("Bearer anything");

    expect(res.statusCode).toBe(503);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a missing header", () => {
    process.env.CRON_SECRET = "s3cret";

    const { res, next } = guard();

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a wrong secret of the same length", () => {
    process.env.CRON_SECRET = "s3cret";

    const { res, next } = guard("Bearer wrong1");

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a wrong secret of a different length without throwing", () => {
    process.env.CRON_SECRET = "s3cret";

    const { res, next } = guard("Bearer much-longer-than-the-real-one");

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts the bearer token Vercel Cron sends", () => {
    process.env.CRON_SECRET = "s3cret";

    const { next } = guard("Bearer s3cret");

    expect(next).toHaveBeenCalledOnce();
  });
});

describe("cron handlers", () => {
  beforeEach(() => {
    sendDueReminders.mockClear();
    sweepMissedCalendarEvents.mockClear();
  });

  it("runs the reminder sweep and reports what it did", async () => {
    const res = makeRes();

    await runReminders({} as Request, res as unknown as Response);

    expect(sendDueReminders).toHaveBeenCalledOnce();
    expect(res.body).toEqual({ considered: 3, sent: 2, failed: 1 });
  });

  it("runs the calendar sweep and reports what it did", async () => {
    const res = makeRes();

    await runCalendarSweep({} as Request, res as unknown as Response);

    expect(sweepMissedCalendarEvents).toHaveBeenCalledOnce();
    expect(res.body).toEqual({ considered: 4, synced: 4 });
  });
});
