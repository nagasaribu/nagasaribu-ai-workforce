import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { build } from "esbuild";
import { Miniflare } from "miniflare";

const SESSION_SECRET = "integration-test-secret-0123456789";
const ORIGIN = "https://occ.test";

let mf;
let adminToken = null;
let adminId = null;
let agentToken = null;
let viewerToken = null;
let agentId = null;
let taskId = null;
let leadId = null;
let sourceId = null;
let approvalId = null;

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
    compatibilityDate: "2025-01-01",
    d1Databases: { DB: "occ-test-db" },
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
  if (options.cookie) headers.set("cookie", options.cookie);
  for (const [key, value] of Object.entries(options.headers ?? {})) headers.set(key, value);

  const response = await mf.dispatchFetch(`${ORIGIN}${path}`, {
    method: options.method ?? "GET",
    headers,
    body:
      options.rawBody !== undefined
        ? options.rawBody
        : options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
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

async function login(email, password) {
  const response = await call("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  return { response, token: tokenFromCookie(response) };
}

test("health reports an operational phase 2 service with a working database", async () => {
  const response = await call("/health");
  assert.equal(response.status, 200);
  assert.equal(response.data.ok, true);
  assert.equal(response.data.service, "nagasaribu-ai-workforce");
  assert.equal(response.data.phase, 2);
  assert.equal(response.data.checks.database, "ok");
  assert.equal(response.data.checks.auth, "configured");
  assert.equal(response.data.checks.ai, "mock");
  assert.equal(response.data.checks.search, "unavailable");
});

test("root serves the Malay Operations Control Centre with security headers", async () => {
  const response = await call("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.match(response.text, /Pusat Kawalan Operasi/);
  assert.match(response.text, /NAGASARIBU/);
  assert.match(response.headers.get("content-security-policy") ?? "", /default-src 'self'/);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("auth status reports first-run setup before any user exists", async () => {
  const response = await call("/api/auth/me");
  assert.equal(response.status, 200);
  assert.equal(response.data.authenticated, false);
  assert.equal(response.data.needsSetup, true);
  assert.equal(response.data.configured, true);
});

test("administrative endpoints reject unauthenticated requests", async () => {
  for (const path of [
    "/api/dashboard",
    "/api/tasks",
    "/api/agents",
    "/api/prospects",
    "/api/prospects/status",
    "/api/leads",
    "/api/approvals",
    "/api/users",
    "/api/audit-logs",
  ]) {
    const response = await call(path);
    assert.equal(response.status, 401, `${path} must require authentication`);
    assert.equal(response.data.error.code, "unauthorized");
  }
});

test("first-run setup validates password strength", async () => {
  const response = await call("/api/auth/setup", {
    method: "POST",
    body: { name: "Pentadbir", email: "admin@example.test", password: "short" },
  });
  assert.equal(response.status, 400);
});

test("first-run setup creates the initial administrator and signs them in", async () => {
  const response = await call("/api/auth/setup", {
    method: "POST",
    body: {
      name: "Pentadbir Utama",
      email: "Admin@Example.test",
      password: "CorrectHorseBattery1!",
    },
  });

  assert.equal(response.status, 201);
  assert.equal(response.data.authenticated, true);
  assert.equal(response.data.user.email, "admin@example.test");
  assert.equal(response.data.user.role, "admin");

  adminToken = tokenFromCookie(response);
  adminId = response.data.user.id;
  assert.ok(adminToken, "setup should issue a session cookie");

  const cookie = response.headers.get("set-cookie") ?? "";
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);

  const db = await mf.getD1Database("DB");
  const flag = await db
    .prepare("SELECT value FROM system_settings WHERE key = 'bootstrap_completed'")
    .first();
  assert.equal(flag.value, "true", "bootstrap must be marked complete");
});

test("first-run setup cannot be repeated", async () => {
  const response = await call("/api/auth/setup", {
    method: "POST",
    body: { name: "Penyusup", email: "intruder@example.test", password: "AnotherPassword123!" },
  });
  assert.equal(response.status, 409);
});

test("login rejects bad credentials and accepts valid ones", async () => {
  const bad = await call("/api/auth/login", {
    method: "POST",
    body: { email: "admin@example.test", password: "wrong-password" },
  });
  assert.equal(bad.status, 401);

  const good = await login("admin@example.test", "CorrectHorseBattery1!");
  assert.equal(good.response.status, 200);
  assert.equal(good.response.data.user.role, "admin");
  assert.ok(good.token);
  adminToken = good.token;

  const me = await call("/api/auth/me", { token: adminToken });
  assert.equal(me.status, 200);
  assert.equal(me.data.authenticated, true);
  assert.equal(me.data.user.id, adminId);
});

test("state-changing requests from a foreign origin are rejected", async () => {
  const response = await call("/api/agents", {
    method: "POST",
    token: adminToken,
    headers: { origin: "https://evil.test" },
    body: { name: "Ejen Asing" },
  });
  assert.equal(response.status, 403);
  assert.equal(response.data.error.code, "origin_not_allowed");
});

test("agents can be registered, listed and paused", async () => {
  const created = await call("/api/agents", {
    method: "POST",
    token: adminToken,
    body: {
      name: "Ejen Penyelidikan",
      kind: "research",
      description: "Menyediakan ringkasan penyelidikan pasaran.",
      capabilities: ["penyelidikan", "ringkasan"],
    },
  });
  assert.equal(created.status, 201);
  agentId = created.data.agent.id;
  assert.equal(created.data.agent.name, "Ejen Penyelidikan");

  const duplicate = await call("/api/agents", {
    method: "POST",
    token: adminToken,
    body: { name: "Ejen Penyelidikan" },
  });
  assert.equal(duplicate.status, 409);

  const listed = await call("/api/agents", { token: adminToken });
  assert.equal(listed.status, 200);
  assert.equal(listed.data.agents.length, 1);

  const paused = await call(`/api/agents/${agentId}`, {
    method: "PATCH",
    token: adminToken,
    body: { status: "paused" },
  });
  assert.equal(paused.status, 200);
  assert.equal(paused.data.agent.status, "paused");

  const reactivated = await call(`/api/agents/${agentId}`, {
    method: "PATCH",
    token: adminToken,
    body: { status: "active" },
  });
  assert.equal(reactivated.status, 200);
  assert.equal(reactivated.data.agent.status, "active");
});

test("tasks can be created, assigned, tracked and completed with events", async () => {
  const created = await call("/api/tasks", {
    method: "POST",
    token: adminToken,
    body: {
      title: "Sediakan laporan mingguan",
      description: "Ringkasan operasi untuk minggu ini.",
      priority: "high",
      assignedAgentId: agentId,
    },
  });
  assert.equal(created.status, 201);
  taskId = created.data.task.id;
  assert.equal(created.data.task.status, "assigned");
  assert.equal(created.data.task.execution_state, "assigned");
  assert.equal(created.data.task.priority, "high");

  const detail = await call(`/api/tasks/${taskId}`, { token: adminToken });
  assert.equal(detail.status, 200);
  assert.equal(detail.data.task.id, taskId);
  assert.equal(detail.data.events.length, 1);
  assert.equal(detail.data.events[0].event_type, "created");

  const assigned = await call(`/api/tasks/${taskId}/assign`, {
    method: "POST",
    token: adminToken,
    body: { userId: adminId },
  });
  assert.equal(assigned.status, 200);
  assert.equal(assigned.data.task.assigned_user_id, adminId);

  const cleared = await call(`/api/tasks/${taskId}`, {
    method: "PATCH",
    token: adminToken,
    body: { assignedAgentId: null },
  });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.data.task.assigned_agent_id, null);

  const running = await call(`/api/tasks/${taskId}`, {
    method: "PATCH",
    token: adminToken,
    body: { state: "running" },
  });
  assert.equal(running.status, 200);
  assert.equal(running.data.task.execution_state, "running");
  assert.equal(running.data.task.status, "in_progress");

  const completed = await call(`/api/tasks/${taskId}`, {
    method: "PATCH",
    token: adminToken,
    body: { state: "completed" },
  });
  assert.equal(completed.status, 200);
  assert.equal(completed.data.task.execution_state, "completed");
  assert.equal(completed.data.task.status, "completed");
  assert.ok(completed.data.task.completed_at);

  const after = await call(`/api/tasks/${taskId}`, { token: adminToken });
  const types = after.data.events.map((event) => event.event_type);
  assert.ok(types.includes("assigned"));
  assert.ok(types.includes("state_changed"));
});

test("the task state machine rejects invalid transitions", async () => {
  const created = await call("/api/tasks", {
    method: "POST",
    token: adminToken,
    body: { title: "Ujian peralihan state" },
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.task.execution_state, "pending");

  const invalid = await call(`/api/tasks/${created.data.task.id}`, {
    method: "PATCH",
    token: adminToken,
    body: { state: "completed" },
  });
  assert.equal(invalid.status, 409);
  assert.equal(invalid.data.error.code, "invalid_transition");

  const assigned = await call(`/api/tasks/${created.data.task.id}`, {
    method: "PATCH",
    token: adminToken,
    body: { state: "assigned" },
  });
  assert.equal(assigned.status, 200);
  assert.equal(assigned.data.task.execution_state, "assigned");
});

test("SARA routes an unassigned task by capability", async () => {
  const qsAgent = await call("/api/agents", {
    method: "POST",
    token: adminToken,
    body: {
      name: "QS Ujian",
      kind: "quantity_surveying",
      capabilities: ["cost_estimation", "tender_analysis"],
    },
  });
  assert.equal(qsAgent.status, 201);

  const created = await call("/api/tasks", {
    method: "POST",
    token: adminToken,
    body: { title: "Anggarkan kos projek", capability: "cost_estimation" },
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.task.assigned_agent_id, null);

  const routed = await call(`/api/tasks/${created.data.task.id}/auto-assign`, {
    method: "POST",
    token: adminToken,
    body: {},
  });
  assert.equal(routed.status, 200);
  assert.equal(routed.data.agent.id, qsAgent.data.agent.id);
  assert.equal(routed.data.task.assigned_agent_id, qsAgent.data.agent.id);
  assert.equal(routed.data.task.execution_state, "assigned");

  const detail = await call(`/api/tasks/${created.data.task.id}`, { token: adminToken });
  assert.ok(detail.data.events.some((event) => event.event_type === "auto_routed"));
});

test("safe tools execute, risky tools need approval and never pretend to run", async () => {
  const created = await call("/api/tasks", {
    method: "POST",
    token: adminToken,
    body: { title: "Ujian alat", assignedAgentId: agentId },
  });
  assert.equal(created.status, 201);
  const toolTaskId = created.data.task.id;

  const safe = await call(`/api/tasks/${toolTaskId}/tools/registry_snapshot`, {
    method: "POST",
    token: adminToken,
    body: {},
  });
  assert.equal(safe.status, 200);
  assert.ok(Array.isArray(safe.data.output.agents));

  const safeDetail = await call(`/api/tasks/${toolTaskId}`, { token: adminToken });
  assert.ok(safeDetail.data.events.some((event) => event.event_type === "tool_completed"));

  const blocked = await call(`/api/tasks/${toolTaskId}/tools/external_publish`, {
    method: "POST",
    token: adminToken,
    body: {},
  });
  assert.equal(blocked.status, 409);
  assert.equal(blocked.data.error.code, "approval_required");
  assert.equal(blocked.data.task.execution_state, "blocked");

  const approval = await call("/api/approvals", {
    method: "POST",
    token: adminToken,
    body: {
      entityType: "task",
      entityId: toolTaskId,
      title: "Kelulusan alat luaran",
      description: "Ujian gerbang kelulusan alat.",
    },
  });
  assert.equal(approval.status, 201);

  const decision = await call(`/api/approvals/${approval.data.approval.id}/decision`, {
    method: "POST",
    token: adminToken,
    body: { decision: "approved" },
  });
  assert.equal(decision.status, 200);

  const stillBlocked = await call(`/api/tasks/${toolTaskId}/tools/external_publish`, {
    method: "POST",
    token: adminToken,
    body: {},
  });
  assert.equal(stillBlocked.status, 409);
  assert.equal(stillBlocked.data.error.code, "tool_not_configured");
  assert.equal(stillBlocked.data.task.execution_state, "blocked");
});

test("prospective customers and sources are managed without outbound messages", async () => {
  const source = await call("/api/lead-sources", {
    method: "POST",
    token: adminToken,
    body: { name: "Kajian Kes", channel: "research", description: "Rujukan kajian kes." },
  });
  assert.equal(source.status, 201);
  sourceId = source.data.source.id;

  const created = await call("/api/leads", {
    method: "POST",
    token: adminToken,
    body: {
      companyName: "Syarikat Contoh Sdn Bhd",
      contactName: "Nur Aisyah",
      email: "aisyah@example.test",
      phone: "+60123456789",
      sourceId,
      status: "new",
      consentStatus: "granted",
      notes: "Berminat dengan automasi operasi.",
    },
  });
  assert.equal(created.status, 201);
  leadId = created.data.lead.id;
  assert.equal(created.data.lead.source_name, "Kajian Kes");

  const listed = await call("/api/leads", { token: adminToken });
  assert.equal(listed.status, 200);
  assert.equal(listed.data.leads.length, 1);
  assert.equal(listed.data.leads[0].company_name, "Syarikat Contoh Sdn Bhd");

  const updated = await call(`/api/leads/${leadId}`, {
    method: "PATCH",
    token: adminToken,
    body: { status: "qualified", doNotContact: false },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.lead.status, "qualified");
});

test("approval workflow records a decision once", async () => {
  const created = await call("/api/approvals", {
    method: "POST",
    token: adminToken,
    body: {
      entityType: "task",
      entityId: taskId,
      title: "Kelulusan laporan mingguan",
      description: "Sahkan laporan sebelum diterbitkan.",
    },
  });
  assert.equal(created.status, 201);
  approvalId = created.data.approval.id;
  assert.equal(created.data.approval.status, "pending");

  const approved = await call(`/api/approvals/${approvalId}/decision`, {
    method: "POST",
    token: adminToken,
    body: { decision: "approved", note: "Disemak dan diluluskan." },
  });
  assert.equal(approved.status, 200);
  assert.equal(approved.data.approval.status, "approved");
  assert.equal(approved.data.approval.decision_note, "Disemak dan diluluskan.");

  const again = await call(`/api/approvals/${approvalId}/decision`, {
    method: "POST",
    token: adminToken,
    body: { decision: "rejected" },
  });
  assert.equal(again.status, 409);
});

test("task execution runs in mock mode and records events and audit logs", async () => {
  const created = await call("/api/tasks", {
    method: "POST",
    token: adminToken,
    body: {
      title: "Jalankan analisis kos",
      description: "Sediakan analisis kos awal untuk projek contoh.",
      capability: "penyelidikan",
      assignedAgentId: agentId,
      maxTokens: 100,
    },
  });
  assert.equal(created.status, 201);
  const executionTaskId = created.data.task.id;
  assert.match(created.data.task.metadata, /"maxTokens":100/);

  const executed = await call(`/api/tasks/${executionTaskId}/execute`, {
    method: "POST",
    token: adminToken,
    body: {},
  });
  assert.equal(executed.status, 200);
  assert.equal(executed.data.execution.mode, "mock");
  assert.equal(executed.data.execution.live, false);
  assert.equal(executed.data.execution.success, false);
  assert.equal(executed.data.task.status, "blocked");
  assert.equal(executed.data.task.execution_state, "blocked");
  assert.match(executed.data.task.result, /MOD MOCK/);
  assert.match(executed.data.task.last_error, /Mod mock/);

  const detail = await call(`/api/tasks/${executionTaskId}`, { token: adminToken });
  const eventTypes = detail.data.events.map((event) => event.event_type);
  assert.ok(eventTypes.includes("execution_started"));
  assert.ok(eventTypes.includes("execution_mock"));

  const ai = await call("/api/ai/status", { token: adminToken });
  assert.equal(ai.status, 200);
  assert.equal(ai.data.provider.mode, "mock");
  assert.equal(ai.data.provider.configured, false);
  assert.equal(ai.data.provider.liveExecutionEnabled, false);

  const dashboard = await call("/api/dashboard", { token: adminToken });
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.data.ai.mode, "mock");
  assert.ok(dashboard.data.execution.started >= 1);
  assert.ok(dashboard.data.execution.mock >= 1);
  assert.ok(dashboard.data.recentActivity.length >= 1);
  assert.ok(dashboard.data.recentErrors.some((task) => task.id === executionTaskId));
});

test("risky tasks require an approved gate before execution", async () => {
  const created = await call("/api/tasks", {
    method: "POST",
    token: adminToken,
    body: {
      title: "Terbitkan kempen luaran",
      description: "Kempen ini memerlukan kelulusan manusia.",
      assignedAgentId: agentId,
      requiresApproval: true,
    },
  });
  assert.equal(created.status, 201);
  const gatedTaskId = created.data.task.id;

  const blocked = await call(`/api/tasks/${gatedTaskId}/execute`, {
    method: "POST",
    token: adminToken,
    body: {},
  });
  assert.equal(blocked.status, 409);
  assert.equal(blocked.data.error.code, "approval_required");

  const detail = await call(`/api/tasks/${gatedTaskId}`, { token: adminToken });
  assert.ok(detail.data.events.some((event) => event.event_type === "approval_required"));

  const approval = await call("/api/approvals", {
    method: "POST",
    token: adminToken,
    body: {
      entityType: "task",
      entityId: gatedTaskId,
      title: "Kelulusan kempen luaran",
      description: "Sahkan pelaksanaan kempen.",
    },
  });
  assert.equal(approval.status, 201);

  const decision = await call(`/api/approvals/${approval.data.approval.id}/decision`, {
    method: "POST",
    token: adminToken,
    body: { decision: "approved", note: "Diluluskan untuk ujian." },
  });
  assert.equal(decision.status, 200);

  const executed = await call(`/api/tasks/${gatedTaskId}/execute`, {
    method: "POST",
    token: adminToken,
    body: {},
  });
  assert.equal(executed.status, 200);
  assert.equal(executed.data.execution.mode, "mock");
});

test("role-based access control separates agents, viewers and administrators", async () => {
  const agentUser = await call("/api/users", {
    method: "POST",
    token: adminToken,
    body: {
      name: "Ejen Operasi",
      email: "agent@example.test",
      password: "AgentPassword123!",
      role: "agent",
    },
  });
  assert.equal(agentUser.status, 201);
  const agentUserId = agentUser.data.user.id;

  const viewerUser = await call("/api/users", {
    method: "POST",
    token: adminToken,
    body: {
      name: "Pemerhati",
      email: "viewer@example.test",
      password: "ViewerPassword123!",
      role: "viewer",
    },
  });
  assert.equal(viewerUser.status, 201);

  const agentLogin = await login("agent@example.test", "AgentPassword123!");
  assert.equal(agentLogin.response.status, 200);
  agentToken = agentLogin.token;

  const viewerLogin = await login("viewer@example.test", "ViewerPassword123!");
  assert.equal(viewerLogin.response.status, 200);
  viewerToken = viewerLogin.token;

  const agentLeads = await call("/api/leads", { token: agentToken });
  assert.equal(agentLeads.status, 200);
  assert.equal(agentLeads.data.leads.length, 0, "agent sees only their own leads");

  const agentTask = await call("/api/tasks", {
    method: "POST",
    token: agentToken,
    body: { title: "Tugas ejen" },
  });
  assert.equal(agentTask.status, 201);

  const agentUsers = await call("/api/users", { token: agentToken });
  assert.equal(agentUsers.status, 403);

  const agentEscalation = await call(`/api/users/${agentUserId}`, {
    method: "PATCH",
    token: agentToken,
    body: { role: "admin" },
  });
  assert.equal(agentEscalation.status, 403, "agents cannot change their own role");

  const agentAdminPatch = await call(`/api/users/${adminId}`, {
    method: "PATCH",
    token: agentToken,
    body: { role: "viewer" },
  });
  assert.equal(agentAdminPatch.status, 403, "agents cannot modify administrators");

  const agentDecision = await call(`/api/approvals/${approvalId}/decision`, {
    method: "POST",
    token: agentToken,
    body: { decision: "rejected" },
  });
  assert.equal(agentDecision.status, 403);

  const agentExecution = await call(`/api/tasks/${agentTask.data.task.id}/execute`, {
    method: "POST",
    token: agentToken,
    body: {},
  });
  assert.equal(agentExecution.status, 200);
  assert.equal(agentExecution.data.execution.mode, "mock");

  const viewerDashboard = await call("/api/dashboard", { token: viewerToken });
  assert.equal(viewerDashboard.status, 200);

  const viewerTask = await call("/api/tasks", {
    method: "POST",
    token: viewerToken,
    body: { title: "Tidak dibenarkan" },
  });
  assert.equal(viewerTask.status, 403);

  const viewerLeads = await call("/api/leads", { token: viewerToken });
  assert.equal(viewerLeads.status, 403);

  const viewerAudit = await call("/api/audit-logs", { token: viewerToken });
  assert.equal(viewerAudit.status, 403);

  const viewerExecution = await call(`/api/tasks/${agentTask.data.task.id}/execute`, {
    method: "POST",
    token: viewerToken,
    body: {},
  });
  assert.equal(viewerExecution.status, 403);

  const selfDemote = await call(`/api/users/${adminId}`, {
    method: "PATCH",
    token: adminToken,
    body: { role: "viewer" },
  });
  assert.equal(selfDemote.status, 400, "administrators cannot demote themselves");

  const selfDisable = await call(`/api/users/${adminId}`, {
    method: "PATCH",
    token: adminToken,
    body: { status: "disabled" },
  });
  assert.equal(selfDisable.status, 400, "administrators cannot disable themselves");

  const disableAgent = await call(`/api/users/${agentUserId}`, {
    method: "PATCH",
    token: adminToken,
    body: { status: "disabled" },
  });
  assert.equal(disableAgent.status, 200);

  const disabledSession = await call("/api/dashboard", { token: agentToken });
  assert.equal(disabledSession.status, 401, "disabled users lose session access");

  const enableAgent = await call(`/api/users/${agentUserId}`, {
    method: "PATCH",
    token: adminToken,
    body: { status: "active" },
  });
  assert.equal(enableAgent.status, 200);

  const restoredSession = await call("/api/dashboard", { token: agentToken });
  assert.equal(restoredSession.status, 200);
});

test("users and audit logs are protected and never expose password hashes", async () => {
  const users = await call("/api/users", { token: adminToken });
  assert.equal(users.status, 200);
  assert.equal(users.data.users.length, 3);
  for (const user of users.data.users) {
    assert.equal(user.password_hash, undefined);
  }

  const forbidden = await call("/api/users", { token: viewerToken });
  assert.equal(forbidden.status, 403);

  const logs = await call("/api/audit-logs?limit=200", { token: adminToken });
  assert.equal(logs.status, 200);
  const actions = logs.data.logs.map((log) => log.action);
  for (const action of [
    "auth.setup",
    "auth.login",
    "auth.login_failed",
    "agent.create",
    "task.create",
    "task.execute",
    "task.execute_blocked",
    "task.auto_route",
    "task.tool",
    "task.tool_blocked",
    "lead.create",
    "approval.approved",
    "user.create",
  ]) {
    assert.ok(actions.includes(action), `audit log should include ${action}`);
  }
});

test("invalid content types and unknown routes fail safely", async () => {
  const wrongType = await call("/api/tasks", {
    method: "POST",
    token: adminToken,
    headers: { "content-type": "text/plain" },
    rawBody: "not json",
  });
  assert.equal(wrongType.status, 415);

  const notFound = await call("/api/does-not-exist", { token: adminToken });
  assert.equal(notFound.status, 404);

  const publicInfo = await call("/api/info");
  assert.equal(publicInfo.status, 200);
  assert.equal(publicInfo.data.phase, 2);
});

test("logout clears the session cookie", async () => {
  const response = await call("/api/auth/logout", {
    method: "POST",
    token: adminToken,
    body: {},
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie") ?? "";
  assert.match(cookie, /occ_session=;/);
  assert.match(cookie, /Max-Age=0/);
});

test("bootstrap stays permanently closed even after every user is removed", async () => {
  const db = await mf.getD1Database("DB");
  const flag = await db
    .prepare("SELECT value FROM system_settings WHERE key = 'bootstrap_completed'")
    .first();
  assert.equal(flag.value, "true");

  await db.prepare("DELETE FROM users").run();

  const response = await call("/api/auth/setup", {
    method: "POST",
    body: {
      name: "Penyusup",
      email: "reopen@example.test",
      password: "AnotherPassword123!",
    },
  });
  assert.equal(response.status, 409);
  assert.equal(response.data.error.code, "already_initialized");

  const me = await call("/api/auth/me");
  assert.equal(me.data.needsSetup, false, "setup must not reopen when users are removed");
});
