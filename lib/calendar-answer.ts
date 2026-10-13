import { formatEventLine } from "./dates";

export interface StoredEvent {
  title: string;
  start_time: string;
  category?: string | null;
}

export interface AnsweredWindow {
  label: string;
  singleDay: boolean;
}

/**
 * How to refer to a window mid-sentence. Some labels take a preposition
 * ("in the next 7 days", "on Friday") and some read as adverbs already
 * ("today", "next week") — "in next week" is the giveaway for getting it wrong.
 */
function phraseFor({ label, singleDay }: AnsweredWindow): string {
  if (singleDay) return label === "today" || label === "tomorrow" ? label : `on ${label}`;
  return label.startsWith("the ") ? `in ${label}` : label;
}

// Turns the rows for a window into a real answer. Pure, and separate from the
// DB read, so it can be tested against fixed input.
export function formatCalendarAnswer(
  events: StoredEvent[],
  window: AnsweredWindow,
  tzOffsetMin = 0
): string {
  const phrase = phraseFor(window);

  if (events.length === 0) {
    return `Nothing on your calendar ${phrase}. Want to put something on it?`;
  }

  // Long stretches get trimmed rather than dumping thirty rows into a bubble.
  const MAX = 8;
  const shown = events.slice(0, MAX);
  const extra = events.length - shown.length;

  const lines = shown.map(
    (e) => `• ${formatEventLine(e.start_time, tzOffsetMin, { withDate: !window.singleDay })} — ${e.title}`
  );

  const count = events.length === 1 ? "one thing" : `${events.length} things`;
  const tail = extra > 0 ? `\n…and ${extra} more — the Calendar tab has the full view.` : "";

  return `You've got ${count} ${phrase}:\n${lines.join("\n")}${tail}`;
}
