"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Check, ArrowRight, X } from "lucide-react";

interface SetupChecklistProps {
  familyName?: string | null;
  memberCount: number;
  eventCount: number;
}

const DISMISSED_KEY = "kin_setup_dismissed";

// "My Family" is the database default — it means nobody has named anything yet.
const isUnnamed = (name?: string | null) =>
  !name || name.trim().toLowerCase() === "my family";

/**
 * What's still missing from a new household, shown on the dashboard.
 *
 * Every account so far has landed on an empty chat box and never found the
 * Profile page — not one has added a family member — so the chat has been
 * claiming to know a family it knows nothing about. This says what Kin is
 * missing and links straight to it.
 *
 * It disappears on its own once the steps are done, so it can't become
 * furniture, and it can be dismissed outright.
 */
export function SetupChecklist({ familyName, memberCount, eventCount }: SetupChecklistProps) {
  const [dismissed, setDismissed] = useState(true); // assume dismissed until localStorage is read

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISSED_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const steps = [
    {
      done: !isUnnamed(familyName),
      label: "Name your household",
      why: "So Kin knows what to call you.",
      href: "/dashboard/profile",
      cta: "Add a name",
    },
    {
      done: memberCount > 0,
      label: "Add who's in it",
      why: "Then you can say “dentist for Emma” and Kin knows who you mean.",
      href: "/dashboard/profile",
      cta: "Add people",
    },
    {
      done: eventCount > 0,
      label: "Put something on the calendar",
      why: "Type it below the way you'd text it — “lawn care every Thursday”.",
      href: null,
      cta: null,
    },
  ];

  const remaining = steps.filter((s) => !s.done).length;
  if (dismissed || remaining === 0) return null;

  const next = steps.find((s) => !s.done)!;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      /* a dismissal that doesn't persist is better than a crash */
    }
  }

  return (
    <div className="relative bg-surface border border-border rounded-2xl px-4 py-3.5 mb-4">
      <button
        onClick={dismiss}
        aria-label="Dismiss setup steps"
        className="absolute top-3 right-3 text-text-muted hover:text-text-secondary transition-colors"
      >
        <X size={14} />
      </button>

      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-text-muted mb-2.5">
        {steps.length - remaining} of {steps.length} done
      </p>

      <ul className="space-y-2">
        {steps.map((step) => (
          <li key={step.label} className="flex items-start gap-2.5">
            <span
              className={`mt-0.5 shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${
                step.done ? "bg-accent-soft" : "border border-border-2"
              }`}
            >
              {step.done && <Check size={10} className="text-text-primary" strokeWidth={3} />}
            </span>
            <div className="min-w-0">
              <p
                className={`text-sm leading-snug ${
                  step.done ? "text-text-muted line-through" : "text-text-primary"
                }`}
              >
                {step.label}
              </p>
              {!step.done && step.label === next.label && (
                <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{step.why}</p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {next.href && (
        <Link
          href={next.href}
          className="press inline-flex items-center gap-1.5 mt-3 bg-accent-soft hover:bg-accent-soft-dim text-text-primary text-sm font-medium rounded-lg px-3 py-1.5 transition-colors"
        >
          {next.cta}
          <ArrowRight size={13} />
        </Link>
      )}
    </div>
  );
}
