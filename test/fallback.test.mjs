import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { MockAgent } from "undici";

const ORIGIN = "https://occ.test";
const SESSION_SECRET = "fallback-test-secret-0123456789";

let mf;
let adminToken = null;

before(async () => {
  const bundled = await build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es2022",
    write: false,
    logLevel: "silent",
  });

  const mock = new MockAgent();
  mock.disableNetConnect();
  mock
    .get("https://api.deepseek.test")
    .intercept({ path: "/chat/completions", method: "POST" })
    .reply(503, "temporary upstream failure");
  mock
    .get("https://api.meta.test")
    .intercept({ path: "/v1/responses", method: "POST" })
    .reply(200, {
      id: "resp-fallback-1",
      output: [
        {
          type: "reasoning",
          encrypted_content: "ENCRYPTED_REASONING_MUST_NOT_LEAK",
        },
        {
          type: "message",
          content: [{ type: "output_text", text: "Jawapan sandaran Muse Spark." }],
        },
      ],
      usage: { input_tokens: 20, output_tokens: 8, total_tokens: 28 },
    });
  mock
    .get("https://api.meta.test")
    .intercept({ path: "/v1/responses", method: "POST" })
    .reply(200, {
      id: "resp-verify-1",
      status: "completed",
      output: [
        {
          type: "reasoning",
          encrypted_content: "ENCRYPTED_REASONING_MUST_NOT_LEAK",
        },
        {
          type: "message",
          content: [{ type: "output_text", text: "Muse Spark backup verification berjaya." }],
        },
      ],
      usage: {
        input_tokens: 20,
        output_tokens: 10,
        total_tokens: 30,
        output_tokens_details: { reasoning_tokens: 5 },
      },
    });

  mf = new Miniflare({
    modules: true,
    script: bundled.outputFiles[0].text,
    compatibilityDate: "2025-01-01",
    d1Databases: { DB: "fallback-test-db" },
    bindings: {
      APP_ENV: "test",
      SESSION_SECRET,
      DEEPSEEK_API_KEY: "deepseek-test-key",
      DEEPSEEK_BASE_URL: "https://api.deepseek.test",
      META_MODEL_API_KEY: "meta-test-key",
      META_BASE_URL: "https://api.meta.test/v1",
    },
    fetchMock: mock,
  });

  const db = await mf.getD1Database("DB");
  const migrationFiles = (await readdir("migrations")).filter((file) => file.endsWith(".sql")).sort();
  for (const file of migrationFiles) {
    const migration = await readFile(`migrations/${file}`, "utf8");
    const statements = migration
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of statements) await db.prepare(statement).run();
  }

  const setup = await call("/api/auth/setup", {
    method: "POST",
    body: {
      name: "Fallback Admin",
      email: "fallback-admin@example.test",
      password: "CorrectHorseBattery1!",
    },
  });
  assert.equal(setup.status, 201);
  adminToken = tokenFromCookie(setup);
});

after(async () => {
  await mf?.dispose();
});

