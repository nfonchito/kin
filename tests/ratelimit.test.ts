import { test } from "node:test";
import assert from "node:assert/strict";
import { rateLimit, resetRateLimits, MAX_REQUESTS } from "../lib/ratelimit.ts";

test("allows up to the ceiling, then blocks", () => {
  resetRateLimits();
  for (let i = 0; i < MAX_REQUESTS; i++) {
    assert.equal(rateLimit("u1").ok, true, `request ${i + 1} should be allowed`);
  }
  const over = rateLimit("u1");
  assert.equal(over.ok, false);
  assert.ok(over.retryAfterSeconds > 0, "a blocked caller is told when to retry");
});

test("one noisy caller cannot affect another", () => {
  resetRateLimits();
  for (let i = 0; i < MAX_REQUESTS + 5; i++) rateLimit("noisy");
  assert.equal(rateLimit("quiet").ok, true);
});

test("the window expires", async () => {
  resetRateLimits();
  for (let i = 0; i < MAX_REQUESTS; i++) rateLimit("u3", { windowMs: 40 });
  assert.equal(rateLimit("u3", { windowMs: 40 }).ok, false);
  await new Promise((r) => setTimeout(r, 70));
  assert.equal(rateLimit("u3", { windowMs: 40 }).ok, true);
});
