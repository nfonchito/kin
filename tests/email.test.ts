import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { safeZone, formatEventTime, resolveRecipients } from "../lib/email.ts";

// The event actually on the live calendar when these were written.
const ISO = "2026-10-13T19:00:00+00:00";

describe("formatEventTime", () => {
  test("renders in the family's own zone", () => {
    assert.equal(formatEventTime(ISO, "America/Chicago"), "Tue, Oct 13 · 2:00 PM");
    assert.equal(formatEventTime(ISO, "America/Los_Angeles"), "Tue, Oct 13 · 12:00 PM");
    assert.equal(formatEventTime(ISO, "America/New_York"), "Tue, Oct 13 · 3:00 PM");
    assert.equal(formatEventTime(ISO, "Europe/London"), "Tue, Oct 13 · 8:00 PM");
  });

  test("far enough east the date rolls over too", () => {
    // The old Central-only rendering got the day wrong here, not just the hour.
    assert.equal(formatEventTime(ISO, "Asia/Tokyo"), "Wed, Oct 14 · 4:00 AM");
  });

  test("the zone carries daylight saving, not a frozen offset", () => {
    const january = "2026-01-13T19:00:00+00:00";
    assert.equal(formatEventTime(january, "America/Chicago"), "Tue, Jan 13 · 1:00 PM");
    assert.equal(formatEventTime(ISO, "America/Chicago"), "Tue, Oct 13 · 2:00 PM");
  });
});

describe("safeZone", () => {
  test("passes a real zone through", () => {
    assert.equal(safeZone("America/Denver"), "America/Denver");
  });

  test("falls back rather than throwing — a throw would kill the whole send", () => {
    assert.equal(safeZone(null), "America/Chicago");
    assert.equal(safeZone(undefined), "America/Chicago");
    assert.equal(safeZone("Not/AZone"), "America/Chicago");
    assert.equal(safeZone(""), "America/Chicago");
  });
});

describe("resolveRecipients", () => {
  test("the user gets it and the owner is copied", () => {
    assert.deepEqual(resolveRecipients("user@example.com", "owner@example.com"), {
      to: "user@example.com",
      bcc: "owner@example.com",
    });
  });

  test("no copy when the user is the owner", () => {
    assert.deepEqual(resolveRecipients("owner@example.com", "owner@example.com"), {
      to: "owner@example.com",
    });
  });

  test("case does not create a copy to the same inbox", () => {
    assert.deepEqual(resolveRecipients("Owner@Example.com", "owner@example.com"), {
      to: "Owner@Example.com",
    });
  });

  test("falls back to the owner when there is no user address", () => {
    assert.deepEqual(resolveRecipients(null, "owner@example.com"), { to: "owner@example.com" });
  });

  test("returns null when there is nobody to send to", () => {
    assert.equal(resolveRecipients(null, null), null);
  });
});
