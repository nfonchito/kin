import type { Metadata } from "next";
import Link from "next/link";
import { KinLogo } from "@/components/KinLogo";
import { RefreshCw } from "lucide-react";

export const metadata: Metadata = {
  title: "Temporarily unavailable",
  description: "Kin is waking up. Please try again in a moment.",
  robots: { index: false, follow: false },
};

export default function UnavailablePage() {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-8">
          <KinLogo size={44} />
        </div>

        <div className="bg-surface border border-border rounded-2xl px-6 py-8">
          <h1 className="text-xl font-semibold text-text-primary mb-2">
            Kin is waking up
          </h1>
          <p className="text-sm text-text-secondary leading-relaxed">
            We couldn&apos;t reach your family&apos;s data just now. This usually clears up
            within a minute or two — your information is safe.
          </p>

          <Link
            href="/dashboard"
            className="mt-6 inline-flex items-center gap-2 bg-accent-soft hover:bg-accent-soft-dim text-text-primary font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors"
          >
            <RefreshCw size={14} />
            Try again
          </Link>
        </div>

        <p className="mt-6 text-xs text-text-muted">
          Still stuck? Email{" "}
          <a href="mailto:hello@kinfamily.app" className="text-accent hover:text-accent-dim transition-colors">
            hello@kinfamily.app
          </a>
        </p>
      </div>
    </div>
  );
}
