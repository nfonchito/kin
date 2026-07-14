import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";

const IS_PREVIEW = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (IS_PREVIEW) {
    return (
      <div className="flex h-screen bg-bg overflow-hidden">
        <Sidebar family={null} userEmail="" />
        <main className="flex-1 overflow-auto lg:ml-0">
          <MobileNav family={null} userEmail="" />
          <div className="min-h-full">{children}</div>
        </main>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const userEmail = user.email ?? "";
  let { data: family } = await supabase
    .from("families")
    .select("*")
    .eq("user_id", user.id)
    .single();

  // Fallback: if the signup trigger didn't create the family row, create it
  // here so a fresh account is never stuck without one.
  if (!family) {
    const { data: created } = await supabase
      .from("families")
      .insert({
        user_id: user.id,
        name: (user.user_metadata?.family_name as string) || "My Family",
      })
      .select()
      .single();
    family = created;
  }

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      <Sidebar family={family} userEmail={userEmail} />
      <main className="flex-1 overflow-auto lg:ml-0">
        <MobileNav family={family} userEmail={userEmail} />
        <div className="min-h-full">{children}</div>
      </main>
    </div>
  );
}
