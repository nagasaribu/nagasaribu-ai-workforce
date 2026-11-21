import test from "node:test";
import assert from "node:assert/strict";
import { getSearchStatus, searchExa, SearchError } from "../src/providers/exa.ts";

test("missing Exa credentials report search unavailable and never call the network", async () => {
  const status = getSearchStatus({});
  assert.equal(status.available, false);
  assert.equal(status.reason, "missing_api_key");

  let called = false;
  await assert.rejects(
    searchExa({}, { query: "test" }, async () => {
      called = true;
      throw new Error("network must not be used");
    }),
    (error) => error instanceof SearchError && error.code === "search_unavailable",
  );
  assert.equal(called, false);
});

test("Exa search sends the expected request and normalizes results", async () => {
  let captured;
  const response = await searchExa(
    {
      EXA_API_KEY: "exa-secret",
      EXA_BASE_URL: "https://api.exa.test",
    },
    { query: "kontraktor binaan Kuala Lumpur", numResults: 10 },
    async (url, init) => {
      captured = { url, init };
      return new Response(
        JSON.stringify({
          requestId: "exa-req-1",
          results: [
            {
              title: "Alpha Construction",
              url: "https://alpha.test/about",
              publishedDate: "2026-01-01",
              text: "Kontraktor binaan di Kuala Lumpur. info@alpha.test",
            },
            { title: "Invalid", url: "javascript:alert(1)" },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  );

  assert.equal(captured.url, "https://api.exa.test/search");
  assert.equal(captured.init.method, "POST");
  assert.equal(captured.init.headers["x-api-key"], "exa-secret");
  const body = JSON.parse(captured.init.body);
  assert.equal(body.query, "kontraktor binaan Kuala Lumpur");
  assert.equal(body.numResults, 5, "initial testing must cap results at 5");
  assert.equal(body.type, "auto");
  assert.equal(body.contents.highlights, true);

  assert.equal(response.requestId, "exa-req-1");
  assert.equal(response.results.length, 1, "unsafe URLs must be filtered");
  assert.equal(response.results[0].title, "Alpha Construction");
});

test("Exa HTTP errors are sanitized and never include the key", async () => {
  await assert.rejects(
    searchExa(
      { EXA_API_KEY: "super-secret", EXA_BASE_URL: "https://api.exa.test" },
      { query: "test" },
      async () => new Response("provider details", { status: 429 }),
    ),
    (error) => {
      assert.ok(error instanceof SearchError);
      assert.equal(error.code, "search_http_error");
      assert.match(error.message, /status 429/);
      assert.doesNotMatch(error.message, /super-secret/);
      return true;
    },
  );
});

test("invalid Exa keys are reported without leaking the key", async () => {
  await assert.rejects(
    searchExa(
      { EXA_API_KEY: "invalid-key-value", EXA_BASE_URL: "https://api.exa.test" },
      { query: "test" },
      async () => new Response(JSON.stringify({ error: "invalid api key" }), { status: 401 }),
    ),
    (error) => {
      assert.ok(error instanceof SearchError);
      assert.equal(error.code, "search_http_error");
      assert.doesNotMatch(error.message, /invalid-key-value/);
      return true;
    },
  );
});

test("Exa invalid responses and timeouts are rejected safely", async () => {
  await assert.rejects(
    searchExa(
      { EXA_API_KEY: "test", EXA_BASE_URL: "https://api.exa.test" },
      { query: "test" },
      async () => new Response(JSON.stringify({ nope: true }), { status: 200 }),
    ),
    (error) => error instanceof SearchError && error.code === "search_invalid_response",
  );

  await assert.rejects(
    searchExa(
      { EXA_API_KEY: "test", EXA_BASE_URL: "https://api.exa.test" },
      { query: "test" },
      async () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        throw error;
      },
    ),
    (error) => error instanceof SearchError && error.code === "search_timeout",
  );
});

test("plain HTTP Exa endpoints are rejected", async () => {
  await assert.rejects(
    searchExa(
      { EXA_API_KEY: "test", EXA_BASE_URL: "http://api.exa.test" },
      { query: "test" },
      async () => new Response("{}", { status: 200 }),
    ),
    (error) => error instanceof SearchError && error.code === "invalid_base_url",
  );
});
