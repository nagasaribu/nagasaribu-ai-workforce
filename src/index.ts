import {
  clearSessionCookie,
  hashPassword,
  parseCookies,
  sessionCookie,
  signSession,
  verifyPassword,
  verifySession,
  SESSION_COOKIE,
} from "./auth.ts";
import { consoleHtml } from "./ui.ts";
import type { AuthUser, Env } from "./types.ts";
import { getProviderStatus, ProviderError } from "./providers/deepseek.ts";
import {
  executeAgent,
  parseAgentConfig,
  parseCapabilities,
  parseJsonObject,
  selectAgentForTask,
} from "./orchestrator.ts";
import {
  allowedTransitions,
  canTransition,
  isTaskState,
  legacyStatus,
  stateFromLegacy,
  stateOfTask,
  TASK_STATES,
  type TaskState,
} from "./state.ts";
import { getTool, isToolName, runSafeTool, ToolError } from "./tools.ts";

const SERVICE = "nagasaribu-ai-workforce";
const PHASE = 2;

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ["*"],
  manager: [
    "dashboard.read",
    "tasks.read",
    "tasks.write",
    "agents.read",
    "agents.write",
    "leads.read",
    "leads.write",
    "approvals.read",
    "approvals.write",
    "users.read",
    "audit.read",
  ],
  agent: [
    "dashboard.read",
    "tasks.read",
    "tasks.write",
    "agents.read",
    "leads.read",
    "leads.write",
    "approvals.read",
    "approvals.create",
  ],
  viewer: ["dashboard.read", "tasks.read", "agents.read"],
};

const TASK_PRIORITIES = ["low", "normal", "high", "urgent"];
const LEAD_STATUSES = ["new", "contacted", "qualified", "proposal", "won", "lost"];
const APPROVAL_STATUSES = ["pending", "approved", "rejected", "cancelled"];
const APPROVAL_ENTITIES = ["task", "lead", "agent", "campaign", "other"];
const USER_ROLES = ["admin", "manager", "agent", "viewer"];

class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code = "request_error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type Body = Record<string, unknown>;

const baseHeaders: Record<string, string> = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...baseHeaders,
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      ...baseHeaders,
      "content-type": "text/html; charset=utf-8",
      "content-security-policy":
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    },
  });
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return crypto.randomUUID();
}

function asInt(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function str(body: Body, key: string, max = 2000): string | undefined {
  const value = body[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new HttpError(400, `Medan ${key} mesti teks.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new HttpError(400, `Medan ${key} terlalu panjang.`);
  return trimmed;
}

function requiredStr(body: Body, key: string, max = 500): string {
  const value = str(body, key, max);
  if (!value) throw new HttpError(400, `Medan ${key} wajib diisi.`);
  return value;
}

function optionalText(body: Body, key: string, max = 2000): string | null | undefined {
  const value = body[key];
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new HttpError(400, `Medan ${key} mesti teks.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new HttpError(400, `Medan ${key} terlalu panjang.`);
  return trimmed;
}

function oneOf<T extends string>(value: string | undefined, allowed: T[], key: string): T | undefined {
  if (value === undefined) return undefined;
  if (!allowed.includes(value as T)) {
    throw new HttpError(400, `Nilai ${key} tidak sah.`);
  }
  return value as T;
}

function boolInt(body: Body, key: string): number | undefined {
  const value = body[key];
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value === 0 || value === 1) return value;
  throw new HttpError(400, `Medan ${key} mesti boolean.`);
}

function requestedState(body: Body): TaskState | undefined {
  const rawState = body.state;
  if (rawState !== undefined) {
    if (!isTaskState(rawState)) {
      throw new HttpError(400, "Nilai state tidak sah.");
    }
    return rawState;
  }
  const legacy = str(body, "status", 40);
  if (legacy === undefined) return undefined;
  return stateFromLegacy(legacy);
}

function stateColumns(state: TaskState): { execution_state: TaskState; status: string } {
  return { execution_state: state, status: legacyStatus(state) };
}

function stringArray(value: unknown, key: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new HttpError(400, `Medan ${key} mesti senarai teks.`);
  }
  return value.map((item) => (item as string).trim()).filter(Boolean).slice(0, 50);
}

function email(value: string, key = "email"): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) {
    throw new HttpError(400, `Alamat ${key} tidak sah.`);
  }
  return normalized;
}

function isoDate(value: string, key: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, `Tarikh ${key} tidak sah.`);
  return date.toISOString();
}

async function readJson(request: Request): Promise<Body> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new HttpError(415, "Permintaan mesti menggunakan application/json.", "unsupported_media_type");
  }
  const text = await request.text();
  if (text.length > 64 * 1024) throw new HttpError(413, "Permintaan terlalu besar.", "payload_too_large");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text || "{}");
  } catch {
    throw new HttpError(400, "JSON tidak sah.", "invalid_json");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new HttpError(400, "Badan permintaan mesti objek JSON.", "invalid_json");
  }
  return parsed as Body;
}

function assertSameOrigin(request: Request): void {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") return;
  const origin = request.headers.get("origin");
  if (!origin) return;
  const requestUrl = new URL(request.url);
  if (origin !== requestUrl.origin) {
    throw new HttpError(403, "Asalan permintaan tidak dibenarkan.", "origin_not_allowed");
  }
}

function clientIp(request: Request): string | null {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

async function audit(
  env: Env,
  request: Request,
  actorId: string | null,
  action: string,
  entityType = "",
  entityId = "",
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, ip_address, user_agent, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        newId(),
        actorId,
        action,
        entityType,
        entityId,
        clientIp(request),
        (request.headers.get("user-agent") ?? "").slice(0, 300),
        JSON.stringify(metadata),
      )
      .run();
  } catch (error) {
    console.error("audit_failed", error instanceof Error ? error.message : "unknown");
  }
}

// Best-effort, per-isolate protection against credential stuffing.
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT = 8;

function rateLimit(key: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return;
  }
  entry.count += 1;
  if (entry.count > RATE_LIMIT) {
    throw new HttpError(429, "Terlalu banyak cubaan. Sila cuba sebentar lagi.", "rate_limited");
  }
  if (loginAttempts.size > 5000) {
    for (const [mapKey, value] of loginAttempts) {
      if (value.resetAt <= now) loginAttempts.delete(mapKey);
    }
  }
}

function clearRateLimit(key: string): void {
  loginAttempts.delete(key);
}

function can(user: AuthUser, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[user.role] ?? [];
  return permissions.includes("*") || permissions.includes(permission);
}

function requirePermission(user: AuthUser, permission: string): void {
  if (!can(user, permission)) {
    throw new HttpError(403, "Anda tiada kebenaran untuk tindakan ini.", "forbidden");
  }
}

async function currentUser(request: Request, env: Env): Promise<AuthUser | null> {
  if (!env.SESSION_SECRET) return null;

  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  const token = bearer || parseCookies(request.headers.get("cookie"))[SESSION_COOKIE];
  const payload = await verifySession(token, env.SESSION_SECRET);
  if (!payload) return null;

  const user = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, r.name AS role, u.status
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.id = ?`,
  )
    .bind(payload.sub)
    .first<AuthUser>();

  if (!user || user.status !== "active") return null;
  return user;
}

async function requireUser(request: Request, env: Env): Promise<AuthUser> {
  const user = await currentUser(request, env);
  if (!user) throw new HttpError(401, "Sesi tidak sah atau telah tamat.", "unauthorized");
  return user;
}

async function userCount(env: Env): Promise<number> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM users").first<{ count: number }>();
  return Number(row?.count ?? 0);
}

async function getSetting(env: Env, key: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT value FROM system_settings WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

async function setSetting(env: Env, key: string, value: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  )
    .bind(key, value, nowIso())
    .run();
}

async function findUserByEmail(env: Env, address: string): Promise<
  | (AuthUser & { password_hash: string })
  | null
> {
  return env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.password_hash, r.name AS role, u.status
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.email = ?`,
  )
    .bind(address)
    .first<AuthUser & { password_hash: string }>();
}

function publicUser(user: AuthUser): Record<string, unknown> {
  return { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status };
}

const TASK_SELECT = `
  SELECT t.id, t.title, t.description, t.status, t.execution_state, t.priority,
         t.assigned_agent_id, t.assigned_user_id, t.created_by,
         t.due_at, t.metadata, t.result, t.last_error, t.last_execution_at,
         t.execution_mode, t.execution_count,
         t.created_at, t.updated_at, t.completed_at,
         (SELECT ap.status FROM approvals ap
          WHERE ap.entity_type = 'task' AND ap.entity_id = t.id
          ORDER BY ap.created_at DESC LIMIT 1) AS approval_status,
         a.name AS assigned_agent_name, u.name AS assigned_user_name, c.name AS created_by_name
  FROM tasks t
  LEFT JOIN agent_registry a ON a.id = t.assigned_agent_id
  LEFT JOIN users u ON u.id = t.assigned_user_id
  LEFT JOIN users c ON c.id = t.created_by`;

const LEAD_SELECT = `
  SELECT l.id, l.company_name, l.contact_name, l.email, l.phone, l.source_id,
         l.status, l.owner_user_id, l.notes, l.consent_status, l.do_not_contact,
         l.created_at, l.updated_at, s.name AS source_name, u.name AS owner_name
  FROM leads l
  LEFT JOIN lead_sources s ON s.id = l.source_id
  LEFT JOIN users u ON u.id = l.owner_user_id`;

