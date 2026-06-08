"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Clock, XCircle, Loader2, TreePine, Bell, CalendarDays, ShoppingCart, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Activity {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "done" | "cancelled";
  category: string;
  created_at: string;
  completed_at?: string;
}

interface ActivityFeedProps {
  activities: Activity[];
  familyId: string | undefined;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  lawn: TreePine,
  reminder: Bell,
  booking: CalendarDays,
  errand: ShoppingCart,
  general: Sparkles,
};

const STATUS_CONFIG = {
  pending: {
    icon: Circle,
    label: "Pending",
    color: "text-text-muted",
    dot: "bg-text-muted",
  },
  in_progress: {
    icon: Loader2,
    label: "In progress",
    color: "text-yellow-400",
    dot: "bg-yellow-400",
  },
  done: {
    icon: CheckCircle2,
    label: "Done",
    color: "text-teal",
    dot: "bg-teal",
  },
  cancelled: {
    icon: XCircle,
    label: "Cancelled",
    color: "text-red-400",
    dot: "bg-red-400",
  },
};

export function ActivityFeed({ activities: initialActivities, familyId }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>(initialActivities);
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");

  const filtered = activities.filter((a) => {
    if (filter === "pending") return a.status === "pending" || a.status === "in_progress";
    if (filter === "done") return a.status === "done";
    return true;
  });

  async function markDone(id: string) {
    await fetch("/api/activities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "done" }),
    });
    setActivities((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "done" as const } : a))
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <h2 className="text-sm font-semibold text-text-primary mb-2">Activity</h2>
        <div className="flex gap-1">
          {(["all", "pending", "done"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-lg text-xs capitalize transition-colors ${
                filter === f
                  ? "bg-teal-muted text-teal font-medium"
                  : "text-text-muted hover:text-text-secondary hover:bg-surface-3"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Clock size={20} className="text-text-muted mb-2" />
            <p className="text-sm text-text-secondary">Nothing here yet</p>
            <p className="text-xs text-text-muted mt-1">Ask Kin to help with something</p>
          </div>
        ) : (
          filtered.map((activity) => (
            <ActivityItem
              key={activity.id}
              activity={activity}
              onMarkDone={markDone}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ActivityItem({
  activity,
  onMarkDone,
}: {
  activity: Activity;
  onMarkDone: (id: string) => void;
}) {
  const status = STATUS_CONFIG[activity.status];
  const StatusIcon = status.icon;
  const CategoryIcon = CATEGORY_ICONS[activity.category] ?? Sparkles;

  return (
    <div className="px-4 py-3 hover:bg-surface-2 transition-colors group">
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <CategoryIcon size={14} className="text-text-muted" />
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-sm leading-snug ${activity.status === "done" ? "text-text-muted line-through" : "text-text-primary"}`}>
            {activity.title}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <div className={`flex items-center gap-1 text-[10px] ${status.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot} ${activity.status === "in_progress" ? "animate-pulse" : ""}`} />
              {status.label}
            </div>
            <span className="text-[10px] text-text-muted">
              {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>

        {(activity.status === "pending" || activity.status === "in_progress") && (
          <button
            onClick={() => onMarkDone(activity.id)}
            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
            title="Mark done"
          >
            <CheckCircle2 size={16} className="text-text-muted hover:text-teal transition-colors" />
          </button>
        )}
      </div>
    </div>
  );
}
