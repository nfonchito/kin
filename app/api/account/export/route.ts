import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Everything we hold on this household, as one JSON file. The privacy page
// promises "a copy of your data" — this is that, without an email round-trip.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: family } = await supabase
    .from("families")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!family) {
    return NextResponse.json({ error: "No family for this account" }, { status: 404 });
  }

  // RLS already scopes these to the caller's family; the explicit filter keeps
  // that true even if a policy is ever loosened.
  const [members, preferences, events, activities, messages] = await Promise.all([
    supabase.from("family_members").select("*").eq("family_id", family.id),
    supabase.from("family_preferences").select("*").eq("family_id", family.id),
    supabase.from("events").select("*").eq("family_id", family.id).order("start_time"),
    supabase.from("activities").select("*").eq("family_id", family.id).order("created_at"),
    supabase.from("messages").select("*").eq("family_id", family.id).order("created_at"),
  ]);

  const bundle = {
    exported_at: new Date().toISOString(),
    account: { email: user.email, created_at: user.created_at },
    family,
    family_members: members.data ?? [],
    family_preferences: preferences.data?.[0] ?? null,
    events: events.data ?? [],
    activities: activities.data ?? [],
    messages: messages.data ?? [],
  };

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="kin-export-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
