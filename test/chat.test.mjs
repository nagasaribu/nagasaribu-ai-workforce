import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { build } from "esbuild";
import { Miniflare } from "miniflare";

const SESSION_SECRET = "chat-integration-secret-0123456789";
const ORIGIN = "https://occ.test";

let mf;
let adminToken = null;
let adminId = null;
let marketingId = null;
let qsId = null;
let financeId = null;
let technicalId = null;
let creativeId = null;

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
    d1Databases: { DB: "chat-test-db" },
    bindings: { APP_ENV: "test", SESSION_SECRET },
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
  return { status: response.status, data, text, headers: response.headers };
}

function tokenFromCookie(response) {
  const setCookie = response.headers.get("set-cookie") ?? "";
  const match = /occ_session=([^;]+)/.exec(setCookie);
  return match ? decodeURIComponent(match[1]) : null;
}

async function dbFirst(sql, ...params) {
  const db = await mf.getD1Database("DB");
  return db.prepare(sql).bind(...params).first();
}

async function dbAll(sql, ...params) {
  const db = await mf.getD1Database("DB");
  return db.prepare(sql).bind(...params).all();
}

async function chat(message, options = {}) {
  return call("/api/chat", {
    method: "POST",
    token: adminToken,
    headers: options.headers,
    body: {
      message,
      clientMessageId: options.clientMessageId ?? crypto.randomUUID(),
      conversationId: options.conversationId,
    },
  });
}

test("administrator and specialist agents are provisioned", async () => {
  const setup = await call("/api/auth/setup", {
    method: "POST",
    body: {
      name: "Dato Pentadbir",
      email: "admin@example.test",
      password: "CorrectHorseBattery1!",
    },
  });
  assert.equal(setup.status, 201);
  adminToken = tokenFromCookie(setup);
  adminId = setup.data.user.id;

  const agents = [
    ["SARA", "orchestrator", { requiresApproval: false }],
    ["Marketing AI", "customer_acquisition", { requiresApproval: true }],
    ["QS AI", "quantity_surveying", { requiresApproval: false }],
    ["Finance AI", "financial_operations", { requiresApproval: false }],
    ["Technical AI", "engineering_automation", { requiresApproval: false }],
    ["Creative Studio", "creative_production", { requiresApproval: true }],
  ];
  for (const [name, kind, config] of agents) {
    const response = await call("/api/agents", {
      method: "POST",
      token: adminToken,
      body: { name, kind, config },
    });
    assert.equal(response.status, 201, `agent ${name} should be created`);
    if (name === "Marketing AI") marketingId = response.data.agent.id;
    if (name === "QS AI") qsId = response.data.agent.id;
    if (name === "Finance AI") financeId = response.data.agent.id;
    if (name === "Technical AI") technicalId = response.data.agent.id;
    if (name === "Creative Studio") creativeId = response.data.agent.id;
  }
});

test("chat endpoints require authentication", async () => {
  for (const [path, method] of [
    ["/api/chat", "GET"],
    ["/api/chat", "POST"],
    ["/api/chat/history", "GET"],
  ]) {
    const response = await call(path, { method, body: method === "POST" ? { message: "hello" } : undefined });
    assert.equal(response.status, 401, `${method} ${path} must require authentication`);
  }
});

test("new chat starts in human mode with starter actions", async () => {
  const response = await call("/api/chat", { token: adminToken });
  assert.equal(response.status, 200);
  assert.equal(response.data.mode, "human");
  assert.equal(response.data.conversation, null);
  assert.deepEqual(response.data.messages, []);
  assert.equal(response.data.starters.length, 6);
  assert.match(response.data.welcome, /Selamat datang, Dato/);
});

