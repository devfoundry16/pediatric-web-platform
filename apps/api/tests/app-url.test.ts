import { afterEach, describe, expect, it } from "vitest";

import { frontendUrl } from "../src/lib/app-url";

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

describe("frontendUrl", () => {
  it("uses the configured origin", () => {
    process.env.FRONTEND_URL = "https://www.drsaharpediatrics.com";
    expect(frontendUrl()).toBe("https://www.drsaharpediatrics.com");
  });

  it("drops a trailing slash so appended paths do not double up", () => {
    process.env.FRONTEND_URL = "https://www.drsaharpediatrics.com/";
    expect(`${frontendUrl()}/live-sessions/abc`).toBe(
      "https://www.drsaharpediatrics.com/live-sessions/abc"
    );
  });

  // The bug this guard exists for: a reminder that reached real parents with a
  // http://localhost:3333 join link, recorded in email_logs as delivered.
  it("refuses to guess an origin outside development", () => {
    set("FRONTEND_URL", undefined);
    process.env.NODE_ENV = "production";
    expect(() => frontendUrl()).toThrow(/FRONTEND_URL/);
  });

  it("refuses to guess when NODE_ENV says nothing", () => {
    set("FRONTEND_URL", undefined);
    set("NODE_ENV", undefined);
    expect(() => frontendUrl()).toThrow(/FRONTEND_URL/);
  });

  it("treats an empty value as unset", () => {
    process.env.FRONTEND_URL = "   ";
    process.env.NODE_ENV = "production";
    expect(() => frontendUrl()).toThrow(/FRONTEND_URL/);
  });

  // apps/api/.env ships NODE_ENV=DEVELOPMENT, in that casing.
  it("still falls back to localhost in development", () => {
    set("FRONTEND_URL", undefined);
    process.env.NODE_ENV = "DEVELOPMENT";
    expect(frontendUrl()).toBe("http://localhost:3333");
  });
});