const APPROVAL_SELECT = `
  SELECT ap.id, ap.entity_type, ap.entity_id, ap.title, ap.description, ap.status,
         ap.requested_by, ap.decided_by, ap.decision_note, ap.created_at, ap.updated_at, ap.decided_at,
         r.name AS requested_by_name, d.name AS decided_by_name
  FROM approvals ap
  LEFT JOIN users r ON r.id = ap.requested_by
  LEFT JOIN users d ON d.id = ap.decided_by`;

async function getTask(env: Env, id: string): Promise<Record<string, unknown> | null> {
  return env.DB.prepare(`${TASK_SELECT} WHERE t.id = ?`).bind(id).first<Record<string, unknown>>();
}

async function addTaskEvent(
  env: Env,
  taskId: string,
  eventType: string,
  actorId: string | null,
  message = "",
  fromStatus: string | null = null,
  toStatus: string | null = null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO task_events (id, task_id, event_type, actor_user_id, from_status, to_status, message, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(newId(), taskId, eventType, actorId, fromStatus, toStatus, message, JSON.stringify(metadata))
    .run();
}

async function handleAuth(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method;

  if (path === "/api/auth/me" && method === "GET") {
    const user = await currentUser(request, env);
    if (user) return json({ authenticated: true, user: publicUser(user) });
    const bootstrap = env.SESSION_SECRET ? await getSetting(env, "bootstrap_completed") : null;
    const count = env.SESSION_SECRET && bootstrap !== "true" ? await userCount(env) : 0;
    return json({
      authenticated: false,
      needsSetup: bootstrap !== "true" && count === 0,
      configured: Boolean(env.SESSION_SECRET),
    });
  }

  if (path === "/api/auth/setup" && method === "POST") {
    if (!env.SESSION_SECRET) {
      throw new HttpError(503, "Pengesahan belum dikonfigurasikan.", "auth_not_configured");
    }
    rateLimit(`setup:${clientIp(request) ?? "unknown"}`);

    if ((await getSetting(env, "bootstrap_completed")) === "true") {
      throw new HttpError(409, "Penyediaan awal telah selesai. Sila log masuk.", "already_initialized");
    }

    const body = await readJson(request);
    const name = requiredStr(body, "name", 120);
    const address = email(requiredStr(body, "email", 254));
    const password = requiredStr(body, "password", 200);
    if (password.length < 12) {
      throw new HttpError(400, "Kata laluan mesti sekurang-kurangnya 12 aksara.");
    }

    const hash = await hashPassword(password);
    const id = newId();
    const result = await env.DB.prepare(
      `INSERT INTO users (id, email, name, password_hash, role_id)
       SELECT ?, ?, ?, ?, 'role_admin'
       WHERE NOT EXISTS (SELECT 1 FROM users)
         AND NOT EXISTS (SELECT 1 FROM system_settings WHERE key = 'bootstrap_completed' AND value = 'true')`,
    )
      .bind(id, address, name, hash)
      .run();

    if (!result.meta.changes) {
      await setSetting(env, "bootstrap_completed", "true");
      throw new HttpError(409, "Penyediaan awal telah selesai. Sila log masuk.", "already_initialized");
    }

    await setSetting(env, "bootstrap_completed", "true");
    clearRateLimit(`setup:${clientIp(request) ?? "unknown"}`);
    await audit(env, request, id, "auth.setup", "user", id, { role: "admin" });
    const user: AuthUser = { id, email: address, name, role: "admin", status: "active" };
    const token = await signSession(id, env.SESSION_SECRET);
    return json(
      { authenticated: true, user: publicUser(user) },
      201,
      { "set-cookie": sessionCookie(token, new URL(request.url).protocol === "https:") },
    );
  }

  if (path === "/api/auth/login" && method === "POST") {
    if (!env.SESSION_SECRET) {
      throw new HttpError(503, "Pengesahan belum dikonfigurasikan.", "auth_not_configured");
    }
    const body = await readJson(request);
    const address = email(requiredStr(body, "email", 254));
    const password = requiredStr(body, "password", 200);
    const key = `login:${clientIp(request) ?? "unknown"}:${address}`;
    rateLimit(key);

    const user = await findUserByEmail(env, address);
    const valid = user ? await verifyPassword(password, user.password_hash) : false;
    if (!user || !valid || user.status !== "active") {
      await audit(env, request, user?.id ?? null, "auth.login_failed", "user", user?.id ?? "");
      throw new HttpError(401, "E-mel atau kata laluan tidak sah.", "invalid_credentials");
    }

    clearRateLimit(key);
    await env.DB.prepare("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?")
      .bind(nowIso(), nowIso(), user.id)
      .run();
    await audit(env, request, user.id, "auth.login", "user", user.id);

    const token = await signSession(user.id, env.SESSION_SECRET);
    return json(
      { authenticated: true, user: publicUser(user) },
      200,
      { "set-cookie": sessionCookie(token, new URL(request.url).protocol === "https:") },
    );
  }

  if (path === "/api/auth/logout" && method === "POST") {
    const user = await currentUser(request, env);
    if (user) await audit(env, request, user.id, "auth.logout", "user", user.id);
    return json({ ok: true }, 200, {
      "set-cookie": clearSessionCookie(new URL(request.url).protocol === "https:"),
    });
  }

  throw new HttpError(404, "Laluan tidak dijumpai.", "not_found");
}

async function handleDashboard(env: Env): Promise<Response> {
  const [
    taskStats,
    agentStats,
    leadStats,
    approvalStats,
    recentTasks,
    pendingApprovals,
    executionStats,
    recentActivity,
    recentErrors,
  ] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN execution_state NOT IN ('completed','cancelled') THEN 1 ELSE 0 END) AS active,
              SUM(CASE WHEN execution_state = 'completed' THEN 1 ELSE 0 END) AS completed,
              SUM(CASE WHEN execution_state = 'failed' THEN 1 ELSE 0 END) AS failed,
              SUM(CASE WHEN execution_state = 'blocked' THEN 1 ELSE 0 END) AS blocked
       FROM tasks`,
    ).first<{ total: number; active: number; completed: number; failed: number; blocked: number }>(),
    env.DB.prepare(
      `SELECT SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active, COUNT(*) AS total
       FROM agent_registry`,
    ).first<{ active: number; total: number }>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS new,
              SUM(CASE WHEN status = 'qualified' THEN 1 ELSE 0 END) AS qualified
       FROM leads`,
    ).first<{ total: number; new: number; qualified: number }>(),
    env.DB.prepare(
      `SELECT SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending, COUNT(*) AS total FROM approvals`,
    ).first<{ pending: number; total: number }>(),
    env.DB.prepare(`${TASK_SELECT} ORDER BY t.created_at DESC LIMIT 5`).all<Record<string, unknown>>(),
    env.DB.prepare(`${APPROVAL_SELECT} WHERE ap.status = 'pending' ORDER BY ap.created_at DESC LIMIT 5`)
      .all<Record<string, unknown>>(),
    env.DB.prepare(
      `SELECT
         SUM(CASE WHEN event_type = 'execution_started' THEN 1 ELSE 0 END) AS started,
         SUM(CASE WHEN event_type = 'execution_completed' THEN 1 ELSE 0 END) AS completed,
         SUM(CASE WHEN event_type = 'execution_failed' THEN 1 ELSE 0 END) AS failed,
         SUM(CASE WHEN event_type = 'execution_mock' THEN 1 ELSE 0 END) AS mock,
         SUM(CASE WHEN event_type = 'approval_required' THEN 1 ELSE 0 END) AS approval_blocked
       FROM task_events
       WHERE event_type IN ('execution_started','execution_completed','execution_failed','execution_mock','approval_required')`,
    ).first<{
      started: number;
      completed: number;
      failed: number;
      mock: number;
      approval_blocked: number;
    }>(),
    env.DB.prepare(
      `SELECT e.id, e.event_type, e.message, e.created_at,
              t.id AS task_id, t.title AS task_title, u.name AS actor_name
       FROM task_events e
       JOIN tasks t ON t.id = e.task_id
       LEFT JOIN users u ON u.id = e.actor_user_id
       WHERE e.event_type IN ('execution_started','execution_completed','execution_failed','execution_mock','approval_required','auto_routed','routing_failed')
       ORDER BY e.created_at DESC LIMIT 12`,
    ).all<Record<string, unknown>>(),
    env.DB.prepare(
      `SELECT id, title, last_error, last_execution_at, execution_mode
       FROM tasks WHERE last_error <> ''
       ORDER BY COALESCE(last_execution_at, updated_at) DESC LIMIT 8`,
    ).all<Record<string, unknown>>(),
  ]);

  const ai = getProviderStatus(env);

  return json({
    tasks: {
      total: Number(taskStats?.total ?? 0),
      active: Number(taskStats?.active ?? 0),
      completed: Number(taskStats?.completed ?? 0),
      failed: Number(taskStats?.failed ?? 0),
      blocked: Number(taskStats?.blocked ?? 0),
    },
    agents: { active: Number(agentStats?.active ?? 0), total: Number(agentStats?.total ?? 0) },
    leads: {
      total: Number(leadStats?.total ?? 0),
      new: Number(leadStats?.new ?? 0),
      qualified: Number(leadStats?.qualified ?? 0),
    },
    approvals: { pending: Number(approvalStats?.pending ?? 0), total: Number(approvalStats?.total ?? 0) },
    execution: {
      started: Number(executionStats?.started ?? 0),
      completed: Number(executionStats?.completed ?? 0),
      failed: Number(executionStats?.failed ?? 0),
      mock: Number(executionStats?.mock ?? 0),
      approvalBlocked: Number(executionStats?.approval_blocked ?? 0),
    },
    ai: {
      mode: ai.mode,
      configured: ai.configured,
      model: ai.model,
      reason: ai.reason ?? null,
    },
    recentTasks: recentTasks.results,
    pendingApprovals: pendingApprovals.results,
    recentActivity: recentActivity.results,
    recentErrors: recentErrors.results,
  });
}

