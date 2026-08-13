"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] render failed:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-5">
      <div className="w-full max-w-sm text-center bg-surface border border-border rounded-2xl px-6 py-8">
        <h1 className="text-lg font-semibold text-text-primary mb-2">
          Something went wrong
        </h1>
        <p className="text-sm text-text-secondary leading-relaxed">
          We couldn&apos;t load your family&apos;s data. This is usually temporary —
          your information is safe.
        </p>
        <button
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 bg-accent hover:bg-accent-dim text-bg font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors"
        >
          <RefreshCw size={14} />
          Try again
        </button>
      </div>
    </div>
  );
}
