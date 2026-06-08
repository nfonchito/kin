import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";

const IS_PREVIEW = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");

const PREVIEW_FAMILY = { id: "preview", name: "The Johnson Family", neighborhood: "Northwest Hills" };

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let family = IS_PREVIEW ? PREVIEW_FAMILY : null;
  let userEmail = IS_PREVIEW ? "preview@kin.app" : "";

  if (!IS_PREVIEW) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    userEmail = user.email ?? "";
    const { data: familyData } = await supabase
      .from("families")
      .select("*")
      .eq("user_id", user.id)
      .single();
    family = familyData;
  }

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      <Sidebar family={family} userEmail={userEmail} />

      <main className="flex-1 overflow-auto lg:ml-0">
        <MobileNav family={family} userEmail={userEmail} />
        <div className="min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
