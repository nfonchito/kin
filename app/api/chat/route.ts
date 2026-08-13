import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { sendTaskNotification } from "@/lib/email";
import { generateSmartReply } from "@/lib/ai";
import { rateLimit } from "@/lib/ratelimit";
import {
  TOMORROW_RE,
  TODAY_RE,
  normalizeDays,
  extractDay,
  extractDateISO,
  hasDateLike,
  friendlyWhen,
  whenPhrase,
  formatUserNow,
  expandOccurrences,
} from "@/lib/dates";

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

// True only when this deployment has no real Supabase behind it. Gates the
// unauthenticated "preview" chat path, which must never be reachable in prod.
const IS_PREVIEW_DEPLOYMENT =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const CAL_CATEGORY: Record<string, string> = {
  lawn: "service",
  booking: "appointment",
  errand: "general",
  reminder: "general",
  general: "general",
};

const CAL_COLOR: Record<string, string> = {
  appointment: "#be185d",
  service: "#15803d",
  sports: "#b45309",
  school: "#4338ca",
  social: "#6d28d9",
  general: "#57534e",
};

interface CalEvent {
  id: string;
  title: string;
  start_time: string;
  category: string;
  color: string;
  description?: string;
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
  msg: string,
  tzOffsetMin: number
): CalEvent | null {
  const start_time = extractDateISO(msg, tzOffsetMin);
  if (!start_time) return null;
  const category = inferCalCategory(activity.title) || CAL_CATEGORY[activity.category] || "general";
  return {
    id: `${Date.now()}`,
    title: activity.title,
    start_time,
    category,
    color: CAL_COLOR[category] ?? "#57534e",
  };
}

// A repeat ("every Thursday") becomes a run of real event rows, since there's
// no recurrence column. One-off requests come back as a single-item array.
function buildEventSeries(
  activity: { title: string; category: string },
  msg: string,
  tzOffsetMin: number,
  timeZone?: string | null
): CalEvent[] {
  const recurrence = extractRecurrence(msg);

  let first = buildCalendarEvent(activity, msg, tzOffsetMin);

  // "every day" / "every month" name a cadence but no start date. Anchor the
  // series to tomorrow, carrying over any time the message did mention.
  if (!first && recurrence) {
    first = buildCalendarEvent(activity, `tomorrow ${msg}`, tzOffsetMin);
  }

  if (!first) return [];
  if (!recurrence) return [first];

  // "Lawn care — every Thursday" repeated 12 times reads badly on a calendar;
  // the cadence belongs in the description, not every row's title. Titles
  // carry it either as an em-dash suffix or in parentheses.
  const escaped = recurrence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const title =
    first.title
      .replace(new RegExp(`\\s*[—-]\\s*${escaped}\\s*$`, "i"), "")
      .replace(new RegExp(`\\s*\\(${escaped}\\)\\s*$`, "i"), "")
      .trim() || first.title;

  const stamp = Date.now();
  return expandOccurrences(first.start_time, recurrence, tzOffsetMin, timeZone).map((start_time, i) => ({
    ...first,
    id: `${stamp}-${i}`,
    title,
    start_time,
    description: `Repeats ${recurrence}`,
  }));
}

// ─── Entity extraction ──────────────────────────────────────────────────────────

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
}

// A recurring cadence phrase ("every Monday", "every morning", "weekly"), or null.
function extractRecurrence(msg: string): string | null {
  const l = msg.toLowerCase();
  const wd = l.match(/\bevery\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)s?\b/);
  if (wd) return `every ${cap(wd[1])}`;
  if (/\bevery weekday\b|\bweekdays\b/.test(l)) return "every weekday";
  if (/\bevery other week\b|\bbi-?weekly\b/.test(l)) return "every other week";
  if (/\bevery morning\b/.test(l)) return "every morning";
  if (/\bevery (night|evening)\b/.test(l)) return "every evening";
  if (/\bevery day\b|\bdaily\b|\beach day\b/.test(l)) return "every day";
  if (/\bevery week\b|\bweekly\b|\beach week\b/.test(l)) return "every week";
  if (/\bevery month\b|\bmonthly\b|\beach month\b/.test(l)) return "every month";
  if (/\bevery year\b|\byearly\b|\bannually\b/.test(l)) return "every year";
  return null;
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
  return normalizeDays(s)
    .replace(TOMORROW_RE, "").replace(TODAY_RE, "")
    // recurrence phrases first, so "every monday" is removed as a unit
    .replace(/\bevery\s+other\s+week\b/gi, "")
    .replace(/\bevery\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)s?\b/gi, "")
    .replace(/\bevery\s+(weekday|day|morning|evening|night|week|month|year)\b/gi, "")
    .replace(/\b(daily|weekly|monthly|yearly|annually|bi-?weekly|weekdays)\b/gi, "")
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

