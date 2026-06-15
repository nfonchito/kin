import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { sendTaskNotification } from "@/lib/email";
import { generateSmartReply } from "@/lib/ai";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface FamilyContext {
  name: string;
  neighborhood: string;
  city: string;
  state: string;
  zip: string;
  members: { name: string; role: string; age?: number }[];
  preferences: {
    home_size?: string;
    yard_type?: string;
    dietary_notes?: string;
  } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Texting shorthand for "tomorrow" / "today" so casual typing still works.
const TOMORROW_RE = /\b(tomorrow|tomorow|tommorow|tommorrow|tomoro|tomorro|tmrw|tmrrw|tmmr|tmr|tmw|tomo|tomm|2moro|2morrow)\b/i;
const TODAY_RE = /\b(today|tonight|tonite|2day)\b/i;

function extractDay(msg: string): string | null {
  if (TOMORROW_RE.test(msg)) return "tomorrow";
  if (TODAY_RE.test(msg)) return "today";
  const m = msg.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday|this week|next week)/i);
  return m ? m[1] : null;
}

function extractTime(msg: string): string {
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

const MONTHS_ABBR = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

// Parse any date reference in a freeform message into an ISO datetime, or null.
function extractDateISO(msg: string): string | null {
  const lower = msg.toLowerCase();
  const [hh, mm] = extractTime(msg).split(":").map(Number);
  const now = new Date();
  const at = (d: Date) => { d.setHours(hh, mm, 0, 0); return d.toISOString(); };

  if (TOMORROW_RE.test(lower)) { const d = new Date(now); d.setDate(d.getDate() + 1); return at(d); }
  if (TODAY_RE.test(lower)) return at(new Date(now));

  // Weekday (optionally preceded by "next")
  const days = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  const wd = lower.match(/\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (wd) {
    const d = new Date(now);
    let ahead = days.indexOf(wd[2]) - d.getDay();
    if (ahead <= 0) ahead += 7;
    d.setDate(d.getDate() + ahead);
    return at(d);
  }

  // "next week" → next Monday
  if (/\bnext week\b/.test(lower)) {
    const d = new Date(now);
    let ahead = 1 - d.getDay(); if (ahead <= 0) ahead += 7; ahead += 7;
    d.setDate(d.getDate() + ahead); return at(d);
  }

  // Month name + day  ("june 22", "jun 22nd", "sept 3")
  const mn = lower.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (mn) {
    const mi = MONTHS_ABBR.indexOf(mn[1].slice(0, 3));
    const day = parseInt(mn[2]);
    if (mi >= 0 && day >= 1 && day <= 31) {
      let d = new Date(now.getFullYear(), mi, day, hh, mm, 0, 0);
      if (d < now) d = new Date(now.getFullYear() + 1, mi, day, hh, mm, 0, 0);
      return d.toISOString();
    }
  }

  // Numeric M/D or M/D/Y  ("6/22", "06/22/2026")
  const num = lower.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (num) {
    const mi = parseInt(num[1]) - 1, day = parseInt(num[2]);
    const year = num[3] ? (num[3].length === 2 ? 2000 + parseInt(num[3]) : parseInt(num[3])) : now.getFullYear();
    if (mi >= 0 && mi <= 11 && day >= 1 && day <= 31) {
      let d = new Date(year, mi, day, hh, mm, 0, 0);
      if (!num[3] && d < now) d = new Date(year + 1, mi, day, hh, mm, 0, 0);
      return d.toISOString();
    }
  }

  // Day-of-month ordinal  ("the 20th", "on the 3rd", "22nd")
  const dom = lower.match(/\b(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/);
  if (dom) {
    const day = parseInt(dom[1]);
    if (day >= 1 && day <= 31) {
      let d = new Date(now.getFullYear(), now.getMonth(), day, hh, mm, 0, 0);
      if (d < now) d = new Date(now.getFullYear(), now.getMonth() + 1, day, hh, mm, 0, 0);
      return d.toISOString();
    }
  }

  return null;
}

function hasDateLike(msg: string): boolean {
  return extractDateISO(msg) !== null;
}

const CAL_CATEGORY: Record<string, string> = {
  lawn: "service",
  booking: "appointment",
  errand: "general",
  reminder: "general",
  general: "general",
};

const CAL_COLOR: Record<string, string> = {
  appointment: "#ec4899",
  service: "#15c489",
  sports: "#f59e0b",
  school: "#6366f1",
  social: "#8b5cf6",
  general: "#6b7280",
};

interface CalEvent {
  id: string;
  title: string;
  start_time: string;
  category: string;
  color: string;
}

function extractEventTitle(msg: string): string {
  const cleaned = stripWhen(msg)
    .replace(/\b(add|put|create|log|note|set up|set|book|schedule|make|need|want|get|find|please)\b/gi, " ")
    .replace(/\b(i|we|me|my|our|us|a|an|the|to|for|on|at|of|is|are|am|has|have|had|will|would|can|could|do|does)\b/gi, " ")
    .replace(/[.!?]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || msg.slice(0, 60);
}

function inferCalCategory(title: string): string {
  const t = title.toLowerCase();
  if (/doctor|dentist|appointment|appt|vet|therapy|checkup|physical/.test(t)) return "appointment";
  if (/soccer|practice|game|sport|gym|workout|tennis|swim|dance|cheer|baseball|basketball/.test(t)) return "sports";
  if (/school|class|teacher|homework|exam|test|conference|tutor|recital|play/.test(t)) return "school";
  if (/party|date|birthday|brunch|lunch|concert|movie|social|show/.test(t)) return "social";
  if (/lawn|clean|plumb|repair|service|maintenance|pool|pest|handyman/.test(t)) return "service";
  return "general";
}

function buildCalendarEvent(
  activity: { title: string; category: string },
  msg: string
): CalEvent | null {
  const start_time = extractDateISO(msg);
  if (!start_time) return null;
  const category = inferCalCategory(activity.title) || CAL_CATEGORY[activity.category] || "general";
  return {
    id: `${Date.now()}`,
    title: activity.title,
    start_time,
    category,
    color: CAL_COLOR[category] ?? "#6b7280",
  };
}

// ─── Entity extraction ──────────────────────────────────────────────────────────

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
}

// A friendly human phrase for any date/time in the message:
// "tomorrow", "Friday", "Friday at 2:00 PM", "June 22", or null if none.
function friendlyWhen(msg: string): string | null {
  const lower = msg.toLowerCase();
  const iso = extractDateISO(msg);
  if (!iso) {
    if (/\bnext week\b/.test(lower)) return "next week";
    if (/\bthis week\b/.test(lower)) return "this week";
    return null;
  }
  const date = new Date(iso);
  let dayLabel: string;
  if (TOMORROW_RE.test(lower)) dayLabel = "tomorrow";
  else if (TODAY_RE.test(lower)) dayLabel = "today";
  else {
    const diff = Math.round((date.getTime() - Date.now()) / 86400000);
    dayLabel = diff >= 0 && diff < 7
      ? date.toLocaleDateString("en-US", { weekday: "long" })
      : date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  }
  const hasTime = /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\bnoon\b|\bmidnight\b/i.test(msg);
  return hasTime
    ? `${dayLabel} at ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
    : dayLabel;
}

// Prefix a "when" phrase with the right preposition: relative phrases
// ("tomorrow", "this week") take none; named days/dates take "on".
function whenPhrase(w: string | null): string {
  if (!w) return "";
  if (/^(today|tonight|tomorrow|this week|next week)\b/i.test(w)) return ` ${w}`;
  return ` on ${w}`;
}

// The person a message is about — matched against known family members,
// or pulled from "remind X" / "for X" / "X's" patterns. Ignores pronouns.
function extractPerson(msg: string, members: string[]): string | null {
  for (const m of members) {
    if (m && new RegExp(`\\b${m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(msg)) return m;
  }
  const remind = msg.match(/\bremind\s+(\w+)/i);
  if (remind && !/^(me|us|everyone|them|the|my|our|myself)$/i.test(remind[1])) return cap(remind[1]);
  const forM = msg.match(/\bfor\s+([A-Z][a-z]+)\b/);
  if (forM && !/^(the|my|our|us)$/i.test(forM[1])) return forM[1];
  const poss = msg.match(/\b([A-Z][a-z]+)'s\b/);
  if (poss) return poss[1];
  return null;
}

// Strip every date/time form (days, dates, ordinals, times) from a phrase
// so it doesn't read redundantly alongside a separate "when".
function stripWhen(s: string): string {
  return s
    .replace(TOMORROW_RE, "").replace(TODAY_RE, "")
    .replace(/\b(next|this)\s+week\b/gi, "")
    .replace(/\b(next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, "")
    .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?\b/gi, "")
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, "")
    .replace(/\b(?:the\s+)?\d{1,2}(?:st|nd|rd|th)\b/gi, "")
    .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, "")
    .replace(/\b(noon|midnight)\b/gi, "")
    .replace(/\b(on|at|for)\s*$/i, "")
    .replace(/\s+/g, " ").trim();
}

// The kind of appointment mentioned, normalized for natural phrasing.
function appointmentType(msg: string): string {
  const m = msg.toLowerCase().match(/\b(dentist|doctor|dr\.?|vet|haircut|hair|nails?|nail|therapy|orthodontist|optometrist|checkup|physical|appointment|appt)\b/);
  if (!m) return "appointment";
  const w = m[1];
  if (w === "dr" || w === "dr.") return "doctor";
  if (w === "appt") return "appointment";
  if (w === "hair") return "haircut";
  if (w === "nails" || w === "nail") return "nail appointment";
  return w;
}

// ─── Intent detection ─────────────────────────────────────────────────────────

function detectIntent(msg: string, history: Message[]): string {
  const lower = msg.toLowerCase().trim();
  const recent = history.slice(-3).map(m => m.content.toLowerCase()).join(" ");

  // Meta / capability
  if (/can you|are you able|will you ever|do you actually/.test(lower) &&
      /book|call|order|schedule|do it|for real|real(ly)?|yourself/.test(lower))
    return "capability_question";

  // About Kin / help
  if (/what (are|can) you|who are you|what is kin|how do you work|what do you do|^help\b|^help me|how (do|can) i use/.test(lower))
    return "what_is_kin";

  // Family knowledge
  if (/where (do|did) (i|we) live|my address|my neighborhood|where am i/.test(lower))
    return "where_live";
  if (/who (is|are) (in )?(my|our) (family|household)|family members|who do i live with|list (my )?family/.test(lower))
    return "family_members";
  if (/(what('s| is) my name|who am i|my family name|our (last )?name)/.test(lower))
    return "family_name";

  // Time & weather
  if (/what('s| is) the weather|weather (today|tomorrow|this week|outside)/.test(lower))
    return "weather";
  if (/what time is it|what('s| is) today'?s? date|what day is/.test(lower))
    return "time_date";

  // Conversation
  if (/^(hi+|hey+|hello+|yo|howdy|sup|good (morning|afternoon|evening))[\s!.?]*$/.test(lower))
    return "greeting";
  if (/^(thank(s| you)|ty|much appreciated)|that('?s| is) (great|helpful|perfect|amazing|awesome|wonderful)/.test(lower))
    return "thanks";
  if (/how are you|how('?s| is) it going|you doing|how have you been/.test(lower))
    return "how_are_you";

  // Short, standalone affirmations
  if (/^(yes|yep|yeah|yup|ya|sure|ok|okay|k|sounds good|sounds great|go ahead|do it|please do|yes please|perfect|great|that works|works for me)[\s!.]*$/.test(lower))
    return "affirmation";

  // Calendar query — before add_to_calendar so "what do I have Friday" isn't a new event
  if (/\bmy (schedule|calendar|agenda)\b/.test(lower) ||
      /\bwhat do i have\b/.test(lower) ||
      /(what('?s| is)|anything)\b[^?]*\b(on (my|the) (calendar|schedule)|going on|happening|planned|scheduled|coming up)\b/.test(lower))
    return "calendar_query";

  // Cancel / reschedule — before task matching so "cancel the dentist" isn't a new appointment
  if (/\b(cancel|never ?mind|nevermind|scratch that|forget (it|that)|delete (it|that|the)|remove (it|that|the))\b/.test(lower))
    return "cancel";
  if (/\b(reschedule|resched|push (it|that|back)|bump (it|that))\b/.test(lower) ||
      (/\b(move|change|switch)\b/.test(lower) && /\b(to|until|earlier|later|appointment|meeting|it|that|event)\b/.test(lower)))
    return "reschedule";

  // Tasks
  if (/lawn|mow|grass|yard (care|service|work)|landscap|weed|edg(e|ing)/.test(lower)) return "task_lawn";
  if (/remind|reminder|don'?t (let|forget)|heads[ -]?up|make sure (i|we)/.test(lower)) return "task_reminder";
  if (/clean(ing|er)?|housekeep|maid|tidy|vacuum|deep clean/.test(lower)) return "task_cleaning";
  if (/grocery|groceries|shopping list|food (run|pickup|shop)|meal prep/.test(lower)) return "task_grocery";
  if (/\b(book|schedule|make|set up|add|create|need|get|find|put)\b.{0,30}\b(appointment|appt|dentist|doctor|dr\.?|vet|hair|haircut|nails?|therapy|checkup|physical)\b/.test(lower) ||
      /\b(appointment|appt|dentist|doctor|vet|orthodontist|optometrist)\b/.test(lower))
    return "task_appointment";
  if (/pick(ing)?[ -]?up|drop(ping)?[ -]?off|carpool|drive|ride|uber|lyft/.test(lower)) return "task_transport";
  if (/dinner|cook|recipe|restaurant|reserv|takeout|order food/.test(lower)) return "task_dinner";
  if (/pool|pest|repair|fix|broken|leak|plumb|electr|handyman|hvac|\bac\b|a\/c|appliance/.test(lower)) return "task_home_service";

  // Follow-ups based on recent context
  if (recent.includes("lawn") || recent.includes("mow")) return "task_lawn_followup";
  if (recent.includes("remind")) return "task_reminder_followup";
  if (recent.includes("clean")) return "task_cleaning_followup";

  // Generic calendar event — any message that references a date/day.
  // Questions, greetings, and thanks are matched and returned above, so
  // by here a date reference almost always means "put this on my calendar".
  if (hasDateLike(msg))
    return "add_to_calendar";

  return "general";
}

// ─── Response generator ───────────────────────────────────────────────────────

function generateResponse(
  intent: string,
  msg: string,
  ctx: FamilyContext
): { reply: string; activity?: { title: string; category: string; status: string } } {

  const day = extractDay(msg);
  const when = friendlyWhen(msg);
  const members = ctx.members.map(m => m.name);
  const person = extractPerson(msg, members);
  const shortName = ctx.name.replace(/^the\s+/i, "").replace(/s$/i, "");

  switch (intent) {

    case "capability_question":
      return { reply: pick([
        "Not yet — right now I understand and track your requests, but the actual bookings are handled by your Kin coordinator. Full automation is coming. Want me to queue this up?",
        "Honest answer: not fully on my own yet. I capture everything so nothing falls through the cracks, and your Kin team acts on it. Should I add this to your list?",
        "Not autonomously yet — think of me as the layer that never forgets. I log it, your Kin team handles it. Want me to put this in the queue?",
      ]) };

    case "what_is_kin": {
      const knows = ctx.name === "your family" ? "your family" : `the ${ctx.name}`;
      return { reply: `I'm Kin — your family's assistant. I handle the mental load of running a household: booking services, reminders, calendar, errands. I know ${knows} and your home in ${ctx.neighborhood}, so you don't have to re-explain things each time. What can I take off your plate?` };
    }

    case "where_live":
      return { reply: `You're in ${ctx.neighborhood}, ${ctx.city}, ${ctx.state} ${ctx.zip}. I've got your neighborhood dialed in for local vendors and services.` };

    case "family_members":
      if (ctx.members.length === 0)
        return { reply: "I don't have your family members on file yet. Head to your Profile page and add them — it helps me give more personalized responses." };
      return { reply: `Your household: ${ctx.members.map(m => `${m.name} (${m.role}${m.age ? `, ${m.age}` : ""})`).join(", ")}. Anything I can do for any of them?` };

    case "family_name":
      return { reply: `You're the ${ctx.name}, based in ${ctx.neighborhood}. What can I help with?` };

    case "weather":
      return { reply: `I don't have live weather data, but ${ctx.neighborhood} in Austin typically runs hot and sunny this time of year. Check your phone for the exact forecast — want me to set a reminder before any outdoor plans?` };

    case "time_date": {
      const now = new Date();
      return { reply: `It's ${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}, ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}. Anything time-sensitive I can help with?` };
    }

    case "greeting": {
      const h = new Date().getHours();
      const greet = h < 12 ? "Good morning" : h < 17 ? "Hey" : "Good evening";
      return { reply: members.length > 0
        ? `${greet}! What's on the ${ctx.name} agenda today?`
        : `${greet}! What can I help with today?` };
    }

    case "thanks":
      return { reply: pick([
        "Of course — that's what I'm here for. Anything else?",
        "Happy to help. What else can I take off your plate?",
        "Always. Let me know if anything else comes up.",
      ]) };

    case "how_are_you":
      return { reply: pick([
        "Doing great — your calendar, tasks, and home details are all loaded up. What do you need?",
        "Ready to go. What's on your mind?",
        "All good. What can I help with?",
      ]) };

    case "task_lawn": {
      const whenStr = when ?? "this week";
      const yard = ctx.preferences?.yard_type ? ` (${ctx.preferences.yard_type} yard)` : "";
      return {
        reply: pick([
          `Got it — lawn care for ${whenStr}${yard}. I'll line up a crew near ${ctx.neighborhood} and confirm once it's booked.`,
          `On it — I'll arrange lawn care for ${whenStr}${yard} with a trusted vendor in ${ctx.neighborhood}.`,
        ]),
        activity: { title: `Lawn care — ${when ?? "this week"}`, category: "lawn", status: "in_progress" },
      };
    }

    case "task_lawn_followup":
      return { reply: pick([
        "Already on it — confirmation coming shortly. Any special instructions for the crew?",
        "It's in the queue. Anything extra this time — edging, weeding?",
      ]) };

    case "task_reminder": {
      const who = person ?? "you";
      const m = msg.match(/\b(about|to|that)\s+(.+)/i);
      const verb = m && m[1].toLowerCase() === "to" ? "to" : "about";
      const about = m ? stripWhen(m[2].replace(/[.!?]+$/, "")) : null;
      const whenStr = whenPhrase(when);
      if (!about) {
        return { reply: `Happy to set that reminder${who !== "you" ? ` for ${who}` : ""}. What should I remind ${who} about, and when?` };
      }
      return {
        reply: pick([
          `Done — I'll remind ${who} ${verb} ${about}${whenStr}. A heads-up goes out ahead of time.`,
          `Got it — reminder set${who !== "you" ? ` for ${who}` : ""} ${verb} ${about}${whenStr}.`,
        ]),
        activity: { title: `Reminder${who !== "you" ? ` for ${who}` : ""}: ${about}`, category: "reminder", status: "pending" },
      };
    }

    case "task_reminder_followup":
      return { reply: "Reminder is set — I'll make sure it lands at the right time. Anything else?" };

    case "task_cleaning": {
      const size = ctx.preferences?.home_size ? ` for your ${ctx.preferences.home_size} home` : "";
      return {
        reply: when
          ? `I'll coordinate cleaning${size} for ${when}. Any focus areas, or the usual full house?`
          : `I'll set up cleaning${size}. What day works best — and any focus areas?`,
        activity: { title: `House cleaning${when ? ` — ${when}` : ""}`, category: "general", status: "pending" },
      };
    }

    case "task_cleaning_followup":
      return { reply: "Got it — I'll note that for the cleaners. Anything else to add?" };

    case "task_grocery": {
      const diet = ctx.preferences?.dietary_notes ? ` (noting ${ctx.preferences.dietary_notes})` : "";
      return {
        reply: pick([
          `Added to the grocery list${diet}. Want a reminder before your usual run?`,
          `Got it — on the list${diet}. Anything else to add while I'm at it?`,
        ]),
        activity: { title: stripWhen(extractEventTitle(msg)).slice(0, 60) || "Grocery run", category: "errand", status: "pending" },
      };
    }

    case "task_appointment": {
      const what = appointmentType(msg);
      const forWhom = person ? ` for ${person}` : "";
      if (when) {
        return {
          reply: pick([
            `Done — I've got the ${what}${forWhom} down for ${when}. I'll have your Kin coordinator confirm the booking.`,
            `Got it — ${what}${forWhom}, ${when}. We'll lock in the appointment and confirm shortly.`,
          ]),
          activity: { title: `${cap(what)}${forWhom}`, category: "booking", status: "in_progress" },
        };
      }
      return {
        reply: `Sure — I'll set up the ${what}${forWhom}. What day and time should I aim for?`,
        activity: { title: `${cap(what)}${forWhom}`, category: "booking", status: "pending" },
      };
    }

    case "task_transport": {
      const forWhom = person ? ` ${person}` : "";
      const whenStr = whenPhrase(when);
      return {
        reply: (when || person)
          ? `Got it — I'll sort the pickup/drop-off${forWhom ? ` for${forWhom}` : ""}${whenStr} and confirm the ride details.`
          : `I can set up a ride. Who needs to go where, and when?`,
        activity: { title: stripWhen(extractEventTitle(msg)).slice(0, 60) || "Transportation", category: "general", status: "pending" },
      };
    }

    case "task_dinner": {
      const diet = ctx.preferences?.dietary_notes ? ` (keeping ${ctx.preferences.dietary_notes} in mind)` : "";
      const whenStr = when ? ` for ${when}` : "";
      return {
        reply: `On it${diet} — dinner${whenStr}. Want a few spots near ${ctx.neighborhood}, or are you cooking?`,
        activity: { title: `Dinner${when ? ` — ${when}` : ""}`, category: "errand", status: "pending" },
      };
    }

    case "task_home_service":
      return {
        reply: `I'll find a reliable vendor in ${ctx.neighborhood} for that.${when ? ` Aiming for ${when}.` : " When works for you?"} Anything about the issue I should pass along?`,
        activity: { title: stripWhen(extractEventTitle(msg)).slice(0, 60) || "Home service", category: "general", status: "in_progress" },
      };

    case "add_to_calendar": {
      const title = extractEventTitle(msg);
      const forWhom = person && !title.toLowerCase().includes(person.toLowerCase()) ? ` for ${person}` : "";
      return {
        reply: `Got it — I've got "${title}"${forWhom}${when ? ` down for ${when}` : ""}.`,
        activity: { title, category: "general", status: "done" },
      };
    }

    case "affirmation":
      return { reply: pick([
        "Perfect — consider it handled. Anything else?",
        "Great, I'm on it. What else can I take off your plate?",
        "Done. Let me know if there's anything else.",
      ]) };

    case "calendar_query":
      return { reply: pick([
        "Your full schedule lives on the Calendar tab — everything I've set up is there. Want me to add or move anything?",
        "Take a peek at the Calendar tab for what's coming up. Anything you'd like me to schedule?",
      ]) };

    case "cancel":
      return { reply: pick([
        "No problem — I'll hold off on that. You can also remove anything directly from the Calendar tab.",
        "Got it, I won't move forward with it. Anything you'd like to set up instead?",
      ]) };

    case "reschedule":
      return { reply: when
        ? `Sure — I'll move that to ${when} and confirm. You can also drag it on the Calendar tab.`
        : "Happy to reschedule — what day and time should I move it to?" };

    default:
      return {
        reply: pick([
          `Got it. I'll look into that for the ${shortName} family and follow up. Any deadline or details I should keep in mind?`,
          `On it. Anything specific about timing or preferences that would help me handle this better?`,
          `Noted — I'll take care of that. Any details before I move forward?`,
        ]),
        activity: { title: msg.slice(0, 60), category: "general", status: "pending" },
      };
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { message, familyId, context } = await req.json();
  if (!message || !familyId)
    return NextResponse.json({ error: "Missing message or familyId" }, { status: 400 });

  // Preview mode — no Supabase. Use the profile the client passes from localStorage.
  if (familyId === "preview") {
    const provided = context && typeof context === "object" ? context : {};
    const ctx: FamilyContext = {
      name: provided.name || "your family",
      neighborhood: provided.neighborhood || "your neighborhood",
      city: "Austin", state: "TX", zip: "",
      members: Array.isArray(provided.members) ? provided.members : [],
      preferences: null,
    };
    const intent = detectIntent(message, []);
    const { reply, activity } = generateResponse(intent, message, ctx);
    const calEvent = activity ? buildCalendarEvent(activity, message) : null;

    // Use Claude for the reply when an API key is configured; otherwise fall back.
    const smart = await generateSmartReply(message, ctx, [], {
      calendarEvent: calEvent ? { title: calEvent.title, start_time: calEvent.start_time } : null,
      activity: activity ?? null,
    });
    const finalReply = smart ?? (calEvent ? `${reply} I've added it to your calendar.` : reply);

    if (activity) {
      void sendTaskNotification({
        userMessage: message,
        kinReply: finalReply,
        taskTitle: activity.title,
        taskCategory: activity.category,
        taskStatus: activity.status,
      });
    }

    return NextResponse.json({
      reply: finalReply,
      message: { id: Date.now().toString(), role: "assistant", content: finalReply, created_at: new Date().toISOString() },
      ...(calEvent ? { event: calEvent } : {}),
    });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Load family context
  const [{ data: family }, { data: members }, { data: preferences }, { data: recentMessages }] =
    await Promise.all([
      supabase.from("families").select("*").eq("id", familyId).single(),
      supabase.from("family_members").select("name, role, age").eq("family_id", familyId),
      supabase.from("family_preferences").select("*").eq("family_id", familyId).single(),
      supabase.from("messages").select("role, content").eq("family_id", familyId)
        .order("created_at", { ascending: false }).limit(10),
    ]);

  const ctx: FamilyContext = {
    name: family?.name ?? "your family",
    neighborhood: family?.neighborhood ?? "Northwest Hills",
    city: family?.city ?? "Austin",
    state: family?.state ?? "TX",
    zip: family?.zip ?? "78731",
    members: members ?? [],
    preferences: preferences ?? null,
  };

  const history: Message[] = (recentMessages ?? []).reverse();

  // Save user message
  await supabase.from("messages").insert({
    family_id: familyId,
    role: "user",
    content: message,
  });

  // Generate response
  const intent = detectIntent(message, history);
  const { reply, activity } = generateResponse(intent, message, ctx);
  const calEvent = activity ? buildCalendarEvent(activity, message) : null;

  // Use Claude for the reply when an API key is configured; otherwise fall back.
  const smart = await generateSmartReply(message, ctx, history, {
    calendarEvent: calEvent ? { title: calEvent.title, start_time: calEvent.start_time } : null,
    activity: activity ?? null,
  });
  const finalReply = smart ?? (calEvent ? `${reply} I've added it to your calendar.` : reply);

  // Save assistant message
  const { data: assistantMsg } = await supabase
    .from("messages")
    .insert({ family_id: familyId, role: "assistant", content: finalReply })
    .select()
    .single();

  // Log activity for task intents
  if (activity) {
    await supabase.from("activities").insert({
      family_id: familyId,
      title: activity.title,
      category: activity.category,
      status: activity.status,
      description: message,
    });

    void sendTaskNotification({
      userMessage: message,
      kinReply: finalReply,
      taskTitle: activity.title,
      taskCategory: activity.category,
      taskStatus: activity.status,
    });
  }

  // Create calendar event when a specific day was mentioned
  if (calEvent) {
    await supabase.from("events").insert({
      family_id: familyId,
      title: calEvent.title,
      start_time: calEvent.start_time,
      category: calEvent.category,
      color: calEvent.color,
    });
  }

  return NextResponse.json({ reply: finalReply, message: assistantMsg, ...(calEvent ? { event: calEvent } : {}) });
}
