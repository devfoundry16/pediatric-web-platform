import { afterEach, describe, expect, it, vi } from "vitest";

// The URL builders are pure, but their module pulls in the supabase and resend
// singletons at load; stub them out the way reminder-titles.test.ts does.
vi.mock("../src/lib/supabase", () => ({ supabaseAdmin: null }));
vi.mock("../src/lib/resend", () => ({
  alreadySent: vi.fn(),
  recordEmailFailure: vi.fn(),
  sendBookingConfirmation: vi.fn(),
  sendBookingNotification: vi.fn(),
}));
vi.mock("../src/lib/recipients", () => ({ activeAdminRecipients: vi.fn() }));
vi.mock("../src/lib/appointment-room", () => ({ ensureAppointmentRoom: vi.fn() }));

import { appointmentUrlFor, meetingUrlFor } from "../src/lib/booking-notifications";

const ORIGINAL_FRONTEND_URL = process.env.FRONTEND_URL;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

function set(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

afterEach(() => {
  set("FRONTEND_URL", ORIGINAL_FRONTEND_URL);
  set("NODE_ENV", ORIGINAL_NODE_ENV);
});

describe("links in outgoing email", () => {
  it("point at the configured web app", () => {
    process.env.FRONTEND_URL = "https://www.drsaharpediatrics.com";

    expect(meetingUrlFor("appt-1")).toBe(
      "https://www.drsaharpediatrics.com/appointments/appt-1/room"
    );
    expect(appointmentUrlFor("parent", "appt-1")).toBe(
      "https://www.drsaharpediatrics.com/dashboard/parent/appointments?appointment=appt-1"
    );
  });

  // The reported bug: reminders reached real parents with a join link nobody
  // outside the sending machine could open. A misconfigured instance must now
  // fail to build the link at all rather than send a useless one.
  it("are never silently built against localhost on a deployment", () => {
    set("FRONTEND_URL", undefined);
    process.env.NODE_ENV = "production";

    expect(() => meetingUrlFor("appt-1")).toThrow(/FRONTEND_URL/);
  });
});
