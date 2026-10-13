import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Permanently deletes the caller's household.
 *
 * Removing the auth user is enough to remove everything: families.user_id
 * cascades from auth.users, and family_members, family_preferences, events,
 * activities and messages all cascade from families.
 *
 * The account is always the caller's own — taken from the session, never from
 * the request — so there is no id a client could substitute for someone else's.
 */
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: family } = await supabase
    .from("families")
    .select("id, name")
    .eq("user_id", user.id)
    .single();

  if (!family) return NextResponse.json({ error: "No family for this account" }, { status: 404 });

  // Typed confirmation. This is irreversible and there is no undo, so a stray
  // click on the button must not be enough on its own.
  const body = await req.json().catch(() => ({}));
  const typed = typeof body.confirm === "string" ? body.confirm.trim() : "";
  if (typed.toLowerCase() !== (family.name ?? "").trim().toLowerCase()) {
    return NextResponse.json(
      { error: `Type the household name exactly — "${family.name}" — to confirm.` },
      { status: 400 }
    );
  }

  // Deleting an auth user needs the service role; the caller's own client can't.
  const admin = createAdminClient();
  if (!admin) {
    console.error("[account] delete requested but no service-role key is configured");
    return NextResponse.json(
      { error: "Account deletion isn't available right now. Email hello@kinfamily.app and we'll do it by hand." },
      { status: 503 }
    );
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[account] delete failed:", error.message);
    return NextResponse.json({ error: "Couldn't delete the account. Nothing was removed." }, { status: 500 });
  }

  // The session now points at a user that no longer exists — clear the cookies
  // so the browser isn't left holding a dead token.
  await supabase.auth.signOut();

  return NextResponse.json({ success: true });
}
