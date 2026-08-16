import { getApiBaseUrl } from "@/lib/api/config";
import type { FeatureFlags } from "@/lib/api/feature-flags";

/**
 * Server-side read of the flags, used to seed FeatureFlagsProvider from the
 * root layout. Without it every page would render its navigation twice — once
 * before the flags arrive and once after — and a section the admin turned off
 * would flash on screen first.
 *
 * Revalidated rather than uncached so pages can stay static; the provider
 * refetches on mount, so an admin's change lands immediately for anyone loading
 * a fresh page.
 */
export async function getFeatureFlags(): Promise<FeatureFlags> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/feature-flags`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return {};
    const data = (await res.json()) as { flags?: FeatureFlags };
    return data.flags ?? {};
  } catch {
    // The API being unreachable (including at build time) must not break the
    // page. Unknown flags read as disabled, so nothing half-built leaks out.
    return {};
  }
}
