import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { extractSubject, findMatches, wantsWholeSeries } from "../lib/event-match.ts";

const events = [
  { id: "1", title: "Dentist — Maya", start_time: "2026-11-13T20:00:00Z" },
  { id: "2", title: "Soccer practice", start_time: "2026-11-13T23:00:00Z" },
  { id: "3", title: "Lawn care", start_time: "2026-11-12T15:00:00Z",
    recurrence_id: "r1", recurrence_rule: "every Thursday" },
  { id: "4", title: "Lawn care", start_time: "2026-11-19T15:00:00Z",
    recurrence_id: "r1", recurrence_rule: "every Thursday" },
  { id: "5", title: "Vet — Biscuit", start_time: "2026-11-20T21:00:00Z" },
];

describe("extractSubject", () => {
  test("strips the instruction and leaves the thing", () => {
    assert.equal(extractSubject("cancel the dentist"), "dentist");
    assert.equal(extractSubject("delete the lawn care"), "lawn care");
    assert.equal(extractSubject("move soccer to friday"), "soccer");
  });

  test("strips dates and times too", () => {
    assert.equal(extractSubject("cancel the dentist on friday"), "dentist");
    assert.equal(extractSubject("change the dentist to 3pm"), "dentist");
    assert.equal(extractSubject("push the vet appointment to next week"), "vet");
    assert.equal(extractSubject("move soccer practice to tomorrow at 5pm"), "soccer practice");
  });

  test("returns empty when the message names nothing — ask, don't guess", () => {
    assert.equal(extractSubject("cancel it"), "");
    assert.equal(extractSubject("never mind"), "");
    assert.equal(extractSubject("move that to friday"), "");
  });
});

describe("findMatches", () => {
  test("finds one by a single word", () => {
    const m = findMatches(events, "dentist");
    assert.equal(m.length, 1);
    assert.equal(m[0].id, "1");
  });

  test("returns every occurrence of a repeating run", () => {
    const m = findMatches(events, "lawn care");
    assert.equal(m.length, 2);
    assert.deepEqual(m.map((e) => e.id), ["3", "4"]);
  });

  test("soonest first, so acting on one means the next one", () => {
    const m = findMatches(events, "lawn care");
    assert.ok(m[0].start_time < m[1].start_time);
  });

  test("prefers the title that accounts for more of the subject", () => {
    const withExtra = [...events, { id: "6", title: "Care home visit", start_time: "2026-11-14T10:00:00Z" }];
    const m = findMatches(withExtra, "lawn care");
    // "Care home visit" shares only "care"; the lawn rows hit both words.
    assert.deepEqual(m.map((e) => e.id), ["3", "4"]);
  });

  test("no match is empty, not a wrong guess", () => {
    assert.deepEqual(findMatches(events, "piano lesson"), []);
  });

  test("ignores words too short to mean anything", () => {
    assert.deepEqual(findMatches(events, "to a"), []);
  });
});

describe("wantsWholeSeries", () => {
  test("spots a request about the standing arrangement", () => {
    for (const m of ["cancel all lawn care", "stop the lawn care", "cancel every lawn care", "delete the whole series"]) {
      assert.equal(wantsWholeSeries(m), true, m);
    }
  });

  test("a plain cancel means one occurrence", () => {
    assert.equal(wantsWholeSeries("cancel the lawn care"), false);
    assert.equal(wantsWholeSeries("cancel the dentist on friday"), false);
  });
});