function detectIntent(msg: string, history: Message[], tzOffsetMin = 0): string {
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
  // A bare cadence ("water the plants every day") names no date but is still
  // a calendar request — the series anchors to tomorrow.
  if (hasDateLike(msg, tzOffsetMin) || extractRecurrence(msg))
    return "add_to_calendar";

  return "general";
}

// ─── Response generator ───────────────────────────────────────────────────────

function generateResponse(
  intent: string,
  msg: string,
  ctx: FamilyContext,
  tzOffsetMin = 0
): { reply: string; activity?: { title: string; category: string; status: string } } {

  const day = extractDay(msg);
  const when = friendlyWhen(msg, tzOffsetMin);
  const recurrence = extractRecurrence(msg);
  const members = ctx.members.map(m => m.name);
  const person = extractPerson(msg, members);
  // "The Batlles" -> "Batlle family". Placeholder names like "My Family" or an
  // unset name already read as a family, so don't append the word again —
  // that produced "the My Family family".
  const bare = ctx.name.replace(/^the\s+/i, "").trim();
  const looksLikeAFamilyName = /\bfamily\b/i.test(bare) || bare.length === 0;
  const familyPhrase = looksLikeAFamilyName
    ? "your family"
    : `${bare.replace(/s$/i, "")} family`;

  switch (intent) {

    // No, and there is no "Kin coordinator" or "Kin team" — saying so left
    // people waiting on a call that was never going to happen.
    case "capability_question":
      return { reply: pick([
        "No — I don't call or book anything. What I do is remember it: I put it on your calendar and email you each morning with what's coming up. The booking itself is still yours to make.",
        "Straight answer: no. I'm the memory, not the hands — I write it down, schedule it, and remind you. Making the call is still on you.",
      ]) };

    case "what_is_kin": {
      const knows = ctx.name === "your family" ? "your family" : `the ${ctx.name}`;
      return { reply: `I'm Kin — somewhere to put everything the house needs so you're not holding it in your head. Tell me in plain English and I'll get it on your calendar, keep a list, and email you each morning with what's ahead.${ctx.neighborhood ? ` I know ${knows} and your home in ${ctx.neighborhood}, so you don't have to re-explain things.` : ""} I don't book services or make calls — that part's still yours.` };
    }

    case "where_live": {
      const place = [ctx.neighborhood, ctx.city, [ctx.state, ctx.zip].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", ");
      return { reply: place
        ? `You're in ${place}. I'll use that whenever a request depends on where you are.`
        : `You haven't told me where you are yet — add it on the Profile page and I'll use it whenever a request depends on your location.` };
    }

    case "family_members":
      if (ctx.members.length === 0)
        return { reply: "I don't have your family members on file yet. Head to your Profile page and add them — it helps me give more personalized responses." };
      return { reply: `Your household: ${ctx.members.map(m => `${m.name} (${m.role}${m.age ? `, ${m.age}` : ""})`).join(", ")}. Anything I can do for any of them?` };

    case "family_name": {
      // "You're the My Family." — same placeholder problem as the default reply.
      const based = ctx.neighborhood ? `, based in ${ctx.neighborhood}` : "";
      return { reply: looksLikeAFamilyName
        ? `Your account is still called "${ctx.name}" — you can rename it on the Profile page. What can I help with?`
        : `You're the ${ctx.name}${based}. What can I help with?` };
    }

    case "weather":
      // Don't invent a climate: we know the family's own city, and a Brooklyn
      // family was being told "Park Slope in Austin…".
      return { reply: `I don't have live weather data${ctx.city ? ` for ${ctx.city}` : ""} — your phone will have the exact forecast. Want me to set a reminder before any outdoor plans?` };

    case "time_date": {
      const now = formatUserNow(tzOffsetMin);
      return { reply: `It's ${now.date}, ${now.time}. Anything time-sensitive I can help with?` };
    }

    case "greeting": {
      const h = new Date(Date.now() - tzOffsetMin * 60000).getUTCHours(); // user-local hour
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
      const whenStr = recurrence ?? when ?? "this week";
      const yard = ctx.preferences?.yard_type ? ` (${ctx.preferences.yard_type} yard)` : "";
      return {
        reply: recurrence
          ? `Noted — lawn care ${recurrence}${yard}. I'll flag each one in your morning email.`
          : pick([
              `Noted — lawn care for ${whenStr}${yard}. It's on your list and I'll remind you.`,
              `Got it — lawn care ${whenStr}${yard}. Written down so it doesn't get lost.`,
            ]),
        activity: { title: `Lawn care — ${recurrence ?? when ?? "this week"}`, category: "lawn", status: "pending" },
      };
    }

    case "task_lawn_followup":
      return { reply: pick([
        "It's on the list. Anything else worth writing down — gate code, edging, weeding?",
        "Noted. Any details about it I should keep with the entry?",
      ]) };

    case "task_reminder": {
      const who = person ?? "you";
      const m = msg.match(/\b(about|to|that)\s+(.+)/i);
      const verb = m && m[1].toLowerCase() === "to" ? "to" : "about";
      const about = m ? stripWhen(m[2].replace(/[.!?]+$/, "")) : null;
      // A recurring cadence takes priority over a one-time date in the phrasing.
      const timing = recurrence ? ` ${recurrence}` : whenPhrase(when);
      const recurTag = recurrence ? ` (${recurrence})` : "";
      if (!about) {
        return { reply: `Happy to set that reminder${who !== "you" ? ` for ${who}` : ""}. What should I remind ${who} about, and when?` };
      }
      return {
        reply: recurrence
          ? `Done — ${about}${timing}, on repeat. Each one shows up in your morning email.`
          : pick([
              `Done — ${about}${timing}. It'll be in your morning email that day.`,
              `Got it — noted${who !== "you" ? ` for ${who}` : ""}: ${about}${timing}.`,
            ]),
        activity: { title: `Reminder${who !== "you" ? ` for ${who}` : ""}: ${about}${recurTag}`, category: "reminder", status: "pending" },
      };
    }

    case "task_reminder_followup":
      return { reply: "It's on the list — you'll see it in your morning email. Anything else?" };

    case "task_cleaning": {
      const size = ctx.preferences?.home_size ? ` for your ${ctx.preferences.home_size} home` : "";
      return {
        reply: recurrence
          ? `Noted — cleaning${size} ${recurrence}. Any focus areas worth recording?`
          : when
            ? `Noted — cleaning${size} for ${when}. Any focus areas, or the usual full house?`
            : `Happy to write that down. What day works — and any focus areas?`,
        activity: { title: `House cleaning${recurrence ? ` — ${recurrence}` : when ? ` — ${when}` : ""}`, category: "general", status: "pending" },
      };
    }

    case "task_cleaning_followup":
      return { reply: "Noted with the entry. Anything else to add?" };

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
            `Got it — ${what}${forWhom}, ${when}. Making the actual appointment is still yours.`,
            `Noted — ${what}${forWhom} down for ${when}, and in your morning email that day.`,
          ]),
          activity: { title: `${cap(what)}${forWhom}`, category: "booking", status: "pending" },
        };
      }
      return {
        reply: `Sure — what day and time? I'll put the ${what}${forWhom} on your calendar.`,
        activity: { title: `${cap(what)}${forWhom}`, category: "booking", status: "pending" },
      };
    }

    case "task_transport": {
      const forWhom = person ? ` ${person}` : "";
      const whenStr = whenPhrase(when);
      return {
        reply: (when || person)
          ? `Noted — pickup/drop-off${forWhom ? ` for${forWhom}` : ""}${whenStr}.`
          : `Happy to note that down. Who needs to go where, and when?`,
        activity: { title: stripWhen(extractEventTitle(msg)).slice(0, 60) || "Transportation", category: "general", status: "pending" },
      };
    }

    case "task_dinner": {
      const diet = ctx.preferences?.dietary_notes ? ` (I've got ${ctx.preferences.dietary_notes} on file)` : "";
      const whenStr = when ? ` for ${when}` : "";
      return {
        reply: `Noted — dinner${whenStr}${diet}. Anything to add to the list for it?`,
        activity: { title: `Dinner${when ? ` — ${when}` : ""}`, category: "errand", status: "pending" },
      };
    }

    case "task_home_service":
      return {
        reply: `Noted${when ? ` for ${when}` : ""}. Anything about the issue worth writing down while it's fresh?${when ? "" : " What day works?"}`,
        activity: { title: stripWhen(extractEventTitle(msg)).slice(0, 60) || "Home service", category: "general", status: "pending" },
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

    // Neither of these can edit the calendar yet, so they say what's actually
    // true and point at the control that does work, rather than implying the
    // change has been made.
    case "cancel":
      return { reply:
        "I can't remove things from the calendar myself yet — open the Calendar tab, tap the event, and hit Remove. Anything you'd like me to set up instead?" };

    case "reschedule":
      return { reply: when
        ? `I can't move events myself yet. On the Calendar tab you can remove it and add it back for ${when} — or tell me the details and I'll create the new one.`
        : "I can't move events myself yet — remove it on the Calendar tab, then tell me the new day and time and I'll add it." };

    default:
      return {
        reply: pick([
          `Got it. I'll look into that for ${familyPhrase === "your family" ? "you" : `the ${familyPhrase}`} and follow up. Any deadline or details I should keep in mind?`,
          `On it. Anything specific about timing or preferences that would help me handle this better?`,
          `Noted — I'll take care of that. Any details before I move forward?`,
        ]),
        activity: { title: msg.slice(0, 60), category: "general", status: "pending" },
      };
  }
}

