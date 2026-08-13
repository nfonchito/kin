import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Where the provider sends the user back after they approve. Supabase hands
// us a one-time code here, which we trade for a real session cookie.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Only ever a same-site path. A single leading slash and no "//" keeps this
  // from being turned into an open redirect via ?next=//evil.example.
  const requestedNext = searchParams.get("next") ?? "";
  const next = /^\/(?!\/)[A-Za-z0-9\-._~!$&'()*+,;=:@%/]*$/.test(requestedNext)
    ? requestedNext
    : "/dashboard";

  // How a refusal comes back (e.g. the user pressed Cancel on Google).
  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");

  // Behind Vercel's proxy `origin` is the internal host, so prefer the
  // forwarded host or we'd redirect to the wrong URL in production.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocal = process.env.NODE_ENV === "development";
  const base = isLocal || !forwardedHost ? origin : `https://${forwardedHost}`;

  const backToLogin = (message: string) =>
    NextResponse.redirect(`${base}/login?error=${encodeURIComponent(message)}`);

  if (oauthError) {
    console.error("[auth/callback] provider returned an error:", oauthError);
    return backToLogin(oauthError);
  }

  if (!code) return backToLogin("Sign-in was interrupted. Please try again.");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] code exchange failed:", error.message);
    return backToLogin(error.message);
  }

  return NextResponse.redirect(`${base}${next}`);
}
