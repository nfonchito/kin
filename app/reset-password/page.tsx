"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { KinLogo } from "@/components/KinLogo";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  // The recovery link goes through /auth/callback, which trades the code for a
  // session before landing here. No session means the link was stale or reused.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (!cancelled) setHasSession(!!data.user);
      } catch {
        if (!cancelled) setHasSession(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Those two passwords don't match.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message);
        setLoading(false);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Unable to connect. Check your internet and try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-10">
          <KinLogo size={48} />
        </div>

        <div className="text-center mb-8">
          <h1 className="font-display text-4xl text-text-primary mb-2 tracking-[-0.01em]">
            Choose a new password
          </h1>
          <p className="text-text-secondary text-sm">You&apos;ll be signed in straight after.</p>
        </div>

        {checking ? (
          <p className="text-center text-sm text-text-muted">Checking your link…</p>
        ) : !hasSession ? (
          <div className="bg-surface border border-border rounded-2xl px-6 py-6 text-center">
            <p className="text-sm text-text-secondary leading-relaxed">
              This reset link has expired or has already been used. Request a fresh one and it&apos;ll
              work.
            </p>
            <Link
              href="/forgot-password"
              className="inline-block mt-5 text-sm font-medium text-accent hover:text-accent-dim transition-colors"
            >
              Send a new link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                minLength={8}
                required
                autoFocus
                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Type it again"
                minLength={8}
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
              className="press w-full bg-accent-soft hover:bg-accent-soft-dim text-text-primary font-semibold rounded-xl py-3 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? "Saving…" : "Save new password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
