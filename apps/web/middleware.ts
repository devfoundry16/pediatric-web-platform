import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { pathname } = request.nextUrl;

  const skipAuthLoggedInRedirect =
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/auth/check-email") ||
    // Password recovery lands here with a freshly-exchanged session; don't
    // bounce the user to the dashboard before they set a new password.
    pathname.startsWith("/auth/reset-password");

  const protectedPaths = [
    "/dashboard",
    "/courses",
    "/booking",
    "/live-sessions",
    "/packages",
  ];

  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));

  // Refresh session — do NOT use getSession() here; getUser() contacts Supabase
  // and is the only reliable way to validate the token server-side.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // When the refresh token is revoked or no longer exists (e.g. the user
  // hasn't visited in a long time), getUser() returns an error instead of
  // silently returning null. The stale `sb-*` cookies must be deleted from
  // the response so the browser stops re-sending them on every subsequent
  // request, which would otherwise cause an "Invalid Refresh Token" console
  // error on each page load until the cookies naturally expire.
  if (authError) {
    const response = isProtected
      ? (() => {
          const loginUrl = request.nextUrl.clone();
          loginUrl.pathname = "/auth/login";
          loginUrl.searchParams.set("redirectTo", pathname);
          return NextResponse.redirect(loginUrl);
        })()
      : supabaseResponse;

    request.cookies
      .getAll()
      .filter((c) => c.name.startsWith("sb-"))
      .forEach((c) => response.cookies.delete(c.name));

    return response;
  }

  // Role for routing: prefer `profiles.role` (DB) over JWT `user_metadata.role`.
  // Admins promoted in SQL may not have updated auth metadata, which would
  // otherwise keep sending them to the parent dashboard.
  let dashboardRole: string | undefined;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    dashboardRole = profile?.role ?? (user.user_metadata?.role as string | undefined);
  }

  // Redirect unauthenticated users away from protected routes
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  // Role-based dashboard routing
  if (user && pathname.startsWith("/dashboard")) {
    const role = dashboardRole;
    const isDoctor = role === "doctor";
    const isAdmin = role === "admin";
    const onDoctorPath = pathname.startsWith("/dashboard/doctor");
    const onParentPath = pathname.startsWith("/dashboard/parent");
    const onAdminPath = pathname.startsWith("/dashboard/admin");

    // Admin may only access /dashboard/admin/*
    if (isAdmin && !onAdminPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard/admin";
      url.search = "";
      return NextResponse.redirect(url);
    }
    // Non-admins may not access admin paths
    if (!isAdmin && onAdminPath) {
      const url = request.nextUrl.clone();
      url.pathname = isDoctor ? "/dashboard/doctor" : "/dashboard/parent";
      url.search = "";
      return NextResponse.redirect(url);
    }
    // Doctor/parent cross-routing guards
    if (!isAdmin) {
      if (isDoctor && onParentPath) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard/doctor";
        url.search = "";
        return NextResponse.redirect(url);
      }
      if (!isDoctor && onDoctorPath) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard/parent";
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
  }

  // Redirect authenticated users away from auth pages to their dashboard
  if (user && pathname.startsWith("/auth") && !skipAuthLoggedInRedirect) {
    const url = request.nextUrl.clone();
    const role = dashboardRole;
    url.pathname =
      role === "doctor"
        ? "/dashboard/doctor"
        : role === "admin"
          ? "/dashboard/admin"
          : "/dashboard/parent";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/auth/:path*",
    "/courses",
    "/courses/:path*",
    "/booking",
    "/booking/:path*",
    "/live-sessions",
    "/live-sessions/:path*",
    "/packages",
    "/packages/:path*",
  ],
};
