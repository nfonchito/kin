import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// Look up the signed-in user's family, or null.
async function getFamilyId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("families").select("id").eq("user_id", userId).single();
  return data?.id ?? null;
}

// DELETE — clear the conversation. Returns the removed messages so the client
// can offer an undo without needing a soft-delete column.
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const familyId = await getFamilyId(supabase, user.id);
  if (!familyId) return NextResponse.json({ error: "Family not found" }, { status: 404 });

  const { data: removed, error } = await supabase
    .from("messages")
    .delete()
    .eq("family_id", familyId)
    .select("role, content, created_at");

  if (error) {
    console.error("[messages] clear failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ removed: removed ?? [] });
}

// POST — restore a previously cleared conversation (the undo).
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { messages } = await req.json();
  if (!Array.isArray(messages) || messages.length === 0)
    return NextResponse.json({ error: "No messages to restore" }, { status: 400 });

  const familyId = await getFamilyId(supabase, user.id);
  if (!familyId) return NextResponse.json({ error: "Family not found" }, { status: 404 });

  // Rebuild rows from scratch rather than trusting the payload: only role,
  // content, and the original timestamp carry over, always under this family.
  const rows = messages
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string")
    .slice(0, 500)
    .map((m) => ({
      family_id: familyId,
      role: m.role as "user" | "assistant",
      content: String(m.content).slice(0, 4000),
      ...(typeof m.created_at === "string" ? { created_at: m.created_at } : {}),
    }));

  if (rows.length === 0)
    return NextResponse.json({ error: "Nothing valid to restore" }, { status: 400 });

  const { data: restored, error } = await supabase
    .from("messages")
    .insert(rows)
    .select("id, role, content, created_at");

  if (error) {
    console.error("[messages] restore failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ restored: restored ?? [] });
}