async function executeTask(
  request: Request,
  env: Env,
  user: AuthUser,
  task: Record<string, unknown>,
  id: string,
): Promise<Response> {
  requirePermission(user, "tasks.write");

  const initialState = stateOfTask(task);
  if (initialState === "cancelled") {
    throw new HttpError(409, "Tugas yang dibatalkan tidak boleh dilaksanakan.", "task_cancelled");
  }
  if (initialState === "running") {
    throw new HttpError(409, "Tugas ini sedang berjalan.", "task_running");
  }

  const selection = await selectAgentForTask(env, task);
  if (!selection) {
    await addTaskEvent(env, id, "routing_failed", user.id, "Tiada ejen aktif untuk tugas ini.");
    await audit(env, request, user.id, "task.execute_blocked", "task", id, { reason: "no_agent" });
    throw new HttpError(409, "Tiada ejen aktif tersedia untuk tugas ini.", "no_agent");
  }

  const agent = selection.agent;
  if (agent.status !== "active") {
    await addTaskEvent(env, id, "routing_failed", user.id, `Ejen ${agent.name} tidak aktif.`);
    await audit(env, request, user.id, "task.execute_blocked", "task", id, {
      reason: "agent_inactive",
      agentId: agent.id,
    });
    throw new HttpError(409, `Ejen ${agent.name} tidak aktif. Sila tugaskan ejen lain.`, "agent_inactive");
  }

  const metadata = parseJsonObject(task.metadata);
  const agentConfig = parseAgentConfig(agent);
  const toolName = typeof metadata.tool === "string" ? metadata.tool : "";
  const tool = toolName ? getTool(toolName) : null;
  if (toolName && !tool) {
    await addTaskEvent(env, id, "tool_failed", user.id, `Alat ${toolName} tidak sah.`);
    await audit(env, request, user.id, "task.execute_blocked", "task", id, {
      reason: "invalid_tool",
      tool: toolName,
    });
    throw new HttpError(400, "Alat yang dipilih tidak sah.", "invalid_tool");
  }

  const requiresApproval =
    metadata.requiresApproval === true ||
    agentConfig.requiresApproval === true ||
    parseCapabilities(agent).includes("external_action") ||
    tool?.risk === "approval_required";

  if (requiresApproval) {
    const approved = await env.DB.prepare(
      `SELECT id FROM approvals
       WHERE entity_type = 'task' AND entity_id = ? AND status = 'approved'
       ORDER BY decided_at DESC LIMIT 1`,
    )
      .bind(id)
      .first<{ id: string }>();

    if (!approved) {
      const blockedAt = nowIso();
      const blockedColumns = stateColumns("blocked");
      await env.DB.prepare(
        `UPDATE tasks SET execution_state = ?, status = ?, last_error = ?, updated_at = ? WHERE id = ?`,
      )
        .bind(
          blockedColumns.execution_state,
          blockedColumns.status,
          "Kelulusan diperlukan sebelum pelaksanaan.",
          blockedAt,
          id,
        )
        .run();
      await addTaskEvent(
        env,
        id,
        "approval_required",
        user.id,
        "Pelaksanaan disekat sehingga kelulusan diluluskan.",
        initialState,
        "blocked",
        { agentId: agent.id, tool: toolName || null },
      );
      await audit(env, request, user.id, "task.execute_blocked", "task", id, {
        reason: "approval_required",
        agentId: agent.id,
        tool: toolName || null,
      });
      return json(
        {
          error: {
            code: "approval_required",
            message: "Kelulusan diperlukan sebelum tugas ini boleh dilaksanakan.",
          },
          task: await getTask(env, id),
        },
        409,
      );
    }
  }

  let workingState = stateOfTask(task);
  if (selection.reason !== "assigned" || workingState === "pending") {
    if (!canTransition(workingState, "assigned")) {
      throw new HttpError(
        409,
        `Peralihan ${workingState} → assigned tidak dibenarkan.`,
        "invalid_transition",
      );
    }
    const assignedColumns = stateColumns("assigned");
    await env.DB.prepare(
      `UPDATE tasks SET assigned_agent_id = ?, status = ?, execution_state = ?, last_error = '', updated_at = ? WHERE id = ?`,
    )
      .bind(agent.id, assignedColumns.status, assignedColumns.execution_state, nowIso(), id)
      .run();
    await addTaskEvent(
      env,
      id,
      selection.reason === "assigned" ? "assigned" : "auto_routed",
      user.id,
      selection.reason === "assigned"
        ? "Tugas ditugaskan kepada ejen."
        : `SARA memilih ${agent.name} untuk tugas ini.`,
      workingState,
      "assigned",
      { agentId: agent.id, reason: selection.reason },
    );
    if (selection.reason !== "assigned") {
      await audit(env, request, user.id, "task.auto_route", "task", id, {
        agentId: agent.id,
        reason: selection.reason,
      });
    }
    workingState = "assigned";
  }

  if (!canTransition(workingState, "running")) {
    throw new HttpError(
      409,
      `Peralihan ${workingState} → running tidak dibenarkan.`,
      "invalid_transition",
    );
  }

  const provider = getProviderStatus(env);
  const startedAt = nowIso();
  const runningColumns = stateColumns("running");
  const started = await env.DB.prepare(
    `UPDATE tasks
     SET execution_state = 'running', status = ?, last_error = '', last_execution_at = ?,
         execution_mode = ?, execution_count = execution_count + 1, completed_at = NULL, updated_at = ?
     WHERE id = ? AND execution_state <> 'running' AND execution_state <> 'cancelled'`,
  )
    .bind(runningColumns.status, startedAt, provider.mode, startedAt, id)
    .run();

  if (!started.meta.changes) {
    throw new HttpError(409, "Tugas ini sedang berjalan.", "task_running");
  }

  await addTaskEvent(
    env,
    id,
    "execution_started",
    user.id,
    `Pelaksanaan bermula oleh ${agent.name} (mod ${provider.mode}).`,
    workingState,
    "running",
    { agentId: agent.id, mode: provider.mode, model: provider.model, tool: toolName || null },
  );

  let toolOutput: unknown;
  if (tool?.risk === "safe") {
    try {
      toolOutput = await runSafeTool(env, { ...task, assigned_agent_id: agent.id, execution_state: "running" }, tool.name);
      await addTaskEvent(
        env,
        id,
        "tool_completed",
        user.id,
        `Alat ${tool.name} selesai dijalankan.`,
        "running",
        "running",
        { tool: tool.name, risk: "safe" },
      );
      await audit(env, request, user.id, "task.tool", "task", id, {
        tool: tool.name,
        outcome: "completed",
      });
    } catch (error) {
      const toolError =
        error instanceof ToolError ? error : new ToolError("tool_failed", "Alat dalaman gagal dijalankan.");
      const failedAt = nowIso();
      const failedColumns = stateColumns("failed");
      await env.DB.prepare(
        `UPDATE tasks SET execution_state = 'failed', status = ?, last_error = ?, last_execution_at = ?, updated_at = ? WHERE id = ?`,
      )
        .bind(failedColumns.status, toolError.message, failedAt, failedAt, id)
        .run();
      await addTaskEvent(
        env,
        id,
        "tool_failed",
        user.id,
        toolError.message,
        "running",
        "failed",
        { tool: tool.name, code: toolError.code },
      );
      await audit(env, request, user.id, "task.tool", "task", id, {
        tool: tool.name,
        outcome: "failed",
        code: toolError.code,
      });
      return json(
        {
          error: { code: toolError.code, message: toolError.message },
          task: await getTask(env, id),
        },
        502,
      );
    }
  }

  if (tool?.risk === "approval_required") {
    const blockedAt = nowIso();
    const blockedColumns = stateColumns("blocked");
    await env.DB.prepare(
      `UPDATE tasks SET execution_state = 'blocked', status = ?, last_error = ?, last_execution_at = ?, updated_at = ? WHERE id = ?`,
    )
      .bind(
        blockedColumns.status,
        "Alat luaran belum dikonfigurasikan; tiada tindakan dijalankan.",
        blockedAt,
        blockedAt,
        id,
      )
      .run();
    await addTaskEvent(
      env,
      id,
      "tool_not_configured",
      user.id,
      "Alat luaran belum dikonfigurasikan; tiada tindakan dijalankan.",
      "running",
      "blocked",
      { tool: tool.name, risk: "approval_required" },
    );
    await audit(env, request, user.id, "task.tool", "task", id, {
      tool: tool.name,
      outcome: "not_configured",
    });
    return json(
      {
        error: {
          code: "tool_not_configured",
          message: "Alat luaran belum dikonfigurasikan; tiada tindakan dijalankan.",
        },
        task: await getTask(env, id),
      },
      409,
    );
  }

  try {
    const providerResult = await executeAgent(
      env,
      agent,
      { ...task, assigned_agent_id: agent.id, execution_state: "running" },
      toolOutput,
    );
    const finishedAt = nowIso();
    const live = providerResult.mode === "live";
    const finalState: TaskState = live ? "completed" : "blocked";
    const finalColumns = stateColumns(finalState);
    const mockError = live
      ? ""
      : "Mod mock: DEEPSEEK_API_KEY tiada; tiada pelaksanaan AI sebenar berlaku.";

    await env.DB.prepare(
      `UPDATE tasks
       SET execution_state = ?, status = ?, result = ?, last_error = ?, execution_mode = ?,
           last_execution_at = ?, completed_at = ?, updated_at = ?
       WHERE id = ?`,
    )
      .bind(
        finalColumns.execution_state,
        finalColumns.status,
        providerResult.content.slice(0, 20_000),
        mockError,
        providerResult.mode,
        finishedAt,
        live ? finishedAt : null,
        finishedAt,
        id,
      )
      .run();

    await addTaskEvent(
      env,
      id,
      live ? "execution_completed" : "execution_mock",
      user.id,
      providerResult.content.slice(0, 4000),
      "running",
      finalState,
      {
        agentId: agent.id,
        mode: providerResult.mode,
        model: providerResult.model,
        latencyMs: providerResult.latencyMs,
        usage: providerResult.usage ?? null,
        requestId: providerResult.requestId ?? null,
        tool: toolName || null,
      },
    );
    await audit(env, request, user.id, "task.execute", "task", id, {
      agentId: agent.id,
      mode: providerResult.mode,
      model: providerResult.model,
      outcome: live ? "completed" : "mock_only",
      success: live,
    });

    return json({
      task: await getTask(env, id),
      execution: {
        mode: providerResult.mode,
        live,
        success: live,
        model: providerResult.model,
        latencyMs: providerResult.latencyMs,
        usage: providerResult.usage ?? null,
        requestId: providerResult.requestId ?? null,
        agent: { id: agent.id, name: agent.name },
        tool: toolName || null,
      },
    });
  } catch (error) {
    const providerError =
      error instanceof ProviderError
        ? error
        : new ProviderError("provider_error", "Pelaksanaan AI gagal.", 502);
    const failedAt = nowIso();
    const failedColumns = stateColumns("failed");

    await env.DB.prepare(
      `UPDATE tasks
       SET execution_state = 'failed', status = ?, result = '', last_error = ?, execution_mode = ?,
           last_execution_at = ?, updated_at = ?
       WHERE id = ?`,
    )
      .bind(failedColumns.status, providerError.message, provider.mode, failedAt, failedAt, id)
      .run();

    await addTaskEvent(
      env,
      id,
      "execution_failed",
      user.id,
      providerError.message,
      "running",
      "failed",
      { agentId: agent.id, mode: provider.mode, code: providerError.code },
    );
    await audit(env, request, user.id, "task.execute", "task", id, {
      agentId: agent.id,
      mode: provider.mode,
      outcome: "failed",
      success: false,
      code: providerError.code,
    });

    return json(
      {
        error: { code: providerError.code, message: providerError.message },
        task: await getTask(env, id),
      },
      providerError.status,
    );
  }
}
async function handleTasks(
  request: Request,
  env: Env,
  user: AuthUser,
  segments: string[],
  url: URL,
): Promise<Response> {
  const method = request.method;
  const id = segments[2];
  const action = segments[3];

  if (!id) {
    if (method === "GET") {
      requirePermission(user, "tasks.read");
      const where: string[] = [];
      const params: unknown[] = [];

      const stateParam = url.searchParams.get("state") ?? url.searchParams.get("status");
      if (stateParam) {
        if (stateParam !== "in_progress" && !isTaskState(stateParam)) {
          throw new HttpError(400, "Nilai state tidak sah.");
        }
        where.push("t.execution_state = ?");
        params.push(stateFromLegacy(stateParam));
      }
      const priority = oneOf(url.searchParams.get("priority") ?? undefined, TASK_PRIORITIES, "priority");
      if (priority) {
        where.push("t.priority = ?");
        params.push(priority);
      }
      const agentId = url.searchParams.get("agentId");
      if (agentId) {
        where.push("t.assigned_agent_id = ?");
        params.push(agentId);
      }
      const q = (url.searchParams.get("q") ?? "").trim();
      if (q) {
        where.push("(t.title LIKE ? OR t.description LIKE ?)");
        params.push(`%${q}%`, `%${q}%`);
      }

      const limit = asInt(url.searchParams.get("limit"), 50, 1, 100);
      const offset = asInt(url.searchParams.get("offset"), 0, 0, 10000);
      const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const result = await env.DB.prepare(
        `${TASK_SELECT} ${clause} ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
      )
        .bind(...params, limit, offset)
        .all<Record<string, unknown>>();
      return json({ tasks: result.results, limit, offset });
    }

    if (method === "POST") {
      requirePermission(user, "tasks.write");
      const body = await readJson(request);
      const title = requiredStr(body, "title", 200);
      const description = str(body, "description", 5000) ?? "";
      const priority = oneOf(str(body, "priority"), TASK_PRIORITIES, "priority") ?? "normal";
      const dueAtRaw = str(body, "dueAt", 40);
      const dueAt = dueAtRaw ? isoDate(dueAtRaw, "dueAt") : null;
      const assignedAgentId = str(body, "assignedAgentId", 64) || null;
      const assignedUserId = str(body, "assignedUserId", 64) || null;
      const capability = str(body, "capability", 80);
      const requiresApproval = boolInt(body, "requiresApproval");
      const toolName = str(body, "tool", 60);

      const metadata: Record<string, unknown> = {};
      if (capability) metadata.capability = capability;
      if (requiresApproval !== undefined) metadata.requiresApproval = Boolean(requiresApproval);
      if (toolName) {
        if (!isToolName(toolName)) throw new HttpError(400, "Alat yang dipilih tidak sah.");
        metadata.tool = toolName;
        if (getTool(toolName)?.risk === "approval_required") metadata.requiresApproval = true;
      }

      if (assignedAgentId) {
        const agent = await env.DB.prepare("SELECT id FROM agent_registry WHERE id = ?")
          .bind(assignedAgentId)
          .first();
        if (!agent) throw new HttpError(400, "Ejen yang dipilih tidak wujud.");
      }
      if (assignedUserId) {
        const assignee = await env.DB.prepare("SELECT id FROM users WHERE id = ?")
          .bind(assignedUserId)
          .first();
        if (!assignee) throw new HttpError(400, "Pengguna yang dipilih tidak wujud.");
      }

      const id = newId();
      const state: TaskState = assignedAgentId || assignedUserId ? "assigned" : "pending";
      const columns = stateColumns(state);
      await env.DB.prepare(
        `INSERT INTO tasks (id, title, description, status, execution_state, priority, assigned_agent_id, assigned_user_id, created_by, due_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          id,
          title,
          description,
          columns.status,
          columns.execution_state,
          priority,
          assignedAgentId,
          assignedUserId,
          user.id,
          dueAt,
          JSON.stringify(metadata),
        )
        .run();

      await addTaskEvent(
        env,
        id,
        "created",
        user.id,
        assignedAgentId || assignedUserId ? "Tugas dicipta dan ditugaskan." : "Tugas dicipta.",
        null,
        state,
      );
      await audit(env, request, user.id, "task.create", "task", id, {
        priority,
        capability: capability ?? null,
        tool: toolName ?? null,
        requiresApproval: metadata.requiresApproval === true,
      });
      return json({ task: await getTask(env, id) }, 201);
    }

    throw new HttpError(405, "Kaedah tidak dibenarkan.", "method_not_allowed");
  }

  const task = await getTask(env, id);
  if (!task) throw new HttpError(404, "Tugas tidak dijumpai.", "not_found");

  const taskAssignedUserId = task.assigned_user_id as string | null;
  const taskCreatedBy = task.created_by as string | null;
  if (user.role === "agent" && taskAssignedUserId !== user.id && taskCreatedBy !== user.id) {
    throw new HttpError(403, "Anda hanya boleh mengemas kini tugas anda sendiri.", "forbidden");
  }

  if (!action && method === "GET") {
    requirePermission(user, "tasks.read");
    const events = await env.DB.prepare(
      `SELECT e.id, e.event_type, e.from_status, e.to_status, e.message, e.metadata, e.created_at,
              u.name AS actor_name
       FROM task_events e LEFT JOIN users u ON u.id = e.actor_user_id
       WHERE e.task_id = ? ORDER BY e.created_at ASC`,
    )
      .bind(id)
      .all<Record<string, unknown>>();
    return json({ task, events: events.results });
  }

  if (!action && method === "PATCH") {
    requirePermission(user, "tasks.write");
    const body = await readJson(request);

    const title = str(body, "title", 200);
    const description = str(body, "description", 5000);
    const nextState = requestedState(body);
    const priority = oneOf(str(body, "priority"), TASK_PRIORITIES, "priority");
    const dueAtRaw = optionalText(body, "dueAt", 40);
    const dueAt = dueAtRaw === undefined ? undefined : dueAtRaw ? isoDate(dueAtRaw, "dueAt") : null;
    const assignedAgentId = optionalText(body, "assignedAgentId", 64);
    const assignedUserId = optionalText(body, "assignedUserId", 64);
    const capability = str(body, "capability", 80);
    const requiresApproval = boolInt(body, "requiresApproval");
    const toolName = str(body, "tool", 60);
    const currentState = stateOfTask(task);

    const updates: string[] = [];
    const params: unknown[] = [];
    const push = (column: string, value: unknown): void => {
      updates.push(`${column} = ?`);
      params.push(value);
    };

    if (title !== undefined) push("title", title);
    if (description !== undefined) push("description", description);
    if (priority !== undefined) push("priority", priority);
    if (dueAt !== undefined) push("due_at", dueAt);
    if (assignedAgentId !== undefined) push("assigned_agent_id", assignedAgentId || null);
    if (assignedUserId !== undefined) push("assigned_user_id", assignedUserId || null);

    if (capability !== undefined || requiresApproval !== undefined || toolName !== undefined) {
      const metadata = parseJsonObject(task.metadata);
      if (capability !== undefined) {
        if (capability) metadata.capability = capability;
        else delete metadata.capability;
      }
      if (requiresApproval !== undefined) metadata.requiresApproval = Boolean(requiresApproval);
      if (toolName !== undefined) {
        if (toolName) {
          if (!isToolName(toolName)) throw new HttpError(400, "Alat yang dipilih tidak sah.");
          metadata.tool = toolName;
          if (getTool(toolName)?.risk === "approval_required") metadata.requiresApproval = true;
        } else {
          delete metadata.tool;
        }
      }
      push("metadata", JSON.stringify(metadata));
    }

    if (assignedAgentId) {
      const agent = await env.DB.prepare("SELECT id FROM agent_registry WHERE id = ?")
        .bind(assignedAgentId)
        .first();
      if (!agent) throw new HttpError(400, "Ejen yang dipilih tidak wujud.");
    }
    if (assignedUserId) {
      const assignee = await env.DB.prepare("SELECT id FROM users WHERE id = ?")
        .bind(assignedUserId)
        .first();
      if (!assignee) throw new HttpError(400, "Pengguna yang dipilih tidak wujud.");
    }

    if (nextState !== undefined) {
      if (!canTransition(currentState, nextState)) {
        throw new HttpError(
          409,
          `Peralihan ${currentState} → ${nextState} tidak dibenarkan.`,
          "invalid_transition",
        );
      }
      const columns = stateColumns(nextState);
      push("execution_state", columns.execution_state);
      push("status", columns.status);
      if (nextState === "completed") push("completed_at", nowIso());
      else push("completed_at", null);
    }

    if (!updates.length) throw new HttpError(400, "Tiada perubahan dihantar.");
    push("updated_at", nowIso());
    await env.DB.prepare(`UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...params, id)
      .run();

    if (nextState && nextState !== currentState) {
      await addTaskEvent(env, id, "state_changed", user.id, "", currentState, nextState);
    }
    if (assignedAgentId !== undefined || assignedUserId !== undefined) {
      await addTaskEvent(env, id, "assigned", user.id, "Penugasan dikemas kini.");
    }
    await audit(env, request, user.id, "task.update", "task", id, {
      fields: updates.map((entry) => entry.split(" ")[0]),
      fromState: currentState,
      toState: nextState ?? currentState,
    });
    return json({ task: await getTask(env, id) });
  }

  if (action === "assign" && method === "POST") {
    requirePermission(user, "tasks.write");
    const body = await readJson(request);
    const agentId = str(body, "agentId", 64) || null;
    const userId = str(body, "userId", 64) || null;
    if (!agentId && !userId) throw new HttpError(400, "Sila pilih ejen atau pengguna.");

    if (agentId) {
      const agent = await env.DB.prepare("SELECT id, status FROM agent_registry WHERE id = ?")
        .bind(agentId)
        .first<{ id: string; status: string }>();
      if (!agent) throw new HttpError(400, "Ejen yang dipilih tidak wujud.");
      if (agent.status !== "active") throw new HttpError(409, "Ejen yang dipilih tidak aktif.", "agent_inactive");
    }
    if (userId) {
      const assignee = await env.DB.prepare("SELECT id FROM users WHERE id = ?")
        .bind(userId)
        .first();
      if (!assignee) throw new HttpError(400, "Pengguna yang dipilih tidak wujud.");
    }

    const currentState = stateOfTask(task);
    if (currentState === "running") {
      throw new HttpError(409, "Tugas sedang berjalan dan tidak boleh ditugaskan semula.", "task_running");
    }
    if (!canTransition(currentState, "assigned")) {
      throw new HttpError(409, `Peralihan ${currentState} → assigned tidak dibenarkan.`, "invalid_transition");
    }
    const columns = stateColumns("assigned");
    await env.DB.prepare(
      `UPDATE tasks SET assigned_agent_id = ?, assigned_user_id = ?, status = ?, execution_state = ?, updated_at = ? WHERE id = ?`,
    )
      .bind(agentId, userId, columns.status, columns.execution_state, nowIso(), id)
      .run();
    await addTaskEvent(
      env,
      id,
      "assigned",
      user.id,
      "Tugas ditugaskan semula.",
      currentState,
      "assigned",
      { agentId, userId },
    );
    await audit(env, request, user.id, "task.assign", "task", id, {
      agentId,
      userId,
      fromState: currentState,
      toState: "assigned",
    });
    return json({ task: await getTask(env, id) });
  }

  if (action === "auto-assign" && method === "POST") {
    requirePermission(user, "tasks.write");
    const currentState = stateOfTask(task);
    if (currentState === "running" || currentState === "cancelled") {
      throw new HttpError(409, "Tugas ini tidak boleh diagihkan semula.", "invalid_transition");
    }

    const selection = await selectAgentForTask(env, task);
    if (!selection || selection.agent.status !== "active") {
      await addTaskEvent(env, id, "routing_failed", user.id, "Tiada ejen aktif untuk tugas ini.");
      await audit(env, request, user.id, "task.execute_blocked", "task", id, { reason: "no_agent" });
      throw new HttpError(409, "Tiada ejen aktif tersedia untuk tugas ini.", "no_agent");
    }
    if (!canTransition(currentState, "assigned")) {
      throw new HttpError(409, `Peralihan ${currentState} → assigned tidak dibenarkan.`, "invalid_transition");
    }

    const columns = stateColumns("assigned");
    await env.DB.prepare(
      `UPDATE tasks SET assigned_agent_id = ?, status = ?, execution_state = ?, updated_at = ? WHERE id = ?`,
    )
      .bind(selection.agent.id, columns.status, columns.execution_state, nowIso(), id)
      .run();
    await addTaskEvent(
      env,
      id,
      "auto_routed",
      user.id,
      `SARA memilih ${selection.agent.name} untuk tugas ini.`,
      currentState,
      "assigned",
      { agentId: selection.agent.id, reason: selection.reason },
    );
    await audit(env, request, user.id, "task.auto_route", "task", id, {
      agentId: selection.agent.id,
      reason: selection.reason,
    });
    return json({
      task: await getTask(env, id),
      agent: { id: selection.agent.id, name: selection.agent.name },
      reason: selection.reason,
    });
  }

  if (action === "events" && method === "POST") {
    requirePermission(user, "tasks.write");
    const body = await readJson(request);
    const message = requiredStr(body, "message", 2000);
    const eventType = str(body, "eventType", 40) || "comment";
    await addTaskEvent(env, id, eventType, user.id, message);
    await audit(env, request, user.id, "task.event", "task", id);
    const events = await env.DB.prepare(
      `SELECT e.id, e.event_type, e.from_status, e.to_status, e.message, e.created_at, u.name AS actor_name
       FROM task_events e LEFT JOIN users u ON u.id = e.actor_user_id
       WHERE e.task_id = ? ORDER BY e.created_at ASC`,
    )
      .bind(id)
      .all<Record<string, unknown>>();
    return json({ events: events.results }, 201);
  }

  if (action === "tools" && method === "POST") {
    requirePermission(user, "tasks.write");
    const toolName = segments[4] ?? "";
    const tool = getTool(toolName);
    if (!tool) throw new HttpError(404, "Alat tidak dijumpai.", "tool_not_found");

    const currentState = stateOfTask(task);
    if (currentState === "cancelled") {
      throw new HttpError(409, "Tugas yang dibatalkan tidak boleh menjalankan alat.", "task_cancelled");
    }

    if (tool.risk === "approval_required") {
      const approved = await env.DB.prepare(
        `SELECT id FROM approvals
         WHERE entity_type = 'task' AND entity_id = ? AND status = 'approved'
         ORDER BY decided_at DESC LIMIT 1`,
      )
        .bind(id)
        .first<{ id: string }>();

      if (!approved) {
        const blockedColumns = stateColumns("blocked");
        await env.DB.prepare(
          `UPDATE tasks SET execution_state = 'blocked', status = ?, last_error = ?, updated_at = ? WHERE id = ?`,
        )
          .bind(blockedColumns.status, "Kelulusan diperlukan untuk alat luaran.", nowIso(), id)
          .run();
        await addTaskEvent(
          env,
          id,
          "tool_blocked",
          user.id,
          "Alat luaran disekat sehingga kelulusan diluluskan.",
          currentState,
          "blocked",
          { tool: tool.name, risk: tool.risk },
        );
        await audit(env, request, user.id, "task.tool_blocked", "task", id, {
          tool: tool.name,
          reason: "approval_required",
        });
        return json(
          {
            error: {
              code: "approval_required",
              message: "Kelulusan diperlukan sebelum alat luaran ini boleh dijalankan.",
            },
            task: await getTask(env, id),
          },
          409,
        );
      }

      const blockedColumns = stateColumns("blocked");
      await env.DB.prepare(
        `UPDATE tasks SET execution_state = 'blocked', status = ?, last_error = ?, updated_at = ? WHERE id = ?`,
      )
        .bind(
          blockedColumns.status,
          "Alat luaran belum dikonfigurasikan; tiada tindakan dijalankan.",
          nowIso(),
          id,
        )
        .run();
      await addTaskEvent(
        env,
        id,
        "tool_not_configured",
        user.id,
        "Alat luaran belum dikonfigurasikan; tiada tindakan dijalankan.",
        currentState,
        "blocked",
        { tool: tool.name, risk: tool.risk },
      );
      await audit(env, request, user.id, "task.tool", "task", id, {
        tool: tool.name,
        outcome: "not_configured",
      });
      return json(
        {
          error: {
            code: "tool_not_configured",
            message: "Alat luaran belum dikonfigurasikan; tiada tindakan dijalankan.",
          },
          task: await getTask(env, id),
        },
        409,
      );
    }

    try {
      const output = await runSafeTool(env, task, tool.name);
      await addTaskEvent(env, id, "tool_completed", user.id, `Alat ${tool.name} selesai dijalankan.`, null, null, {
        tool: tool.name,
        risk: "safe",
      });
      await audit(env, request, user.id, "task.tool", "task", id, {
        tool: tool.name,
        outcome: "completed",
      });
      return json({ tool: { name: tool.name, risk: tool.risk }, output });
    } catch (error) {
      const toolError =
        error instanceof ToolError ? error : new ToolError("tool_failed", "Alat dalaman gagal dijalankan.");
      await addTaskEvent(env, id, "tool_failed", user.id, toolError.message);
      await audit(env, request, user.id, "task.tool", "task", id, {
        tool: tool.name,
        outcome: "failed",
        code: toolError.code,
      });
      return json(
        { error: { code: toolError.code, message: toolError.message } },
        502,
      );
    }
  }

  if (action === "execute" && method === "POST") {
    return executeTask(request, env, user, task, id);
  }

  throw new HttpError(404, "Laluan tidak dijumpai.", "not_found");
}

async function handleAgents(
  request: Request,
  env: Env,
  user: AuthUser,
  segments: string[],
  url: URL,
): Promise<Response> {
  const method = request.method;
  const id = segments[2];

  if (!id) {
    if (method === "GET") {
      requirePermission(user, "agents.read");
      const where: string[] = [];
      const params: unknown[] = [];
      const status = oneOf(url.searchParams.get("status") ?? undefined, ["active", "paused", "retired"], "status");
      if (status) {
        where.push("a.status = ?");
        params.push(status);
      }
      const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const result = await env.DB.prepare(
        `SELECT a.id, a.name, a.kind, a.description, a.status, a.capabilities, a.config,
                a.created_by, a.created_at, a.updated_at,
                COALESCE((SELECT COUNT(*) FROM tasks t
                          WHERE t.assigned_agent_id = a.id
                            AND t.execution_state NOT IN ('completed', 'cancelled')), 0) AS active_tasks
         FROM agent_registry a ${clause} ORDER BY a.created_at DESC LIMIT 100`,
      )
        .bind(...params)
        .all<Record<string, unknown>>();
      return json({ agents: result.results });
    }

    if (method === "POST") {
      requirePermission(user, "agents.write");
      const body = await readJson(request);
      const name = requiredStr(body, "name", 120);
      const kind = str(body, "kind", 60) || "general";
      const description = str(body, "description", 2000) ?? "";
      const capabilities = stringArray(body.capabilities, "capabilities") ?? [];
      const config = body.config && typeof body.config === "object" ? body.config : {};
      const id = newId();

      try {
        await env.DB.prepare(
          `INSERT INTO agent_registry (id, name, kind, description, capabilities, config, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(id, name, kind, description, JSON.stringify(capabilities), JSON.stringify(config), user.id)
          .run();
      } catch (error) {
        if (error instanceof Error && /UNIQUE/i.test(error.message)) {
          throw new HttpError(409, "Nama ejen telah digunakan.", "duplicate");
        }
        throw error;
      }

      await audit(env, request, user.id, "agent.create", "agent", id, { kind });
      const agent = await env.DB.prepare("SELECT * FROM agent_registry WHERE id = ?").bind(id).first();
      return json({ agent }, 201);
    }

    throw new HttpError(405, "Kaedah tidak dibenarkan.", "method_not_allowed");
  }

  const agent = await env.DB.prepare("SELECT * FROM agent_registry WHERE id = ?")
    .bind(id)
    .first<Record<string, unknown>>();
  if (!agent) throw new HttpError(404, "Ejen tidak dijumpai.", "not_found");

  if (method === "GET") {
    requirePermission(user, "agents.read");
    return json({ agent });
  }

  if (method === "PATCH") {
    requirePermission(user, "agents.write");
    const body = await readJson(request);
    const updates: string[] = [];
    const params: unknown[] = [];
    const push = (column: string, value: unknown): void => {
      updates.push(`${column} = ?`);
      params.push(value);
    };

    const name = str(body, "name", 120);
    const kind = str(body, "kind", 60);
    const description = str(body, "description", 2000);
    const status = oneOf(str(body, "status"), ["active", "paused", "retired"], "status");
    const capabilities = stringArray(body.capabilities, "capabilities");
    const config = body.config && typeof body.config === "object" ? body.config : undefined;

    if (name !== undefined) push("name", name);
    if (kind !== undefined) push("kind", kind);
    if (description !== undefined) push("description", description);
    if (status !== undefined) push("status", status);
    if (capabilities !== undefined) push("capabilities", JSON.stringify(capabilities));
    if (config !== undefined) push("config", JSON.stringify(config));
    if (!updates.length) throw new HttpError(400, "Tiada perubahan dihantar.");

    push("updated_at", nowIso());
    try {
      await env.DB.prepare(`UPDATE agent_registry SET ${updates.join(", ")} WHERE id = ?`)
        .bind(...params, id)
        .run();
    } catch (error) {
      if (error instanceof Error && /UNIQUE/i.test(error.message)) {
        throw new HttpError(409, "Nama ejen telah digunakan.", "duplicate");
      }
      throw error;
    }
    await audit(env, request, user.id, "agent.update", "agent", id);
    return json({
      agent: await env.DB.prepare("SELECT * FROM agent_registry WHERE id = ?").bind(id).first(),
    });
  }

  throw new HttpError(405, "Kaedah tidak dibenarkan.", "method_not_allowed");
}

function leadVisible(user: AuthUser, lead: Record<string, unknown>): boolean {
  if (user.role === "agent") return lead.owner_user_id === user.id;
  return true;
}

async function handleLeads(
  request: Request,
  env: Env,
  user: AuthUser,
  segments: string[],
  url: URL,
): Promise<Response> {
  const method = request.method;
  const id = segments[2];

  if (!id) {
    if (method === "GET") {
      requirePermission(user, "leads.read");
      const where: string[] = [];
      const params: unknown[] = [];

      const status = oneOf(url.searchParams.get("status") ?? undefined, LEAD_STATUSES, "status");
      if (status) {
        where.push("l.status = ?");
        params.push(status);
      }
      const sourceId = url.searchParams.get("sourceId");
      if (sourceId) {
        where.push("l.source_id = ?");
        params.push(sourceId);
      }
      const q = (url.searchParams.get("q") ?? "").trim();
      if (q) {
        where.push("(l.company_name LIKE ? OR l.contact_name LIKE ?)");
        params.push(`%${q}%`, `%${q}%`);
      }
      if (user.role === "agent") {
        where.push("l.owner_user_id = ?");
        params.push(user.id);
      }

      const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const result = await env.DB.prepare(
        `${LEAD_SELECT} ${clause} ORDER BY l.created_at DESC LIMIT 100`,
      )
        .bind(...params)
        .all<Record<string, unknown>>();
      return json({ leads: result.results });
    }

    if (method === "POST") {
      requirePermission(user, "leads.write");
      const body = await readJson(request);
      const companyName = requiredStr(body, "companyName", 200);
      const contactName = str(body, "contactName", 120) ?? "";
      const emailRaw = str(body, "email", 254);
      const emailValue = emailRaw ? email(emailRaw) : "";
      const phone = str(body, "phone", 40) ?? "";
      const sourceId = str(body, "sourceId", 64) || null;
      const status = oneOf(str(body, "status"), LEAD_STATUSES, "status") ?? "new";
      const notes = str(body, "notes", 5000) ?? "";
      const consentStatus =
        oneOf(str(body, "consentStatus"), ["unknown", "granted", "declined"], "consentStatus") ?? "unknown";
      const doNotContact = boolInt(body, "doNotContact") ?? 0;
      let ownerUserId = str(body, "ownerUserId", 64) || null;

      if (sourceId) {
        const source = await env.DB.prepare("SELECT id FROM lead_sources WHERE id = ?")
          .bind(sourceId)
          .first();
        if (!source) throw new HttpError(400, "Sumber prospek tidak wujud.");
      }
      if (ownerUserId) {
        if (user.role === "agent" && ownerUserId !== user.id) {
          throw new HttpError(403, "Ejen hanya boleh menetapkan dirinya sebagai pemilik.", "forbidden");
        }
        const owner = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(ownerUserId).first();
        if (!owner) throw new HttpError(400, "Pemilik yang dipilih tidak wujud.");
      } else {
        ownerUserId = user.id;
      }

      const id = newId();
      await env.DB.prepare(
        `INSERT INTO leads (id, company_name, contact_name, email, phone, source_id, status, owner_user_id, notes, consent_status, do_not_contact)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          id,
          companyName,
          contactName,
          emailValue,
          phone,
          sourceId,
          status,
          ownerUserId,
          notes,
          consentStatus,
          doNotContact,
        )
        .run();
      await audit(env, request, user.id, "lead.create", "lead", id, { status, sourceId });
      return json(
        { lead: await env.DB.prepare(`${LEAD_SELECT} WHERE l.id = ?`).bind(id).first<Record<string, unknown>>() },
        201,
      );
    }

    throw new HttpError(405, "Kaedah tidak dibenarkan.", "method_not_allowed");
  }

  const lead = await env.DB.prepare(`${LEAD_SELECT} WHERE l.id = ?`)
    .bind(id)
    .first<Record<string, unknown>>();
  if (!lead) throw new HttpError(404, "Prospek tidak dijumpai.", "not_found");
  if (!leadVisible(user, lead)) {
    throw new HttpError(403, "Anda hanya boleh mengakses prospek anda sendiri.", "forbidden");
  }

  if (method === "GET") {
    requirePermission(user, "leads.read");
    return json({ lead });
  }

  if (method === "PATCH") {
    requirePermission(user, "leads.write");
    const body = await readJson(request);
    const updates: string[] = [];
    const params: unknown[] = [];
    const push = (column: string, value: unknown): void => {
      updates.push(`${column} = ?`);
      params.push(value);
    };

    const companyName = str(body, "companyName", 200);
    const contactName = str(body, "contactName", 120);
    const emailRaw = optionalText(body, "email", 254);
    const phone = str(body, "phone", 40);
    const sourceId = optionalText(body, "sourceId", 64);
    const status = oneOf(str(body, "status"), LEAD_STATUSES, "status");
    const notes = str(body, "notes", 5000);
    const consentStatus = oneOf(
      str(body, "consentStatus"),
      ["unknown", "granted", "declined"],
      "consentStatus",
    );
    const doNotContact = boolInt(body, "doNotContact");
    const ownerUserId = optionalText(body, "ownerUserId", 64);

    if (companyName !== undefined) push("company_name", companyName);
    if (contactName !== undefined) push("contact_name", contactName);
    if (emailRaw !== undefined) push("email", emailRaw ? email(emailRaw) : "");
    if (phone !== undefined) push("phone", phone);
    if (sourceId !== undefined) {
      if (sourceId) {
        const source = await env.DB.prepare("SELECT id FROM lead_sources WHERE id = ?").bind(sourceId).first();
        if (!source) throw new HttpError(400, "Sumber prospek tidak wujud.");
      }
      push("source_id", sourceId || null);
    }
    if (status !== undefined) push("status", status);
    if (notes !== undefined) push("notes", notes);
    if (consentStatus !== undefined) push("consent_status", consentStatus);
    if (doNotContact !== undefined) push("do_not_contact", doNotContact);
    if (ownerUserId !== undefined) {
      if (user.role === "agent" && ownerUserId !== user.id) {
        throw new HttpError(403, "Ejen hanya boleh menetapkan dirinya sebagai pemilik.", "forbidden");
      }
      if (ownerUserId) {
        const owner = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(ownerUserId).first();
        if (!owner) throw new HttpError(400, "Pemilik yang dipilih tidak wujud.");
      }
      push("owner_user_id", ownerUserId || null);
    }

    if (!updates.length) throw new HttpError(400, "Tiada perubahan dihantar.");
    push("updated_at", nowIso());
    await env.DB.prepare(`UPDATE leads SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...params, id)
      .run();
    await audit(env, request, user.id, "lead.update", "lead", id);
    return json({ lead: await env.DB.prepare(`${LEAD_SELECT} WHERE l.id = ?`).bind(id).first() });
  }

  throw new HttpError(405, "Kaedah tidak dibenarkan.", "method_not_allowed");
}

async function handleLeadSources(request: Request, env: Env, user: AuthUser): Promise<Response> {
  requirePermission(user, "leads.read");
  if (request.method === "GET") {
    const result = await env.DB.prepare(
      "SELECT id, name, channel, description, is_active, created_at FROM lead_sources ORDER BY name ASC",
    ).all<Record<string, unknown>>();
    return json({ sources: result.results });
  }
  if (request.method === "POST") {
    requirePermission(user, "leads.write");
    const body = await readJson(request);
    const name = requiredStr(body, "name", 120);
    const channel = str(body, "channel", 60) || "other";
    const description = str(body, "description", 500) ?? "";
    const id = newId();
    try {
      await env.DB.prepare(
        "INSERT INTO lead_sources (id, name, channel, description) VALUES (?, ?, ?, ?)",
      )
        .bind(id, name, channel, description)
        .run();
    } catch (error) {
      if (error instanceof Error && /UNIQUE/i.test(error.message)) {
        throw new HttpError(409, "Nama sumber telah digunakan.", "duplicate");
      }
      throw error;
    }
    await audit(env, request, user.id, "lead_source.create", "lead_source", id);
    return json(
      { source: await env.DB.prepare("SELECT * FROM lead_sources WHERE id = ?").bind(id).first() },
      201,
    );
  }
  throw new HttpError(405, "Kaedah tidak dibenarkan.", "method_not_allowed");
}

async function handleApprovals(
  request: Request,
  env: Env,
  user: AuthUser,
  segments: string[],
  url: URL,
): Promise<Response> {
  const method = request.method;
  const id = segments[2];
  const action = segments[3];

  if (!id) {
    if (method === "GET") {
      requirePermission(user, "approvals.read");
      const where: string[] = [];
      const params: unknown[] = [];
      const status = oneOf(url.searchParams.get("status") ?? undefined, APPROVAL_STATUSES, "status");
      if (status) {
        where.push("ap.status = ?");
        params.push(status);
      }
      if (user.role === "agent") {
        where.push("ap.requested_by = ?");
        params.push(user.id);
      }
      const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const result = await env.DB.prepare(
        `${APPROVAL_SELECT} ${clause} ORDER BY ap.created_at DESC LIMIT 100`,
      )
        .bind(...params)
        .all<Record<string, unknown>>();
      return json({ approvals: result.results });
    }

    if (method === "POST") {
      if (!can(user, "approvals.create") && !can(user, "approvals.write")) {
        throw new HttpError(403, "Anda tiada kebenaran untuk tindakan ini.", "forbidden");
      }
      const body = await readJson(request);
      const entityType = oneOf(str(body, "entityType"), APPROVAL_ENTITIES, "entityType") ?? "other";
      const entityId = str(body, "entityId", 64) ?? "";
      const title = requiredStr(body, "title", 200);
      const description = str(body, "description", 5000) ?? "";
      const id = newId();
      await env.DB.prepare(
        `INSERT INTO approvals (id, entity_type, entity_id, title, description, requested_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
        .bind(id, entityType, entityId, title, description, user.id)
        .run();
      await audit(env, request, user.id, "approval.create", "approval", id, { entityType });
      return json(
        { approval: await env.DB.prepare(`${APPROVAL_SELECT} WHERE ap.id = ?`).bind(id).first() },
        201,
      );
    }

    throw new HttpError(405, "Kaedah tidak dibenarkan.", "method_not_allowed");
  }

  const approval = await env.DB.prepare(`${APPROVAL_SELECT} WHERE ap.id = ?`)
    .bind(id)
    .first<Record<string, unknown>>();
  if (!approval) throw new HttpError(404, "Kelulusan tidak dijumpai.", "not_found");
  if (user.role === "agent" && approval.requested_by !== user.id) {
    throw new HttpError(403, "Anda hanya boleh mengakses permohonan anda sendiri.", "forbidden");
  }

  if (!action && method === "GET") {
    requirePermission(user, "approvals.read");
    return json({ approval });
  }

  if (action === "decision" && method === "POST") {
    requirePermission(user, "approvals.write");
    const body = await readJson(request);
    const decision = oneOf(str(body, "decision"), ["approved", "rejected"], "decision");
    if (!decision) throw new HttpError(400, "Keputusan wajib dihantar.");
    if (approval.status !== "pending") {
      throw new HttpError(409, "Permohonan ini telah diputuskan.", "already_decided");
    }
    const note = str(body, "note", 2000) ?? "";
    await env.DB.prepare(
      `UPDATE approvals SET status = ?, decided_by = ?, decision_note = ?, decided_at = ?, updated_at = ?
       WHERE id = ? AND status = 'pending'`,
    )
      .bind(decision, user.id, note, nowIso(), nowIso(), id)
      .run();
    await audit(env, request, user.id, `approval.${decision}`, "approval", id, { entityType: approval.entity_type });
    return json({
      approval: await env.DB.prepare(`${APPROVAL_SELECT} WHERE ap.id = ?`).bind(id).first(),
    });
  }

  throw new HttpError(404, "Laluan tidak dijumpai.", "not_found");
}

async function handleUsers(
  request: Request,
  env: Env,
  user: AuthUser,
  segments: string[],
  url: URL,
): Promise<Response> {
  const method = request.method;
  const id = segments[2];

  if (!id) {
    if (method === "GET") {
      requirePermission(user, "users.read");
      const result = await env.DB.prepare(
        `SELECT u.id, u.email, u.name, r.name AS role, u.status, u.last_login_at, u.created_at, u.updated_at
         FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.created_at ASC LIMIT 200`,
      ).all<Record<string, unknown>>();
      return json({ users: result.results });
    }

    if (method === "POST") {
      if (user.role !== "admin") throw new HttpError(403, "Hanya pentadbir boleh mencipta pengguna.", "forbidden");
      const body = await readJson(request);
      const name = requiredStr(body, "name", 120);
      const address = email(requiredStr(body, "email", 254));
      const password = requiredStr(body, "password", 200);
      const role = oneOf(str(body, "role"), USER_ROLES, "role") ?? "viewer";
      if (password.length < 12) {
        throw new HttpError(400, "Kata laluan mesti sekurang-kurangnya 12 aksara.");
      }
      const roleRow = await env.DB.prepare("SELECT id FROM roles WHERE name = ?").bind(role).first<{ id: string }>();
      if (!roleRow) throw new HttpError(400, "Peranan tidak sah.");

      const newUserId = newId();
      try {
        await env.DB.prepare(
          "INSERT INTO users (id, email, name, password_hash, role_id) VALUES (?, ?, ?, ?, ?)",
        )
          .bind(newUserId, address, name, await hashPassword(password), roleRow.id)
          .run();
      } catch (error) {
        if (error instanceof Error && /UNIQUE/i.test(error.message)) {
          throw new HttpError(409, "E-mel telah digunakan.", "duplicate");
        }
        throw error;
      }
      await audit(env, request, user.id, "user.create", "user", newUserId, { role });
      return json(
        {
          user: await env.DB.prepare(
            `SELECT u.id, u.email, u.name, r.name AS role, u.status, u.created_at
             FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
          )
            .bind(newUserId)
            .first(),
        },
        201,
      );
    }

    throw new HttpError(405, "Kaedah tidak dibenarkan.", "method_not_allowed");
  }

  if (method === "PATCH") {
    if (user.role !== "admin") throw new HttpError(403, "Hanya pentadbir boleh mengemas kini pengguna.", "forbidden");
    const target = await env.DB.prepare(
      `SELECT u.id, u.email, u.name, r.name AS role, u.status
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
    )
      .bind(id)
      .first<{ id: string; email: string; name: string; role: string; status: string }>();
    if (!target) throw new HttpError(404, "Pengguna tidak dijumpai.", "not_found");

    const body = await readJson(request);
    const updates: string[] = [];
    const params: unknown[] = [];
    const push = (column: string, value: unknown): void => {
      updates.push(`${column} = ?`);
      params.push(value);
    };

    const name = str(body, "name", 120);
    const role = oneOf(str(body, "role"), USER_ROLES, "role");
    const status = oneOf(str(body, "status"), ["active", "disabled"], "status");
    const password = str(body, "password", 200);

    if (target.id === user.id && (status === "disabled" || (role && role !== "admin"))) {
      throw new HttpError(400, "Anda tidak boleh menyahaktifkan atau menurunkan peranan akaun sendiri.");
    }
    if (target.role === "admin" && (status === "disabled" || (role && role !== "admin"))) {
      const admins = await env.DB.prepare(
        `SELECT COUNT(*) AS count FROM users u JOIN roles r ON r.id = u.role_id
         WHERE r.name = 'admin' AND u.status = 'active'`,
      ).first<{ count: number }>();
      if (Number(admins?.count ?? 0) <= 1) {
        throw new HttpError(409, "Sekurang-kurangnya satu pentadbir aktif diperlukan.", "last_admin");
      }
    }

    if (name !== undefined) push("name", name);
    if (status !== undefined) push("status", status);
    if (role !== undefined) {
      const roleRow = await env.DB.prepare("SELECT id FROM roles WHERE name = ?").bind(role).first<{ id: string }>();
      if (!roleRow) throw new HttpError(400, "Peranan tidak sah.");
      push("role_id", roleRow.id);
    }
    if (password !== undefined) {
      if (password.length < 12) throw new HttpError(400, "Kata laluan mesti sekurang-kurangnya 12 aksara.");
      push("password_hash", await hashPassword(password));
    }
    if (!updates.length) throw new HttpError(400, "Tiada perubahan dihantar.");

    push("updated_at", nowIso());
    await env.DB.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...params, id)
      .run();
    await audit(env, request, user.id, "user.update", "user", id, {
      fields: updates.map((entry) => entry.split(" ")[0]),
    });
    return json({
      user: await env.DB.prepare(
        `SELECT u.id, u.email, u.name, r.name AS role, u.status, u.created_at, u.updated_at
         FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
      )
        .bind(id)
        .first(),
    });
  }

  throw new HttpError(405, "Kaedah tidak dibenarkan.", "method_not_allowed");
}

