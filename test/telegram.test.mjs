import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { build } from "esbuild";
import { Miniflare } from "miniflare";

const SESSION_SECRET = "telegram-integration-secret-0123456789";
const WEBHOOK_SECRET = "telegram-webhook-secret-0123456789";
const BOT_TOKEN = "123456:TEST-BOT-TOKEN-DO-NOT-LEAK";
const BOOTSTRAP_TOKEN = "telegram-bootstrap-test-token";
const ORIGIN = "https://occ.test";
const WEBHOOK_URL = `${ORIGIN}/telegram/webhook`;

let mf;
let adminToken = null;
let adminId = null;
let pairingCode = null;
const sentMessages = [];
const outboundCalls = [];

function outboundJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

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

  mf = new Miniflare({
    modules: true,
    script: bundled.outputFiles[0].text,
    compatibilityDate: "2026-05-03",
    d1Databases: { DB: "telegram-test-db" },
    bindings: {
      APP_ENV: "test",
      SESSION_SECRET,
      TELEGRAM_BOT_TOKEN: BOT_TOKEN,
      TELEGRAM_WEBHOOK_SECRET: WEBHOOK_SECRET,
      TELEGRAM_API_BASE: "https://telegram.test",
      TELEGRAM_BOOTSTRAP_TOKEN: BOOTSTRAP_TOKEN,
    },
    async outboundService(request) {
      const url = new URL(request.url);
      const text = await request.text();
      let body = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = null;
      }
      outboundCalls.push({ pathname: url.pathname, body });

      if (url.pathname.endsWith("/getMe")) {
        return outboundJson({
          ok: true,
          result: {
            id: 987654321,
            is_bot: true,
            first_name: "SARA",
            username: "nagasaribu_sara_bot",
          },
        });
      }
      if (url.pathname.endsWith("/sendMessage")) {
        sentMessages.push(body);
        return outboundJson({ ok: true, result: { message_id: sentMessages.length } });
      }
      if (url.pathname.endsWith("/setWebhook")) {
        return outboundJson({ ok: true, result: true });
      }
      if (url.pathname.endsWith("/getWebhookInfo")) {
        return outboundJson({
          ok: true,
          result: {
            url: WEBHOOK_URL,
            pending_update_count: 0,
            max_connections: 40,
          },
        });
      }
      return outboundJson({ ok: false, error_code: 404, description: "unknown method" }, 404);
    },
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
});

after(async () => {
  await mf?.dispose();
});

