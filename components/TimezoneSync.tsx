"use client";

import { useEffect } from "react";

/**
 * Records the household's timezone the first time a signed-in browser loads
 * the dashboard, so reminder emails can render times where the family
 * actually is rather than in Central.
 *
 * Capture-once: it sends `onlyIfMissing`, so a zone that has been set stays
 * set — a week abroad shouldn't quietly rewrite where a family lives. Renders
 * nothing and never blocks the page; if the request fails, the fallback zone
 * is still correct for most of the current users.
 */
export function TimezoneSync({ hasTimezone }: { hasTimezone: boolean }) {
  useEffect(() => {
    if (hasTimezone) return;

    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone) return;

    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "timezone", timezone: zone, onlyIfMissing: true }),
    }).catch(() => {
      /* best effort — the reminder falls back to the default zone */
    });
  }, [hasTimezone]);

  return null;
}
