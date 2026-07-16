// Date/time parsing for chat messages, computed in the USER's timezone.
//
// The server runs in UTC (Vercel), so "today" typed at 11 PM Central used to
// resolve to the next calendar day. Every function here takes tzOffsetMin —
// the browser's `new Date().getTimezoneOffset()` (minutes to ADD to local
// time to reach UTC; e.g. Central daylight = 300) — and uses the classic
// shift → compute-with-UTC-accessors → unshift technique so day arithmetic
// happens on the user's wall clock regardless of server timezone.

// Texting shorthand and typos for "tomorrow" / "today" so casual typing still
// works. The t+o+m+o+r+o*w* form tolerates any letter repetition (tomorrrow,
// tommorrow, tomorow, ...) rather than enumerating misspellings.
export const TOMORROW_RE = /\b(t+o+m+o+r+o*w*|tmrw|tmrrw|tmmr|tmr|tmw|tomo|tomm|2+m+o+r+o+w*|2morrow)\b/i;
export const TODAY_RE = /\b(t+o+d+a+y+|tonight|tonite|2day)\b/i;

// Common weekday misspellings, normalized before any matching.
const DAY_TYPOS: [RegExp, string][] = [
  [/\b(wensday|wendsday|wednsday|wednesay|wedensday)\b/gi, "wednesday"],
  [/\b(tusday|teusday|tuseday|tuesdy)\b/gi, "tuesday"],
  [/\b(thurday|thrusday|thursady|thusday)\b/gi, "thursday"],
  [/\b(firday|fridy|freeday)\b/gi, "friday"],
  [/\b(staurday|satruday|saterday|sautrday)\b/gi, "saturday"],
  [/\b(mondey|munday|mondy)\b/gi, "monday"],
  [/\b(sundey|sundy)\b/gi, "sunday"],
];

export function normalizeDays(s: string): string {
  let out = s;
  for (const [re, fix] of DAY_TYPOS) out = out.replace(re, fix);
  return out;
}

const MONTHS_ABBR = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
const MS_MIN = 60000;

// Did the message name an explicit clock time ("2pm", "14:30", "noon")?
export function hasExplicitTime(msg: string): boolean {
  return /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\bnoon\b|\bmidnight\b/i.test(msg);
}

export function extractDay(msg: string): string | null {
  const normalized = normalizeDays(msg);
  if (TOMORROW_RE.test(normalized)) return "tomorrow";
  if (TODAY_RE.test(normalized)) return "today";
  const m = normalized.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday|this week|next week)/i);
  return m ? m[1] : null;
}

