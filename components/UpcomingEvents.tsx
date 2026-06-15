"use client";

import { useState, useEffect } from "react";
import { format, isToday, isTomorrow } from "date-fns";
import { CalendarDays, Plus, X } from "lucide-react";

interface Event {
  id: string;
  title: string;
  start_time: string;
  end_time?: string;
  category: string;
  color?: string;
  created_by?: string;
}

interface UpcomingEventsProps {
  events: Event[];
  familyId: string | undefined;
}

function dayLabel(date: Date) {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE, MMM d");
}

const CATEGORY_COLORS: Record<string, string> = {
  sports: "#f59e0b",
  school: "#6366f1",
  appointment: "#ec4899",
  service: "#15c489",
  social: "#8b5cf6",
  general: "#6b7280",
};

const PREVIEW_KEY = "kin_calendar_events";
const isPreview = (id: string | undefined) => id === "preview";
const byStart = (a: Event, b: Event) =>
  new Date(a.start_time).getTime() - new Date(b.start_time).getTime();

export function UpcomingEvents({ events: initialEvents, familyId }: UpcomingEventsProps) {
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [saving, setSaving] = useState(false);

  // Preview mode: read the shared calendar store so AI- and calendar-created
  // events show up here too. Show today onward, soonest first.
  useEffect(() => {
    if (!isPreview(familyId)) return;
    try {
      const stored = localStorage.getItem(PREVIEW_KEY);
      if (!stored) return;
      const all: Event[] = JSON.parse(stored);
      const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
      setEvents(
        all.filter((e) => new Date(e.start_time).getTime() >= startOfToday.getTime())
           .sort(byStart)
      );
    } catch {}
  }, [familyId]);

  async function addEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle || !newDate || !familyId) return;

    setSaving(true);
    const start_time = newTime
      ? new Date(`${newDate}T${newTime}`).toISOString()
      : new Date(`${newDate}T09:00`).toISOString();

    if (isPreview(familyId)) {
      const newEvent: Event = {
        id: Date.now().toString(),
        title: newTitle,
        start_time,
        category: newCategory,
        color: CATEGORY_COLORS[newCategory],
      };
      try {
        const all: Event[] = JSON.parse(localStorage.getItem(PREVIEW_KEY) || "[]");
        all.push(newEvent);
        localStorage.setItem(PREVIEW_KEY, JSON.stringify(all));
      } catch {}
      setEvents((prev) => [...prev, newEvent].sort(byStart));
    } else {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          family_id: familyId,
          title: newTitle,
          start_time,
          category: newCategory,
          color: CATEGORY_COLORS[newCategory],
        }),
      });
      const data = await res.json();
      setEvents((prev) => [...prev, data].sort(byStart));
    }

    setNewTitle("");
    setNewDate("");
    setNewTime("");
    setShowForm(false);
    setSaving(false);
  }

  async function removeEvent(id: string) {
    if (isPreview(familyId)) {
      try {
        const all: Event[] = JSON.parse(localStorage.getItem(PREVIEW_KEY) || "[]");
        localStorage.setItem(PREVIEW_KEY, JSON.stringify(all.filter((e) => e.id !== id)));
      } catch {}
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } else {
      await fetch("/api/events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setEvents((prev) => prev.filter((e) => e.id !== id));
    }
  }

  return (
    <div className="border-b border-border">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <h2 className="text-sm font-semibold text-text-primary">Upcoming</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="p-1 text-text-muted hover:text-teal transition-colors rounded-md hover:bg-teal-subtle"
        >
          <Plus size={14} />
        </button>
      </div>

      {showForm && (
        <form onSubmit={addEvent} className="px-4 pb-3 space-y-2 animate-slide-up">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Event name"
            required
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-teal/40"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              required
              className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-teal/40"
            />
            <input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="w-24 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-teal/40"
            />
          </div>
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-secondary focus:outline-none focus:border-teal/40"
          >
            <option value="general">General</option>
            <option value="sports">Sports</option>
            <option value="school">School</option>
            <option value="appointment">Appointment</option>
            <option value="service">Service</option>
            <option value="social">Social</option>
          </select>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-teal hover:bg-teal-dim text-bg text-sm font-medium rounded-lg py-2 transition-colors disabled:opacity-50"
            >
              {saving ? "Adding…" : "Add event"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 text-text-muted hover:text-text-secondary bg-surface-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="px-4 pb-4 space-y-1.5">
        {events.length === 0 && !showForm ? (
          <div className="flex items-center gap-2 py-3 text-sm text-text-muted">
            <CalendarDays size={14} />
            <span>No upcoming events</span>
          </div>
        ) : (
          events.slice(0, 4).map((event) => {
            const date = new Date(event.start_time);
            const color = event.color ?? CATEGORY_COLORS[event.category] ?? "#6b7280";
            return (
              <div key={event.id} className="flex items-center gap-2.5 group">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">{event.title}</p>
                  <p className="text-[11px] text-text-muted">
                    {dayLabel(date)} · {format(date, "h:mm a")}
                  </p>
                </div>
                <button
                  onClick={() => removeEvent(event.id)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-text-muted hover:text-red-400"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
