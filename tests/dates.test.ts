import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  extractDateISO,
  friendlyWhen,
  expandOccurrences,
  calendarWindow,
  formatEventLine,
  shiftPreservingLocalTime,
  localDayDelta,
  localPartsIn,
  hasDateLike,
} from "../lib/dates.ts";

// US Central: getTimezoneOffset() reports +300 while on daylight time.
const TZ_OFFSET = 300;
const ZONE = "America/Chicago";

// Monday 12 October 2026, 10:00 local (Central).
const MONDAY_10AM = Date.parse("2026-10-12T15:00:00Z");

const realNow = Date.now;
function freeze(ts: number) {
  Date.now = () => ts;
}

const inZone = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: ZONE,
  });

const localTimes = (isos: string[]) =>
  new Set(
    isos.map((iso) =>
      new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: ZONE })
    )
  );

describe("extractDateISO", () => {
  beforeEach(() => freeze(MONDAY_10AM));
  afterEach(() => {
    Date.now = realNow;
  });

  test("tomorrow", () => {
    assert.match(extractDateISO("lawn care tomorrow", TZ_OFFSET)!, /^2026-10-13/);
  });

  test("tolerates misspellings — a real user typed three r's", () => {
    for (const typo of ["tomorrrow", "tommorow", "tmrw", "tmmr"]) {
      assert.match(
        extractDateISO("lawn care " + typo, TZ_OFFSET) ?? "",
        /^2026-10-13/,
        typo + " should resolve to tomorrow"
      );
    }
  });

  test("a named weekday means the next one", () => {
    assert.match(extractDateISO("dentist friday", TZ_OFFSET)!, /^2026-10-16/);
  });

  test("an explicit time is honoured in the caller's zone", () => {
    assert.equal(inZone(extractDateISO("dentist friday at 2pm", TZ_OFFSET)!), "Fri, Oct 16, 2:00 PM");
  });

  test("late at night, today does not roll into tomorrow", () => {
    // 11:47 PM Central on the 12th — this shipped wrong once.
    freeze(Date.parse("2026-10-13T04:47:00Z"));
    const local = inZone(extractDateISO("call the vet today", TZ_OFFSET)!);
    assert.ok(local.startsWith("Mon, Oct 12"), "expected still Monday, got " + local);
  });

  test("returns null when there is no date at all", () => {
    assert.equal(extractDateISO("book lawn care", TZ_OFFSET), null);
    assert.equal(hasDateLike("book lawn care", TZ_OFFSET), false);
  });
});

describe("friendlyWhen", () => {
  beforeEach(() => freeze(MONDAY_10AM));
  afterEach(() => {
    Date.now = realNow;
  });

  test("names the day rather than echoing the typo back", () => {
    assert.equal(friendlyWhen("lawn care tomorrrow", TZ_OFFSET), "tomorrow");
  });
});

describe("expandOccurrences", () => {
  // Thursdays at 9:00 AM Central, starting before the 1 November clock change.
  const FIRST = "2026-10-15T14:00:00.000Z";

  test("a weekly run holds its local time across the clock change", () => {
    const times = localTimes(expandOccurrences(FIRST, "every Thursday", TZ_OFFSET, ZONE));
    assert.deepEqual([...times], ["9:00 AM"], "a fixed offset would drift to 8:00 AM in November");
  });

  test("every occurrence lands on the same weekday", () => {
    const days = new Set(
      expandOccurrences(FIRST, "every Thursday", TZ_OFFSET, ZONE).map((iso) =>
        new Date(iso).toLocaleDateString("en-US", { weekday: "long", timeZone: ZONE })
      )
    );
    assert.deepEqual([...days], ["Thursday"]);
  });

  test("the first occurrence is the anchor itself", () => {
    assert.equal(expandOccurrences(FIRST, "every Thursday", TZ_OFFSET, ZONE)[0], FIRST);
  });

  test("without a zone it falls back to fixed-offset stepping", () => {
    const run = expandOccurrences(FIRST, "every Thursday", TZ_OFFSET);
    assert.ok(run.length > 1);
    assert.equal(new Date(run[1]).getTime() - new Date(run[0]).getTime(), 7 * 86400000);
  });
});

