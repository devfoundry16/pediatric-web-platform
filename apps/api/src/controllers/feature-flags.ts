import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";

/**
 * Sections an admin can mark as "coming soon". These are returned by the
 * PUBLIC endpoint, so nothing sensitive may join this list.
 */
export const SECTION_FLAG_KEYS = ["courses"] as const;

/**
 * Operational settings an admin controls. Same storage, deliberately NOT public
 * — GET /api/feature-flags is unauthenticated so the app can decide what to
 * render before anyone signs in, and whether the clinic mails its admins is
 * nobody else's business.
 */
export const ADMIN_SETTING_KEYS = ["admin_email_notifications"] as const;

export const FEATURE_FLAG_KEYS = [
  ...SECTION_FLAG_KEYS,
  ...ADMIN_SETTING_KEYS,
] as const;

export type SectionFlagKey = (typeof SECTION_FLAG_KEYS)[number];
export type AdminSettingKey = (typeof ADMIN_SETTING_KEYS)[number];
export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

/**
 * Used when a flag has no row yet. Both kinds default on: a section is live
 * unless disabled, and notifications keep behaving as they did before the
 * switch existed.
 */
const DEFAULT_ENABLED = true;

function isKnownKey(key: string): key is FeatureFlagKey {
  return (FEATURE_FLAG_KEYS as readonly string[]).includes(key);
}

/** Read one stored switch, falling back to the default when it has no row. */
export async function isFlagEnabled(key: FeatureFlagKey): Promise<boolean> {
  if (!supabaseAdmin) return DEFAULT_ENABLED;

  const { data, error } = await supabaseAdmin
    .from("feature_flags")
    .select("enabled")
    .eq("key", key)
    .maybeSingle();

  // A failed read must not silently change behaviour, so it falls back to the
  // default rather than to "off".
  if (error) {
    console.error(`[flags] Could not read ${key}: ${error.message}`);
    return DEFAULT_ENABLED;
  }
  return data?.enabled ?? DEFAULT_ENABLED;
}

/**
 * Public: the web app needs the flags before it knows who (if anyone) is
 * signed in, so this is unauthenticated. It exposes nothing but which sections
 * are currently visible.
 */
export async function listFeatureFlags(_req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) { res.status(500).json({ error: "Server misconfigured" }); return; }

  const { data, error } = await supabaseAdmin
    .from("feature_flags")
    .select("key, enabled");

  if (error) { res.status(500).json({ error: error.message }); return; }

  // SECTION_FLAG_KEYS, not FEATURE_FLAG_KEYS: this response is public.
  const flags = Object.fromEntries(
    SECTION_FLAG_KEYS.map((key) => [
      key,
      data?.find((row) => row.key === key)?.enabled ?? DEFAULT_ENABLED,
    ]),
  );

  res.json({ flags });
}

/**
 * Admin only: the operational settings, which the public endpoint withholds.
 * Mounted on the admin router, so adminMiddleware has already run.
 */
export async function listAdminSettings(_req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) { res.status(500).json({ error: "Server misconfigured" }); return; }

  const { data, error } = await supabaseAdmin
    .from("feature_flags")
    .select("key, enabled")
    .in("key", ADMIN_SETTING_KEYS as readonly string[]);

  if (error) { res.status(500).json({ error: error.message }); return; }

  const settings = Object.fromEntries(
    ADMIN_SETTING_KEYS.map((key) => [
      key,
      data?.find((row) => row.key === key)?.enabled ?? DEFAULT_ENABLED,
    ]),
  );

  res.json({ settings });
}

/** Admin only: flip a section on or off for everyone. */
export async function updateFeatureFlag(req: Request, res: Response): Promise<void> {
  if (!supabaseAdmin) { res.status(500).json({ error: "Server misconfigured" }); return; }

  const key = String(req.params.key ?? "");
  const { enabled } = req.body;

  if (!isKnownKey(key)) {
    res.status(400).json({ error: `Unknown feature flag: ${key}` });
    return;
  }
  if (typeof enabled !== "boolean") {
    res.status(400).json({ error: "enabled must be a boolean" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("feature_flags")
    .upsert(
      { key, enabled, updated_by: req.userId ?? null },
      { onConflict: "key" },
    )
    .select("key, enabled")
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ flag: data });
}
