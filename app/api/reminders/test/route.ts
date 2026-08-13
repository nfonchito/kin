import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendReminderEmail } from "@/lib/email";
import { fetchUpcomingEvents, LOOKAHEAD_HOURS } from "@/lib/reminders";

export const dynamic = "force-dynamic";

// Whether the nightly job has everything it needs. Booleans only — never the
// values themselves — and only ever behind a signed-in session.
function cronReadiness() {
  const from = process.env.RESEND_FROM;
  return {
    cronSecret: !!process.env.CRON_SECRET,
    serviceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    resendKey: !!process.env.RESEND_API_KEY,
    // Without RESEND_FROM the default sender is Resend's shared test address,
    // which only delivers to the account owner — so every other user's
    // reminder silently goes nowhere. Surfacing the sender (not a secret)
    // makes that visible instead of invisible.
    resendFrom: from ?? null,
    canEmailAnyone: !!from,
  };
}

async function loadContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: family } = await supabase
    .from("families")
    .select("id, name")
    .eq("user_id", user.id)
    .single();

  if (!family) return { error: NextResponse.json({ error: "Family not found" }, { status: 404 }) };
  return { supabase, user, family };
}

// GET — preview what tomorrow's reminder would contain. Sends nothing.
export async function GET() {
  const ctx = await loadContext();
  if (ctx.error) return ctx.error;
  const { supabase, user, family } = ctx;

  const { events, error } = await fetchUpcomingEvents(supabase, family.id);
  if (error) return NextResponse.json({ ok: false, error }, { status: 500 });

  return NextResponse.json({
    ok: true,
    window: `${LOOKAHEAD_HOURS}h`,
    wouldSendTo: user.email,
    eventCount: events.length,
    events: events.map((e) => ({ title: e.title, start_time: e.start_time })),
    scheduledJob: cronReadiness(),
  });
}

// POST — actually send the digest to the signed-in user, on their request.
export async function POST() {
  const ctx = await loadContext();
  if (ctx.error) return ctx.error;
  const { supabase, user, family } = ctx;

  if (!user.email) return NextResponse.json({ ok: false, error: "Your account has no email address" }, { status: 400 });

  const { events, error } = await fetchUpcomingEvents(supabase, family.id);
  if (error) return NextResponse.json({ ok: false, error }, { status: 500 });

  if (events.length === 0) {
    return NextResponse.json({
      ok: false,
      error: `Nothing on the calendar in the next ${LOOKAHEAD_HOURS} hours, so there's nothing to send. Add an event and try again.`,
      eventCount: 0,
    });
  }

  const result = await sendReminderEmail({ to: user.email, familyName: family.name, events });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 502 });

  return NextResponse.json({ ok: true, sentTo: user.email, eventCount: events.length });
}
