import { editDistance } from "./dates.ts";

/**
 * Repairs misspelled instruction words.
 *
 * Only words that change what Kin *does* are corrected. A typo in "dentsit"
 * costs you a slightly odd title; a typo in "cancle" used to offer to create
 * a second dentist appointment, and "remvoe the lawn care" added lawn care —
 * the exact opposite of the request. Content words are left alone on purpose,
 * because guessing at them risks rewriting someone's surname.
 */
const COMMAND_WORDS = [
  "cancel", "delete", "remove", "move", "reschedule", "schedule",
  "change", "switch", "every", "remind", "tomorrow", "today", "weekly", "monthly",
];

/**
 * Real words close enough to a command to be swallowed by the matcher.
 * "movie night" must not become "move night", and "remote work" must not
 * become "remove work" — both would flip the message into an instruction.
 */
const LOOKALIKES = new Set([
  "movie", "movies", "moved", "moving", "mover", "movers",
  "remote", "chance", "chances", "changed", "changes", "charge",
  "ever", "even", "evening", "events", "event", "severy",
  "deleted", "removed", "cancelled", "canceled", "scheduled", "rescheduled",
  "switched", "reminded", "reminder", "reminders", "weekday", "weekend",
]);

/** Short, very common slips that edit distance alone would be unsafe on. */
const SHORT_FIXES: [RegExp, string][] = [
  [/\bevry\b/gi, "every"],
  [/\beveery\b/gi, "every"],
  [/\beverey\b/gi, "every"],
  [/\bcancl\b/gi, "cancel"],
  [/\bdelet\b/gi, "delete"],
  [/\bplz\b/gi, "please"],
];

/**
 * Corrects instruction words in the first part of a message.
 *
 * Scoped to the opening words because that is where instructions live, and
 * because a word deep in a title is far more likely to be someone's name than
 * a misspelled verb.
 */
export function normalizeCommands(text: string): string {
  let out = text;
  for (const [re, fix] of SHORT_FIXES) out = out.replace(re, fix);

  const words = out.split(/(\s+)/);          // keep the separators
  let wordsSeen = 0;

  return words
    .map((token) => {
      if (/^\s+$/.test(token)) return token;
      wordsSeen++;

      // "every" can appear anywhere ("lawn care every thursday"); the rest are
      // instructions and belong near the front.
      const lower = token.toLowerCase().replace(/[^a-z]/g, "");
      const onlyEvery = wordsSeen > 3;
      if (lower.length < 4 || LOOKALIKES.has(lower)) return token;

      for (const word of COMMAND_WORDS) {
        if (onlyEvery && word !== "every") continue;
        if (word === lower) return token;
        if (word[0] !== lower[0]) continue;
        const budget = lower.length <= 4 ? 1 : 2;
        if (editDistance(lower, word, budget) <= budget) {
          return token.replace(/[a-zA-Z]+/, word);
        }
      }
      return token;
    })
    .join("");
}
