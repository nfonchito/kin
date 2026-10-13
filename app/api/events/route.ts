import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { shiftPreservingLocalTime, localPartsIn, localDayDelta } from "@/lib/dates";

// Columns a client is allowed to set. Everything else on the row — id,
// family_id, created_by, activity_id, created_at — is decided here, so a
// caller can't pick its own id or attach an event to someone's activity.
const WRITABLE = ["title", "start_time", "end_time", "all_day", "category", "color", "description"] as const;

type Writable = Partial<Record<(typeof WRITABLE)[number], unknown>>;

function writableFields(body: Record<string, unknown>): Writable {
  const out: Writable = {};
  for (const key of WRITABLE) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

// The caller's own family. Never trust a family_id from the request body.
async function familyIdFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  const { data } = await supabase.from("families").select("id").eq("user_id", userId).single();
  return data?.id ?? null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const fields = writableFields(body);
  if (!fields.title || !fields.start_time) {
    return NextResponse.json({ error: "title and start_time are required" }, { status: 400 });
  }

  const family_id = await familyIdFor(supabase, user.id);
  if (!family_id) return NextResponse.json({ error: "No family for this account" }, { status: 404 });

  const { data, error } = await supabase
    .from("events")
    .insert({ ...fields, family_id })
    .select()
    .single();

  if (error) {
    console.error("[events] insert failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const fields = writableFields(body);
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // Scoped to the caller's own family as well as the id. RLS already does this,
  // but matching explicitly means someone else's id comes back as not found
  // rather than quietly updating zero rows and reporting success.
  const family_id = await familyIdFor(supabase, user.id);
  if (!family_id) return NextResponse.json({ error: "No family for this account" }, { status: 404 });

  // Editing a whole run: title and category apply to every future occurrence,
  // and a time change is applied as the same shift to each — so moving one
  // occurrence from Thursday 9am to Friday 10am moves the series to Fridays
  // at 10am, rather than stacking them all on one date.
  if (body.scope === "series") {
    const { data: clicked } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .eq("family_id", family_id)
      .single();

    if (clicked?.recurrence_id) {
      const { data: siblings } = await supabase
        .from("events")
        .select("id, start_time")
        .eq("family_id", family_id)
        .eq("recurrence_id", clicked.recurrence_id)
        .gte("start_time", clicked.start_time);

      const { start_time: newStart, ...shared } = fields;

      // Shift on the local calendar, not by a millisecond delta: a fixed delta
      // turns a 10:30 job into 9:30 the moment the run crosses a daylight-saving
      // change. Needs the family's zone to know what "10:30" means.
      const { data: fam } = await supabase
        .from("families")
        .select("*")
        .eq("id", family_id)
        .single();
      const zone: string | null = fam?.timezone ?? null;

      const moved = typeof newStart === "string";
      const dayDelta = moved ? localDayDelta(clicked.start_time, newStart, zone) : 0;
      const target = moved ? localPartsIn(newStart, zone) : null;

      for (const sib of siblings ?? []) {
        const row: Record<string, unknown> = { ...shared };
        if (target) {
          row.start_time = shiftPreservingLocalTime(
            sib.start_time,
            dayDelta,
            target.hour,
            target.minute,
            zone
          );
        }
        if (Object.keys(row).length === 0) continue;
        const { error: sibError } = await supabase
          .from("events")
          .update(row)
          .eq("id", sib.id)
          .eq("family_id", family_id);
        if (sibError) console.error("[events] series update failed:", sibError.message);
      }

      const { data: updated } = await supabase.from("events").select("*").eq("id", id).single();
      return NextResponse.json({ ...updated, updatedCount: (siblings ?? []).length });
    }
    // Falls through to the single-row update when there's no series to speak of.
  }

  const { data, error } = await supabase
    .from("events")
    .update(fields)
    .eq("id", id)
    .eq("family_id", family_id)
    .select()
    .single();

  if (error) {
    console.error("[events] update failed:", error.message);
    // No row matched — a bad id, or one belonging to someone else.
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// The occurrences this row stands for: itself, or — with scope "series" — every
// future occurrence sharing its recurrence_id. Past ones are left alone, since
// cancelling a standing arrangement shouldn't rewrite history.
async function seriesScope(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  family_id: string,
  scope: unknown
): Promise<{ ids: string[]; rule: string | null }> {
  if (scope !== "series") return { ids: [id], rule: null };

  const { data: row, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .eq("family_id", family_id)
    .single();

  // No recurrence columns yet, or a one-off: just this row.
  if (error || !row?.recurrence_id) return { ids: [id], rule: null };

  const { data: siblings } = await supabase
    .from("events")
    .select("id")
    .eq("family_id", family_id)
    .eq("recurrence_id", row.recurrence_id)
    .gte("start_time", row.start_time);

  const ids = (siblings ?? []).map((s) => s.id);
  return { ids: ids.length ? ids : [id], rule: row.recurrence_rule ?? null };
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const family_id = await familyIdFor(supabase, user.id);
  if (!family_id) return NextResponse.json({ error: "No family for this account" }, { status: 404 });

  const { ids } = await seriesScope(supabase, id, family_id, body.scope);

  const { error } = await supabase
    .from("events")
    .delete()
    .in("id", ids)
    .eq("family_id", family_id);

  if (error) {
    console.error("[events] delete failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, deleted: ids.length });
}