async function call(path, options = {}) {
  const headers = new Headers();
  if (options.body !== undefined) headers.set("content-type", "application/json");
  if (options.token) headers.set("authorization", `Bearer ${options.token}`);
  for (const [key, value] of Object.entries(options.headers ?? {})) headers.set(key, value);

  const response = await mf.dispatchFetch(`${ORIGIN}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: response.status, headers: response.headers, data, text };
}

function tokenFromCookie(response) {
  const setCookie = response.headers.get("set-cookie") ?? "";
  const match = /occ_session=([^;]+)/.exec(setCookie);
  return match ? decodeURIComponent(match[1]) : null;
}

function messageUpdate(updateId, text, userId = 9001, chatId = 9001, chatType = "private") {
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      from: { id: userId, is_bot: false, first_name: "Pentadbir", username: "admin_test" },
      chat: { id: chatId, type: chatType },
      date: Math.floor(Date.now() / 1000),
      text,
    },
  };
}

async function sendUpdate(update, secret = WEBHOOK_SECRET) {
  return call("/telegram/webhook", {
    method: "POST",
    headers: { "x-telegram-bot-api-secret-token": secret },
    body: update,
  });
}

function lastSent() {
  return sentMessages[sentMessages.length - 1] || null;
}

async function dbFirst(sql, ...params) {
  const db = await mf.getD1Database("DB");
  return db.prepare(sql).bind(...params).first();
}

async function dbAll(sql, ...params) {
  const db = await mf.getD1Database("DB");
  return db.prepare(sql).bind(...params).all();
}

test("telegram webhook rejects an invalid secret token", async () => {
  const before = await dbFirst("SELECT COUNT(*) AS count FROM telegram_updates");
  const response = await sendUpdate(messageUpdate(1000, "/status"), "wrong-secret");
  assert.equal(response.status, 401);
  assert.equal(response.data.ok, false);
  assert.equal(response.data.error.code, "invalid_webhook_secret");

  const after = await dbFirst("SELECT COUNT(*) AS count FROM telegram_updates");
  assert.equal(after.count, before.count, "rejected webhook must not record an update");
});

test("administrator setup creates the dashboard account", async () => {
  const response = await call("/api/auth/setup", {
    method: "POST",
    body: {
      name: "Pentadbir Telegram",
      email: "admin@example.test",
      password: "CorrectHorseBattery1!",
    },
  });
  assert.equal(response.status, 201);
  adminToken = tokenFromCookie(response);
  adminId = response.data.user.id;
  assert.ok(adminToken);

  const agent = await call("/api/agents", {
    method: "POST",
    token: adminToken,
    body: {
      name: "SARA Ujian",
      kind: "orchestrator",
      description: "Orkestrator untuk ujian Telegram.",
      capabilities: ["orchestration", "reporting"],
    },
  });
  assert.equal(agent.status, 201);
});

test("unpaired Telegram users are rejected and never trusted automatically", async () => {
  const response = await sendUpdate(messageUpdate(1001, "/status"));
  assert.equal(response.status, 200);
  assert.equal(response.data.ok, true);
  assert.equal(response.data.rejected, true);

  const account = await dbFirst("SELECT COUNT(*) AS count FROM telegram_accounts");
  assert.equal(account.count, 0, "no Telegram account may be created automatically");

  assert.ok(lastSent(), "the bot should answer the rejected user");
  assert.match(lastSent().text, /belum dipasangkan/i);
  assert.match(lastSent().text, /\/pair KOD/i);
  assert.doesNotMatch(lastSent().text, /BOT-TOKEN/);
});

test("pairing codes are generated only through the authenticated admin API", async () => {
  const unauthorized = await call("/api/telegram/pairing-code", { method: "POST", body: {} });
  assert.equal(unauthorized.status, 401);

  const response = await call("/api/telegram/pairing-code", {
    method: "POST",
    token: adminToken,
    body: {},
  });
  assert.equal(response.status, 201);
  pairingCode = response.data.code;
  assert.equal(typeof pairingCode, "string");
  assert.equal(pairingCode.length, 10);
  assert.equal(response.data.botUsername, "nagasaribu_sara_bot");
  assert.ok(new Date(response.data.expiresAt).getTime() > Date.now());
  assert.doesNotMatch(response.text, /TEST-BOT-TOKEN/);
  assert.doesNotMatch(response.text, /telegram-webhook-secret/);

  const stored = await dbFirst("SELECT code_hash FROM telegram_pairing_codes ORDER BY created_at DESC LIMIT 1");
  assert.ok(stored.code_hash);
  assert.notEqual(stored.code_hash, pairingCode, "plaintext pairing code must not be stored");
});

test("a valid one-time code binds the Telegram user and chat to the administrator", async () => {
  const response = await sendUpdate(messageUpdate(1002, `/pair ${pairingCode}`));
  assert.equal(response.status, 200);
  assert.equal(response.data.ok, true);

  const account = await dbFirst(
    "SELECT user_id, telegram_user_id, chat_id, status FROM telegram_accounts WHERE telegram_user_id = '9001'",
  );
  assert.ok(account);
  assert.equal(account.user_id, adminId);
  assert.equal(account.chat_id, "9001");
  assert.equal(account.status, "active");
  assert.match(lastSent().text, /Pasangan berjaya/i);
});

test("a pairing code cannot be reused", async () => {
  const response = await sendUpdate(messageUpdate(1003, `/pair ${pairingCode}`));
  assert.equal(response.status, 200);
  assert.match(lastSent().text, /tidak sah atau telah tamat tempoh/i);

  const accounts = await dbFirst("SELECT COUNT(*) AS count FROM telegram_accounts");
  assert.equal(accounts.count, 1);
});

test("duplicate Telegram update_id values are ignored", async () => {
  const sentBefore = sentMessages.length;
  const update = messageUpdate(2001, "/status");

  const first = await sendUpdate(update);
  assert.equal(first.status, 200);
  assert.equal(first.data.ok, true);
  assert.equal(first.data.duplicate, undefined);
  const sentAfterFirst = sentMessages.length;
  assert.ok(sentAfterFirst > sentBefore);

  const second = await sendUpdate(update);
  assert.equal(second.status, 200);
  assert.equal(second.data.duplicate, true);
  assert.equal(sentMessages.length, sentAfterFirst, "duplicate update must not send another reply");
});

test("/status and /tasks work for the paired administrator", async () => {
  const status = await sendUpdate(messageUpdate(2002, "/status"));
  assert.equal(status.status, 200);
  assert.match(lastSent().text, /STATUS OPERASI/);
  assert.match(lastSent().text, /Tugas:/);

  const created = await call("/api/tasks", {
    method: "POST",
    token: adminToken,
    body: { title: "Tugas ujian Telegram", description: "Rujukan untuk arahan /tasks." },
  });
  assert.equal(created.status, 201);

  const tasks = await sendUpdate(messageUpdate(2003, "/tasks"));
  assert.equal(tasks.status, 200);
  assert.match(lastSent().text, /TUGASAN TERKINI/);
  assert.match(lastSent().text, /Tugas ujian Telegram/);
});

test("natural-language tasks are recorded and executed through SARA", async () => {
  const response = await sendUpdate(
    messageUpdate(2004, "Sediakan ringkasan operasi mingguan untuk pasukan."),
  );
  assert.equal(response.status, 200);
  assert.match(lastSent().text, /ID:/);

  const task = await dbFirst(
    "SELECT id, title, description, created_by, metadata, execution_count, execution_state FROM tasks WHERE title = ? ORDER BY created_at DESC LIMIT 1",
    "Sediakan ringkasan operasi mingguan untuk pasukan.",
  );
  assert.ok(task);
  assert.equal(task.created_by, adminId);
  assert.equal(task.execution_count, 1);
  const metadata = JSON.parse(task.metadata);
  assert.equal(metadata.source, "telegram");
  assert.equal(metadata.telegram_user_id, "9001");

  const events = await dbAll("SELECT event_type FROM task_events WHERE task_id = ?", task.id);
  const types = events.results.map((event) => event.event_type);
  assert.ok(types.includes("execution_started"));
  assert.ok(types.includes("execution_mock"));

  const logs = await dbAll("SELECT action FROM audit_logs WHERE action LIKE 'telegram.%'");
  const actions = logs.results.map((log) => log.action);
  assert.ok(actions.includes("telegram.task.create"));
  assert.ok(actions.includes("telegram.task.execute"));
});

test("external actions require explicit confirmation before execution", async () => {
  const response = await sendUpdate(
    messageUpdate(2005, "Hantar e-mel tawaran kepada pelanggan baharu."),
  );
  assert.equal(response.status, 200);
  assert.match(lastSent().text, /PENGESAHAN DIPERLUKAN/);
  assert.match(lastSent().text, /\/confirm/);

  const task = await dbFirst(
    "SELECT id, execution_count, execution_state, metadata FROM tasks WHERE title = ? ORDER BY created_at DESC LIMIT 1",
    "Hantar e-mel tawaran kepada pelanggan baharu.",
  );
  assert.ok(task);
  assert.equal(task.execution_count, 0, "external task must not execute before confirmation");
  assert.equal(task.execution_state, "pending");
  assert.equal(JSON.parse(task.metadata).requiresApproval, true);

  const approvalsBefore = await dbFirst(
    "SELECT COUNT(*) AS count FROM approvals WHERE entity_id = ?",
    task.id,
  );
  assert.equal(approvalsBefore.count, 0);

  const confirmed = await sendUpdate(messageUpdate(2006, `/confirm ${task.id}`));
  assert.equal(confirmed.status, 200);
  assert.match(lastSent().text, /ID:/);

  const approval = await dbFirst(
    "SELECT status, decided_by FROM approvals WHERE entity_id = ? ORDER BY created_at DESC LIMIT 1",
    task.id,
  );
  assert.ok(approval);
  assert.equal(approval.status, "approved");
  assert.equal(approval.decided_by, adminId);

  const updated = await dbFirst("SELECT execution_count FROM tasks WHERE id = ?", task.id);
  assert.equal(updated.execution_count, 1, "confirmed task should execute exactly once");

  const events = await dbAll(
    "SELECT event_type FROM task_events WHERE task_id = ? ORDER BY created_at ASC",
    task.id,
  );
  assert.ok(events.results.some((event) => event.event_type === "approval_granted"));

  const logs = await dbAll("SELECT action FROM audit_logs WHERE action = 'telegram.task.confirm'");
  assert.ok(logs.results.length >= 1);
});

test("analysis-only Telegram tasks execute without a false approval gate", async () => {
  const text =
    "Analisis pelanggan waterproofing dan sediakan pelan pemasaran 7 hari. Jangan hantar sebarang mesej.";
  const response = await sendUpdate(messageUpdate(2007, text));
  assert.equal(response.status, 200);
  assert.doesNotMatch(lastSent().text, /PENGESAHAN DIPERLUKAN/);
  assert.match(lastSent().text, /ID:/);

  const task = await dbFirst(
    "SELECT id, execution_count, execution_state, metadata FROM tasks WHERE title LIKE ? ORDER BY created_at DESC LIMIT 1",
    "Analisis pelanggan waterproofing%",
  );
  assert.ok(task);
  assert.equal(task.execution_count, 1, "analysis-only task should execute exactly once");
  assert.notEqual(JSON.parse(task.metadata).requiresApproval, true);

  const approvals = await dbFirst(
    "SELECT COUNT(*) AS count FROM approvals WHERE entity_id = ?",
    task.id,
  );
  assert.equal(approvals.count, 0, "analysis-only task must not create an approval record");
});

test("admin Telegram status exposes connection state without secrets", async () => {
  const response = await call("/api/telegram/status", { token: adminToken });
  assert.equal(response.status, 200);
  assert.equal(response.data.configured, true);
  assert.equal(response.data.activeLinks, 1);
  assert.equal(response.data.bot.username, "nagasaribu_sara_bot");
  assert.equal(response.data.accounts.length, 1);
  assert.equal(response.data.webhook.matchesExpected, true);
  assert.doesNotMatch(response.text, /TEST-BOT-TOKEN/);
  assert.doesNotMatch(response.text, /telegram-webhook-secret/);

  const dashboard = await call("/api/dashboard", { token: adminToken });
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.data.telegram.configured, true);
  assert.equal(dashboard.data.telegram.activeLinks, 1);
  assert.doesNotMatch(dashboard.text, /TEST-BOT-TOKEN/);
  assert.doesNotMatch(dashboard.text, /telegram-webhook-secret/);
});

test("webhook registration uses the worker HTTPS URL and verifies getWebhookInfo", async () => {
  const response = await call("/api/telegram/webhook/register", {
    method: "POST",
    token: adminToken,
    body: {},
  });
  assert.equal(response.status, 200);
  assert.equal(response.data.url, WEBHOOK_URL);
  assert.equal(response.data.webhook.url, WEBHOOK_URL);
  assert.equal(response.data.webhook.matchesExpected, true);

  const setCall = outboundCalls.find((call) => call.pathname.endsWith("/setWebhook"));
  assert.ok(setCall);
  assert.equal(setCall.body.url, WEBHOOK_URL);
  assert.equal(setCall.body.secret_token, WEBHOOK_SECRET);
  assert.deepEqual(setCall.body.allowed_updates, ["message"]);
});

test("the bootstrap registration endpoint requires its own secret", async () => {
  const rejected = await call("/telegram/register", {
    method: "POST",
    headers: { "x-telegram-bootstrap-token": "wrong" },
  });
  assert.equal(rejected.status, 401);

  const accepted = await call("/telegram/register", {
    method: "POST",
    headers: { "x-telegram-bootstrap-token": BOOTSTRAP_TOKEN },
  });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.data.ok, true);
  assert.equal(accepted.data.url, WEBHOOK_URL);
  assert.equal(accepted.data.webhook.url, WEBHOOK_URL);
});

test("non-admin users cannot manage Telegram", async () => {
  const viewer = await call("/api/users", {
    method: "POST",
    token: adminToken,
    body: {
      name: "Pemerhati Telegram",
      email: "viewer@example.test",
      password: "ViewerPassword123!",
      role: "viewer",
    },
  });
  assert.equal(viewer.status, 201);

  const login = await call("/api/auth/login", {
    method: "POST",
    body: { email: "viewer@example.test", password: "ViewerPassword123!" },
  });
  const viewerToken = tokenFromCookie(login);
  assert.ok(viewerToken);

  const status = await call("/api/telegram/status", { token: viewerToken });
  assert.equal(status.status, 403);
  const pair = await call("/api/telegram/pairing-code", {
    method: "POST",
    token: viewerToken,
    body: {},
  });
  assert.equal(pair.status, 403);
});
