import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendDueReminders } = vi.hoisted(() => ({
  sendDueReminders: vi.fn(async () => ({ considered: 0, sent: 0, failed: 0 })),
}));

vi.mock("../src/lib/supabase", () => ({ supabaseAdmin: {} }));
vi.mock("../src/lib/reminder-notifications", () => ({ sendDueReminders }));

import { startReminderScheduler, stopReminderScheduler } from "../src/lib/reminder-scheduler";

beforeEach(() => {
  vi.useFakeTimers();
  sendDueReminders.mockClear();
  process.env.RESEND_API_KEY = "re_test";
});

afterEach(() => {
  stopReminderScheduler();
  vi.useRealTimers();
  delete process.env.RESEND_API_KEY;
  delete process.env.ENABLE_SCHEDULERS;
});

describe("startReminderScheduler", () => {
  // Every `pnpm dev` used to start this, against whatever database the local
  // .env points at — which is production. The sweep then mailed real parents
  // and doctors, and the email_logs dedupe spent their one reminder.
  it("stays off unless the host opts in", async () => {
    delete process.env.ENABLE_SCHEDULERS;

    startReminderScheduler();
    await vi.advanceTimersByTimeAsync(5 * 60_000);

    expect(sendDueReminders).not.toHaveBeenCalled();
  });

  it("is not enabled by a value other than true", async () => {
    process.env.ENABLE_SCHEDULERS = "1";

    startReminderScheduler();
    await vi.advanceTimersByTimeAsync(5 * 60_000);

    expect(sendDueReminders).not.toHaveBeenCalled();
  });

  it("runs on a long-running host that opts in", async () => {
    process.env.ENABLE_SCHEDULERS = "true";

    startReminderScheduler();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(sendDueReminders).toHaveBeenCalledTimes(1);
  });
});
