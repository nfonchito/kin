import type { SupabaseClient } from "@supabase/supabase-js";
import { expandOccurrences } from "@/lib/dates";

// How far ahead a repeating series should always reach, and how close to the
// end we let it get before extending. Without this a "every Thursday" request
// simply stops after its last generated row, with nothing to tell the family.
export const HORIZON_DAYS = 60;
export const TOP_UP_COUNT = 8;

type Client = Pick<SupabaseClient, "from">;

interface SeriesRow {
  recurrence_id: string;
  recurrence_rule: string;
  family_id: string;
  title: string;
  category: string;
  color: string;
  description: string | null;
  start_time: string;
}

/**
 * Extends any repeating series whose last occurrence falls inside the horizon.
 *
 * Occurrences are materialised rows rather than a rule expanded at read time,
 * which keeps every query simple but means the run is finite. This tops it up
 * from the back, so a standing arrangement keeps going.
 */
export async function topUpSeries(
  client: Client,
  now = new Date()
): Promise<{ extended: number; added: number; error?: string }> {
  const horizon = new Date(now.getTime() + HORIZON_DAYS * 86400000).toISOString();

  // Every future occurrence that belongs to a run, oldest first.
  const { data, error } = await client
    .from("events")
    .select("*")
    .not("recurrence_id", "is", null)
    .gte("start_time", now.toISOString())
    .order("start_time", { ascending: true });

  // The columns may not exist yet; that's not a failure worth reporting up.
  if (error) return { extended: 0, added: 0, error: error.message };

  const rows = (data ?? []) as SeriesRow[];

  // Keep the last occurrence of each run.
  const last = new Map<string, SeriesRow>();
  for (const row of rows) last.set(row.recurrence_id, row);

  // Each family's zone, so occurrences keep their local wall time across a
  // daylight-saving change. Extending in UTC would turn a 9am weekly job into
  // an 8am one the moment the clocks go back.
  const familyIds = [...new Set([...last.values()].map((r) => r.family_id))];
  const zones = new Map<string, string | null>();
  if (familyIds.length > 0) {
    const { data: families } = await client.from("families").select("*").in("id", familyIds);
    for (const f of families ?? []) zones.set(f.id, f.timezone ?? null);
  }

  let extended = 0;
  let added = 0;

  for (const [, tail] of last) {
    if (tail.start_time > horizon) continue;       // still has plenty of runway
    if (!tail.recurrence_rule) continue;

    // expandOccurrences includes the anchor as its first result, so drop it.
    const next = expandOccurrences(
      tail.start_time,
      tail.recurrence_rule,
      0,
      zones.get(tail.family_id) ?? undefined
    ).slice(1, TOP_UP_COUNT + 1);
    if (next.length === 0) continue;

    const { error: insertError } = await client.from("events").insert(
      next.map((start_time) => ({
        family_id: tail.family_id,
        title: tail.title,
        start_time,
        category: tail.category,
        color: tail.color,
        description: tail.description,
        recurrence_id: tail.recurrence_id,
        recurrence_rule: tail.recurrence_rule,
      }))
    );

    if (insertError) {
      console.error("[series] top-up failed:", insertError.message);
      continue;
    }
    extended++;
    added += next.length;
  }

  return { extended, added };
}
