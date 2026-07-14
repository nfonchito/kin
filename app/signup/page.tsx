"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { KinLogo } from "@/components/KinLogo";

export default function SignupPage() {
  const router = useRouter();
  const [familyName, setFamilyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  const isPreview = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Preview mode — no real auth, just go to dashboard
    if (isPreview) {
      if (familyName) localStorage.setItem("kin_family_name", familyName);
      router.push("/dashboard");
      return;
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { family_name: familyName },
        },
      });

      if (error) {
        setError(error.message);
      } else if (!data.session) {
        // Email confirmation is required — no session until the link is clicked
        setNeedsConfirm(true);
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

  if (needsConfirm) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="flex justify-center mb-8">
            <KinLogo size={48} />
          </div>
          <div className="bg-surface border border-border rounded-2xl px-6 py-8">
            <h1 className="text-xl font-semibold text-text-primary mb-2">Check your email 📬</h1>
            <p className="text-sm text-text-secondary leading-relaxed">
              We sent a confirmation link to{" "}
              <span className="text-text-primary font-medium">{email}</span>.
              Click it to activate your account, then sign in.
            </p>
            <Link
              href="/login"
              className="inline-block mt-6 text-sm font-medium text-teal hover:text-teal-dim transition-colors"
            >
              Go to sign in
            </Link>
          </div>
          <p className="mt-6 text-xs text-text-muted">
            Nothing arriving? Check your spam folder.
          </p>
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
          <h1 className="text-2xl font-semibold text-text-primary mb-1">Join Kin</h1>
          <p className="text-text-secondary text-sm">Set up your family&apos;s dashboard</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Family name</label>
            <input
              type="text"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              placeholder="The Johnsons"
              required
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-teal transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-teal transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              minLength={8}
              required
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-teal transition-colors"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal hover:bg-teal-dim text-bg font-semibold rounded-xl py-3 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? "Creating your dashboard…" : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-text-secondary mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-teal hover:text-teal-dim transition-colors font-medium">
            Sign in
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
