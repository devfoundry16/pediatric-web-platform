/**
 * Public base URL of the web app, used for every link the API hands out —
 * emails, calendar events and Stripe return URLs.
 *
 * This was previously `process.env.FRONTEND_URL ?? "http://localhost:3333"`,
 * repeated in nine places. The fallback is right in development and actively
 * harmful in production: a deployment missing the variable mails patients
 * links to their own machine, and nothing anywhere says so. Reminders went out
 * pointing at http://localhost:3333 for exactly this reason.
 *
 * So the fallback now only applies in development, and production refuses to
 * start without a real value (see assertFrontendUrl). Same reasoning as
 * apps/web/lib/api/config.ts, which fails loudly rather than shipping a build
 * that silently talks to localhost.
 */

const DEV_FALLBACK = "http://localhost:3333";

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function configured(): string | null {
  const raw = process.env.FRONTEND_URL?.trim();
  if (!raw) return null;
  // Trailing slashes would produce "https://host//dashboard/..." once joined.
  return raw.replace(/\/+$/, "");
}

export function frontendUrl(): string {
  const value = configured();
  if (value) return value;

  if (isProduction()) {
    // Unreachable when the process booted through assertFrontendUrl; kept so a
    // link is never silently wrong if something else imports this first.
    throw new Error(
      "FRONTEND_URL is not set. Every link the API sends would point at localhost."
    );
  }
  return DEV_FALLBACK;
}

/** A value that only makes sense on a developer's machine. */
function isLocal(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(url);
}

/**
 * Fail fast at boot rather than at the moment an email is being written.
 * Call once from the server entrypoint.
 */
export function assertFrontendUrl(): void {
  const value = configured();

  if (isProduction()) {
    // Presence alone is not enough: a deployment that inherited a developer's
    // value is exactly how a reminder went out linking to localhost.
    const problem = !value
      ? "is not set"
      : isLocal(value)
        ? `points at a local address (${value})`
        : null;

    if (problem) {
      console.error(
        `[config] FRONTEND_URL ${problem}. Refusing to start: booking emails, ` +
          "reminders and calendar invitations would all link somewhere the " +
          "recipient cannot reach."
      );
      process.exit(1);
    }
    return;
  }

  if (!value) {
    console.warn(`[config] FRONTEND_URL is not set; links will use ${DEV_FALLBACK}`);
  }
}