describe("calendarWindow", () => {
  beforeEach(() => freeze(MONDAY_10AM));
  afterEach(() => {
    Date.now = realNow;
  });

  const local = (iso: string) =>
    new Date(new Date(iso).getTime() - TZ_OFFSET * 60000).toISOString().slice(0, 16).replace("T", " ");

  test("today is the local day, not the UTC one", () => {
    const w = calendarWindow("what's on today", TZ_OFFSET);
    assert.equal(local(w.startISO), "2026-10-12 00:00");
    assert.equal(local(w.endISO), "2026-10-12 23:59");
    assert.equal(w.singleDay, true);
  });

  test("a bare weekday asked on that weekday means today", () => {
    assert.equal(calendarWindow("anything on monday", TZ_OFFSET).label, "today");
  });

  test("next friday skips the coming one", () => {
    assert.equal(local(calendarWindow("what's next friday", TZ_OFFSET).startISO), "2026-10-23 00:00");
  });

  test("an unqualified question means the week ahead", () => {
    const w = calendarWindow("show me the calendar", TZ_OFFSET);
    assert.equal(w.label, "the next 7 days");
    assert.equal(w.singleDay, false);
  });

  test("this weekend is Saturday and Sunday", () => {
    const w = calendarWindow("anything this weekend", TZ_OFFSET);
    assert.equal(local(w.startISO), "2026-10-17 00:00");
    assert.equal(local(w.endISO), "2026-10-18 23:59");
  });
});

describe("formatEventLine", () => {
  test("renders in the caller's offset", () => {
    assert.equal(formatEventLine("2026-10-13T19:00:00Z", TZ_OFFSET), "2:00 PM");
    assert.equal(
      formatEventLine("2026-10-13T19:00:00Z", TZ_OFFSET, { withDate: true }),
      "Tue, Oct 13 · 2:00 PM"
    );
  });
});

describe("shiftPreservingLocalTime", () => {
  // Thursdays 9:00 AM Central, spanning the 1 November change.
  const run = Array.from({ length: 8 }, (_, i) =>
    new Date(Date.UTC(2026, 9, 15 + i * 7, 14, 0)).toISOString()
  );

  test("moving a run keeps the wall time across a clock change", () => {
    const moved = run.map((iso) => shiftPreservingLocalTime(iso, 0, 10, 30, ZONE));
    assert.deepEqual(
      [...localTimes(moved)],
      ["10:30 AM"],
      "a millisecond delta gives 9:30 after 1 November"
    );
  });

  test("a day shift moves the whole run to the new weekday", () => {
    const moved = run.map((iso) => shiftPreservingLocalTime(iso, 2, 10, 30, ZONE));
    const days = new Set(
      moved.map((iso) => new Date(iso).toLocaleDateString("en-US", { weekday: "long", timeZone: ZONE }))
    );
    assert.deepEqual([...days], ["Saturday"]);
  });

  test("rolls over a month end", () => {
    const moved = shiftPreservingLocalTime("2026-10-30T14:00:00Z", 3, 9, 0, ZONE);
    assert.ok(inZone(moved).startsWith("Mon, Nov 2"), "got " + inZone(moved));
  });
});

describe("localDayDelta", () => {
  test("counts calendar days, not elapsed hours", () => {
    // 11pm Monday to 1am Tuesday is two hours but one calendar day.
    assert.equal(localDayDelta("2026-10-13T04:00:00Z", "2026-10-13T06:00:00Z", ZONE), 1);
  });

  test("is zero for a time-only move", () => {
    assert.equal(localDayDelta("2026-10-15T14:00:00Z", "2026-10-15T15:30:00Z", ZONE), 0);
  });

  test("localPartsIn reads the zone's wall clock", () => {
    const p = localPartsIn("2026-10-13T19:00:00Z", ZONE);
    assert.equal(p.hour, 14);
    assert.equal(p.day, 13);
  });
});
