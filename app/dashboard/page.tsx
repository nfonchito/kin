import { createClient } from "@/lib/supabase/server";
import { ChatInterface } from "@/components/ChatInterface";
import { ActivityFeed } from "@/components/ActivityFeed";
import { UpcomingEvents } from "@/components/UpcomingEvents";
import { PreviewGreeting } from "@/components/PreviewGreeting";
import { TodayLabel } from "@/components/TodayLabel";

const IS_PREVIEW = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");

export default async function DashboardPage() {
  if (IS_PREVIEW) {
    return (
      <div className="flex flex-col lg:flex-row h-full min-h-[calc(100vh-56px)] lg:min-h-screen">
        <div className="flex-1 flex flex-col min-h-[60vh] lg:min-h-0">
          <div className="relative px-5 pt-6 pb-5 border-b border-border overflow-hidden">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-28 -left-20 w-96 h-56 rounded-full opacity-[0.13] blur-3xl"
              style={{ background: "radial-gradient(circle, #f7cb98 0%, transparent 70%)" }}
            />
            <div className="relative">
              <TodayLabel className="mb-1.5" />
              <PreviewGreeting />
              <p className="text-sm text-text-secondary mt-1">What can Kin help with today?</p>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatInterface familyId="preview" initialMessages={[]} />
          </div>
        </div>
        <div className="w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-border flex flex-col overflow-auto">
          <UpcomingEvents events={[]} familyId="preview" />
          <div className="flex-1">
            <ActivityFeed activities={[]} familyId="preview" />
          </div>
        </div>
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

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("family_id", family?.id)
    .order("created_at", { ascending: true })
    .limit(50);

  const { data: activities } = await supabase
    .from("activities")
    .select("*")
    .eq("family_id", family?.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("family_id", family?.id)
    .gte("start_time", new Date().toISOString())
    .order("start_time", { ascending: true })
    .limit(5);

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-[calc(100vh-56px)] lg:min-h-screen">
      <div className="flex-1 flex flex-col min-h-[60vh] lg:min-h-0">
        <div className="relative px-5 pt-6 pb-5 border-b border-border overflow-hidden">
          {/* soft accent wash, echoes the landing page hero */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -left-16 w-72 h-48 rounded-full opacity-[0.07] blur-3xl"
            style={{ background: "radial-gradient(circle, #f7cb98 0%, transparent 70%)" }}
          />
          <div className="relative">
            <TodayLabel className="mb-1.5" />
            <h1 className="font-display text-[2rem] leading-tight text-text-primary tracking-[-0.01em]">
              Hey, {family?.name ?? "there"} 👋
            </h1>
            <p className="text-sm text-text-secondary mt-1">What can Kin help with today?</p>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <ChatInterface familyId={family?.id} initialMessages={messages ?? []} />
        </div>
      </div>
      <div className="w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-border flex flex-col overflow-auto">
        <UpcomingEvents events={events ?? []} familyId={family?.id} />
        <div className="flex-1">
          <ActivityFeed activities={activities ?? []} familyId={family?.id} />
        </div>
      </div>
    </div>
  );
}
