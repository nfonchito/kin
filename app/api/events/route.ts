import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

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

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json().catch(() => ({ id: null }));
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) {
    console.error("[events] delete failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
