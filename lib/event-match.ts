import { normalizeDays, TOMORROW_RE, TODAY_RE, hasDateLike, calendarWindow, editDistance } from "./dates.ts";

/** Words that say what to do, never what it is about. */
const COMMANDS =
  /\b(cancel|delete|remove|drop|scrap|call off|never ?mind|scratch|forget|reschedule|resched|move|change|switch|shift|push|bump|put|set|make|take|get|book|schedule)\b/gi;

/** Filler that survives command-stripping but doesn't identify anything. */
const NOISE =
  /\b(the|a|an|my|our|his|her|their|its|this|that|it|them|to|for|on|at|of|in|from|back|off|please|can|could|would|you|i|we|us|me|appointment|appt|event|thing|entry|all|every|whole|series|run|repeating|recurring|and|is|be|up|new|old|next|last|earlier|later|instead|again|rest)\b/gi;

/**
 * The thing a change refers to — "cancel the dentist on Friday" → "dentist".
 *
 * Deliberately crude: what's left after removing the instruction, the date and
 * the filler. It only has to be good enough to match against titles the family
 * wrote themselves, and an empty result is a useful answer too — it means the
 * message named no subject, so we should ask rather than guess.
 */
export function extractSubject(msg: string): string {
  return normalizeDays(msg.toLowerCase())
    .replace(TOMORROW_RE, " ")
    .replace(TODAY_RE, " ")
    .replace(/\bevery\s+\w+\b/gi, " ")
    .replace(/\b(next|this|last)\s+(week|month|year)\b/gi, " ")
    .replace(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)s?\b/gi, " ")
    .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?\b/gi, " ")
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, " ")
    .replace(/\b(?:the\s+)?\d{1,2}(?:st|nd|rd|th)\b/gi, " ")
    .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, " ")
    .replace(/\b(noon|midnight|morning|afternoon|evening|tonight)\b/gi, " ")
    .replace(COMMANDS, " ")
    .replace(NOISE, " ")
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when the message is about the standing arrangement, not one occurrence. */
export function wantsWholeSeries(msg: string): boolean {
  return /\b(all|every|the whole|entire|series|recurring|repeating|standing|from now on|permanently|for good|stop)\b/i.test(msg);
}

export interface MatchableEvent {
  id: string;
  title: string;
  start_time: string;
  recurrence_id?: string | null;
  recurrence_rule?: string | null;
}

/**
 * Events whose title the subject points at, best first.
 *
 * Scores on how much of the subject the title accounts for, so "dentist"
 * matches "Dentist — Maya", and a two-word subject prefers a title carrying
 * both words. Returns everything that matched so the caller can tell the
 * difference between one answer and an ambiguous question.
 */
export function findMatches<T extends MatchableEvent>(events: T[], subject: string): T[] {
  const words = subject.split(/\s+/).filter((w) => w.length > 2);
  if (words.length === 0) return [];

  const scored = events
    .map((event) => {
      const title = event.title.toLowerCase();
      const titleWords = title.split(/[^a-z0-9']+/).filter(Boolean);
      const hits = words.filter((w) => title.includes(w) || nearAnyWord(w, titleWords)).length;
      return { event, hits };
    })
    .filter((s) => s.hits > 0);

  if (scored.length === 0) return [];

  // Only keep the strongest matches: a title hitting two words beats one
  // hitting a single shared word.
  const best = Math.max(...scored.map((s) => s.hits));
  return scored
    .filter((s) => s.hits === best)
    .map((s) => s.event)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}

/**
 * A "clear my Friday" request: a span of time, with nothing named inside it.
 *
 * Returns null unless the message both sweeps ("everything", "clear") and says
 * when — "cancel everything" with no day is too blunt an instruction to act on.
 */
export function clearWholeDay(
  message: string,
  tzOffsetMin: number
): { startISO: string; endISO: string; phrase: string } | null {
  const sweeping =
    /\b(everything|anything|all (my |the )?(events?|plans?|appointments?)|the (whole|entire) day|my (whole |entire )?(day|week))\b/i.test(message) ||
    /^\s*clear\b/i.test(message);
  if (!sweeping) return null;

  const saysWhen =
    hasDateLike(message, tzOffsetMin) || /\b(today|tomorrow|week|weekend|month)\b/i.test(message);
  if (!saysWhen) return null;

  const win = calendarWindow(message, tzOffsetMin);
  return { startISO: win.startISO, endISO: win.endISO, phrase: win.label };
}

/** "cancel soccer and the dentist" → ["soccer", "dentist"]. */
export function splitSubjects(message: string): string[] {
  return message
    .split(/\s*(?:,|\band\b|\bplus\b|&)\s*/i)
    .map((part) => extractSubject(part))
    .filter((part) => part.length > 0);
}

/**
 * Whether a subject word is close enough to any word in a title.
 *
 * Instruction typos are repaired before this point, but the *subject* is
 * whatever the family typed — a real user wrote "cancel the dentest" and Kin
 * found nothing, because matching was exact. The budget scales with length so
 * short words still have to be right: "vet" and "gym" have no room to spare,
 * while "dentest" is one edit from "dentist".
 */
function nearAnyWord(word: string, titleWords: string[]): boolean {
  const budget = word.length >= 8 ? 2 : word.length >= 5 ? 1 : 0;
  if (budget === 0) return false;
  return titleWords.some((t) => {
    if (Math.abs(t.length - word.length) > budget) return false;
    return editDistance(word, t, budget) <= budget;
  });
}
