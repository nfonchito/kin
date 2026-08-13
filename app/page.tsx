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
        <div className="mx-auto max-w-6xl px-6 lg:px-10 py-6 flex items-center justify-between">
          <KinLogo size={28} showWordmark />
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors px-4 py-2"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="press text-sm font-medium bg-text-primary hover:bg-white text-bg rounded-lg px-4 py-2 transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero — asymmetric: the claim carries the left, a sample exchange anchors the right */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-40 -top-40 w-[680px] h-[680px] rounded-full opacity-[0.16] blur-3xl"
          style={{ background: "radial-gradient(circle, #15c489 0%, transparent 62%)" }}
        />
        <div className="relative mx-auto max-w-6xl px-6 lg:px-10 pt-20 pb-24 lg:pt-28 lg:pb-32">
          <div className="grid lg:grid-cols-12 gap-14 lg:gap-10 items-center">
            {/* Claim */}
            <div className="lg:col-span-7">
              <p className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted mb-7">
                <span className="h-px w-8 bg-teal" />
                Your family&apos;s personal assistant
              </p>
              <h1 className="font-display text-[3.25rem] sm:text-7xl lg:text-[5.25rem] leading-[0.95] tracking-[-0.02em] text-text-primary">
                The mental load
                <br />
                of running a home,
                <br />
                <em className="italic text-teal">handled.</em>
              </h1>
              <p className="mt-8 text-lg text-text-secondary max-w-md leading-relaxed">
                Kin keeps track of your household — tasks, reminders, and the family calendar — so
                nothing slips through the cracks. Just tell it what you need.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row sm:items-center gap-3">
                <Link
                  href="/signup"
                  className="press group inline-flex items-center justify-center gap-2.5 bg-teal hover:bg-teal-dim text-bg font-semibold rounded-lg px-7 py-4 text-[15px] transition-colors"
                >
                  Get started free
                  <ArrowRight size={17} className="group-hover:translate-x-1 transition-transform duration-200" />
                </Link>
                <Link
                  href="/login"
                  className="press inline-flex items-center justify-center border border-border hover:border-border-2 text-text-primary font-medium rounded-lg px-7 py-4 text-[15px] transition-colors"
                >
                  Sign in
                </Link>
              </div>
              <p className="mt-5 text-xs text-text-muted tracking-wide">
                Free to use · No credit card · Works in your browser
              </p>
            </div>

            {/* A real exchange, rather than a stock illustration */}
            <div className="lg:col-span-5 lg:pl-4">
              <div className="relative bg-surface border border-border rounded-2xl p-6 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)]">
                <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted mb-5">
                  Thursday morning
                </p>
                <div className="space-y-3.5">
                  <div className="flex justify-end">
                    <p className="bg-teal text-bg text-sm font-medium rounded-2xl rounded-br-md px-4 py-2.5 max-w-[85%]">
                      lawn care every thursday
                    </p>
                  </div>
                  <div className="flex justify-start">
                    <p className="bg-surface-2 border border-border text-text-primary text-sm rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[90%] leading-relaxed">
                      Got it — recurring lawn care every Thursday. I&apos;ve put the next 12 on your
                      calendar.
                    </p>
                  </div>
                </div>
                <div className="mt-6 pt-5 border-t border-border flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal" />
                  <p className="text-xs text-text-secondary">
                    Reminder emailed each morning
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features — numbered editorial cards that respond to the cursor */}
      <section className="mx-auto max-w-6xl px-6 lg:px-10 py-24 w-full">
        <div className="max-w-xl mb-14">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted mb-4">
            What it does
          </p>
          <h2 className="font-display text-4xl sm:text-5xl leading-[1.05] tracking-[-0.02em] text-text-primary">
            Four fewer things to hold in your head.
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-px bg-border border border-border rounded-2xl overflow-hidden">
          {FEATURES.map(({ icon: Icon, title, body }, i) => (
            <div
              key={title}
              className="group relative bg-surface hover:bg-surface-2 p-8 lg:p-10 transition-colors duration-200"
            >
              {/* teal rule that draws in on hover */}
              <span className="absolute left-0 top-0 h-px w-0 bg-teal transition-all duration-300 group-hover:w-full" />
              <div className="flex items-start justify-between mb-7">
                <Icon size={20} className="text-teal" strokeWidth={1.6} />
                <span className="font-display text-2xl text-text-muted/60 leading-none tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="font-display text-2xl text-text-primary mb-3 leading-tight">{title}</h3>
              <p className="text-[15px] text-text-secondary leading-relaxed max-w-sm">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works — a numbered editorial list, not centered boxes */}
      <section className="mx-auto max-w-6xl px-6 lg:px-10 pb-24 w-full">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted mb-10">
          How it works
        </p>
        <div className="grid sm:grid-cols-3 gap-10 sm:gap-8">
          {STEPS.map(({ n, title, body }) => (
            <div key={n} className="border-t border-border pt-6">
              <span className="font-display text-5xl text-teal leading-none">{n}</span>
              <h3 className="mt-5 text-base font-semibold text-text-primary">{title}</h3>
              <p className="mt-2 text-[15px] text-text-secondary leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA — full-bleed and weighty */}
      <section className="border-y border-border bg-surface/60 relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 bottom-0 w-[520px] h-[420px] rounded-full opacity-[0.13] blur-3xl"
          style={{ background: "radial-gradient(circle, #15c489 0%, transparent 65%)" }}
        />
        <div className="relative mx-auto max-w-6xl px-6 lg:px-10 py-24 lg:py-28">
          <div className="grid lg:grid-cols-12 gap-10 items-end">
            <div className="lg:col-span-8">
              <h2 className="font-display text-5xl sm:text-6xl lg:text-7xl leading-[0.98] tracking-[-0.02em] text-text-primary">
                Let Kin carry
                <br />
                <em className="italic text-teal">the details.</em>
              </h2>
              <p className="mt-7 text-lg text-text-secondary max-w-md leading-relaxed">
                Set up your family in a couple of minutes and start handing off the busywork.
              </p>
            </div>
            <div className="lg:col-span-4 lg:text-right">
              <Link
                href="/signup"
                className="press group inline-flex items-center gap-2.5 bg-teal hover:bg-teal-dim text-bg font-semibold rounded-lg px-8 py-4 text-[15px] transition-colors"
              >
                Get started free
                <ArrowRight size={17} className="group-hover:translate-x-1 transition-transform duration-200" />
              </Link>
              <p className="mt-4 text-xs text-text-muted">Takes about two minutes.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto">
        <div className="mx-auto max-w-6xl px-6 lg:px-10 py-10 flex flex-col sm:flex-row items-center justify-between gap-5">
          <KinLogo size={22} showWordmark />
          <div className="flex items-center gap-6 text-xs text-text-muted">
            <Link href="/privacy" className="hover:text-text-primary transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-text-primary transition-colors">Terms</Link>
            <span className="tracking-wide">Northwest Hills · Austin, TX</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
