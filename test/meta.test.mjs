import test from "node:test";
import assert from "node:assert/strict";
import { getMetaStatus, runMeta } from "../src/providers/meta.ts";
import { ProviderError } from "../src/providers/deepseek.ts";

const INPUT = {
  systemPrompt: "Anda ialah pembantu ujian.",
  prompt: "Sahkan saluran Muse Spark.",
  maxTokens: 100,
};

function metaResponse(content = "Muse Spark berfungsi.") {
  return {
    id: "resp-meta-1",
    object: "response",
    output: [
      {
        type: "reasoning",
        id: "reason-1",
        summary: [],
        encrypted_content: "ENCRYPTED_REASONING_MUST_NOT_LEAK",
      },
      {
        type: "message",
        id: "msg-1",
        role: "assistant",
        content: [{ type: "output_text", text: content }],
      },
    ],
    usage: { input_tokens: 20, output_tokens: 10, total_tokens: 30 },
  };
}

test("Muse Spark is unavailable without META_MODEL_API_KEY", async () => {
  const status = getMetaStatus({});
  assert.equal(status.available, false);
  assert.equal(status.reason, "missing_api_key");

  let called = false;
  await assert.rejects(
    runMeta({}, INPUT, async () => {
      called = true;
      throw new Error("network must not be used");
    }),
    (error) => error instanceof ProviderError && error.code === "missing_api_key",
  );
  assert.equal(called, false);
});

test("Meta Responses request uses reasoning, encrypted content and store=false", async () => {
  let captured;
  const result = await runMeta(
    {
      META_MODEL_API_KEY: "meta-secret",
      META_BASE_URL: "https://api.meta.test/v1",
      META_MODEL: "muse-spark-1.3",
    },
    INPUT,
    async (url, init) => {
      captured = { url, init };
      return new Response(JSON.stringify(metaResponse()), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  );

  assert.equal(captured.url, "https://api.meta.test/v1/responses");
  assert.equal(captured.init.method, "POST");
  assert.equal(captured.init.headers.authorization, "Bearer meta-secret");
  const body = JSON.parse(captured.init.body);
  assert.equal(body.model, "muse-spark-1.3");
  assert.equal(body.reasoning.effort, "high");
  assert.equal(body.reasoning.summary, "auto");
  assert.deepEqual(body.include, ["reasoning.encrypted_content"]);
  assert.equal(body.store, false);
  assert.equal(body.max_output_tokens, 100);
  assert.equal(body.input[0].role, "system");
  assert.equal(body.input[1].role, "user");
  assert.equal(body.input[1].content[0].text, INPUT.prompt);

  assert.equal(result.content, "Muse Spark berfungsi.");
  assert.equal(result.provider, "meta");
  assert.equal(result.model, "muse-spark-1.3");
  assert.equal(result.requestId, "resp-meta-1");
  assert.deepEqual(result.usage, { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 });
  assert.doesNotMatch(JSON.stringify(result), /ENCRYPTED_REASONING_MUST_NOT_LEAK/);
});

test("Meta output falls back to output_text when output items are unavailable", async () => {
  const result = await runMeta(
    { META_MODEL_API_KEY: "test", META_BASE_URL: "https://api.meta.test/v1" },
    { ...INPUT, maxTokens: undefined },
    async () =>
      new Response(JSON.stringify({ id: "resp-2", output_text: "Teks mudah.", usage: {} }), {
        status: 200,
      }),
  );
  assert.equal(result.content, "Teks mudah.");
});

test("Meta authentication errors are not retryable and never leak the key", async () => {
  await assert.rejects(
    runMeta(
      { META_MODEL_API_KEY: "super-secret", META_BASE_URL: "https://api.meta.test/v1" },
      INPUT,
      async () => new Response("unauthorized", { status: 401 }),
    ),
    (error) => {
      assert.ok(error instanceof ProviderError);
      assert.equal(error.code, "provider_auth_error");
      assert.equal(error.retryable, false);
      assert.equal(error.provider, "meta");
      assert.doesNotMatch(error.message, /super-secret/);
      return true;
    },
  );
});

test("Meta 429 and 5xx errors are retryable", async () => {
  for (const status of [429, 500, 502]) {
    await assert.rejects(
      runMeta(
        { META_MODEL_API_KEY: "test", META_BASE_URL: "https://api.meta.test/v1" },
        INPUT,
        async () => new Response("temporary", { status }),
      ),
      (error) => {
        assert.ok(error instanceof ProviderError);
        assert.equal(error.retryable, true);
        assert.equal(error.providerStatus, status);
        return true;
      },
    );
  }
});

test("Meta timeouts and network failures are retryable", async () => {
  for (const name of ["AbortError", "TypeError"]) {
    await assert.rejects(
      runMeta(
        { META_MODEL_API_KEY: "test", META_BASE_URL: "https://api.meta.test/v1" },
        INPUT,
        async () => {
          const error = new Error("failed");
          error.name = name;
          throw error;
        },
      ),
      (error) => {
        assert.ok(error instanceof ProviderError);
        assert.equal(error.retryable, true);
        assert.equal(error.provider, "meta");
        return true;
      },
    );
  }
});

test("Meta invalid responses are rejected without retry", async () => {
  await assert.rejects(
    runMeta(
      { META_MODEL_API_KEY: "test", META_BASE_URL: "https://api.meta.test/v1" },
      INPUT,
      async () => new Response(JSON.stringify({ output: [] }), { status: 200 }),
    ),
    (error) =>
      error instanceof ProviderError &&
      error.code === "provider_invalid_response" &&
      error.retryable === false,
  );
});