// Only claim what actually got saved — and say how many when it repeats.
function calendarNote(savedCount: number): string {
  if (savedCount === 0) return "";
  if (savedCount === 1) return " I've added it to your calendar.";
  return ` I've put the next ${savedCount} on your calendar.`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { message, familyId, context, tzOffset, timeZone } = await req.json();
  if (!message || !familyId)
    return NextResponse.json({ error: "Missing message or familyId" }, { status: 400 });

  // Browser's getTimezoneOffset(): minutes to ADD to local time to reach UTC.
  // Without it dates are computed in server time (UTC on Vercel).
  const tz = typeof tzOffset === "number" && Number.isFinite(tzOffset) && Math.abs(tzOffset) <= 900
    ? Math.round(tzOffset)
    : 0;

  // IANA zone name (e.g. "America/Chicago"). Needed on top of the offset so
  // repeating events hold their local time across daylight saving. Validated
  // before use — it reaches Intl, which throws on junk.
  const zone: string | null =
    typeof timeZone === "string" && /^[A-Za-z][A-Za-z0-9_+\-]*(\/[A-Za-z0-9_+\-]+)*$/.test(timeZone) && timeZone.length < 64
      ? (() => {
          try {
            new Intl.DateTimeFormat("en-US", { timeZone }).format();
            return timeZone;
          } catch {
            return null;
          }
        })()
      : null;

  // Preview mode — no Supabase. Use the profile the client passes from
  // localStorage. This branch runs BEFORE any auth check, so it is only ever
  // reachable on a deployment that has no Supabase configured. Otherwise
  // anyone could POST familyId:"preview" and use the endpoint unauthenticated
  // (which also means triggering email, and billing once a model key is set).
  if (familyId === "preview") {
    if (!IS_PREVIEW_DEPLOYMENT) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const provided = context && typeof context === "object" ? context : {};
    const ctx: FamilyContext = {
      name: provided.name || "your family",
      neighborhood: provided.neighborhood || "your neighborhood",
      city: "Austin", state: "TX", zip: "",
      members: Array.isArray(provided.members) ? provided.members : [],
      preferences: null,
    };
    const intent = detectIntent(message, [], tz);
    const { reply, activity } = generateResponse(intent, message, ctx, tz);
    const series = activity ? buildEventSeries(activity, message, tz, zone) : [];
    const calEvent = series[0] ?? null;

    // Use Claude for the reply when an API key is configured; otherwise fall back.
    const smart = await generateSmartReply(message, ctx, [], {
      calendarEvent: calEvent ? { title: calEvent.title, start_time: calEvent.start_time } : null,
      activity: activity ?? null,
    });
    const finalReply = smart ?? (reply + calendarNote(series.length));

    // Awaited: fire-and-forget promises can be cut off when the serverless
    // function freezes after the response is sent.
    if (activity) {
      await sendTaskNotification({
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
      ...(series.length ? { event: calEvent, events: series } : {}),
    });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Authenticated, but one account can still loop this endpoint — and every
  // call may send email and, once a model key is set, cost money. Keyed on the
  // user so one noisy account can't affect anyone else.
  const limit = rateLimit(`chat:${user.id}`);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "You're sending messages faster than Kin can keep up. Try again in a moment." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  // Load family context. RLS already scopes these reads to the caller, but
  // check ownership explicitly below rather than proceeding with a null family
  // and letting the writes fail silently.
  const [{ data: family }, { data: members }, { data: preferences }, { data: recentMessages }] =
    await Promise.all([
      supabase.from("families").select("*").eq("id", familyId).eq("user_id", user.id).single(),
      supabase.from("family_members").select("name, role, age").eq("family_id", familyId),
      supabase.from("family_preferences").select("*").eq("family_id", familyId).single(),
      supabase.from("messages").select("role, content").eq("family_id", familyId)
        .order("created_at", { ascending: false }).limit(10),
    ]);

  // Someone else's familyId (or one that doesn't exist) stops here rather than
  // getting a generated reply off default context.
  if (!family) {
    return NextResponse.json({ error: "Family not found" }, { status: 404 });
  }

  // Never substitute a location the family didn't give us — an invented
  // "Northwest Hills, Austin" is worse than saying we don't know.
  const ctx: FamilyContext = {
    name: family.name ?? "your family",
    neighborhood: family.neighborhood ?? "",
    city: family.city ?? "",
    state: family.state ?? "",
    zip: family.zip ?? "",
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
  const intent = detectIntent(message, history, tz);
  const { reply, activity } = generateResponse(intent, message, ctx, tz);
  const series = activity ? buildEventSeries(activity, message, tz, zone) : [];

  // Save the calendar rows BEFORE composing the reply, so the confirmation
  // only ever claims what actually persisted.
  let savedEvents: CalEvent[] = [];
  if (series.length > 0) {
    const { error: eventError } = await supabase.from("events").insert(
      series.map((e) => ({
        family_id: familyId,
        title: e.title,
        start_time: e.start_time,
        category: e.category,
        color: e.color,
        ...(e.description ? { description: e.description } : {}),
      }))
    );
    if (eventError) console.error("[chat] calendar event insert failed:", eventError.message, eventError);
    else savedEvents = series;
  }

  const savedEvent = savedEvents[0] ?? null;

  // Use Claude for the reply when an API key is configured; otherwise fall back.
  const smart = await generateSmartReply(message, ctx, history, {
    calendarEvent: savedEvent ? { title: savedEvent.title, start_time: savedEvent.start_time } : null,
    activity: activity ?? null,
  });
  const finalReply = smart ?? (reply + calendarNote(savedEvents.length));

  // Save assistant message
  const { data: assistantMsg } = await supabase
    .from("messages")
    .insert({ family_id: familyId, role: "assistant", content: finalReply })
    .select()
    .single();

  // Log activity for task intents
  if (activity) {
    const { error: activityError } = await supabase.from("activities").insert({
      family_id: familyId,
      title: activity.title,
      category: activity.category,
      status: activity.status,
      description: message,
    });
    if (activityError) console.error("[chat] activity insert failed:", activityError.message);

    // Awaited: fire-and-forget promises can be cut off when the serverless
    // function freezes after the response is sent.
    await sendTaskNotification(
      {
        userMessage: message,
        kinReply: finalReply,
        taskTitle: activity.title,
        taskCategory: activity.category,
        taskStatus: activity.status,
      },
      { userEmail: user.email }
    );
  }

  return NextResponse.json({
    reply: finalReply,
    message: assistantMsg,
    ...(savedEvents.length ? { event: savedEvent, events: savedEvents } : {}),
  });
}
