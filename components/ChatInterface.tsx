"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles } from "lucide-react";
import { KinLogo } from "./KinLogo";
import { format } from "date-fns";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface ChatInterfaceProps {
  familyId: string | undefined;
  initialMessages: Message[];
}

const SUGGESTIONS = [
  "Book lawn care for Saturday",
  "Remind David about Emma's soccer Thursday",
  "Schedule house cleaning next week",
  "Add grocery run to the list",
];

export function ChatInterface({ familyId, initialMessages }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Preview mode: restore the conversation on mount so it survives navigation
  useEffect(() => {
    if (familyId !== "preview") return;
    try {
      const saved = localStorage.getItem("kin_chat_messages");
      if (saved) setMessages(JSON.parse(saved));
    } catch {}
  }, [familyId]);

  // Preview mode: persist on every change (skip the initial empty state so we
  // never overwrite a saved conversation before it has been restored)
  useEffect(() => {
    if (familyId !== "preview" || messages.length === 0) return;
    try {
      localStorage.setItem("kin_chat_messages", JSON.stringify(messages));
    } catch {}
  }, [messages, familyId]);

  async function sendMessage(text: string) {
    if (!text.trim() || !familyId || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), familyId }),
      });

      const data = await res.json();

      // Persist calendar event to localStorage in preview mode
      if (data.event && familyId === "preview") {
        try {
          const stored: unknown[] = JSON.parse(localStorage.getItem("kin_calendar_events") || "[]");
          stored.push(data.event);
          localStorage.setItem("kin_calendar_events", JSON.stringify(stored));
        } catch {}
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Something went wrong. Please try again.",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <EmptyState onSuggestion={sendMessage} />
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {loading && <TypingIndicator />}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-bg">
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="text-xs bg-surface-2 hover:bg-surface-3 border border-border text-text-secondary hover:text-text-primary px-3 py-1.5 rounded-full transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 bg-surface border border-border rounded-2xl px-4 py-3 focus-within:border-teal/40 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Kin anything…"
            rows={1}
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted resize-none outline-none max-h-32 leading-relaxed"
            style={{ minHeight: "24px" }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="shrink-0 p-1.5 bg-teal hover:bg-teal-dim text-bg rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send size={14} />
          </button>
        </div>

        <p className="text-center text-[10px] text-text-muted mt-2">
          Kin handles the details — you stay present
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 animate-slide-up ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="shrink-0 mt-0.5">
          <KinLogo size={28} />
        </div>
      )}

      <div className={`max-w-[75%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? "bg-teal text-bg rounded-br-sm font-medium"
              : "bg-surface-2 text-text-primary border border-border rounded-bl-sm"
          }`}
        >
          {message.content}
        </div>
        <span className="text-[10px] text-text-muted px-1">
          {format(new Date(message.created_at), "h:mm a")}
        </span>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-in">
      <KinLogo size={28} />
      <div className="bg-surface-2 border border-border px-4 py-3 rounded-2xl rounded-bl-sm">
        <div className="flex gap-1.5 items-center h-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 bg-text-muted rounded-full animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onSuggestion }: { onSuggestion: (s: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-16 px-4">
      <div className="mb-4 opacity-60">
        <Sparkles size={28} className="text-teal mx-auto" />
      </div>
      <h3 className="text-base font-medium text-text-primary mb-2">
        Kin is ready to help
      </h3>
      <p className="text-sm text-text-secondary max-w-xs leading-relaxed">
        Tell Kin what you need in plain English — bookings, reminders, errands, anything.
      </p>
    </div>
  );
}