test("a chat request persists messages and routes marketing work to Marketing AI", async () => {
  const response = await chat(
    "Sediakan strategi pemasaran 7 hari untuk perkhidmatan waterproofing.",
    { clientMessageId: "chat-marketing-1" },
  );
  assert.equal(response.status, 200);
  assert.equal(response.data.mode, "human");
  assert.equal(response.data.messages.length, 2);
  assert.equal(response.data.messages[0].role, "user");
  assert.equal(response.data.messages[1].role, "assistant");
  assert.match(response.data.messages[1].content, /Marketing AI/);
  assert.ok(response.data.taskId);

  const task = await dbFirst("SELECT * FROM tasks WHERE id = ?", response.data.taskId);
  assert.ok(task);
  assert.equal(task.assigned_agent_id, marketingId);
  assert.equal(task.created_by, adminId);
  assert.equal(task.execution_count, 1);
  assert.equal(JSON.parse(task.metadata).channel, "web");
  assert.equal(JSON.parse(task.metadata).responseMode, "human");

  const messages = await dbAll(
    "SELECT role, content FROM conversation_messages WHERE conversation_id = ? ORDER BY created_at ASC",
    response.data.conversation.id,
  );
  assert.equal(messages.results.length, 2);
  assert.equal(messages.results[1].role, "assistant");

  const logs = await dbAll("SELECT action FROM audit_logs WHERE action LIKE 'chat.%'");
  const actions = logs.results.map((log) => log.action);
  assert.ok(actions.includes("chat.task.create"));
  assert.ok(actions.includes("chat.task.execute"));
  assert.ok(actions.includes("chat.message"));
});

test("conversation history survives reloads", async () => {
  const current = await call("/api/chat", { token: adminToken });
  assert.equal(current.status, 200);
  assert.ok(current.data.conversation);
  assert.equal(current.data.messages.length, 2);

  const history = await call("/api/chat/history", { token: adminToken });
  assert.equal(history.status, 200);
  assert.equal(history.data.conversations.length, 1);
  assert.equal(history.data.messages.length, 0);

  const detail = await call(
    `/api/chat/history?conversationId=${encodeURIComponent(current.data.conversation.id)}`,
    { token: adminToken },
  );
  assert.equal(detail.status, 200);
  assert.equal(detail.data.messages.length, 2);
});

test("greetings, general questions and opinions do not create tasks", async () => {
  const before = await dbFirst("SELECT COUNT(*) AS count FROM tasks");
  const cases = [
    ["Hai SARA", "conversation-greeting-1"],
    ["Apa itu waterproofing?", "conversation-question-1"],
    ["Apa pendapat awak tentang strategi pemasaran kita?", "conversation-opinion-1"],
  ];
  for (const [message, clientMessageId] of cases) {
    const response = await chat(message, { clientMessageId });
    assert.equal(response.status, 200);
    assert.equal(response.data.intent, "conversation");
    assert.equal(response.data.taskId, undefined);
    assert.ok(response.data.messages.length >= 2);
  }
  const after = await dbFirst("SELECT COUNT(*) AS count FROM tasks");
  assert.equal(after.count, before.count, "conversation must not create tasks");
});

test("follow-up questions persist and retain project context", async () => {
  const before = await dbFirst("SELECT COUNT(*) AS count FROM tasks");
  const first = await chat("Projek Alpha ialah projek waterproofing di Selangor.", {
    clientMessageId: "context-project-1",
  });
  assert.equal(first.status, 200);
  assert.equal(first.data.intent, "conversation");

  const followUp = await chat("Bagaimana margin projek itu?", {
    clientMessageId: "context-project-2",
  });
  assert.equal(followUp.status, 200);
  assert.equal(followUp.data.intent, "conversation");
  assert.equal(followUp.data.taskId, undefined);

  const history = await call("/api/chat", { token: adminToken });
  const contents = history.data.messages.map((message) => message.content);
  assert.ok(contents.includes("Projek Alpha ialah projek waterproofing di Selangor."));
  assert.ok(contents.includes("Bagaimana margin projek itu?"));

  const after = await dbFirst("SELECT COUNT(*) AS count FROM tasks");
  assert.equal(after.count, before.count, "follow-up conversation must not create a task");
});

