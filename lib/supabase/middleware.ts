// @ts-nocheck
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { withTimeout, isUnreachable, DB_TIMEOUT_MS } from "@/lib/timeout";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If env vars are not configured (preview mode), let every page through —
  // the landing page lives at "/", and login/signup go straight to the dashboard.
  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes("placeholder")) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
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

  const protectedPaths = ["/dashboard", "/calendar", "/profile"];
  const isProtected = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  // Bound the auth check: a paused/unreachable Supabase project would
  // otherwise stall the request until the browser gives up.
  let user = null;
  let unreachable = false;
  try {
    const { data, error } = await withTimeout(supabase.auth.getUser(), DB_TIMEOUT_MS);
    user = data?.user ?? null;
    // A network-shaped error means the backend is down, not that the visitor
    // is signed out — anything else keeps the old "no user" behaviour.
    if (error && isUnreachable(error)) unreachable = true;
  } catch (err) {
    if (isUnreachable(err)) unreachable = true;
    else throw err;
  }

  if (unreachable) {
    console.error("[middleware] Supabase unreachable for", request.nextUrl.pathname);
    // Public pages still render fine without auth; only gate the app itself.
    if (isProtected && request.nextUrl.pathname !== "/unavailable") {
      const url = request.nextUrl.clone();
      url.pathname = "/unavailable";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (
    user &&
    (request.nextUrl.pathname === "/login" ||
      request.nextUrl.pathname === "/signup" ||
      request.nextUrl.pathname === "/")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
