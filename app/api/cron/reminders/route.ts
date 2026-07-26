import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendReminderEmail, type ReminderEvent } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LOOKAHEAD_HOURS = 24;

interface EventRow extends ReminderEvent {
  family_id: string;
}

// Scheduled by vercel.json. Vercel attaches `Authorization: Bearer $CRON_SECRET`
// when that env var is set; the same header works for a manual run.
// Add ?dry=1 to see what would be sent without sending anything.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not set on the server" },
      { status: 500 }
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not set on the server" },
      { status: 500 }
    );
  }

  const dryRun = req.nextUrl.searchParams.get("dry") === "1";
  const now = new Date();
  const until = new Date(now.getTime() + LOOKAHEAD_HOURS * 3600 * 1000);

  const { data: events, error: eventsError } = await admin
    .from("events")
    .select("family_id, title, start_time, category")
    .gte("start_time", now.toISOString())
    .lte("start_time", until.toISOString())
    .order("start_time", { ascending: true });

  if (eventsError) {
    console.error("[cron/reminders] event query failed:", eventsError.message);
    return NextResponse.json({ ok: false, error: eventsError.message }, { status: 500 });
  }

  const rows = (events ?? []) as EventRow[];
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, window: `${LOOKAHEAD_HOURS}h`, events: 0, families: 0, sent: 0 });
  }

  const byFamily = new Map<string, ReminderEvent[]>();
  for (const row of rows) {
    const list = byFamily.get(row.family_id) ?? [];
    list.push({ title: row.title, start_time: row.start_time, category: row.category });
    byFamily.set(row.family_id, list);
  }

  const { data: families, error: familiesError } = await admin
    .from("families")
    .select("id, user_id, name")
    .in("id", [...byFamily.keys()]);

  if (familiesError) {
    console.error("[cron/reminders] family query failed:", familiesError.message);
    return NextResponse.json({ ok: false, error: familiesError.message }, { status: 500 });
  }

  let sent = 0;
  const skipped: string[] = [];

  for (const family of families ?? []) {
    const familyEvents = byFamily.get(family.id) ?? [];
    if (familyEvents.length === 0) continue;

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(family.user_id);
    const email = userData?.user?.email;
    if (userError || !email) {
      skipped.push(`${family.id}: no email`);
      continue;
    }

    if (dryRun) {
      sent++;
      continue;
    }

    const result = await sendReminderEmail({ to: email, familyName: family.name, events: familyEvents });
    if (result.ok) sent++;
    else skipped.push(`${family.id}: ${result.error}`);
  }

  console.log(`[cron/reminders] ${rows.length} events, ${byFamily.size} families, ${sent} sent${dryRun ? " (dry run)" : ""}`);

  return NextResponse.json({
    ok: true,
    dryRun,
    window: `${LOOKAHEAD_HOURS}h`,
    events: rows.length,
    families: byFamily.size,
    sent,
    ...(skipped.length ? { skipped } : {}),
  });
}
