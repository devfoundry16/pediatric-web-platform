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

  // Refresh session — do NOT use getSession() here; getUser() contacts Supabase
  // and is the only reliable way to validate the token server-side.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const skipAuthLoggedInRedirect =
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/auth/check-email");

  const protectedPaths = [
    "/dashboard",
    "/courses",
    "/booking",
    "/live-sessions",
    "/packages",
  ];

  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));

  // Redirect unauthenticated users away from protected routes
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  // Doctors may only access /dashboard/doctor/*; parents (and any non-doctor role) only /dashboard/parent/*
  if (user && pathname.startsWith("/dashboard")) {
    const role = user.user_metadata?.role as string | undefined;
    const isDoctor = role === "doctor";
    const onDoctorPath = pathname.startsWith("/dashboard/doctor");
    const onParentPath = pathname.startsWith("/dashboard/parent");

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

  // Redirect authenticated users away from auth pages to their dashboard
  if (user && pathname.startsWith("/auth") && !skipAuthLoggedInRedirect) {
    const role = user.user_metadata?.role as string | undefined;
    const url = request.nextUrl.clone();
    url.pathname =
      role === "doctor" ? "/dashboard/doctor" : "/dashboard/parent";
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
