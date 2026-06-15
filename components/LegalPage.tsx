import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { KinLogo } from "./KinLogo";

interface LegalPageProps {
  title: string;
  lastUpdated: string;
  /** "privacy" | "terms" — used to show the cross-link to the other document */
  current: "privacy" | "terms";
  children: React.ReactNode;
}

export function LegalPage({ title, lastUpdated, current, children }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-2xl px-5 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <Link href="/login" className="flex items-center gap-2">
            <KinLogo size={26} showWordmark />
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={14} />
            Back
          </Link>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-semibold text-text-primary mb-1">{title}</h1>
        <p className="text-sm text-text-muted mb-8">Last updated {lastUpdated}</p>

        {/* Content */}
        <article className="legal-prose">{children}</article>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-border flex items-center justify-between text-sm">
          <Link
            href={current === "privacy" ? "/terms" : "/privacy"}
            className="text-teal hover:text-teal-dim transition-colors"
          >
            {current === "privacy" ? "Terms of Service" : "Privacy Policy"}
          </Link>
          <span className="text-text-muted">Kin · Austin, TX</span>
        </div>
      </div>
    </div>
  );
}
