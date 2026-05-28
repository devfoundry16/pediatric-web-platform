/**
 * Seed script — creates an admin user in Supabase Auth + public.profiles.
 *
 * Usage:
 *   pnpm --filter api seed
 *
 * Env vars (from apps/api/.env):
 *   SUPABASE_URL              – project URL
 *   SUPABASE_SERVICE_ROLE_KEY – service-role key (never expose client-side)
 *
 * Override credentials at runtime:
 *   ADMIN_EMAIL=me@example.com ADMIN_PASSWORD=secret pnpm --filter api seed
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@pediatric.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Admin@1234!";
const ADMIN_FULL_NAME = process.env.ADMIN_FULL_NAME ?? "System Admin";
const ADMIN_PHONE = process.env.ADMIN_PHONE ?? "+10000000000";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "❌  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in apps/api/.env"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg: string) {
  console.log(`[seed] ${msg}`);
}

async function adminExists(): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) throw new Error(`Failed to list users: ${error.message}`);
  const existing = data.users.find((u) => u.email === ADMIN_EMAIL);
  return existing?.id ?? null;
}

async function createAdminAuthUser(): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: ADMIN_FULL_NAME,
      phone: ADMIN_PHONE,
      // Pass 'admin' so the handle_new_user trigger can read it; we also set
      // the profile role explicitly below to guard against trigger variations.
      role: "admin",
    },
  });

  if (error) throw new Error(`Failed to create auth user: ${error.message}`);
  return data.user.id;
}

async function ensureAdminProfile(userId: string): Promise<void> {
  // The handle_new_user trigger auto-inserts public.profiles; upsert here
  // guarantees the correct role even if the trigger ran with a different value.
  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      full_name: ADMIN_FULL_NAME,
      phone: ADMIN_PHONE,
      role: "admin",
      is_active: true,
    },
    { onConflict: "id" }
  );

  if (error) throw new Error(`Failed to upsert profile: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seed() {
  log("Starting admin seed…");
  log(`Target email: ${ADMIN_EMAIL}`);

  // Idempotency — skip creation if the user already exists
  const existingId = await adminExists();

  let userId: string;

  if (existingId) {
    log(`Auth user already exists (id: ${existingId}). Skipping creation.`);
    userId = existingId;
  } else {
    userId = await createAdminAuthUser();
    log(`Auth user created (id: ${userId}).`);
  }

  // Always ensure the profile has role = 'admin'
  await ensureAdminProfile(userId);
  log("Profile role set to 'admin'.");

  log("✅  Done.");
  log("");
  log("Admin credentials:");
  log(`  Email    : ${ADMIN_EMAIL}`);
  log(`  Password : ${ADMIN_PASSWORD}`);
  log("");
  log(
    "⚠️  Change the password immediately after first login in production environments."
  );
}

seed().catch((err) => {
  console.error(`[seed] ❌  ${err.message}`);
  process.exit(1);
});
