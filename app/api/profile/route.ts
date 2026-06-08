import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

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