async function handleAuditLogs(request: Request, env: Env, user: AuthUser, url: URL): Promise<Response> {
  requirePermission(user, "audit.read");
  if (user.role !== "admin" && user.role !== "manager") {
    throw new HttpError(403, "Anda tiada kebenaran untuk tindakan ini.", "forbidden");
  }
  const where: string[] = [];
  const params: unknown[] = [];
  const action = (url.searchParams.get("action") ?? "").trim();
  if (action) {
    where.push("a.action = ?");
    params.push(action);
  }
  const entityType = (url.searchParams.get("entityType") ?? "").trim();
  if (entityType) {
    where.push("a.entity_type = ?");
    params.push(entityType);
  }
  const limit = asInt(url.searchParams.get("limit"), 100, 1, 200);
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const result = await env.DB.prepare(
    `SELECT a.id, a.action, a.entity_type, a.entity_id, a.metadata, a.created_at,
            u.name AS actor_name, a.ip_address
     FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id
     ${clause} ORDER BY a.created_at DESC LIMIT ?`,
  )
    .bind(...params, limit)
    .all<Record<string, unknown>>();
  return json({ logs: result.results });
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname;
  const segments = path.split("/").filter(Boolean);

  if (path.startsWith("/api/auth/")) return handleAuth(request, env, path);

  if (path === "/api/info" && request.method === "GET") {
    return json({
      name: "NAGASARIBU AI WORKFORCE",
      message: "Pusat Kawalan Operasi",
      phase: PHASE,
      health: "/health",
      ui: "/",
      api: "/api",
    });
  }

  const user = await requireUser(request, env);

  if (path === "/api/dashboard" && request.method === "GET") {
    requirePermission(user, "dashboard.read");
    return handleDashboard(env);
  }

  if (path === "/api/ai/status" && request.method === "GET") {
    requirePermission(user, "tasks.read");
    const ai = getProviderStatus(env);
    return json({
      provider: {
        mode: ai.mode,
        configured: ai.configured,
        model: ai.model,
        reason: ai.reason ?? null,
        liveExecutionEnabled: ai.mode === "live",
      },
    });
  }

  if (segments[1] === "tasks") return handleTasks(request, env, user, segments, url);
  if (segments[1] === "agents") return handleAgents(request, env, user, segments, url);
  if (segments[1] === "leads") return handleLeads(request, env, user, segments, url);
  if (segments[1] === "lead-sources") return handleLeadSources(request, env, user);
  if (segments[1] === "approvals") return handleApprovals(request, env, user, segments, url);
  if (segments[1] === "users") return handleUsers(request, env, user, segments, url);
  if (segments[1] === "audit-logs" && request.method === "GET") {
    return handleAuditLogs(request, env, user, url);
  }

  throw new HttpError(404, "Laluan tidak dijumpai.", "not_found");
}

