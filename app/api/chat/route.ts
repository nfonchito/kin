import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// ─── Anthropic client ─────────────────────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─── Task intent detection (for activity logging only) ────────────────────────

function detectTaskCategory(msg: string): string | null {
  const lower = msg.toLowerCase();
  if (/lawn|mow|grass|yard (care|service)|landscap/.test(lower)) return "lawn";
  if (/remind|reminder|don'?t (let|forget)|heads[ -]?up/.test(lower)) return "reminder";
  if (/clean(ing|er)?|housekeeper|maid|tidy/.test(lower)) return "cleaning";
  if (/grocery|groceries|shopping list|food (run|pickup)|meal prep/.test(lower)) return "errand";
  if (/(book|schedule|make|set up).{0,20}(appointment|appt|dentist|doctor|dr\.|vet|hair|nail)/.test(lower)) return "booking";
  if (/pick(ing)? up|drop(ping)? off|carpool|drive/.test(lower)) return "transport";
  if (/dinner|cook|recipe|restaurant|reserv/.test(lower)) return "errand";
  if (/pool|pest|repair|fix|plumb|electr|handyman|hvac|ac |a\/c/.test(lower)) return "home_service";
  return null;
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

  // Load family context in parallel
  const [{ data: family }, { data: members }, { data: preferences }, { data: recentMessages }] =
    await Promise.all([
      supabase.from("families").select("*").eq("id", familyId).single(),
      supabase.from("family_members").select("name, role, age").eq("family_id", familyId),
      supabase.from("family_preferences").select("*").eq("family_id", familyId).single(),
      supabase.from("messages").select("role, content").eq("family_id", familyId)
        .order("created_at", { ascending: false }).limit(10),
    ]);

  const familyName = family?.name ?? "your family";
  const neighborhood = family?.neighborhood ?? "Northwest Hills";
  const city = family?.city ?? "Austin";
  const state = family?.state ?? "TX";
  const zip = family?.zip ?? "78731";

  const memberList =
    (members ?? []).length > 0
      ? (members ?? []).map(m => `${m.name} (${m.role}${m.age ? `, age ${m.age}` : ""})`).join(", ")
      : "no members added yet";

  const systemPrompt = [
    `You are Kin, an AI-powered family assistant for the ${familyName} family. You help them manage their household in ${neighborhood}, ${city}, ${state} ${zip}.`,
    "",
    "Your job is to handle the mental load of running a household: scheduling services, setting reminders, managing the calendar, tracking errands, and coordinating tasks so the family doesn't have to think about them.",
    "",
    `Family members: ${memberList}`,
    preferences?.home_size ? `Home: ${preferences.home_size}` : null,
    preferences?.yard_type ? `Yard: ${preferences.yard_type}` : null,
    preferences?.dietary_notes ? `Dietary notes: ${preferences.dietary_notes}` : null,
    "",
    "Guidelines:",
    "- Be warm, helpful, and concise — keep responses to 2-4 sentences",
    "- When asked to schedule, book, or remind, confirm you're on it and ask for any missing details needed to complete the task",
    "- You track tasks and help coordinate; actual vendor calls are handled by the Kin team for now, but you manage everything in between",
    "- Respond in plain conversational text — no markdown, no bullet points, no headers",
    "- Address family members by name when relevant",
    "- You know the neighborhood, local vendors, and the family's preferences well",
  ].filter(line => line !== null).join("\n");

  const history = (recentMessages ?? []).reverse();

  // Save user message first
  await supabase.from("messages").insert({
    family_id: familyId,
    role: "user",
    content: message,
  });

  // Call Claude
  let reply: string;
  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 400,
      system: systemPrompt,
      messages: [
        ...history.map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user", content: message },
      ],
    });

    const textBlock = response.content.find(b => b.type === "text");
    reply =
      textBlock && textBlock.type === "text"
        ? textBlock.text
        : "I didn't catch that — could you say it again?";
  } catch (err) {
    console.error("Anthropic API error:", err);
    reply = "I'm having a bit of trouble right now. Please try again in a moment.";
  }

  // Save assistant message
  const { data: assistantMsg } = await supabase
    .from("messages")
    .insert({ family_id: familyId, role: "assistant", content: reply })
    .select()
    .single();

  // Log an activity for recognized task intents
  const taskCategory = detectTaskCategory(message);
  if (taskCategory) {
    await supabase.from("activities").insert({
      family_id: familyId,
      title: message.slice(0, 60),
      category: taskCategory,
      status: "pending",
      description: message,
    });
  }

  return NextResponse.json({ reply, message: assistantMsg });
}
