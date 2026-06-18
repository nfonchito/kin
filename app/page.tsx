import type { Metadata } from "next";
import Link from "next/link";
import { KinLogo } from "@/components/KinLogo";
import { MessageSquareText, CalendarDays, BellRing, Home, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Kin — A personal assistant for busy families",
  description:
    "Kin handles the mental load of running a household — tasks, reminders, and your family calendar in one place. Just tell it what you need.",
};

const FEATURES = [
  {
    icon: MessageSquareText,
    title: "Just ask",
    body: "Tell Kin what you need in plain language — “book lawn care Saturday,” “remind David about soccer Thursday.” It understands and takes it from there.",
  },
  {
    icon: CalendarDays,
    title: "One family calendar",
    body: "Appointments, practices, and bookings land on a shared calendar automatically, so the whole household stays in sync.",
  },
  {
    icon: BellRing,
    title: "Nothing slips",
    body: "Reminders and tasks are tracked for you — the dentist, the field trip, the renewal — so you can stop holding it all in your head.",
  },
  {
    icon: Home,
    title: "Knows your household",
    body: "Kin remembers your family, your home, and your preferences, so you never have to re-explain the basics.",
  },
];

const STEPS = [
  { n: "1", title: "Tell Kin what you need", body: "Type it like you'd text a friend." },
  { n: "2", title: "Kin captures and organizes it", body: "Onto your calendar and task list, instantly." },
  { n: "3", title: "Stay present", body: "Kin handles the details in the background." },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Nav */}
      <header className="w-full">
        <div className="mx-auto max-w-5xl px-5 py-5 flex items-center justify-between">
          <KinLogo size={28} showWordmark />
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors px-3 py-2"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium bg-teal hover:bg-teal-dim text-bg rounded-lg px-4 py-2 transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* soft glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 w-[640px] h-[640px] rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #15c489 0%, transparent 60%)" }}
        />
        <div className="relative mx-auto max-w-3xl px-5 pt-16 pb-20 text-center">
          <span className="inline-block text-xs font-medium text-teal bg-teal-muted border border-teal-subtle rounded-full px-3 py-1 mb-6">
            Your family&apos;s personal assistant
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-text-primary leading-[1.1] text-balance">
            The mental load of running a home,{" "}
            <span className="text-teal">handled.</span>
          </h1>
          <p className="mt-5 text-lg text-text-secondary max-w-xl mx-auto leading-relaxed text-balance">
            Kin keeps track of your household — tasks, reminders, and the family calendar — so
            nothing slips through the cracks. Just tell it what you need.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 bg-teal hover:bg-teal-dim text-bg font-semibold rounded-xl px-6 py-3 text-sm transition-colors"
            >
              Get started free
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-surface hover:bg-surface-2 border border-border text-text-primary font-medium rounded-xl px-6 py-3 text-sm transition-colors"
            >
              Sign in
            </Link>
          </div>
          <p className="mt-4 text-xs text-text-muted">No credit card needed.</p>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-5 pb-16 w-full">
        <div className="grid sm:grid-cols-2 gap-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="bg-surface border border-border rounded-2xl p-6 hover:border-teal-subtle transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-teal-muted flex items-center justify-center mb-4">
                <Icon size={18} className="text-teal" />
              </div>
              <h3 className="text-base font-semibold text-text-primary mb-1.5">{title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-5 pb-20 w-full">
        <h2 className="text-center text-sm font-semibold text-text-muted uppercase tracking-wider mb-8">
          How it works
        </h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {STEPS.map(({ n, title, body }) => (
            <div key={n} className="text-center">
              <div className="w-9 h-9 mx-auto rounded-full bg-teal text-bg font-bold text-sm flex items-center justify-center mb-3">
                {n}
              </div>
              <h3 className="text-sm font-semibold text-text-primary mb-1">{title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-3xl px-5 pb-20 w-full">
        <div className="bg-surface border border-border rounded-3xl px-6 py-12 text-center">
          <h2 className="text-2xl font-bold text-text-primary text-balance">
            Let Kin carry the details.
          </h2>
          <p className="mt-3 text-text-secondary max-w-md mx-auto leading-relaxed">
            Set up your family in a couple of minutes and start handing off the busywork.
          </p>
          <Link
            href="/signup"
            className="mt-7 inline-flex items-center gap-2 bg-teal hover:bg-teal-dim text-bg font-semibold rounded-xl px-6 py-3 text-sm transition-colors"
          >
            Get started free
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border">
        <div className="mx-auto max-w-5xl px-5 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <KinLogo size={22} showWordmark />
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <Link href="/privacy" className="hover:text-text-secondary transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-text-secondary transition-colors">Terms</Link>
            <span className="opacity-40">·</span>
            <span>Northwest Hills · Austin, TX</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
