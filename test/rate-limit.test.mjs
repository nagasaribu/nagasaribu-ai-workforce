import test from "node:test";
import assert from "node:assert/strict";
import { tryConsume } from "../src/rate-limit.ts";

test("rate limiter allows up to the configured maximum and then blocks", () => {
  const store = new Map();
  assert.equal(tryConsume(store, "user-1", 2, 1000, 100), true);
  assert.equal(tryConsume(store, "user-1", 2, 1000, 200), true);
  assert.equal(tryConsume(store, "user-1", 2, 1000, 300), false);
  assert.equal(tryConsume(store, "user-1", 2, 1000, 400), false);
});

test("rate limiter resets after the window and isolates keys", () => {
  const store = new Map();
  assert.equal(tryConsume(store, "user-1", 1, 1000, 100), true);
  assert.equal(tryConsume(store, "user-1", 1, 1000, 200), false);
  assert.equal(tryConsume(store, "user-2", 1, 1000, 200), true);
  assert.equal(tryConsume(store, "user-1", 1, 1000, 1200), true);
});

test("rate limiter window is exact at the reset boundary", () => {
  const store = new Map();
  assert.equal(tryConsume(store, "key", 1, 1000, 0), true);
  assert.equal(tryConsume(store, "key", 1, 1000, 999), false);
  assert.equal(tryConsume(store, "key", 1, 1000, 1000), true);
});
