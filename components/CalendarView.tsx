"use client";

import { useState, useEffect } from "react";
import { shiftPreservingLocalTime, localPartsIn, localDayDelta } from "@/lib/dates";
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
  /** Present when this is one occurrence of a repeating request. */
  recurrence_id?: string | null;
  recurrence_rule?: string | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  sports: "#b45309",
  school: "#4338ca",
  appointment: "#be185d",
  service: "#15803d",
  social: "#6d28d9",
  general: "#57534e",
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
  // Set while editing an existing row; null means the form is adding a new one.
  const [editingId, setEditingId] = useState<string | null>(null);
  // The row currently asking "just this one, or the whole run?"
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [editScope, setEditScope] = useState<"one" | "series">("one");
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
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
    closeForm();
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setEditScope("one");
    setConfirmRemove(null);
  }

  function openAdd(day: Date) {
    setEditingId(null);
    setNewTitle("");
    setNewDate(format(day, "yyyy-MM-dd"));
    setNewTime("09:00");
    setNewCategory("general");
    setShowForm(true);
  }

  // Prefill from the row so every field can be corrected — including the date,
  // since an event on the wrong day was the main reason to delete and retype.
  function openEdit(ev: CalEvent) {
    const at = new Date(ev.start_time);
    setEditingId(ev.id);
    setEditScope("one");
    setConfirmRemove(null);
    setNewTitle(ev.title);
    setNewDate(format(at, "yyyy-MM-dd"));
    setNewTime(format(at, "HH:mm"));
    setNewCategory(ev.category ?? "general");
    setShowForm(true);
  }

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle || !newDate || !familyId) return;

    setSaving(true);
    const start_time = new Date(`${newDate}T${newTime}`).toISOString();
    const fields = {
      title: newTitle,
      start_time,
      category: newCategory,
      color: CATEGORY_COLORS[newCategory],
    };

    if (isPreview(familyId)) {
      setEvents((prev) => {
        const edited = prev.find((e) => e.id === editingId);
        const sid = edited?.recurrence_id;
        const applyToRun = editingId && editScope === "series" && sid;
        // Shift on the local calendar, matching the server. A millisecond delta
        // would drop a 10:30 run to 9:30 once it crosses a clock change.
        const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const dayDelta = edited ? localDayDelta(edited.start_time, fields.start_time, zone) : 0;
        const target = localPartsIn(fields.start_time, zone);
        const updated = applyToRun
          ? prev.map((ev) =>
              ev.recurrence_id === sid && ev.start_time >= (edited?.start_time ?? "")
                ? { ...ev, title: fields.title, category: fields.category, color: fields.color,
                    start_time: shiftPreservingLocalTime(ev.start_time, dayDelta, target.hour, target.minute, zone) }
                : ev
            )
          : editingId
          ? prev.map((ev) => (ev.id === editingId ? { ...ev, ...fields } : ev))
          : [...prev, { id: Date.now().toString(), ...fields }];
        localStorage.setItem(PREVIEW_KEY, JSON.stringify(updated));
        return updated;
      });
    } else if (editingId) {
      const res = await fetch("/api/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...fields, ...(editScope === "series" ? { scope: "series" } : {}) }),
      });
      if (res.ok) {
        const data = await res.json();
        setEvents((prev) => prev.map((ev) => (ev.id === editingId ? data : ev)));
      }
    } else {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (res.ok) {
        const data = await res.json();
        setEvents((prev) => [...prev, data]);
      }
    }

    // Follow the event if it was moved to another day, so it isn't just gone.
    if (editingId) setSelected(new Date(`${newDate}T${newTime}`));
    setNewTitle("");
    setNewTime("09:00");
    closeForm();
    setSaving(false);
  }

  async function removeEvent(id: string, scope: "one" | "series" = "one") {
    const target = events.find((e) => e.id === id);
    const seriesId = target?.recurrence_id;

    if (isPreview(familyId)) {
      setEvents((prev) => {
        const updated =
          scope === "series" && seriesId
            ? prev.filter((e) => !(e.recurrence_id === seriesId && e.start_time >= (target?.start_time ?? "")))
            : prev.filter((e) => e.id !== id);
        localStorage.setItem(PREVIEW_KEY, JSON.stringify(updated));
        return updated;
      });
    } else {
      await fetch("/api/events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...(scope === "series" ? { scope: "series" } : {}) }),
      });
      setEvents((prev) =>
        scope === "series" && seriesId
          ? prev.filter((e) => !(e.recurrence_id === seriesId && e.start_time >= (target?.start_time ?? "")))
          : prev.filter((e) => e.id !== id)
      );
    }
    setConfirmRemove(null);
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
                } ${isSelected ? "bg-accent-subtle" : ""}`}
              >
                <span
                  className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                    today
                      ? "bg-accent-soft text-text-primary"
                      : isSelected
                      ? "text-accent"
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
                        backgroundColor: `${ev.color ?? CATEGORY_COLORS[ev.category] ?? "#57534e"}20`,
                        color: ev.color ?? CATEGORY_COLORS[ev.category] ?? "#57534e",
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
              onClick={() => (showForm ? closeForm() : openAdd(selected))}
              className="flex items-center gap-1 text-xs text-accent hover:text-accent-dim transition-colors"
            >
              <Plus size={12} />
              Add event
            </button>
          </div>

          {showForm && (
            <form onSubmit={saveEvent} className="space-y-2 mb-4 animate-slide-up">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Event name"
                required
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40"
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  required
                  className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/40"
                />
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/40"
                />
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-secondary focus:outline-none focus:border-accent/40"
                >
                  <option value="general">General</option>
                  <option value="sports">Sports</option>
                  <option value="school">School</option>
                  <option value="appointment">Appointment</option>
                  <option value="service">Service</option>
                  <option value="social">Social</option>
                </select>
              </div>
              {editingId && selectedDayEvents.find((e) => e.id === editingId)?.recurrence_id && (
                <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer py-0.5">
                  <input
                    type="checkbox"
                    checked={editScope === "series"}
                    onChange={(e) => setEditScope(e.target.checked ? "series" : "one")}
                    className="accent-accent"
                  />
                  Apply to the whole run from here on
                </label>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-accent-soft hover:bg-accent-soft-dim text-text-primary text-sm font-medium rounded-lg py-2 transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving…" : editingId ? "Save changes" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
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
                      {ev.recurrence_rule ? " · " + ev.recurrence_rule : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all">
                    <button
                      onClick={() => openEdit(ev)}
                      className="text-xs text-text-muted hover:text-accent transition-colors"
                    >
                      Edit
                    </button>
                    {confirmRemove === ev.id ? (
                      <>
                        <button
                          onClick={() => removeEvent(ev.id, "one")}
                          className="text-xs text-red-700 hover:underline"
                        >
                          Just this one
                        </button>
                        <button
                          onClick={() => removeEvent(ev.id, "series")}
                          className="text-xs text-red-700 hover:underline"
                        >
                          All future
                        </button>
                        <button
                          onClick={() => setConfirmRemove(null)}
                          className="text-xs text-text-muted hover:text-text-secondary"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => (ev.recurrence_id ? setConfirmRemove(ev.id) : removeEvent(ev.id))}
                        className="text-xs text-text-muted hover:text-red-700 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
