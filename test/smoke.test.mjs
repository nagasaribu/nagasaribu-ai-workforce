import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.ts";

const env = { APP_ENV: "test" };

const get = (path) =>
  worker.fetch(new Request(`https://example.com${path}`), env);

test("GET / returns service metadata", async () => {
  const res = await get("/");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /application\/json/);
  assert.equal(res.headers.get("cache-control"), "no-store");

  const body = await res.json();
  assert.equal(body.name, "NAGASARIBU AI WORKFORCE");
  assert.equal(body.phase, 1);
  assert.equal(body.health, "/health");
});

test("GET /health returns healthy foundation status", async () => {
  const res = await get("/health");
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.service, "nagasaribu-ai-workforce");
  assert.equal(body.phase, 1);
  assert.equal(body.status, "foundation");
  assert.equal(body.environment, "test");
});

test("unknown paths and methods return 404", async () => {
  const notFound = await get("/missing");
  assert.equal(notFound.status, 404);
  assert.deepEqual(await notFound.json(), { error: "Not found" });

  const post = await worker.fetch(
    new Request("https://example.com/", { method: "POST" }),
    env,
  );
  assert.equal(post.status, 404);
});
