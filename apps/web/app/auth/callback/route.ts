import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // Only honor same-origin relative paths to prevent open-redirect abuse.
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : null;

  if (code) {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Prefer DB role over JWT metadata so admin promotions are reflected
      // immediately without requiring a token refresh.
      let role: string | undefined = data.user.user_metadata?.role as string | undefined;
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, is_active")
          .eq("id", data.user.id)
          .maybeSingle();

        // Google sign-in bypasses the password path entirely, so it needs its
        // own check — otherwise a deactivated user just logs in with Google.
        if (profile?.is_active === false) {
          await supabase.auth.signOut();
          return NextResponse.redirect(`${origin}/auth/login?deactivated=1`);
        }

        if (profile?.role) role = profile.role as string;
      } catch {
        // Non-fatal: fall back to metadata role
      }

      // Password-recovery / explicit-destination links pass ?next=... — send
      // the (now authenticated) user straight there instead of a dashboard.
      if (safeNext && safeNext !== "/") {
        return NextResponse.redirect(`${origin}${safeNext}`);
      }

      const dashboard =
        role === "doctor"
          ? "/dashboard/doctor"
          : role === "admin"
            ? "/dashboard/admin"
            : "/dashboard/parent";

      return NextResponse.redirect(`${origin}${dashboard}`);
    }
  }

  // Something went wrong — redirect to login with an error hint
  return NextResponse.redirect(`${origin}/auth/login?error=confirmation_failed`);
}
