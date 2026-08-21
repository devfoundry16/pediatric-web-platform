/**
 * The public origin of the web app.
 *
 * Every link in an outgoing email and every OAuth return redirect is built from
 * this. It used to be `process.env.FRONTEND_URL ?? "http://localhost:3333"`,
 * written out separately in eight modules, so any instance started without the
 * variable set mailed real recipients a http://localhost:3333 link that only
 * resolved on the machine that sent it — and the send was recorded in
 * email_logs as delivered, spending the one reminder that recipient gets.
 *
 * Outside development a missing value now throws instead. The web app applies
 * the same rule to NEXT_PUBLIC_API_URL (apps/web/lib/api/config.ts) for the
 * same reason: failing loudly at the first use beats a silent localhost.
 */

/** Only ever used when NODE_ENV explicitly says this is not a real deployment. */
const DEV_FALLBACK = "http://localhost:3333";

function isDevelopment(): boolean {
  // apps/api/.env ships NODE_ENV=DEVELOPMENT, in that casing; vitest sets
  // "test". Anything else — including unset — is treated as a deployment,
  // because guessing wrong there is what put localhost links in real inboxes.
  const env = process.env.NODE_ENV?.toLowerCase();
  return env === "development" || env === "test";
}

export function frontendUrl(): string {
  const configured = process.env.FRONTEND_URL?.trim();

  if (!configured) {
    if (isDevelopment()) return DEV_FALLBACK;
    throw new Error(
      "FRONTEND_URL is not set, so email links and OAuth redirects have no " +
        "origin to point at. Set it to the public address of the web app."
    );
  }

  // A trailing slash would double up against the paths callers append.
  return configured.replace(/\/$/, "");
}
