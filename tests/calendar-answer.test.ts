import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatCalendarAnswer } from "../lib/calendar-answer.ts";

const TZ_OFFSET = 300; // US Central on daylight time

const dentist = { title: "Dentist", start_time: "2026-10-13T19:00:00+00:00" };
const lawn = { title: "Lawn care", start_time: "2026-10-16T14:00:00+00:00" };

describe("formatCalendarAnswer", () => {
  test("a single day lists times without repeating the date", () => {
    const out = formatCalendarAnswer([dentist], { label: "tomorrow", singleDay: true }, TZ_OFFSET);
    assert.match(out, /one thing tomorrow/);
    assert.match(out, /2:00 PM — Dentist/);
    assert.doesNotMatch(out, /Oct 13/, "a single-day answer should not repeat the date on each row");
  });

  test("a multi-day span carries the date on each row", () => {
    const out = formatCalendarAnswer([dentist, lawn], { label: "the next 7 days", singleDay: false }, TZ_OFFSET);
    assert.match(out, /2 things in the next 7 days/);
    assert.match(out, /Tue, Oct 13 · 2:00 PM — Dentist/);
    assert.match(out, /Fri, Oct 16 · 9:00 AM — Lawn care/);
  });

  test("picks its own preposition — 'in next week' is wrong", () => {
    const week = formatCalendarAnswer([dentist], { label: "next week", singleDay: false }, TZ_OFFSET);
    assert.match(week, /one thing next week/);
    assert.doesNotMatch(week, /in next week/);

    const seven = formatCalendarAnswer([dentist], { label: "the next 7 days", singleDay: false }, TZ_OFFSET);
    assert.match(seven, /in the next 7 days/);

    const friday = formatCalendarAnswer([dentist], { label: "Friday", singleDay: true }, TZ_OFFSET);
    assert.match(friday, /on Friday/);

    const today = formatCalendarAnswer([dentist], { label: "today", singleDay: true }, TZ_OFFSET);
    assert.match(today, /one thing today/);
    assert.doesNotMatch(today, /on today/);
  });

  test("an empty calendar says so and offers to fill it", () => {
    const out = formatCalendarAnswer([], { label: "this weekend", singleDay: false }, TZ_OFFSET);
    assert.match(out, /Nothing on your calendar this weekend/);
    assert.match(out, /\?$/, "an empty answer should end with an offer");
  });

  test("long stretches are trimmed rather than dumped", () => {
    const many = Array.from({ length: 14 }, (_, i) => ({
      title: "Thing " + (i + 1),
      start_time: new Date(Date.UTC(2026, 9, 19 + i, 14, 0)).toISOString(),
    }));
    const out = formatCalendarAnswer(many, { label: "next week", singleDay: false }, TZ_OFFSET);
    const rows = out.split("\n").filter((l) => l.startsWith("•"));
    assert.equal(rows.length, 8);
    assert.match(out, /and 6 more/);
    assert.match(out, /14 things/, "the count should still be the true total");
  });

  test("one event reads as 'one thing', not '1 things'", () => {
    const out = formatCalendarAnswer([dentist], { label: "today", singleDay: true }, TZ_OFFSET);
    assert.match(out, /one thing/);
    assert.doesNotMatch(out, /1 things/);
  });
});
