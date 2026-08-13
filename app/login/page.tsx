"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { KinLogo } from "@/components/KinLogo";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isPreview = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");

  // Off until Google OAuth is configured in Supabase — a visible button that
  // errors on click is worse than no button. Set NEXT_PUBLIC_GOOGLE_AUTH_ENABLED
  // to "true" in Vercel once the provider is live.
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

  // The OAuth callback sends failures back as ?error=… — show them here.
  // Read from location rather than useSearchParams to avoid needing a
  // Suspense boundary around this page.
  useEffect(() => {
    const message = new URLSearchParams(window.location.search).get("error");
    if (message) {
      setError(message);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Preview mode — no real auth, just go to dashboard
    if (isPreview) {
      router.push("/dashboard");
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setError(error.message);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError("Unable to connect. Check your internet and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <KinLogo size={48} />
        </div>

        <div className="text-center mb-8">
          <h1 className="font-display text-4xl text-text-primary mb-2 tracking-[-0.01em]">Welcome back</h1>
          <p className="text-text-secondary text-sm">Sign in to your family dashboard</p>
        </div>

        {!isPreview && googleEnabled && (
          <>
            <GoogleSignInButton label="Continue with Google" />
            <div className="flex items-center gap-3 my-5">
              <span className="flex-1 h-px bg-border" />
              <span className="text-xs text-text-muted">or</span>
              <span className="flex-1 h-px bg-border" />
            </div>
          </>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          {error && (
            <p className="text-sm text-red-700 bg-red-700/8 border border-red-700/25 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-dim text-bg font-semibold rounded-xl py-3 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-text-secondary mt-6">
          New to Kin?{" "}
          <Link href="/signup" className="text-accent hover:text-accent-dim transition-colors font-medium">
            Create an account
          </Link>
        </p>
      </div>

      <div className="mt-16 text-xs text-text-muted text-center space-y-2">
        <div className="flex items-center justify-center gap-4">
          <Link href="/privacy" className="hover:text-text-secondary transition-colors">Privacy</Link>
          <span className="opacity-40">·</span>
          <Link href="/terms" className="hover:text-text-secondary transition-colors">Terms</Link>
        </div>
        <p>Northwest Hills · Austin, TX 78731</p>
      </div>
    </div>
  );
}
