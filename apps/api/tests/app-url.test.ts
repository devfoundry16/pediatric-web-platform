import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The silent `?? "http://localhost:3333"` fallback is what put a localhost link
 * in a reminder email that reached a real inbox. These lock in that the
 * fallback is development-only and that production cannot boot without a real
 * value.
 */

const ORIGINAL_ENV = { ...process.env };

async function loadLib() {
  return import("../src/lib/app-url");
}

beforeEach(() => {
  vi.resetModules();
  delete process.env.FRONTEND_URL;
  delete process.env.NODE_ENV;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("frontendUrl", () => {
  it("uses the configured value", async () => {
    process.env.FRONTEND_URL = "https://drsaharpediatrics.com";
    const { frontendUrl } = await loadLib();
    expect(frontendUrl()).toBe("https://drsaharpediatrics.com");
  });

  it("strips trailing slashes so joined paths do not double up", async () => {
    process.env.FRONTEND_URL = "https://drsaharpediatrics.com///";
    const { frontendUrl } = await loadLib();
    expect(`${frontendUrl()}/appointments/1/room`).toBe(
      "https://drsaharpediatrics.com/appointments/1/room"
    );
  });

  it("falls back to localhost in development", async () => {
    const { frontendUrl } = await loadLib();
    expect(frontendUrl()).toBe("http://localhost:3333");
  });

  it("refuses to invent a URL in production", async () => {
    process.env.NODE_ENV = "production";
    const { frontendUrl } = await loadLib();
    expect(() => frontendUrl()).toThrow(/FRONTEND_URL is not set/);
  });
});

describe("assertFrontendUrl", () => {
  it("exits the process in production when unset", async () => {
    process.env.NODE_ENV = "production";
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exited");
    }) as never);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { assertFrontendUrl } = await loadLib();
    expect(() => assertFrontendUrl()).toThrow("exited");
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("only warns in development", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("should not exit");
    }) as never);

    const { assertFrontendUrl } = await loadLib();
    assertFrontendUrl();

    expect(warn).toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it("rejects a localhost value in production", async () => {
    // Presence alone is not enough — a deployment inheriting a developer's
    // value is how a reminder went out linking to localhost.
    process.env.NODE_ENV = "production";
    process.env.FRONTEND_URL = "http://localhost:3333";
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exited");
    }) as never);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const { assertFrontendUrl } = await loadLib();
    expect(() => assertFrontendUrl()).toThrow("exited");
    expect(exit).toHaveBeenCalledWith(1);
    expect(error.mock.calls[0][0]).toMatch(/local address/);
  });

  it("allows a localhost value in development", async () => {
    process.env.FRONTEND_URL = "http://localhost:3333";
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("should not exit");
    }) as never);

    const { assertFrontendUrl } = await loadLib();
    assertFrontendUrl();
    expect(exit).not.toHaveBeenCalled();
  });

  it("says nothing when configured", async () => {
    process.env.NODE_ENV = "production";
    process.env.FRONTEND_URL = "https://drsaharpediatrics.com";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const { assertFrontendUrl } = await loadLib();
    assertFrontendUrl();

    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
