import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { normalizeCommands } from "../lib/typos.ts";

describe("normalizeCommands", () => {
  test("repairs the instruction words that flip what Kin does", () => {
    // Each of these previously did the opposite of what was asked.
    assert.match(normalizeCommands("cancle the dentist"), /^cancel /);
    assert.match(normalizeCommands("delet the soccer"), /^delete /);
    assert.match(normalizeCommands("remvoe the lawn care"), /^remove /);
    assert.match(normalizeCommands("reschedlue the dentist"), /^reschedule /);
    assert.match(normalizeCommands("moove soccer to friday"), /^move /);
  });

  test("repairs 'every' so a repeat is still a repeat", () => {
    assert.match(normalizeCommands("soccer evry thursday"), /every thursday/);
    assert.match(normalizeCommands("lawn care everey thursday"), /every thursday/);
  });

  test("works mid-sentence for instructions near the front", () => {
    assert.match(normalizeCommands("can you cancle the dentist"), /cancel the dentist/);
    assert.match(normalizeCommands("please delet soccer"), /delete soccer/);
  });

  test("leaves correct words exactly as they were", () => {
    for (const m of [
      "cancel the dentist",
      "move soccer to friday",
      "lawn care every thursday",
      "remind me to pay the bill",
    ]) {
      assert.equal(normalizeCommands(m), m, m);
    }
  });

  test("does not turn ordinary words into instructions", () => {
    // Each of these is one or two edits from a command word.
    const dangerous: [string, RegExp][] = [
      ["movie night friday", /^movie night/],
      ["remote work thursday", /^remote work/],
      ["last chance to sign up", /chance/],
      ["evening swim", /^evening/],
      ["school event tuesday", /event/],
      ["Mover coming saturday", /Mover/i],
    ];
    for (const [input, stillThere] of dangerous) {
      assert.match(normalizeCommands(input), stillThere, input);
    }
  });

  test("preserves spacing and the rest of the message", () => {
    assert.equal(normalizeCommands("cancle  the   dentist"), "cancel  the   dentist");
  });
});
