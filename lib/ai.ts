import Anthropic from "@anthropic-ai/sdk";

// Real LLM replies via Claude. Activates only when ANTHROPIC_API_KEY is set;
// otherwise generateSmartReply returns null and the caller falls back to the
// built-in rule-based responder. The model can be overridden with KIN_AI_MODEL
// (e.g. "claude-haiku-4-5" for lower cost).
const MODEL = process.env.KIN_AI_MODEL || "claude-opus-4-8";

export interface AIContext {
  name: string;
  neighborhood: string;
  city: string;
  state: string;
  members: { name: string; role: string; age?: number }[];
  preferences: { home_size?: string; yard_type?: string; dietary_notes?: string } | null;
}

export interface ActionTaken {
  calendarEvent?: { title: string; start_time: string } | null;
  activity?: { title: string; category: string; status: string } | null;
}

export function aiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function generateSmartReply(
  userMessage: string,
  ctx: AIContext,
  history: { role: string; content: string }[],
  action: ActionTaken
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null; // no key → caller uses the rule-based responder

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: buildSystemPrompt(ctx, history, action),
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content
      .map((block) => ("text" in block ? block.text : ""))
      .join("")
      .trim();

    return text || null;
  } catch (err) {
    // Never let an API hiccup break the chat — fall back to rule-based.
    console.error("[ai] Claude reply failed, falling back to rule-based:", err);
    return null;
  }
}

function buildSystemPrompt(ctx: AIContext, history: { role: string; content: string }[], action: ActionTaken): string {
  const memberList = ctx.members.length
    ? ctx.members.map((m) => `${m.name} (${m.role}${m.age ? `, age ${m.age}` : ""})`).join(", ")
    : "not provided yet";

  const prefs: string[] = [];
  if (ctx.preferences?.home_size) prefs.push(`home size: ${ctx.preferences.home_size}`);
  if (ctx.preferences?.yard_type) prefs.push(`yard: ${ctx.preferences.yard_type}`);
  if (ctx.preferences?.dietary_notes) prefs.push(`dietary notes: ${ctx.preferences.dietary_notes}`);

  const actionLines: string[] = [];
  if (action.calendarEvent) {
    const when = new Date(action.calendarEvent.start_time).toLocaleString("en-US", {
      weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
    });
    actionLines.push(`You just added "${action.calendarEvent.title}" to their calendar for ${when}. Confirm this naturally.`);
  }
  if (action.activity && !action.calendarEvent) {
    actionLines.push(`You just logged this request to their task list: "${action.activity.title}". Confirm you've captured it.`);
  }

  const recent = history.slice(-6).map((m) => `${m.role === "user" ? "Family" : "Kin"}: ${m.content}`).join("\n");

  return [
    `You are Kin, a warm, efficient personal assistant for a busy family. You help manage the mental load of running a household — reminders, scheduling, errands, bookings, and the family calendar.`,
    ``,
    `About this family:`,
    `- Name: the ${ctx.name}`,
    `- Location: ${ctx.neighborhood}, ${ctx.city}, ${ctx.state}`,
    `- Household members: ${memberList}`,
    prefs.length ? `- Preferences: ${prefs.join("; ")}` : ``,
    ``,
    `What you can do: understand requests in plain language, capture them, add things to their calendar, and keep track so nothing slips. Be honest — you organize and track requests, and a human Kin coordinator handles the real-world bookings. Don't claim to have personally phoned a vendor or completed a booking yourself.`,
    ``,
    actionLines.length ? `Action you just took:\n${actionLines.join("\n")}` : ``,
    recent ? `Recent conversation:\n${recent}` : ``,
    ``,
    `Style: reply in 1-3 short, natural sentences. Sound like a sharp, caring assistant texting back — friendly, never robotic. Plain text only (no markdown, bullet points, or headers). Use family members' names when relevant. If you need a detail to act (a day, a time, who it's for), ask one quick question.`,
  ].filter(Boolean).join("\n");
}
