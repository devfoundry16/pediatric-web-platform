import { describe, expect, it, vi } from "vitest";

// reminder-notifications pulls in the supabase and resend singletons at module
// load; neither is exercised by the label helper, so stub them out.
vi.mock("../src/lib/supabase", () => ({ supabaseAdmin: null }));
vi.mock("../src/lib/resend", () => ({
  alreadySent: vi.fn(),
  recordEmailFailure: vi.fn(),
  sendSessionReminder: vi.fn(),
}));

import { consultationLabel } from "../src/lib/reminder-notifications";

describe("consultationLabel", () => {
  it("keeps historical type slugs readable", () => {
    expect(consultationLabel("quick")).toBe("quick consultation");
    expect(consultationLabel("standard")).toBe("standard consultation");
    expect(consultationLabel("extended")).toBe("extended consultation");
  });

  it("does not double the word for the generic consultation type", () => {
    expect(consultationLabel("consultation")).toBe("consultation");
  });
});
