import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/ProfileForm";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: family } = await supabase
    .from("families")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const { data: members } = await supabase
    .from("family_members")
    .select("*")
    .eq("family_id", family?.id)
    .order("created_at", { ascending: true });

  const { data: preferences } = await supabase
    .from("family_preferences")
    .select("*")
    .eq("family_id", family?.id)
    .single();

  return (
    <div className="px-5 py-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Family Profile</h1>
        <p className="text-sm text-text-secondary mt-0.5">Your family details and preferences</p>
      </div>
      <ProfileForm
        family={family}
        members={members ?? []}
        preferences={preferences}
        userEmail={user.email ?? ""}
      />
    </div>
  );
}
