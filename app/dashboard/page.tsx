import { createClient } from "@/lib/supabase/server";
import { ChatInterface } from "@/components/ChatInterface";
import { ActivityFeed } from "@/components/ActivityFeed";
import { UpcomingEvents } from "@/components/UpcomingEvents";

const IS_PREVIEW = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");

const PREVIEW_FAMILY = { id: "preview", name: "The Johnson Family", neighborhood: "Northwest Hills" };

const now = new Date();
const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
const thursday = new Date(now); thursday.setDate(now.getDate() + ((4 - now.getDay() + 7) % 7 || 7));
const saturday = new Date(now); saturday.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7 || 7));

const PREVIEW_EVENTS = [
  { id: "e1", title: "Emma's Soccer Practice", start_time: thursday.toISOString(), category: "sports", color: "#f59e0b" },
  { id: "e2", title: "Lawn Care", start_time: saturday.toISOString(), category: "service", color: "#15c489" },
  { id: "e3", title: "Dentist — David", start_time: tomorrow.toISOString(), category: "appointment", color: "#ec4899" },
];

const PREVIEW_ACTIVITIES = [
  { id: "a1", title: "Lawn care — Saturday", category: "lawn", status: "in_progress" as const, description: "Book lawn care for Saturday", created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
  { id: "a2", title: "Reminder: soccer Thursday for David", category: "reminder", status: "pending" as const, description: "Remind David about Emma's soccer Thursday", created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
  { id: "a3", title: "Dentist appointment confirmed", category: "booking", status: "done" as const, description: "Schedule dentist for David", created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
];

const PREVIEW_MESSAGES = [
  { id: "m1", role: "user" as const, content: "Book lawn care for Saturday", created_at: new Date(Date.now() - 1000 * 60 * 6).toISOString() },
  { id: "m2", role: "assistant" as const, content: "Got it — I'll schedule lawn care for Saturday. I'll reach out to your preferred vendor and confirm the booking. I'll let you know as soon as it's locked in.", created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
];

export default async function DashboardPage() {
  if (IS_PREVIEW) {
    return (
      <div className="flex flex-col lg:flex-row h-full min-h-[calc(100vh-56px)] lg:min-h-screen">
        <div className="flex-1 flex flex-col min-h-[60vh] lg:min-h-0">
          <div className="px-5 pt-6 pb-4 border-b border-border">
            <h1 className="text-lg font-semibold text-text-primary">Hey, The Johnson Family 👋</h1>
            <p className="text-sm text-text-secondary mt-0.5">What can Kin help with today?</p>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatInterface familyId="preview" initialMessages={PREVIEW_MESSAGES} />
          </div>
        </div>
        <div className="w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-border flex flex-col overflow-auto">
          <UpcomingEvents events={PREVIEW_EVENTS} familyId="preview" />
          <div className="flex-1">
            <ActivityFeed activities={PREVIEW_ACTIVITIES} familyId="preview" />
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
