import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Email confirmation (signup + email change) uses the token_hash / verifyOtp
// flow rather than the PKCE code exchange in /auth/callback. verifyOtp needs no
// client-stored code_verifier, so the confirmation link works even when opened
// in a different browser or device than the one used to sign up.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  // Only honor same-origin relative paths to prevent open-redirect abuse.
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : "/auth/confirmed";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  // Missing/invalid params or a spent/expired link — send to login with a hint.
  return NextResponse.redirect(`${origin}/auth/login?error=confirmation_failed`);
}
