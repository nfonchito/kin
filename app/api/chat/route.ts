import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Intent detection ────────────────────────────────────────────────────────

function detectIntent(msg: string, history: Message[]): string {
  const lower = msg.toLowerCase();
  const prev = history.slice(-3).map(m => m.content.toLowerCase()).join(" ");

  // Meta / capability questions
  if (/can you|are you able|do you|will you ever|when will you/.test(lower) &&
      /book|call|order|schedule|set up|actually do|for real|real(ly)?|yourself/.test(lower)) {
    return "capability_question";
  }

  // Self-aware questions about Kin
  if (/what (are|can) you|who are you|what is kin|how do you work|what do you do/.test(lower)) {
    return "what_is_kin";
  }

  // Personal / family knowledge questions
  if (/where (do|did) (i|we) live|my address|my neighborhood|where am i/.test(lower)) {
    return "where_live";
  }
  if (/who (is|are) (in )?(my |our )?(family|household)|family members|who do i live with/.test(lower)) {
    return "family_members";
  }
  if (/(what('s| is) my name|who am i|my family name|our (last )?name)/.test(lower)) {
    return "family_name";
  }
  if (/what('s| is) the weather|weather (today|tomorrow|this week)/.test(lower)) {
    return "weather";
  }
  if (/what time is it|what('s| is) today'?s? date|what day is/.test(lower)) {
    return "time_date";
  }

  // Conversational / greetings
  if (/^(hi|hey|hello|howdy|good (morning|afternoon|evening))[\s!.?]*$/.test(lower)) {
    return "greeting";
  }
  if (/thank(s| you)|that('?s| is) (great|helpful|perfect|amazing|awesome)/.test(lower)) {
    return "thanks";
  }
  if (/how are you|how('?s| is) it going|you doing/.test(lower)) {
    return "how_are_you";
  }

  // Task intents
  if (/lawn|mow|grass|yard (care|service)|landscap/.test(lower)) return "task_lawn";
  if (/remind|reminder|don'?t (let|forget)|heads[ -]?up/.test(lower)) return "task_reminder";
  if (/clean(ing|er)?|housekeeper|maid|tidy/.test(lower)) return "task_cleaning";
  if (/grocery|groceries|shopping list|food (run|pickup)|meal prep/.test(lower)) return "task_grocery";
  if (/(book|schedule|make|set up).{0,20}(appointment|appt|dentist|doctor|dr\.|vet|hair|nail)/.test(lower)) return "task_appointment";
  if (/pick(ing)? up|drop(ping)? off|carpool|drive|uber/.test(lower)) return "task_transport";
  if (/dinner|cook|recipe|restaurant|reserv/.test(lower)) return "task_dinner";
  if (/pool|pest|repair|fix|plumb|electr|handyman|hvac|ac |a\/c/.test(lower)) return "task_home_service";

  // Ambiguous follow-up in task conversation
  if (prev.includes("lawn") || prev.includes("mow")) return "task_lawn_followup";
  if (prev.includes("remind") || prev.includes("reminder")) return "task_reminder_followup";
  if (prev.includes("clean")) return "task_cleaning_followup";

  return "general";
}

// ─── Response generator ───────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateResponse(
  intent: string,
  originalMsg: string,
  family: FamilyContext,
  history: Message[]
): { reply: string; activity?: { title: string; category: string; status: string } } {

  const firstName = family.name.replace(/^the\s+/i, "").replace(/s$/i, "");
  const memberNames = family.members.map(m => m.name);
  const dayMatch = originalMsg.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|this week|next week)/i);
  const day = dayMatch ? dayMatch[1] : null;

  switch (intent) {

    // ── Meta / capability ──────────────────────────────────────────────────
    case "capability_question":
      return {
        reply: pick([
          "Not yet — right now I'm in early mode, which means I understand your requests and track them, but the actual vendor calls and bookings are still handled by your Kin coordinator. The plan is to automate more of that over time. What would you like me to queue up?",
          "Honest answer: not fully on my own yet. I can understand, log, and track requests — and your Kin team acts on them. Automated vendor connections are coming. Want me to put this in the queue regardless?",
          "Not autonomously yet. Think of me right now as the layer that never forgets — I capture everything and make sure it gets handled. Full automation is on the roadmap. Should I add this to your list?",
        ])
      };

    case "what_is_kin":
      return {
        reply: `I'm Kin — your family's AI assistant. I handle the mental load of running a household: booking services, setting reminders, managing the calendar, tracking errands, and making sure nothing falls through the cracks. I know your family, your home, and your preferences — so you don't have to explain context every time. What can I take off your plate?`,
      };

    // ── Personal / family knowledge ────────────────────────────────────────
    case "where_live":
      return {
        reply: `You're in ${family.neighborhood}, ${family.city}, ${family.state} ${family.zip}. One of the best pockets of Austin — I've got your neighborhood dialed in for local services and vendors.`,
      };

    case "family_members": {
      if (family.members.length === 0) {
        return { reply: `I don't have your family members added yet. Head to your Profile page and add them — it helps me give more personalized responses.` };
      }
      const list = family.members.map(m =>
        `${m.name} (${m.role}${m.age ? `, ${m.age}` : ""})`
      ).join(", ");
      return { reply: `Your household: ${list}. Want me to do anything for any of them?` };
    }

    case "family_name":
      return {
        reply: `You're ${family.name} — based in ${family.neighborhood}, ${family.city}. Is there something I can help the family with?`,
      };

    case "weather":
      return {
        reply: `I don't have live weather data yet, but for ${family.neighborhood} in June you're typically looking at mid-90s°F and sunny — classic Austin summer. I'd check weather.com or your phone for the exact forecast. Want me to remind you to check before any outdoor plans?`,
      };

    case "time_date": {
      const now = new Date();
      return {
        reply: `It's ${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}, ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}. Anything time-sensitive I can help with?`,
      };
    }

    // ── Conversation ───────────────────────────────────────────────────────
    case "greeting": {
      const hour = new Date().getHours();
      const timeGreeting = hour < 12 ? "Good morning" : hour < 17 ? "Hey" : "Good evening";
      const intro = memberNames.length > 0 ? `${timeGreeting}! What's on the ${family.name} agenda today?` : `${timeGreeting}! What can I help with today?`;
      return { reply: intro };
    }

    case "thanks":
      return {
        reply: pick([
          "Of course — that's what I'm here for. Anything else on your list?",
          "Happy to help. What else can I take off your plate?",
          "Always. Let me know if anything else comes up.",
        ])
      };

    case "how_are_you":
      return {
        reply: pick([
          "Doing great — I've got your calendar, tasks, and home details loaded up and ready. What can I help with?",
          "Ready to go. What's on your mind?",
          "All good on my end. What do you need?",
        ])
      };

    // ── Task: Lawn ─────────────────────────────────────────────────────────
    case "task_lawn": {
      const when = day ? `for ${day}` : "this week";
      const yardNote = family.preferences?.yard_type ? ` (${family.preferences.yard_type} yard)` : "";
      return {
        reply: `Got it — I'll line up lawn care ${when}${yardNote}. I'll coordinate with your preferred vendor in ${family.neighborhood} and confirm the time. I'll update the activity feed once it's booked.`,
        activity: { title: `Lawn care — ${day ?? "this week"}`, category: "lawn", status: "in_progress" },
      };
    }

    case "task_lawn_followup":
      return {
        reply: pick([
          "Yep, already on it — I'll have a confirmation shortly. Any specific instructions for the crew?",
          "It's in the queue. Anything special this time — edging, weeding, anything extra?",
        ])
      };

    // ── Task: Reminder ─────────────────────────────────────────────────────
    case "task_reminder": {
      const nameMatch = originalMsg.match(/remind (\w+)/i);
      const name = nameMatch ? nameMatch[1] : (memberNames[0] ?? "everyone");
      const aboutMatch = originalMsg.match(/about (.+)/i);
      const about = aboutMatch ? aboutMatch[1].replace(/[.!?]+$/, "") : "that";
      return {
        reply: `Done — I'll remind ${name} about ${about}. They'll get a heads up the day before and again an hour out.`,
        activity: { title: `Reminder for ${name}: ${about}`, category: "reminder", status: "pending" },
      };
    }

    case "task_reminder_followup":
      return { reply: "Reminder is set — I'll make sure it lands at the right time. Anything else?" };

    // ── Task: Cleaning ─────────────────────────────────────────────────────
    case "task_cleaning": {
      const sizeNote = family.preferences?.home_size ? ` for your ${family.preferences.home_size} home` : "";
      return {
        reply: `I'll coordinate cleaning${sizeNote}. ${day ? `I'll aim for ${day}.` : "What day works best?"} Any focus areas this time, or the usual full house?`,
        activity: { title: `House cleaning${day ? ` — ${day}` : ""}`, category: "general", status: "pending" },
      };
    }

    case "task_cleaning_followup":
      return { reply: "Got it. I'll note that for the cleaners. Anything else to add?" };

    // ── Task: Grocery ──────────────────────────────────────────────────────
    case "task_grocery": {
      const dietNote = family.preferences?.dietary_notes ? ` (noted: ${family.preferences.dietary_notes})` : "";
      return {
        reply: `Added to the list${dietNote}. Want me to set a reminder before your usual shopping run, or is there a specific time you're thinking?`,
        activity: { title: originalMsg.slice(0, 60), category: "errand", status: "pending" },
      };
    }

    // ── Task: Appointment ──────────────────────────────────────────────────
    case "task_appointment": {
      const when2 = day ? ` for ${day}` : "";
      return {
        reply: `I'll get that scheduled${when2}. Who is this appointment for${memberNames.length > 1 ? ` — ${memberNames.join(", ")}?` : "?"}`,
        activity: { title: originalMsg.slice(0, 60), category: "booking", status: "pending" },
      };
    }

    // ── Task: Transport ────────────────────────────────────────────────────
    case "task_transport":
      return {
        reply: `I'll add that to the calendar. ${day ? `Who needs to be where on ${day}?` : "What's the day and destination?"}`,
        activity: { title: originalMsg.slice(0, 60), category: "general", status: "pending" },
      };

    // ── Task: Dinner ───────────────────────────────────────────────────────
    case "task_dinner":
      return {
        reply: `On it${family.preferences?.dietary_notes ? ` — keeping in mind ${family.preferences.dietary_notes}` : ""}. Any preferences, or should I suggest a few options near ${family.neighborhood}?`,
        activity: { title: originalMsg.slice(0, 60), category: "errand", status: "pending" },
      };

    // ── Task: Home service ─────────────────────────────────────────────────
    case "task_home_service":
      return {
        reply: `I'll find a reliable vendor in ${family.neighborhood} for that. ${day ? `Aiming for ${day}.` : "When works for you?"} Any history with this issue I should know about?`,
        activity: { title: originalMsg.slice(0, 60), category: "general", status: "in_progress" },
      };

    // ── General fallback ───────────────────────────────────────────────────
    default:
      return {
        reply: pick([
          `Got it. I'll look into that for the ${family.name} and follow up. Is there a deadline or anything else I should keep in mind?`,
          `On it. Anything specific about timing or preferences that would help me handle this better?`,
          `Noted — I'll take care of that. Any details I should have before I move forward?`,
        ]),
        activity: { title: originalMsg.slice(0, 60), category: "general", status: "pending" },
      };
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message, familyId } = await req.json();
  if (!message || !familyId) {
    return NextResponse.json({ error: "Missing message or familyId" }, { status: 400 });
  }

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
  const { reply, activity } = generateResponse(intent, message, ctx, history);

  // Save assistant message
  const { data: assistantMsg } = await supabase
    .from("messages")
    .insert({ family_id: familyId, role: "assistant", content: reply })
    .select()
    .single();

  // Create activity for task intents only
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
