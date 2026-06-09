import { createClient } from "@/lib/supabase/server";
import { ChatInterface } from "@/components/ChatInterface";
import { ActivityFeed } from "@/components/ActivityFeed";
import { UpcomingEvents } from "@/components/UpcomingEvents";
import { PreviewGreeting } from "@/components/PreviewGreeting";

const IS_PREVIEW = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");

export default async function DashboardPage() {
  if (IS_PREVIEW) {
    return (
      <div className="flex flex-col lg:flex-row h-full min-h-[calc(100vh-56px)] lg:min-h-screen">
        <div className="flex-1 flex flex-col min-h-[60vh] lg:min-h-0">
          <div className="px-5 pt-6 pb-4 border-b border-border">
            <PreviewGreeting />
            <p className="text-sm text-text-secondary mt-0.5">What can Kin help with today?</p>
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
        <div className="px-5 pt-6 pb-4 border-b border-border">
          <h1 className="text-lg font-semibold text-text-primary">
            Hey, {family?.name ?? "there"} 👋
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">What can Kin help with today?</p>
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
