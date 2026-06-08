import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/ProfileForm";

const IS_PREVIEW = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");

const PREVIEW_FAMILY = { id: "preview", name: "The Johnson Family", neighborhood: "Northwest Hills", city: "Austin", state: "TX", zip: "78731" };
const PREVIEW_MEMBERS = [
  { id: "m1", name: "Sarah", role: "parent", age: 38 },
  { id: "m2", name: "David", role: "parent", age: 40 },
  { id: "m3", name: "Emma", role: "child", age: 10 },
];
const PREVIEW_PREFS = { home_size: "large", yard_type: "medium", dietary_notes: "", reminders_enabled: true };

export default async function ProfilePage() {
  if (IS_PREVIEW) {
    return (
      <div className="px-5 py-6 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-text-primary">Family Profile</h1>
          <p className="text-sm text-text-secondary mt-0.5">Your family details and preferences</p>
        </div>
        <ProfileForm
          family={PREVIEW_FAMILY}
          members={PREVIEW_MEMBERS}
          preferences={PREVIEW_PREFS}
          userEmail="sarah@johnsons.com"
        />
      </div>
    );
  }

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