test("status questions use actual read-only system data", async () => {
  const before = await dbFirst("SELECT COUNT(*) AS count FROM tasks");
  const stats = await dbFirst(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN execution_state NOT IN ('completed','cancelled') THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN execution_state = 'completed' THEN 1 ELSE 0 END) AS completed
     FROM tasks`,
  );
  const approvals = await dbFirst(
    "SELECT COUNT(*) AS count FROM approvals WHERE status = 'pending'",
  );

  const response = await chat("Semak status sistem kita", {
    clientMessageId: "status-readonly-1",
  });
  assert.equal(response.status, 200);
  assert.equal(response.data.intent, "read_only_system_query");
  assert.equal(response.data.taskId, undefined);
  const assistant = response.data.messages[response.data.messages.length - 1];
  assert.match(assistant.content, /D1 sihat/);
  assert.match(assistant.content, new RegExp(`${Number(stats.active)} tugasan aktif`));
  assert.match(assistant.content, new RegExp(`${Number(stats.completed)} selesai`));
  assert.match(assistant.content, new RegExp(`${Number(approvals.count)} kelulusan menunggu`));
  assert.match(assistant.content, /DeepSeek/);
  assert.match(assistant.content, /Telegram/);

  const after = await dbFirst("SELECT COUNT(*) AS count FROM tasks");
  assert.equal(after.count, before.count, "status query must not create a task");
});

test("negative instructions do not trigger approval", async () => {
  const before = await dbFirst("SELECT COUNT(*) AS count FROM tasks");
  const conversation = await chat("Jangan hantar sebarang mesej kepada pelanggan.", {
    clientMessageId: "negative-conversation-1",
  });
  assert.equal(conversation.status, 200);
  assert.equal(conversation.data.intent, "conversation");
  assert.equal(conversation.data.taskId, undefined);

  const draft = await chat(
    "Jangan hantar sebarang mesej; sediakan draf strategi pemasaran.",
    { clientMessageId: "negative-draft-1" },
  );
  assert.equal(draft.status, 200);
  assert.equal(draft.data.intent, "internal_work");
  assert.ok(draft.data.taskId);
  const task = await dbFirst("SELECT metadata FROM tasks WHERE id = ?", draft.data.taskId);
  assert.notEqual(JSON.parse(task.metadata).requiresApproval, true);
  const approvals = await dbFirst(
    "SELECT COUNT(*) AS count FROM approvals WHERE entity_id = ?",
    draft.data.taskId,
  );
  assert.equal(approvals.count, 0);
  const after = await dbFirst("SELECT COUNT(*) AS count FROM tasks");
  assert.ok(after.count > before.count);
});

test("chat response modes persist and affect task metadata", async () => {
  const setSimple = await call("/api/chat/mode", {
    method: "POST",
    token: adminToken,
    body: { mode: "simple" },
  });
  assert.equal(setSimple.status, 200);
  assert.equal(setSimple.data.mode, "simple");
  const preference = await dbFirst(
    "SELECT response_mode FROM user_ai_preferences WHERE user_id = ?",
    adminId,
  );
  assert.equal(preference.response_mode, "simple");

  const current = await call("/api/chat", { token: adminToken });
  assert.equal(current.data.mode, "simple");

  const simpleTask = await chat("Sediakan ringkasan operasi mingguan.", {
    clientMessageId: "chat-simple-1",
  });
  assert.equal(simpleTask.status, 200);
  const task = await dbFirst("SELECT metadata FROM tasks WHERE id = ?", simpleTask.data.taskId);
  assert.equal(JSON.parse(task.metadata).responseMode, "simple");

  const deep = await chat("/deep", { clientMessageId: "chat-mode-deep" });
  assert.equal(deep.status, 200);
  assert.match(deep.data.messages[deep.data.messages.length - 1].content, /Deep Thinking/);
  assert.equal((await call("/api/chat", { token: adminToken })).data.mode, "deep_thinking");

  const mode = await chat("/mode", { clientMessageId: "chat-mode-show" });
  assert.match(mode.data.messages[mode.data.messages.length - 1].content, /Deep Thinking/);

  const human = await chat("/human", { clientMessageId: "chat-mode-human" });
  assert.match(human.data.messages[human.data.messages.length - 1].content, /Human/);
  assert.equal((await call("/api/chat", { token: adminToken })).data.mode, "human");
});

test("SARA auto-routes work to specialist agents", async () => {
  const cases = [
    ["Sediakan analisis kos awal untuk projek pembinaan.", qsId, "QS AI"],
    ["Sediakan analisis kewangan dan aliran tunai bulan ini.", financeId, "Finance AI"],
    ["Beri cadangan teknikal untuk automasi proses operasi.", technicalId, "Technical AI"],
    ["Sediakan brief kreatif untuk kempen media sosial.", creativeId, "Creative Studio"],
    ["Cari pelanggan baharu untuk perkhidmatan waterproofing.", marketingId, "Marketing AI"],
    ["Cari 20 prospek waterproofing.", marketingId, "Marketing AI"],
  ];
  for (const [index, [message, expectedId, expectedName]] of cases.entries()) {
    const response = await chat(message, { clientMessageId: `route-${index}-${expectedName}` });
    assert.equal(response.status, 200);
    assert.ok(response.data.taskId, `${message} should create a task; intent=${response.data.intent}`);
    const task = await dbFirst("SELECT assigned_agent_id FROM tasks WHERE id = ?", response.data.taskId);
    assert.equal(task.assigned_agent_id, expectedId, `${message} should route to ${expectedName}`);
  }
});

test("duplicate client message IDs do not execute twice", async () => {
  const before = await dbFirst("SELECT COUNT(*) AS count FROM tasks");
  const first = await chat("Sediakan ringkasan operasi untuk pasukan.", {
    clientMessageId: "duplicate-chat-1",
  });
  assert.equal(first.status, 200);
  const afterFirst = await dbFirst("SELECT COUNT(*) AS count FROM tasks");
  const messagesAfterFirst = await dbFirst(
    "SELECT COUNT(*) AS count FROM conversation_messages WHERE conversation_id = ?",
    first.data.conversation.id,
  );

  const second = await chat("Sediakan ringkasan operasi untuk pasukan.", {
    clientMessageId: "duplicate-chat-1",
  });
  assert.equal(second.status, 200);
  assert.equal(second.data.duplicate, true);
  const afterSecond = await dbFirst("SELECT COUNT(*) AS count FROM tasks");
  assert.equal(afterSecond.count, afterFirst.count);
  const messagesAfterSecond = await dbFirst(
    "SELECT COUNT(*) AS count FROM conversation_messages WHERE conversation_id = ?",
    first.data.conversation.id,
  );
  assert.equal(messagesAfterSecond.count, messagesAfterFirst.count);
  assert.ok(afterFirst.count >= before.count);
});

test("external actions require approval and can be confirmed in chat", async () => {
  const response = await chat("Hantar WhatsApp kepada pelanggan baharu.", {
    clientMessageId: "approval-chat-1",
  });
  assert.equal(response.status, 200);
  const assistant = response.data.messages[response.data.messages.length - 1];
  assert.match(assistant.content, /Kelulusan Diperlukan/);
  assert.match(assistant.content, /\/confirm/);

  const task = await dbFirst("SELECT * FROM tasks WHERE id = ?", response.data.taskId);
  assert.equal(task.execution_count, 0);
  assert.equal(JSON.parse(task.metadata).requiresApproval, true);
  const approvalsBefore = await dbFirst(
    "SELECT COUNT(*) AS count FROM approvals WHERE entity_id = ?",
    task.id,
  );
  assert.equal(approvalsBefore.count, 0);

  const confirmed = await chat(`/confirm ${task.id.slice(0, 8)}`, {
    clientMessageId: "approval-chat-confirm-1",
  });
  assert.equal(confirmed.status, 200);
  const approval = await dbFirst(
    "SELECT status, decided_by FROM approvals WHERE entity_id = ? ORDER BY created_at DESC LIMIT 1",
    task.id,
  );
  assert.equal(approval.status, "approved");
  assert.equal(approval.decided_by, adminId);
  const executed = await dbFirst("SELECT execution_count FROM tasks WHERE id = ?", task.id);
  assert.equal(executed.execution_count, 1);
});

test("viewers can read chat history but cannot send messages", async () => {
  const viewer = await call("/api/users", {
    method: "POST",
    token: adminToken,
    body: {
      name: "Pemerhati",
      email: "viewer-chat@example.test",
      password: "ViewerPassword123!",
      role: "viewer",
    },
  });
  assert.equal(viewer.status, 201);
  const login = await call("/api/auth/login", {
    method: "POST",
    body: { email: "viewer-chat@example.test", password: "ViewerPassword123!" },
  });
  const viewerToken = tokenFromCookie(login);
  assert.ok(viewerToken);

  const get = await call("/api/chat", { token: viewerToken });
  assert.equal(get.status, 200);
  const post = await call("/api/chat", {
    method: "POST",
    token: viewerToken,
    body: { message: "hello" },
  });
  assert.equal(post.status, 403);
});

test("chat rejects foreign origins and invalid modes", async () => {
  const origin = await call("/api/chat", {
    method: "POST",
    token: adminToken,
    headers: { origin: "https://evil.test" },
    body: { message: "Ringkaskan operasi." },
  });
  assert.equal(origin.status, 403);

  const invalid = await call("/api/chat/mode", {
    method: "POST",
    token: adminToken,
    body: { mode: "unknown" },
  });
  assert.equal(invalid.status, 400);
});
