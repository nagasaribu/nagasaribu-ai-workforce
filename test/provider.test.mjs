import test from "node:test";
import assert from "node:assert/strict";
import {
  getProviderStatus,
  ProviderError,
  runDeepSeek,
} from "../src/providers/deepseek.ts";

const INPUT = {
  systemPrompt: "Anda ialah ejen ujian.",
  prompt: "Sediakan ringkasan operasi.",
};

test("missing credentials force mock mode", () => {
  const status = getProviderStatus({});
  assert.equal(status.mode, "mock");
  assert.equal(status.configured, false);
  assert.equal(status.reason, "missing_api_key");
});

test("AI_MODE=mock forces mock mode even when a key exists", () => {
  const status = getProviderStatus({ DEEPSEEK_API_KEY: "test-key", AI_MODE: "mock" });
  assert.equal(status.mode, "mock");
  assert.equal(status.configured, true);
  assert.equal(status.reason, "forced_mock");
});

test("mock execution never calls the provider and is labelled clearly", async () => {
  let called = false;
  const result = await runDeepSeek({}, INPUT, async () => {
    called = true;
    throw new Error("network must not be used");
  });

  assert.equal(called, false);
  assert.equal(result.mode, "mock");
  assert.match(result.content, /\[MOD MOCK\]/);
  assert.match(result.content, /Tiada panggilan kepada DeepSeek/);
});

test("live execution sends a secure request and parses the response", async () => {
  let captured;
  const result = await runDeepSeek(
    {
      DEEPSEEK_API_KEY: "secret-key-value",
      DEEPSEEK_BASE_URL: "https://api.deepseek.test",
      DEEPSEEK_MODEL: "deepseek-chat",
    },
    { ...INPUT, maxTokens: 100 },
    async (url, init) => {
      captured = { url, init };
      return new Response(
        JSON.stringify({
          id: "req-123",
          choices: [{ message: { content: "Ringkasan operasi selesai." } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  );

  assert.equal(result.mode, "live");
  assert.equal(result.content, "Ringkasan operasi selesai.");
  assert.equal(result.requestId, "req-123");
  assert.equal(result.usage.total_tokens, 15);
  assert.equal(captured.url, "https://api.deepseek.test/chat/completions");
  assert.equal(captured.init.method, "POST");
  assert.equal(captured.init.headers.authorization, "Bearer secret-key-value");
  const body = JSON.parse(captured.init.body);
  assert.equal(body.model, "deepseek-chat");
  assert.equal(body.max_tokens, 100);
  assert.equal(body.stream, false);
  assert.equal(body.messages[0].role, "system");
  assert.equal(body.messages[1].content, INPUT.prompt);
});

test("provider HTTP errors are sanitized and never include the API key", async () => {
  await assert.rejects(
    runDeepSeek(
      { DEEPSEEK_API_KEY: "super-secret-key", DEEPSEEK_BASE_URL: "https://api.deepseek.test" },
      INPUT,
      async () => new Response("provider body with details", { status: 401 }),
    ),
    (error) => {
      assert.ok(error instanceof ProviderError);
      assert.equal(error.code, "provider_http_error");
      assert.match(error.message, /status 401/);
      assert.doesNotMatch(error.message, /super-secret-key/);
      return true;
    },
  );
});

test("invalid provider responses are rejected", async () => {
  await assert.rejects(
    runDeepSeek(
      { DEEPSEEK_API_KEY: "test-key", DEEPSEEK_BASE_URL: "https://api.deepseek.test" },
      INPUT,
      async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }),
    ),
    (error) => error instanceof ProviderError && error.code === "provider_invalid_response",
  );
});

test("timeouts are reported as provider timeouts", async () => {
  await assert.rejects(
    runDeepSeek(
      { DEEPSEEK_API_KEY: "test-key", DEEPSEEK_BASE_URL: "https://api.deepseek.test" },
      INPUT,
      async () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        throw error;
      },
    ),
    (error) => error instanceof ProviderError && error.code === "provider_timeout",
  );
});

test("plain HTTP endpoints are rejected for live execution", async () => {
  await assert.rejects(
    runDeepSeek(
      { DEEPSEEK_API_KEY: "test-key", DEEPSEEK_BASE_URL: "http://api.deepseek.test" },
      INPUT,
      async () => new Response("{}", { status: 200 }),
    ),
    (error) => error instanceof ProviderError && error.code === "invalid_base_url",
  );
});
