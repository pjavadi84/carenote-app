import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Idle timeout for authed dashboard sessions. Anything inside the
// (dashboard) group is considered "in the app" and bumps the cookie on
// each request. Public / auth pages don't count as activity.
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const LAST_SEEN_COOKIE = "cn_last_seen";
const LAST_SEEN_MAX_AGE_SECONDS = 24 * 60 * 60; // 24h — always refreshed on use

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

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
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public routes that don't require auth
  const publicPrefixes = ["/login", "/signup", "/verify", "/privacy", "/terms", "/hipaa", "/support", "/auth/callback", "/portal"];
  const isPublicRoute =
    request.nextUrl.pathname === "/" ||
    publicPrefixes.some((route) =>
      request.nextUrl.pathname.startsWith(route)
    );

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Enforce email verification — redirect unverified users to /verify
  const isVerifyPage = request.nextUrl.pathname.startsWith("/verify");
  if (user && !user.email_confirmed_at && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/verify";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages (not landing or public content pages)
  const authPages = ["/login", "/signup"];
  const isAuthPage = authPages.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );
  if (user && user.email_confirmed_at && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/today";
    return NextResponse.redirect(url);
  }

  // Verified users on /verify should go to dashboard
  if (user && user.email_confirmed_at && isVerifyPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/today";
    return NextResponse.redirect(url);
  }

  // Idle timeout. Only applies when the user is authenticated AND hitting
  // a protected surface — public routes (the /portal clinician magic
  // link, the marketing pages, auth flows) don't count as activity and
  // shouldn't expire a session.
  if (user && user.email_confirmed_at && !isPublicRoute && !isAuthPage) {
    const now = Date.now();
    const lastSeenRaw = request.cookies.get(LAST_SEEN_COOKIE)?.value;
    const lastSeen = lastSeenRaw ? Number.parseInt(lastSeenRaw, 10) : NaN;

    if (Number.isFinite(lastSeen) && now - lastSeen > IDLE_TIMEOUT_MS) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "?reason=timeout";
      const redirect = NextResponse.redirect(url);
      redirect.cookies.delete(LAST_SEEN_COOKIE);
      return redirect;
    }

    supabaseResponse.cookies.set(LAST_SEEN_COOKIE, now.toString(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: LAST_SEEN_MAX_AGE_SECONDS,
    });
  }

  return supabaseResponse;
}
