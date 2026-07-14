// Centralized API base URL resolution.
//
// NEXT_PUBLIC_* values are inlined at BUILD time. If a production build runs
// without NEXT_PUBLIC_API_URL set, every request would silently target
// localhost and fail with no obvious error. Guard against that: in production a
// missing value throws so the misconfiguration surfaces immediately instead of
// shipping an app that looks fine until data fails to load. In development we
// fall back to the local API for convenience.
const RAW = process.env.NEXT_PUBLIC_API_URL;

// Fail fast in the browser (where the API is actually called) if a production
// build shipped without the URL — otherwise every request silently hits
// localhost. Scoped to the browser so it never crashes SSR/prerender at build.
if (!RAW && process.env.NODE_ENV === "production" && typeof window !== "undefined") {
  throw new Error(
    "NEXT_PUBLIC_API_URL is not set. It must be provided at build time; " +
      "the app cannot reach the backend API without it."
  );
}

export const API_BASE_URL = (RAW ?? "http://localhost:4000/api").replace(
  /\/$/,
  ""
);

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}