async function handleHealth(env: Env): Promise<Response> {
  let dbOk = true;
  try {
    await env.DB.prepare("SELECT 1").first();
  } catch {
    dbOk = false;
  }

  return json(
    {
      ok: dbOk,
      service: SERVICE,
      environment: env.APP_ENV ?? "unknown",
      phase: PHASE,
      status: dbOk ? "operational" : "degraded",
      checks: {
        database: dbOk ? "ok" : "error",
        auth: env.SESSION_SECRET ? "configured" : "missing",
        ai: getProviderStatus(env).mode,
      },
    },
    dbOk ? 200 : 503,
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    try {
      if (method === "OPTIONS") {
        return new Response(null, { status: 204, headers: { ...baseHeaders, allow: "GET, POST, PATCH, OPTIONS" } });
      }

      if (url.pathname === "/health" && method === "GET") return handleHealth(env);

      if (url.pathname === "/" && method === "GET") {
        if (url.searchParams.get("format") === "json") {
          return json({
            name: "NAGASARIBU AI WORKFORCE",
            message: "Pusat Kawalan Operasi",
            phase: PHASE,
            health: "/health",
            ui: "/",
            api: "/api",
          });
        }
        return html(consoleHtml);
      }

      if (url.pathname.startsWith("/api/")) {
        assertSameOrigin(request);
        return await handleApi(request, env, url);
      }

      throw new HttpError(404, "Laluan tidak dijumpai.", "not_found");
    } catch (error) {
      if (error instanceof HttpError) {
        return json({ error: { code: error.code, message: error.message } }, error.status);
      }
      console.error("unhandled_error", error instanceof Error ? error.message : "unknown");
      return json({ error: { code: "internal_error", message: "Ralat dalaman." } }, 500);
    }
  },
};
