import test from "node:test";
import assert from "node:assert/strict";
import { getRouterStatus, generateWithFallback } from "../src/providers/router.ts";
import { ProviderError } from "../src/providers/deepseek.ts";

const INPUT = {
  systemPrompt: "Anda ialah ejen ujian.",
  prompt: "Hasilkan ringkasan ringkas.",
  maxTokens: 100,
};

const ENV = {
  DEEPSEEK_API_KEY: "deepseek-key",
  DEEPSEEK_BASE_URL: "https://api.deepseek.test",
  META_MODEL_API_KEY: "meta-key",
  META_BASE_URL: "https://api.meta.test/v1",
  META_MODEL: "muse-spark-1.3",
};

const deepseekSuccess = () => ({
  id: "ds-1",
  choices: [{ message: { content: "Jawapan DeepSeek." } }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
});

const metaSuccess = () => ({
  id: "meta-1",
  output: [{ type: "message", content: [{ type: "output_text", text: "Jawapan Muse Spark." }] }],
  usage: { input_tokens: 20, output_tokens: 8, total_tokens: 28 },
});

function responseJson(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function fetchRouter(handlers) {
  const calls = { deepseek: 0, meta: 0 };
  const impl = async (url, init) => {
    if (url.includes("api.deepseek.test")) {
      calls.deepseek += 1;
      return handlers.deepseek(url, init);
    }
    if (url.includes("api.meta.test")) {
      calls.meta += 1;
      return handlers.meta(url, init);
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
  return { impl, calls };
}

test("router status reports DeepSeek primary and Muse Spark backup", () => {
  const status = getRouterStatus(ENV);
  assert.equal(status.primary.provider, "deepseek");
  assert.equal(status.primary.mode, "live");
  assert.equal(status.backup.provider, "meta");
  assert.equal(status.backup.available, true);
  assert.equal(status.active, "deepseek");
  assert.equal(status.fallbackEnabled, true);
});

test("router status does not claim an active provider when DeepSeek has no key", () => {
  const status = getRouterStatus({ META_MODEL_API_KEY: "meta-key" });
  assert.equal(status.primary.mode, "mock");
  assert.equal(status.active, "none");
  assert.equal(status.backup.available, true);
});

test("DeepSeek remains the primary provider when it succeeds", async () => {
  const { impl, calls } = fetchRouter({
    deepseek: async () => responseJson(deepseekSuccess()),
    meta: async () => responseJson(metaSuccess()),
  });
  const result = await generateWithFallback(ENV, INPUT, impl);
  assert.equal(result.provider, "deepseek");
  assert.equal(result.fallback, false);
  assert.equal(result.content, "Jawapan DeepSeek.");
  assert.equal(result.usage.total_tokens, 15);
  assert.equal(calls.deepseek, 1);
  assert.equal(calls.meta, 0);
});

test("DeepSeek timeout falls back to Muse Spark exactly once", async () => {
  const { impl, calls } = fetchRouter({
    deepseek: async () => {
      const error = new Error("timed out");
      error.name = "AbortError";
      throw error;
    },
    meta: async () => responseJson(metaSuccess()),
  });
  const result = await generateWithFallback(ENV, INPUT, impl);
  assert.equal(result.provider, "meta");
  assert.equal(result.fallback, true);
  assert.equal(result.fallbackReason, "provider_timeout");
  assert.equal(result.content, "Jawapan Muse Spark.");
  assert.equal(result.usage.total_tokens, 28);
  assert.equal(calls.deepseek, 1);
  assert.equal(calls.meta, 1);
});

test("DeepSeek HTTP 429 and 5xx failures fall back to Muse Spark", async () => {
  for (const status of [429, 500, 503]) {
    const { impl, calls } = fetchRouter({
      deepseek: async () => new Response("temporary", { status }),
      meta: async () => responseJson(metaSuccess()),
    });
    const result = await generateWithFallback(ENV, INPUT, impl);
    assert.equal(result.provider, "meta");
    assert.equal(result.fallback, true);
    assert.equal(calls.deepseek, 1);
    assert.equal(calls.meta, 1);
  }
});

test("DeepSeek authentication and invalid request errors do not fall back", async () => {
  for (const status of [401, 403, 400, 404]) {
    const { impl, calls } = fetchRouter({
      deepseek: async () => new Response("error", { status }),
      meta: async () => responseJson(metaSuccess()),
    });
    await assert.rejects(
      generateWithFallback(ENV, INPUT, impl),
      (error) => {
        assert.ok(error instanceof ProviderError);
        assert.equal(error.retryable, false);
        assert.equal(error.provider, "deepseek");
        return true;
      },
    );
    assert.equal(calls.deepseek, 1);
    assert.equal(calls.meta, 0);
  }
});

test("Muse authentication errors are surfaced and not retried", async () => {
  const { impl, calls } = fetchRouter({
    deepseek: async () => new Response("temporary", { status: 503 }),
    meta: async () => new Response("unauthorized", { status: 401 }),
  });
  await assert.rejects(
    generateWithFallback(ENV, INPUT, impl),
    (error) => {
      assert.ok(error instanceof ProviderError);
      assert.equal(error.code, "provider_auth_error");
      assert.equal(error.provider, "meta");
      assert.equal(error.fallbackAttempted, true);
      assert.equal(error.fallbackReason, "provider_http_error");
      return true;
    },
  );
  assert.equal(calls.deepseek, 1);
  assert.equal(calls.meta, 1);
});

test("both providers unavailable surfaces the primary transient failure", async () => {
  const { impl, calls } = fetchRouter({
    deepseek: async () => new Response("temporary", { status: 503 }),
    meta: async () => responseJson(metaSuccess()),
  });
  const envWithoutMeta = { ...ENV, META_MODEL_API_KEY: "" };
  await assert.rejects(
    generateWithFallback(envWithoutMeta, INPUT, impl),
    (error) => {
      assert.ok(error instanceof ProviderError);
      assert.equal(error.code, "provider_http_error");
      assert.equal(error.provider, "deepseek");
      assert.equal(error.fallbackAttempted, false);
      assert.equal(error.fallbackReason, "backup_unavailable");
      return true;
    },
  );
  assert.equal(calls.deepseek, 1);
  assert.equal(calls.meta, 0);
});

test("Muse fallback failure is recorded once without a second retry", async () => {
  const { impl, calls } = fetchRouter({
    deepseek: async () => new Response("temporary", { status: 503 }),
    meta: async () => new Response("temporary", { status: 503 }),
  });
  await assert.rejects(
    generateWithFallback(ENV, INPUT, impl),
    (error) => {
      assert.ok(error instanceof ProviderError);
      assert.equal(error.provider, "meta");
      assert.equal(error.retryable, true);
      assert.equal(error.fallbackAttempted, true);
      return true;
    },
  );
  assert.equal(calls.deepseek, 1);
  assert.equal(calls.meta, 1);
});
