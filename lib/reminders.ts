import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReminderEvent } from "@/lib/email";

// Shared by the scheduled job and the "send me a test" button so both agree
// on what counts as upcoming.
export const LOOKAHEAD_HOURS = 24;

export function reminderWindow(from = new Date()) {
  return {
    now: from.toISOString(),
    until: new Date(from.getTime() + LOOKAHEAD_HOURS * 3600 * 1000).toISOString(),
  };
}

// Both the user-scoped (RLS) and service-role clients satisfy this.
type EventQueryClient = Pick<SupabaseClient, "from">;

export async function fetchUpcomingEvents(
  client: EventQueryClient,
  familyId: string,
  from = new Date()
): Promise<{ events: ReminderEvent[]; error?: string }> {
  const { now, until } = reminderWindow(from);
  const { data, error } = await client
    .from("events")
    .select("title, start_time, category")
    .eq("family_id", familyId)
    .gte("start_time", now)
    .lte("start_time", until)
    .order("start_time", { ascending: true });

  if (error) return { events: [], error: error.message };
  return { events: (data ?? []) as ReminderEvent[] };
}
