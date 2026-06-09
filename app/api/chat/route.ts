import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

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

function extractDay(msg: string): string | null {
  const m = msg.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|this week|next week)/i);
  return m ? m[1] : null;
}

// ─── Intent detection ─────────────────────────────────────────────────────────

function detectIntent(msg: string, history: Message[]): string {
  const lower = msg.toLowerCase();
  const recent = history.slice(-3).map(m => m.content.toLowerCase()).join(" ");

  // Meta / capability
  if (/can you|are you able|will you ever|do you actually/.test(lower) &&
      /book|call|order|schedule|do it|for real|real(ly)?|yourself/.test(lower))
    return "capability_question";

  // About Kin
  if (/what (are|can) you|who are you|what is kin|how do you work|what do you do/.test(lower))
    return "what_is_kin";

  // Family knowledge
  if (/where (do|did) (i|we) live|my address|my neighborhood|where am i/.test(lower))
    return "where_live";
  if (/who (is|are) (in )?(my|our) (family|household)|family members|who do i live with/.test(lower))
    return "family_members";
  if (/(what('s| is) my name|who am i|my family name|our (last )?name)/.test(lower))
    return "family_name";

  // Time & weather
  if (/what('s| is) the weather|weather (today|tomorrow|this week)/.test(lower))
    return "weather";
  if (/what time is it|what('s| is) today'?s? date|what day is/.test(lower))
    return "time_date";

  // Conversation
  if (/^(hi|hey|hello|howdy|good (morning|afternoon|evening))[\s!.?]*$/.test(lower))
    return "greeting";
  if (/thank(s| you)|that('?s| is) (great|helpful|perfect|amazing|awesome)/.test(lower))
    return "thanks";
  if (/how are you|how('?s| is) it going|you doing/.test(lower))
    return "how_are_you";

  // Tasks
  if (/lawn|mow|grass|yard (care|service)|landscap/.test(lower)) return "task_lawn";
  if (/remind|reminder|don'?t (let|forget)|heads[ -]?up/.test(lower)) return "task_reminder";
  if (/clean(ing|er)?|housekeeper|maid|tidy/.test(lower)) return "task_cleaning";
  if (/grocery|groceries|shopping list|food (run|pickup)|meal prep/.test(lower)) return "task_grocery";
  if (/(book|schedule|make|set up).{0,20}(appointment|appt|dentist|doctor|dr\.|vet|hair|nail)/.test(lower)) return "task_appointment";
  if (/pick(ing)? up|drop(ping)? off|carpool|drive|uber/.test(lower)) return "task_transport";
  if (/dinner|cook|recipe|restaurant|reserv/.test(lower)) return "task_dinner";
  if (/pool|pest|repair|fix|plumb|electr|handyman|hvac|ac |a\/c/.test(lower)) return "task_home_service";

  // Follow-ups based on recent context
  if (recent.includes("lawn") || recent.includes("mow")) return "task_lawn_followup";
  if (recent.includes("remind")) return "task_reminder_followup";
  if (recent.includes("clean")) return "task_cleaning_followup";

  return "general";
}

// ─── Response generator ───────────────────────────────────────────────────────

function generateResponse(
  intent: string,
  msg: string,
  ctx: FamilyContext
): { reply: string; activity?: { title: string; category: string; status: string } } {

  const day = extractDay(msg);
  const members = ctx.members.map(m => m.name);
  const shortName = ctx.name.replace(/^the\s+/i, "").replace(/s$/i, "");

  switch (intent) {

    case "capability_question":
      return { reply: pick([
        "Not yet — right now I understand and track your requests, but the actual bookings are handled by your Kin coordinator. Full automation is coming. Want me to queue this up?",
        "Honest answer: not fully on my own yet. I capture everything so nothing falls through the cracks, and your Kin team acts on it. Should I add this to your list?",
        "Not autonomously yet — think of me as the layer that never forgets. I log it, your Kin team handles it. Want me to put this in the queue?",
      ]) };

    case "what_is_kin":
      return { reply: `I'm Kin — your family's assistant. I handle the mental load of running a household: booking services, reminders, calendar, errands. I know the ${ctx.name} family and your home in ${ctx.neighborhood}, so you don't have to re-explain things each time. What can I take off your plate?` };

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
      const when = day ? `for ${day}` : "this week";
      const yard = ctx.preferences?.yard_type ? ` (${ctx.preferences.yard_type} yard)` : "";
      return {
        reply: `Got it — I'll line up lawn care ${when}${yard}. I'll coordinate with a vendor in ${ctx.neighborhood} and update the activity feed once it's confirmed.`,
        activity: { title: `Lawn care — ${day ?? "this week"}`, category: "lawn", status: "in_progress" },
      };
    }

    case "task_lawn_followup":
      return { reply: pick([
        "Already on it — confirmation coming shortly. Any special instructions for the crew?",
        "It's in the queue. Anything extra this time — edging, weeding?",
      ]) };

    case "task_reminder": {
      const nameMatch = msg.match(/remind (\w+)/i);
      const who = nameMatch ? nameMatch[1] : (members[0] ?? "everyone");
      const aboutMatch = msg.match(/about (.+)/i);
      const about = aboutMatch ? aboutMatch[1].replace(/[.!?]+$/, "") : "that";
      return {
        reply: `Done — I'll remind ${who} about ${about}. They'll get a heads-up the day before and again an hour out.`,
        activity: { title: `Reminder for ${who}: ${about}`, category: "reminder", status: "pending" },
      };
    }

    case "task_reminder_followup":
      return { reply: "Reminder is set — I'll make sure it lands at the right time. Anything else?" };

    case "task_cleaning": {
      const size = ctx.preferences?.home_size ? ` for your ${ctx.preferences.home_size} home` : "";
      return {
        reply: `I'll coordinate cleaning${size}. ${day ? `Aiming for ${day}.` : "What day works best?"} Any focus areas, or the usual full house?`,
        activity: { title: `House cleaning${day ? ` — ${day}` : ""}`, category: "general", status: "pending" },
      };
    }

    case "task_cleaning_followup":
      return { reply: "Got it — I'll note that for the cleaners. Anything else to add?" };

    case "task_grocery": {
      const diet = ctx.preferences?.dietary_notes ? ` (keeping in mind: ${ctx.preferences.dietary_notes})` : "";
      return {
        reply: `Added to the list${diet}. Want me to set a reminder before your usual shopping run?`,
        activity: { title: msg.slice(0, 60), category: "errand", status: "pending" },
      };
    }

    case "task_appointment":
      return {
        reply: `I'll get that scheduled${day ? ` for ${day}` : ""}. Who is this for${members.length > 1 ? ` — ${members.join(" or ")}?` : "?"}`,
        activity: { title: msg.slice(0, 60), category: "booking", status: "pending" },
      };

    case "task_transport":
      return {
        reply: `I'll add that to the calendar. ${day ? `Who needs to be where on ${day}?` : "What's the day and destination?"}`,
        activity: { title: msg.slice(0, 60), category: "general", status: "pending" },
      };

    case "task_dinner":
      return {
        reply: `On it${ctx.preferences?.dietary_notes ? ` — keeping in mind ${ctx.preferences.dietary_notes}` : ""}. Any preferences, or should I suggest a few spots near ${ctx.neighborhood}?`,
        activity: { title: msg.slice(0, 60), category: "errand", status: "pending" },
      };

    case "task_home_service":
      return {
        reply: `I'll find a reliable vendor in ${ctx.neighborhood} for that. ${day ? `Aiming for ${day}.` : "When works for you?"} Any history with this issue I should know about?`,
        activity: { title: msg.slice(0, 60), category: "general", status: "in_progress" },
      };

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
  const { message, familyId } = await req.json();
  if (!message || !familyId)
    return NextResponse.json({ error: "Missing message or familyId" }, { status: 400 });

  // Preview mode — no Supabase, use stored name from request if provided
  if (familyId === "preview") {
    const ctx: FamilyContext = {
      name: "your family",
      neighborhood: "your neighborhood",
      city: "Austin", state: "TX", zip: "",
      members: [],
      preferences: null,
    };
    const intent = detectIntent(message, []);
    const { reply } = generateResponse(intent, message, ctx);
    return NextResponse.json({
      reply,
      message: { id: Date.now().toString(), role: "assistant", content: reply, created_at: new Date().toISOString() },
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

  // Save assistant message
  const { data: assistantMsg } = await supabase
    .from("messages")
    .insert({ family_id: familyId, role: "assistant", content: reply })
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
  }

  return NextResponse.json({ reply, message: assistantMsg });
}
