import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// An IANA zone name reaches Intl, which throws on anything unrecognised, and
// it is stored and reused for every reminder — so it is validated on the way in.
function validZone(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 64) return null;
  if (!/^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/.test(value)) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value;
  } catch {
    return null;
  }
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { type, ...data } = body;

  if (type === "family") {
    const { error } = await supabase
      .from("families")
      .update({ name: data.name, neighborhood: data.neighborhood })
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Set by the browser, which is the only thing that knows where the family
  // actually is. Reminder emails render their times in this zone.
  if (type === "timezone") {
    const zone = validZone(data.timezone);
    if (!zone) return NextResponse.json({ error: "Not a valid IANA timezone" }, { status: 400 });

    const update = supabase.from("families").update({ timezone: zone }).eq("user_id", user.id);
    // "onlyIfMissing" is the automatic capture — it must never overwrite a
    // zone the family set deliberately, or a trip abroad would rewrite it.
    const { error } = data.onlyIfMissing ? await update.is("timezone", null) : await update;
    if (error) {
      // 42703 = the column isn't there yet; the migration in supabase/schema.sql
      // hasn't been run. Say so plainly instead of a bare Postgres error.
      if (error.code === "42703") {
        console.warn("[profile] families.timezone is missing — run the schema migration");
        return NextResponse.json(
          { error: "Timezone storage isn't set up yet on this deployment." },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, timezone: zone });
  }

  if (type === "preferences") {
    const { data: family } = await supabase
      .from("families")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!family) return NextResponse.json({ error: "Family not found" }, { status: 404 });

    const { error } = await supabase
      .from("family_preferences")
      .upsert({ family_id: family.id, ...data });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, ...data } = await req.json();

  if (type === "member") {
    const { data: family } = await supabase
      .from("families")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!family) return NextResponse.json({ error: "Family not found" }, { status: 404 });

    const { data: member, error } = await supabase
      .from("family_members")
      .insert({ family_id: family.id, ...data })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(member);
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, type } = await req.json();

  if (type === "member") {
    const { error } = await supabase.from("family_members").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
