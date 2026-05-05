import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

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
