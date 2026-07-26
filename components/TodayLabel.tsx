"use client";

import { useEffect, useState } from "react";

// Rendered on the client so the date is the viewer's, not the server's (UTC).
export function TodayLabel({ className = "" }: { className?: string }) {
  const [today, setToday] = useState("");

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    );
  }, []);

  // Reserve the line's height before hydration so the header doesn't jump.
  return (
    <p className={`text-[11px] font-medium uppercase tracking-wider text-text-muted ${className}`}>
      {today || " "}
    </p>
  );
}
