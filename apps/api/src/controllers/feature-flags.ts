import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";

/**
 * Sections an admin can mark as "coming soon". Unknown keys are rejected so a
 * typo can't silently create a flag nothing reads.
 */
export const FEATURE_FLAG_KEYS = ["courses"] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

/** Used when a flag has no row yet — a section is live unless disabled. */
const DEFAULT_ENABLED = true;

function isKnownKey(key: string): key is FeatureFlagKey {
  return (FEATURE_FLAG_KEYS as readonly string[]).includes(key);
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

  const flags = Object.fromEntries(
    FEATURE_FLAG_KEYS.map((key) => [
      key,
      data?.find((row) => row.key === key)?.enabled ?? DEFAULT_ENABLED,
    ]),
  );

  res.json({ flags });
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
