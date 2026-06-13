"use client";

import { useState, useEffect } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

interface CalEvent {
  id: string;
  title: string;
  start_time: string;
  category: string;
  color?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  sports: "#f59e0b",
  school: "#6366f1",
  appointment: "#ec4899",
  service: "#15c489",
  social: "#8b5cf6",
  general: "#6b7280",
};

interface CalendarViewProps {
  events: CalEvent[];
  familyId: string | undefined;
}

const PREVIEW_KEY = "kin_calendar_events";
const isPreview = (id: string | undefined) => id === "preview";

export function CalendarView({ events: initialEvents, familyId }: CalendarViewProps) {
  const [current, setCurrent] = useState(new Date());
  const [events, setEvents] = useState<CalEvent[]>(initialEvents);
  const [selected, setSelected] = useState<Date | null>(null);

  useEffect(() => {
    if (!isPreview(familyId)) return;
    try {
      const stored = localStorage.getItem(PREVIEW_KEY);
      if (stored) setEvents(JSON.parse(stored));
    } catch {}
  }, [familyId]);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState("09:00");
  const [newCategory, setNewCategory] = useState("general");
  const [saving, setSaving] = useState(false);

  const monthStart = startOfMonth(current);
  const monthEnd = endOfMonth(current);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  function eventsOnDay(day: Date) {
    return events.filter((e) => isSameDay(new Date(e.start_time), day));
  }

  function selectDay(day: Date) {
    setSelected(isSameDay(day, selected ?? new Date(0)) ? null : day);
    setShowForm(false);
  }

  async function addEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle || !selected || !familyId) return;

    setSaving(true);
    const start_time = new Date(
      `${format(selected, "yyyy-MM-dd")}T${newTime}`
    ).toISOString();

    if (isPreview(familyId)) {
      const newEvent: CalEvent = {
        id: Date.now().toString(),
        title: newTitle,
        start_time,
        category: newCategory,
        color: CATEGORY_COLORS[newCategory],
      };
      setEvents((prev) => {
        const updated = [...prev, newEvent];
        localStorage.setItem(PREVIEW_KEY, JSON.stringify(updated));
        return updated;
      });
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
      setEvents((prev) => [...prev, data]);
    }

    setNewTitle("");
    setNewTime("09:00");
    setShowForm(false);
    setSaving(false);
  }

  async function removeEvent(id: string) {
    if (isPreview(familyId)) {
      setEvents((prev) => {
        const updated = prev.filter((e) => e.id !== id);
        localStorage.setItem(PREVIEW_KEY, JSON.stringify(updated));
        return updated;
      });
    } else {
      await fetch("/api/events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setEvents((prev) => prev.filter((e) => e.id !== id));
    }
  }

  const selectedDayEvents = selected ? eventsOnDay(selected) : [];

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text-primary">
          {format(current, "MMMM yyyy")}
        </h2>
        <div className="flex gap-1">
          <button
            onClick={() => setCurrent(subMonths(current, 1))}
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-3 rounded-lg transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setCurrent(new Date())}
            className="px-3 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-3 rounded-lg transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setCurrent(addMonths(current, 1))}
            className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-3 rounded-lg transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d} className="py-2.5 text-center text-xs text-text-muted font-medium">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const dayEvents = eventsOnDay(day);
            const inMonth = isSameMonth(day, current);
            const today = isToday(day);
            const isSelected = selected && isSameDay(day, selected);

            return (
              <button
                key={i}
                onClick={() => selectDay(day)}
                className={`min-h-[64px] p-1.5 text-left border-b border-r border-border transition-colors relative ${
                  !inMonth ? "opacity-30" : "hover:bg-surface-2"
                } ${isSelected ? "bg-teal-subtle" : ""}`}
              >
                <span
                  className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                    today
                      ? "bg-teal text-bg"
                      : isSelected
                      ? "text-teal"
                      : "text-text-secondary"
                  }`}
                >
                  {format(day, "d")}
                </span>

                <div className="mt-0.5 space-y-0.5">
                  {dayEvents.slice(0, 2).map((ev) => (
                    <div
                      key={ev.id}
                      className="text-[9px] px-1 py-0.5 rounded truncate font-medium"
                      style={{
                        backgroundColor: `${ev.color ?? CATEGORY_COLORS[ev.category] ?? "#6b7280"}20`,
                        color: ev.color ?? CATEGORY_COLORS[ev.category] ?? "#6b7280",
                      }}
                    >
                      {ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-[9px] text-text-muted px-1">
                      +{dayEvents.length - 2} more
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day panel */}
      {selected && (
        <div className="bg-surface border border-border rounded-2xl p-4 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">
              {isToday(selected) ? "Today" : format(selected, "EEEE, MMMM d")}
            </h3>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1 text-xs text-teal hover:text-teal-dim transition-colors"
            >
              <Plus size={12} />
              Add event
            </button>
          </div>

          {showForm && (
            <form onSubmit={addEvent} className="space-y-2 mb-4 animate-slide-up">
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
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-teal/40"
                />
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-secondary focus:outline-none focus:border-teal/40"
                >
                  <option value="general">General</option>
                  <option value="sports">Sports</option>
                  <option value="school">School</option>
                  <option value="appointment">Appointment</option>
                  <option value="service">Service</option>
                  <option value="social">Social</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-teal hover:bg-teal-dim text-bg text-sm font-medium rounded-lg py-2 transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-3 text-sm text-text-muted hover:text-text-secondary bg-surface-2 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {selectedDayEvents.length === 0 ? (
            <p className="text-sm text-text-muted py-2">No events — click &quot;Add event&quot; to schedule something.</p>
          ) : (
            <div className="space-y-2">
              {selectedDayEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center gap-3 p-2.5 bg-surface-2 rounded-xl border border-border group"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: ev.color ?? CATEGORY_COLORS[ev.category] }}
                  />
                  <div className="flex-1">
                    <p className="text-sm text-text-primary">{ev.title}</p>
                    <p className="text-xs text-text-muted">
                      {format(new Date(ev.start_time), "h:mm a")}
                    </p>
                  </div>
                  <button
                    onClick={() => removeEvent(ev.id)}
                    className="text-xs text-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
