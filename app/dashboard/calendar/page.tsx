import { createClient } from "@/lib/supabase/server";
import { CalendarView } from "@/components/CalendarView";

export default async function CalendarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: family } = await supabase
    .from("families")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("family_id", family?.id)
    .gte("start_time", startOfMonth)
    .lte("start_time", endOfMonth)
    .order("start_time", { ascending: true });

  return (
    <div className="px-5 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Calendar</h1>
        <p className="text-sm text-text-secondary mt-0.5">Upcoming events and bookings</p>
      </div>
      <CalendarView events={events ?? []} familyId={family?.id} />
    </div>
  );
}