async function call(path, options = {}) {
  const headers = new Headers();
  if (options.body !== undefined) headers.set("content-type", "application/json");
  if (options.token) headers.set("authorization", `Bearer ${options.token}`);
  const response = await mf.dispatchFetch(`${ORIGIN}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: response.status, data, headers: response.headers };
}

function tokenFromCookie(response) {
  const setCookie = response.headers.get("set-cookie") ?? "";
  const match = /occ_session=([^;]+)/.exec(setCookie);
  return match ? decodeURIComponent(match[1]) : null;
}

test("DeepSeek transient failure falls back to Muse Spark and records provider telemetry", async () => {
  const agent = await call("/api/agents", {
    method: "POST",
    token: adminToken,
    body: { name: "Fallback Agent", kind: "test", capabilities: ["test"] },
  });
  assert.equal(agent.status, 201);

  const task = await call("/api/tasks", {
    method: "POST",
    token: adminToken,
    body: {
      title: "Ujian fallback penyedia",
      description: "Uji laluan sandaran Muse Spark.",
      assignedAgentId: agent.data.agent.id,
    },
  });
  assert.equal(task.status, 201);

  const executed = await call(`/api/tasks/${task.data.task.id}/execute`, {
    method: "POST",
    token: adminToken,
    body: {},
  });
  assert.equal(executed.status, 200);
  assert.equal(executed.data.execution.provider, "meta");
  assert.equal(executed.data.execution.fallback, true);
  assert.equal(executed.data.execution.fallbackReason, "provider_http_error");
  assert.equal(executed.data.execution.mode, "live");
  assert.equal(executed.data.execution.model, "muse-spark-1.3");
  assert.equal(executed.data.execution.usage.total_tokens, 28);
  assert.equal(executed.data.task.provider, "meta");
  assert.equal(executed.data.task.provider_model, "muse-spark-1.3");
  assert.equal(executed.data.task.fallback_used, 1);
  assert.equal(executed.data.task.fallback_reason, "provider_http_error");
  assert.equal(executed.data.task.execution_state, "completed");
  assert.equal(executed.data.task.result, "Jawapan sandaran Muse Spark.");
  assert.doesNotMatch(JSON.stringify(executed.data), /ENCRYPTED_REASONING_MUST_NOT_LEAK/);

  const detail = await call(`/api/tasks/${task.data.task.id}`, { token: adminToken });
  assert.equal(detail.status, 200);
  const eventTypes = detail.data.events.map((event) => event.event_type);
  assert.ok(eventTypes.includes("provider_fallback"));
  assert.ok(eventTypes.includes("execution_completed"));
  const completed = detail.data.events.find((event) => event.event_type === "execution_completed");
  assert.equal(completed.metadata.provider, "meta");
  assert.equal(completed.metadata.fallback, true);

  const verification = await call("/api/ai/providers/test", {
    method: "POST",
    token: adminToken,
    body: {
      provider: "meta",
      maxTokens: 1024,
      reasoningEffort: "minimal",
      prompt: "Reply in Bahasa Melayu with exactly:\nMuse Spark backup verification berjaya.",
      expectedText: "Muse Spark backup verification berjaya.",
    },
  });
  assert.equal(verification.status, 200);
  assert.equal(verification.data.content, "Muse Spark backup verification berjaya.");
  assert.equal(verification.data.responseStatus, "completed");
  assert.equal(verification.data.expectedMatched, true);
  assert.equal(verification.data.usage.total_tokens, 30);
  assert.equal(verification.data.usage.reasoning_tokens, 5);
  assert.doesNotMatch(JSON.stringify(verification.data), /ENCRYPTED_REASONING_MUST_NOT_LEAK/);

  const health = await call("/health");
  assert.equal(health.data.checks.backup, "live");

  const aiStatus = await call("/api/ai/status", { token: adminToken });
  assert.equal(aiStatus.data.backup.verified, true);
  assert.equal(aiStatus.data.backup.status, "live");
  assert.equal(aiStatus.data.active, "deepseek");

  const dashboard = await call("/api/dashboard", { token: adminToken });
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.data.providers.primary.provider, "deepseek");
  assert.equal(dashboard.data.providers.primary.mode, "live");
  assert.equal(dashboard.data.providers.backup.provider, "meta");
  assert.equal(dashboard.data.providers.backup.available, true);
  assert.equal(dashboard.data.providers.backup.verified, true);
  assert.equal(dashboard.data.providers.backup.status, "live");
  assert.equal(dashboard.data.providers.active, "deepseek");
  assert.equal(dashboard.data.providers.fallbackEnabled, true);
  assert.equal(dashboard.data.usage.metaTokens, 58);
  assert.equal(dashboard.data.usage.reasoningTokens, 5);
  assert.equal(dashboard.data.usage.fallbackEvents, 1);
  assert.equal(dashboard.data.execution.fallbacks, 1);

  const logs = await call("/api/audit-logs?limit=200", { token: adminToken });
  const actions = logs.data.logs.map((entry) => entry.action);
  assert.ok(actions.includes("task.provider_fallback"));
  assert.ok(actions.includes("task.execute"));
  assert.ok(actions.includes("ai.provider_test"));
});