export function extractTime(msg: string): string {
  const lower = msg.toLowerCase();
  if (/\bnoon\b/.test(lower)) return "12:00";
  if (/\bmidnight\b/.test(lower)) return "00:00";
  const m = msg.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (!m) return "09:00";
  let h = parseInt(m[1]);
  const min = m[2] ? parseInt(m[2]) : 0;
  if (m[3].toLowerCase() === "pm" && h !== 12) h += 12;
  if (m[3].toLowerCase() === "am" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

// A Date whose getUTC* fields read as the user's local wall clock.
function shiftedNow(tzOffsetMin: number): Date {
  return new Date(Date.now() - tzOffsetMin * MS_MIN);
}

// Convert a shifted (wall-clock) Date back to the real instant.
function unshift(d: Date, tzOffsetMin: number): string {
  return new Date(d.getTime() + tzOffsetMin * MS_MIN).toISOString();
}

// Parse any date reference in a freeform message into an ISO datetime, or null.
export function extractDateISO(msg: string, tzOffsetMin = 0): string | null {
  const lower = normalizeDays(msg.toLowerCase());
  const [hh, mm] = extractTime(msg).split(":").map(Number);
  const now = shiftedNow(tzOffsetMin);
  const at = (d: Date) => { d.setUTCHours(hh, mm, 0, 0); return unshift(d, tzOffsetMin); };

  if (TOMORROW_RE.test(lower)) { const d = new Date(now); d.setUTCDate(d.getUTCDate() + 1); return at(d); }
  if (TODAY_RE.test(lower)) {
    const d = new Date(now);
    d.setUTCHours(hh, mm, 0, 0);
    // "today" with no stated time, said after the default hour has passed:
    // aim for the next full hour instead of creating an already-past event.
    if (!hasExplicitTime(msg) && d <= now) {
      d.setTime(now.getTime());
      d.setUTCMinutes(0, 0, 0);
      d.setUTCHours(d.getUTCHours() + 1);
    }
    return unshift(d, tzOffsetMin);
  }

  // Weekday (optionally preceded by "next")
  const days = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  const wd = lower.match(/\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (wd) {
    const d = new Date(now);
    let ahead = days.indexOf(wd[2]) - d.getUTCDay();
    if (ahead <= 0) ahead += 7;
    d.setUTCDate(d.getUTCDate() + ahead);
    return at(d);
  }

  // "next week" → next Monday
  if (/\bnext week\b/.test(lower)) {
    const d = new Date(now);
    let ahead = 1 - d.getUTCDay(); if (ahead <= 0) ahead += 7; ahead += 7;
    d.setUTCDate(d.getUTCDate() + ahead); return at(d);
  }

  // Month name + day  ("june 22", "jun 22nd", "sept 3")
  const mn = lower.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (mn) {
    const mi = MONTHS_ABBR.indexOf(mn[1].slice(0, 3));
    const day = parseInt(mn[2]);
    if (mi >= 0 && day >= 1 && day <= 31) {
      let d = new Date(Date.UTC(now.getUTCFullYear(), mi, day, hh, mm, 0, 0));
      if (d < now) d = new Date(Date.UTC(now.getUTCFullYear() + 1, mi, day, hh, mm, 0, 0));
      return unshift(d, tzOffsetMin);
    }
  }

  // Numeric M/D or M/D/Y  ("6/22", "06/22/2026")
  const num = lower.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (num) {
    const mi = parseInt(num[1]) - 1, day = parseInt(num[2]);
    const year = num[3] ? (num[3].length === 2 ? 2000 + parseInt(num[3]) : parseInt(num[3])) : now.getUTCFullYear();
    if (mi >= 0 && mi <= 11 && day >= 1 && day <= 31) {
      let d = new Date(Date.UTC(year, mi, day, hh, mm, 0, 0));
      if (!num[3] && d < now) d = new Date(Date.UTC(year + 1, mi, day, hh, mm, 0, 0));
      return unshift(d, tzOffsetMin);
    }
  }

  // Day-of-month ordinal  ("the 20th", "on the 3rd", "22nd")
  const dom = lower.match(/\b(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/);
  if (dom) {
    const day = parseInt(dom[1]);
    if (day >= 1 && day <= 31) {
      let d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, hh, mm, 0, 0));
      if (d < now) d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, day, hh, mm, 0, 0));
      return unshift(d, tzOffsetMin);
    }
  }

  return null;
}

export function hasDateLike(msg: string, tzOffsetMin = 0): boolean {
  return extractDateISO(msg, tzOffsetMin) !== null;
}

// A friendly human phrase for any date/time in the message, in the user's
// timezone: "tomorrow", "Friday", "Friday at 2:00 PM", "June 22", or null.
export function friendlyWhen(msg: string, tzOffsetMin = 0): string | null {
  const lower = normalizeDays(msg.toLowerCase());
  const iso = extractDateISO(msg, tzOffsetMin);
  if (!iso) {
    if (/\bnext week\b/.test(lower)) return "next week";
    if (/\bthis week\b/.test(lower)) return "this week";
    return null;
  }
  // Shift so UTC-formatting displays the user's wall clock.
  const wall = new Date(new Date(iso).getTime() - tzOffsetMin * MS_MIN);
  let dayLabel: string;
  if (TOMORROW_RE.test(lower)) dayLabel = "tomorrow";
  else if (TODAY_RE.test(lower)) dayLabel = "today";
  else {
    const diff = Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
    dayLabel = diff >= 0 && diff < 7
      ? wall.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })
      : wall.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
  }
  return hasExplicitTime(msg)
    ? `${dayLabel} at ${wall.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" })}`
    : dayLabel;
}

// Prefix a "when" phrase with the right preposition: relative phrases
// ("tomorrow", "this week") take none; named days/dates take "on".
export function whenPhrase(w: string | null): string {
  if (!w) return "";
  if (/^(today|tonight|tomorrow|this week|next week)\b/i.test(w)) return ` ${w}`;
  return ` on ${w}`;
}

// The user's current date and time as display strings, in their timezone.
export function formatUserNow(tzOffsetMin = 0): { date: string; time: string } {
  const wall = shiftedNow(tzOffsetMin);
  return {
    date: wall.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }),
    time: wall.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }),
  };
}
