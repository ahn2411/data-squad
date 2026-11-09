import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig, isSupabaseConfigured } from "./configured";

/**
 * Routes that are reachable without a session. Everything else requires an
 * authenticated user. Membership-status gating (pending/active/suspended) is
 * handled in the (app) Server Component layout — not here — to keep the
 * middleware fast and avoid a per-request database query.
 */
const PUBLIC_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/pending-approval",
  "/auth/callback",
];

const CRON_ROUTE = "/api/cron/reminders";

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.includes(pathname);
}

/**
 * Refreshes the Supabase auth session on every navigation and guards
 * protected routes. If Supabase is not configured, it no-ops so the app can
 * render the "not configured" screen.
 */
export async function updateSession(request: NextRequest) {
  // The cron handler has its own bearer-token authorization. Let that handler
  // return 401 for missing/invalid tokens instead of redirecting API callers
  // to the interactive login page. The proxy matcher also excludes this path;
  // this guard protects against matcher drift or a broad middleware matcher.
  if (request.nextUrl.pathname === CRON_ROUTE) {
    return NextResponse.next({ request });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.next();
  }

  // Some Supabase email templates fall back to Site URL and deliver the PKCE
  // code to `/`. Forward it to the public callback before the auth gate can
  // redirect the unauthenticated request to login and discard the code.
  if (request.nextUrl.pathname === "/" && request.nextUrl.searchParams.has("code")) {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";
    if (!callbackUrl.searchParams.has("next")) callbackUrl.searchParams.set("next", "/");
    return NextResponse.redirect(callbackUrl);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseConfig.url,
    supabaseConfig.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do NOT run code between createServerClient and getUser.
  // A simple mistake like refreshing the session here can make sessions
  // silently stop working.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Not signed in and trying to reach a protected route -> login.
  if (!user && !isPublicRoute(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Signed in and on an auth-only page -> let the root resolver route them.
  if (user && (pathname === "/login" || pathname === "/register")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
