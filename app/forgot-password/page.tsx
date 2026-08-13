"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { KinLogo } from "@/components/KinLogo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        // Through the existing callback so the recovery code is exchanged for a
        // session, then on to the form that actually sets the new password.
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) setError(error.message);
      else setSent(true);
    } catch {
      setError("Unable to connect. Check your internet and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="flex justify-center mb-8">
            <KinLogo size={44} />
          </div>
          <div className="bg-surface border border-border rounded-2xl px-6 py-8">
            <h1 className="font-display text-3xl text-text-primary mb-2 tracking-[-0.01em]">
              Check your email
            </h1>
            <p className="text-sm text-text-secondary leading-relaxed">
              If there&apos;s an account for{" "}
              <span className="text-text-primary font-medium">{email}</span>, a reset link is on
              its way. It expires in an hour.
            </p>
            <Link
              href="/login"
              className="inline-block mt-6 text-sm font-medium text-accent hover:text-accent-dim transition-colors"
            >
              Back to sign in
            </Link>
          </div>
          <p className="mt-6 text-xs text-text-muted">Nothing arriving? Check your spam folder.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-10">
          <KinLogo size={48} />
        </div>

        <div className="text-center mb-8">
          <h1 className="font-display text-4xl text-text-primary mb-2 tracking-[-0.01em]">
            Reset your password
          </h1>
          <p className="text-text-secondary text-sm">
            We&apos;ll email you a link to set a new one.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
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
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <p className="text-center text-sm text-text-secondary mt-6">
          Remembered it?{" "}
          <Link href="/login" className="text-accent hover:text-accent-dim transition-colors font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
