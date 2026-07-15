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
      // Password-recovery / explicit-destination links pass ?next=... — send
      // the (now authenticated) user straight there instead of a dashboard.
      if (safeNext && safeNext !== "/") {
        return NextResponse.redirect(`${origin}${safeNext}`);
      }
      // Prefer DB role over JWT metadata so admin promotions are reflected
      // immediately without requiring a token refresh.
      let role: string | undefined = data.user.user_metadata?.role as string | undefined;
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .maybeSingle();
        if (profile?.role) role = profile.role as string;
      } catch {
        // Non-fatal: fall back to metadata role
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
