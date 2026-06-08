import { createClient } from "@/lib/supabase/server";
import { CalendarView } from "@/components/CalendarView";

const IS_PREVIEW = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");

function makeDate(offsetDays: number, hour = 9) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

const PREVIEW_EVENTS = [
  { id: "e1", title: "Emma's Soccer Practice", start_time: makeDate(3, 16), category: "sports", color: "#f59e0b" },
  { id: "e2", title: "Lawn Care", start_time: makeDate(5, 9), category: "service", color: "#15c489" },
  { id: "e3", title: "Dentist — David", start_time: makeDate(1, 10), category: "appointment", color: "#ec4899" },
  { id: "e4", title: "Book Club", start_time: makeDate(8, 19), category: "social", color: "#8b5cf6" },
  { id: "e5", title: "Parent-Teacher Conf.", start_time: makeDate(12, 14), category: "school", color: "#6366f1" },
];

export default async function CalendarPage() {
  if (IS_PREVIEW) {
    return (
      <div className="px-5 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-text-primary">Calendar</h1>
          <p className="text-sm text-text-secondary mt-0.5">Upcoming events and bookings</p>
        </div>
        <CalendarView events={PREVIEW_EVENTS} familyId="preview" />
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
