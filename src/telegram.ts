import type { AuthUser, Env } from "./types.ts";
import { tryConsume } from "./rate-limit.ts";
import { getProviderStatus } from "./providers/deepseek.ts";
import { getMetaStatus } from "./providers/meta.ts";

const DEFAULT_API_BASE = "https://api.telegram.org";
const PAIRING_TTL_MS = 10 * 60 * 1000;
const PAIRING_CODE_LENGTH = 10;
const PAIRING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_TELEGRAM_TEXT = 4096;
const MAX_TASK_TEXT = 4000;
const MAX_MESSAGE_BYTES = 256 * 1024;

export interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number | string;
  type: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
}

export interface BotIdentity {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

export interface WebhookInfo {
  url: string;
  has_custom_certificate?: boolean;
  pending_update_count?: number;
  last_error_date?: number;
  last_error_message?: string;
  last_synchronization_error_date?: number;
  max_connections?: number;
  ip_address?: string;
}

export class TelegramError extends Error {
  code: string;
  status: number;
  retryable: boolean;

  constructor(code: string, message: string, status = 502, retryable = false) {
    super(message);
    this.name = "TelegramError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export interface TelegramTaskInput {
  text?: string;
  taskId?: string;
  requiresApproval: boolean;
  telegramUserId: string;
  chatId: string;
}

export interface TelegramTaskResult {
  taskId: string;
  reply: string;
  external?: boolean;
}

export type TelegramTaskRunner = (
  env: Env,
  request: Request,
  user: AuthUser,
  input: TelegramTaskInput,
) => Promise<TelegramTaskResult>;

interface TelegramAccountRow {
  id: string;
  user_id: string;
  telegram_user_id: string;
  chat_id: string;
  username: string;
  first_name: string;
  status: string;
  paired_at: string;
  last_message_at: string | null;
  user_name: string;
  user_status: string;
  role: string;
}

interface BotApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

const messageRate = new Map<string, { count: number; resetAt: number }>();
const taskRate = new Map<string, { count: number; resetAt: number }>();
const pairingRate = new Map<string, { count: number; resetAt: number }>();
const unpairedRate = new Map<string, { count: number; resetAt: number }>();
const invalidWebhookRate = new Map<string, { count: number; resetAt: number }>();
const bootstrapRate = new Map<string, { count: number; resetAt: number }>();

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return crypto.randomUUID();
}

function limitStore(
  store: Map<string, { count: number; resetAt: number }>,
  key: string,
  max: number,
  windowMs: number,
): boolean {
  const allowed = tryConsume(store, key, max, windowMs);
  if (store.size > 5000) {
    const now = Date.now();
    for (const [entryKey, entry] of store) {
      if (entry.resetAt <= now) store.delete(entryKey);
    }
  }
  return allowed;
}

function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

export function telegramConfigured(env: Env): boolean {
  return Boolean((env.TELEGRAM_BOT_TOKEN ?? "").trim() && (env.TELEGRAM_WEBHOOK_SECRET ?? "").trim());
}

function apiBase(env: Env): string {
  const raw = (env.TELEGRAM_API_BASE ?? DEFAULT_API_BASE).trim().replace(/\/+$/, "");
  const base = raw || DEFAULT_API_BASE;
  try {
    const url = new URL(base);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !local) return DEFAULT_API_BASE;
    return base;
  } catch {
    return DEFAULT_API_BASE;
  }
}

async function callTelegram<T>(
  env: Env,
  method: string,
  payload: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const token = (env.TELEGRAM_BOT_TOKEN ?? "").trim();
  if (!token) {
    throw new TelegramError(
      "telegram_not_configured",
      "Telegram belum dikonfigurasikan pada pelayan.",
      503,
    );
  }

  let response: Response;
  try {
    response = await fetchImpl(`${apiBase(env)}/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new TelegramError("telegram_unreachable", "Telegram tidak dapat dihubungi.", 502, true);
  }

  let data: BotApiResponse<T>;
  try {
    data = (await response.json()) as BotApiResponse<T>;
  } catch {
    throw new TelegramError("telegram_invalid_response", "Respons Telegram tidak sah.", 502, true);
  }

  if (!response.ok || !data.ok) {
    const description = String(data.description ?? "").slice(0, 300);
    throw new TelegramError(
      data.error_code === 429 ? "telegram_rate_limited" : "telegram_api_error",
      description || "Telegram menolak permintaan.",
      data.error_code === 429 ? 429 : 502,
      data.error_code === 429 || response.status >= 500,
    );
  }

  return data.result as T;
}

export async function getMe(env: Env, fetchImpl: typeof fetch = fetch): Promise<BotIdentity> {
  return callTelegram<BotIdentity>(env, "getMe", {}, fetchImpl);
}

export async function getWebhookInfo(
  env: Env,
  fetchImpl: typeof fetch = fetch,
): Promise<WebhookInfo> {
  return callTelegram<WebhookInfo>(env, "getWebhookInfo", {}, fetchImpl);
}

export async function setWebhook(
  env: Env,
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const secret = (env.TELEGRAM_WEBHOOK_SECRET ?? "").trim();
  if (!secret) {
    throw new TelegramError(
      "telegram_not_configured",
      "Rahsia webhook Telegram belum dikonfigurasikan.",
      503,
    );
  }
  return callTelegram<boolean>(
    env,
    "setWebhook",
    {
      url,
      secret_token: secret,
      allowed_updates: ["message"],
      drop_pending_updates: false,
      max_connections: 40,
    },
    fetchImpl,
  );
}

function splitMessage(text: string, max = MAX_TELEGRAM_TEXT): string[] {
  if (text.length <= max) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > max) {
    let cut = remaining.lastIndexOf("\n", max);
    if (cut < Math.floor(max * 0.6)) cut = max;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export async function sendMessage(
  env: Env,
  input: {
    chatId: string | number;
    text: string;
    parseMode?: "HTML" | "Markdown" | "MarkdownV2";
    disablePreview?: boolean;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<{ sent: number; messageIds: number[] }> {
  const text = String(input.text ?? "").trim();
  if (!text) throw new TelegramError("empty_message", "Mesej kosong tidak dihantar.", 400);
  const messageIds: number[] = [];
  for (const chunk of splitMessage(text)) {
    const payload: Record<string, unknown> = {
      chat_id: input.chatId,
      text: chunk,
      disable_web_page_preview: input.disablePreview !== false,
    };
    if (input.parseMode) payload.parse_mode = input.parseMode;
    const result = await callTelegram<{ message_id: number }>(env, "sendMessage", payload, fetchImpl);
    if (result && typeof result.message_id === "number") messageIds.push(result.message_id);
  }
  return { sent: messageIds.length, messageIds };
}

export function generatePairingCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(PAIRING_CODE_LENGTH));
  let code = "";
  for (let i = 0; i < bytes.length; i += 1) code += PAIRING_ALPHABET[bytes[i] % PAIRING_ALPHABET.length];
  return code;
}

export function normalizePairingCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function hashCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function readSetting(env: Env, key: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT value FROM system_settings WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

async function writeSetting(env: Env, key: string, value: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  )
    .bind(key, value, nowIso())
    .run();
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
        request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        (request.headers.get("user-agent") ?? "telegram").slice(0, 300),
        JSON.stringify(metadata),
      )
      .run();
  } catch (error) {
    console.error("telegram_audit_failed", error instanceof Error ? error.message : "unknown");
  }
}

async function auditTelegramApi(
  env: Env,
  request: Request,
  actorId: string | null,
  action: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await audit(env, request, actorId, action, "telegram", "bot", metadata);
}

export interface TelegramSummary {
  configured: boolean;
  botTokenConfigured: boolean;
  webhookSecretConfigured: boolean;
  botUsername: string | null;
  webhookUrl: string | null;
  webhookCheckedAt: string | null;
  linkedAccounts: number;
  activeLinks: number;
  pendingPairingCodes: number;
  lastUpdateAt: string | null;
  lastMessageAt: string | null;
}

export async function getTelegramSummary(env: Env): Promise<TelegramSummary> {
  const now = nowIso();
  const [accountStats, pendingCodes, lastUpdate, lastMessage, settings] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active
       FROM telegram_accounts`,
    ).first<{ total: number; active: number | null }>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS count FROM telegram_pairing_codes
       WHERE used_at IS NULL AND expires_at > ?`,
    )
      .bind(now)
      .first<{ count: number }>(),
    env.DB.prepare("SELECT MAX(received_at) AS last_at FROM telegram_updates").first<{
      last_at: string | null;
    }>(),
    env.DB.prepare("SELECT MAX(last_message_at) AS last_at FROM telegram_accounts").first<{
      last_at: string | null;
    }>(),
    env.DB.prepare(
      `SELECT key, value FROM system_settings
       WHERE key IN ('telegram_bot_username', 'telegram_webhook_url', 'telegram_webhook_checked_at')`,
    ).all<{ key: string; value: string }>(),
  ]);

  const setting = (key: string): string | null =>
    settings.results.find((row) => row.key === key)?.value ?? null;

  const botTokenConfigured = Boolean((env.TELEGRAM_BOT_TOKEN ?? "").trim());
  const webhookSecretConfigured = Boolean((env.TELEGRAM_WEBHOOK_SECRET ?? "").trim());

  return {
    configured: botTokenConfigured && webhookSecretConfigured,
    botTokenConfigured,
    webhookSecretConfigured,
    botUsername: setting("telegram_bot_username"),
    webhookUrl: setting("telegram_webhook_url"),
    webhookCheckedAt: setting("telegram_webhook_checked_at"),
    linkedAccounts: Number(accountStats?.total ?? 0),
    activeLinks: Number(accountStats?.active ?? 0),
    pendingPairingCodes: Number(pendingCodes?.count ?? 0),
    lastUpdateAt: lastUpdate?.last_at ?? null,
    lastMessageAt: lastMessage?.last_at ?? null,
  };
}

function sanitizeWebhook(info: WebhookInfo, expectedUrl: string): Record<string, unknown> {
  return {
    url: info.url ?? "",
    expectedUrl,
    matchesExpected: (info.url ?? "") === expectedUrl,
    pendingUpdateCount: Number(info.pending_update_count ?? 0),
    lastErrorDate: info.last_error_date ?? null,
    lastErrorMessage: info.last_error_message ?? null,
    lastSynchronizationErrorDate: info.last_synchronization_error_date ?? null,
    maxConnections: info.max_connections ?? null,
    ipAddress: info.ip_address ?? null,
  };
}

export async function getTelegramStatus(
  env: Env,
  origin: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const summary = await getTelegramSummary(env);
  const expectedUrl = `${origin.replace(/\/+$/, "")}/telegram/webhook`;
  const accounts = await env.DB.prepare(
    `SELECT a.id, a.user_id, u.name AS user_name, u.email AS user_email,
            a.telegram_user_id, a.chat_id, a.username, a.first_name,
            a.status, a.paired_at, a.last_message_at
     FROM telegram_accounts a JOIN users u ON u.id = a.user_id
     ORDER BY a.paired_at DESC LIMIT 20`,
  ).all<Record<string, unknown>>();

  const result: Record<string, unknown> = {
    ...summary,
    expectedWebhookUrl: expectedUrl,
    accounts: accounts.results,
    bot: { configured: summary.botTokenConfigured, username: summary.botUsername, error: null },
    webhook: { configured: summary.webhookSecretConfigured, error: null },
  };

  if (!summary.botTokenConfigured) {
    (result.bot as Record<string, unknown>).error = "missing_bot_token";
    (result.webhook as Record<string, unknown>).error = "missing_bot_token";
    return result;
  }

  const [me, webhook] = await Promise.allSettled([
    getMe(env, fetchImpl),
    getWebhookInfo(env, fetchImpl),
  ]);

  if (me.status === "fulfilled") {
    result.bot = {
      configured: true,
      id: me.value.id,
      name: me.value.first_name,
      username: me.value.username ?? null,
      isBot: me.value.is_bot,
      error: null,
    };
    await Promise.all([
      writeSetting(env, "telegram_bot_username", me.value.username ?? ""),
      writeSetting(env, "telegram_bot_name", me.value.first_name ?? ""),
    ]);
  } else {
    result.bot = { configured: true, username: summary.botUsername, error: "telegram_unreachable" };
  }

  if (webhook.status === "fulfilled") {
    result.webhook = {
      configured: true,
      ...sanitizeWebhook(webhook.value, expectedUrl),
      checkedAt: nowIso(),
      error: null,
    };
    await writeSetting(env, "telegram_webhook_url", webhook.value.url ?? "");
    await writeSetting(env, "telegram_webhook_checked_at", nowIso());
  } else {
    result.webhook = {
      configured: true,
      expectedUrl,
      error: "telegram_unreachable",
    };
  }

  return result;
}

export async function registerTelegramWebhook(
  env: Env,
  origin: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ url: string; webhook: Record<string, unknown> | null }> {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new TelegramError("invalid_origin", "Asalan pelayan tidak sah.", 400);
  }
  const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !local) {
    throw new TelegramError("invalid_origin", "Webhook Telegram mesti menggunakan HTTPS.", 400);
  }

  const url = `${parsed.origin}/telegram/webhook`;
  await setWebhook(env, url, fetchImpl);
  await writeSetting(env, "telegram_webhook_url", url);
  await writeSetting(env, "telegram_webhook_checked_at", nowIso());

  try {
    const me = await getMe(env, fetchImpl);
    if (me.username) await writeSetting(env, "telegram_bot_username", me.username);
    if (me.first_name) await writeSetting(env, "telegram_bot_name", me.first_name);
  } catch {
    // Webhook registration is still valid if identity lookup is temporarily unavailable.
  }

  let webhook: Record<string, unknown> | null = null;
  try {
    webhook = sanitizeWebhook(await getWebhookInfo(env, fetchImpl), url);
  } catch {
    webhook = null;
  }

  return { url, webhook };
}

export async function createPairingCode(
  env: Env,
  user: AuthUser,
  fetchImpl: typeof fetch = fetch,
): Promise<{ code: string; expiresAt: string; botUsername: string | null }> {
  await env.DB.prepare("DELETE FROM telegram_pairing_codes WHERE user_id = ? AND used_at IS NULL")
    .bind(user.id)
    .run();

  const code = generatePairingCode();
  const codeHash = await hashCode(code);
  const expiresAt = new Date(Date.now() + PAIRING_TTL_MS).toISOString();
  await env.DB.prepare(
    `INSERT INTO telegram_pairing_codes (id, code_hash, user_id, expires_at) VALUES (?, ?, ?, ?)`,
  )
    .bind(newId(), codeHash, user.id, expiresAt)
    .run();

  let botUsername = await readSetting(env, "telegram_bot_username");
  if ((env.TELEGRAM_BOT_TOKEN ?? "").trim()) {
    try {
      const me = await getMe(env, fetchImpl);
      botUsername = me.username ?? null;
      if (me.username) await writeSetting(env, "telegram_bot_username", me.username);
    } catch {
      // Pairing still works if Telegram is temporarily unreachable.
    }
  }

  return { code, expiresAt, botUsername };
}

export async function revokeTelegramLink(env: Env, userId: string): Promise<number> {
  const result = await env.DB.prepare(
    `UPDATE telegram_accounts SET status = 'revoked', updated_at = ? WHERE user_id = ? AND status = 'active'`,
  )
    .bind(nowIso(), userId)
    .run();
  return Number(result.meta.changes ?? 0);
}

function pairingInstructions(botUsername: string | null): string {
  const handle = botUsername ? `@${botUsername}` : "bot ini";
  return [
    "NAGASARIBU AI WORKFORCE",
    "",
    "Akaun Telegram ini belum dipasangkan dengan pentadbir.",
    "",
    "Cara memasang:",
    "1. Log masuk ke Pusat Kawalan Operasi.",
    "2. Buka panel Telegram dan jana kod pasangan (sah 10 minit).",
    `3. Hantar di sini: /pair KOD`,
    "",
    `Tiada akses diberikan secara automatik. Bot: ${handle}`,
  ].join("\n");
}

function welcomeMessage(name: string): string {
  return [
    `Selamat datang, ${name}.`,
    "",
    "SARA sedia menerima arahan operasi.",
    "",
    "Arahan tersedia:",
    "/status — ringkasan operasi",
    "/tasks — tugasan terkini",
    "/agents — status ejen AI",
    "/prospects — ringkasan prospek",
    "/report — laporan penuh",
    "/help — bantuan",
    "",
    "Anda juga boleh menghantar tugasan bahasa semula jadi.",
    "Tindakan luaran memerlukan pengesahan eksplisit melalui /confirm ID.",
  ].join("\n");
}

function helpMessage(name: string): string {
  return [
    `Bantuan SARA untuk ${name}`,
    "",
    "/status — ringkasan operasi",
    "/tasks — 8 tugasan terkini",
    "/agents — ejen dan beban tugas",
    "/prospects — ringkasan prospek",
    "/report — laporan operasi penuh",
    "/confirm ID — sahkan tindakan luaran untuk tugasan",
    "",
    "Contoh arahan biasa:",
    "• Sediakan ringkasan operasi minggu ini",
    "• Analisis kos projek ini",
    "• Draf strategi kempen untuk bulan depan",
    "",
    "Arahan luaran seperti menghantar e-mel, menerbitkan kandungan atau pembayaran",
    "tidak akan dijalankan tanpa pengesahan eksplisit.",
  ].join("\n");
}

function truncate(value: unknown, max = MAX_TASK_TEXT): string {
  return String(value ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
}

async function formatStatus(env: Env): Promise<string> {
  const [tasks, agents, leads, prospects, approvals] = await Promise.all([
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
    ).first<{ active: number | null; total: number }>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS new,
              SUM(CASE WHEN status = 'qualified' THEN 1 ELSE 0 END) AS qualified
       FROM leads`,
    ).first<{ total: number; new: number | null; qualified: number | null }>(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM prospect_candidates WHERE status = 'new'").first<{
      count: number;
    }>(),
    env.DB.prepare(
      "SELECT COUNT(*) AS count FROM approvals WHERE status = 'pending'",
    ).first<{ count: number }>(),
  ]);

  const ai = getProviderStatus(env);
  const backup = getMetaStatus(env);

  return [
    "📊 STATUS OPERASI",
    "",
    `Tugas: ${Number(tasks?.active ?? 0)} aktif · ${Number(tasks?.completed ?? 0)} selesai · ${Number(tasks?.failed ?? 0)} gagal · ${Number(tasks?.blocked ?? 0)} disekat`,
    `Jumlah tugas: ${Number(tasks?.total ?? 0)}`,
    `Ejen: ${Number(agents?.active ?? 0)} aktif / ${Number(agents?.total ?? 0)} berdaftar`,
    `Prospek baharu: ${Number(prospects?.count ?? 0)}`,
    `CRM: ${Number(leads?.total ?? 0)} prospek · ${Number(leads?.new ?? 0)} baharu · ${Number(leads?.qualified ?? 0)} layak`,
    `Kelulusan menunggu: ${Number(approvals?.count ?? 0)}`,
    "",
    `AI: DeepSeek ${ai.mode.toUpperCase()}`,
    `Backup: Muse Spark ${backup.available ? "tersedia" : "tidak tersedia"}`,
    `Telegram: ${telegramConfigured(env) ? "dikonfigurasikan" : "belum dikonfigurasikan"}`,
  ].join("\n");
}

async function formatTasks(env: Env): Promise<string> {
  const result = await env.DB.prepare(
    `SELECT t.id, t.title, t.status, t.execution_state, t.priority, t.created_at,
            a.name AS agent_name
     FROM tasks t LEFT JOIN agent_registry a ON a.id = t.assigned_agent_id
     ORDER BY t.created_at DESC LIMIT 8`,
  ).all<Record<string, unknown>>();

  if (!result.results.length) {
    return "📋 TUGASAN\n\nBelum ada tugasan dalam sistem.";
  }

  const lines = result.results.map((task, index) => {
    const state = String(task.execution_state ?? task.status ?? "pending");
    return `${index + 1}. [${state}] ${String(task.title ?? "").slice(0, 120)}\n   ${String(task.agent_name ?? "SARA (auto)")} · ${String(task.priority ?? "normal")}`;
  });

  return ["📋 TUGASAN TERKINI", "", ...lines].join("\n");
}

async function formatAgents(env: Env): Promise<string> {
  const result = await env.DB.prepare(
    `SELECT a.name, a.kind, a.status,
            COALESCE((SELECT COUNT(*) FROM tasks t
                      WHERE t.assigned_agent_id = a.id
                        AND t.execution_state NOT IN ('completed','cancelled')), 0) AS active_tasks
     FROM agent_registry a ORDER BY a.status ASC, a.name ASC LIMIT 20`,
  ).all<Record<string, unknown>>();

  if (!result.results.length) return "🤖 EJEN AI\n\nBelum ada ejen berdaftar.";

  const lines = result.results.map(
    (agent) =>
      `• ${String(agent.name ?? "")} (${String(agent.kind ?? "general")}) — ${String(agent.status ?? "")}, ${Number(agent.active_tasks ?? 0)} tugas aktif`,
  );
  return ["🤖 EJEN AI", "", ...lines].join("\n");
}

async function formatProspects(env: Env): Promise<string> {
  const [byStatus, latest] = await Promise.all([
    env.DB.prepare(
      "SELECT status, COUNT(*) AS count FROM prospect_candidates GROUP BY status ORDER BY status",
    ).all<{ status: string; count: number }>(),
    env.DB.prepare(
      `SELECT company_name, qualification_score, status
       FROM prospect_candidates ORDER BY created_at DESC LIMIT 5`,
    ).all<Record<string, unknown>>(),
  ]);

  const counts = { new: 0, imported: 0, rejected: 0 };
  for (const row of byStatus.results) {
    if (row.status in counts) counts[row.status as keyof typeof counts] = Number(row.count);
  }

  const lines = [
    "🔎 PROSPEK",
    "",
    `Baharu: ${counts.new} · Diimport: ${counts.imported} · Ditolak: ${counts.rejected}`,
  ];
  if (latest.results.length) {
    lines.push("", "Calon terkini:");
    for (const row of latest.results) {
      lines.push(
        `• ${String(row.company_name ?? "").slice(0, 80)} — skor ${Number(row.qualification_score ?? 0)}/100 (${String(row.status ?? "")})`,
      );
    }
  }
  return lines.join("\n");
}

async function formatReport(env: Env): Promise<string> {
  const [tasks, agents, leads, approvals, execution, activity] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN execution_state NOT IN ('completed','cancelled') THEN 1 ELSE 0 END) AS active,
              SUM(CASE WHEN execution_state = 'completed' THEN 1 ELSE 0 END) AS completed,
              SUM(CASE WHEN execution_state = 'failed' THEN 1 ELSE 0 END) AS failed,
              SUM(CASE WHEN execution_state = 'blocked' THEN 1 ELSE 0 END) AS blocked
       FROM tasks`,
    ).first<{ total: number; active: number; completed: number; failed: number; blocked: number }>(),
    env.DB.prepare(
      "SELECT SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active, COUNT(*) AS total FROM agent_registry",
    ).first<{ active: number | null; total: number }>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS new,
              SUM(CASE WHEN status = 'qualified' THEN 1 ELSE 0 END) AS qualified
       FROM leads`,
    ).first<{ total: number; new: number | null; qualified: number | null }>(),
    env.DB.prepare(
      "SELECT SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending, COUNT(*) AS total FROM approvals",
    ).first<{ pending: number | null; total: number }>(),
    env.DB.prepare(
      `SELECT SUM(CASE WHEN event_type = 'execution_started' THEN 1 ELSE 0 END) AS started,
              SUM(CASE WHEN event_type = 'execution_completed' THEN 1 ELSE 0 END) AS completed,
              SUM(CASE WHEN event_type = 'execution_failed' THEN 1 ELSE 0 END) AS failed,
              SUM(CASE WHEN event_type = 'execution_mock' THEN 1 ELSE 0 END) AS mock,
              SUM(CASE WHEN event_type = 'provider_fallback' THEN 1 ELSE 0 END) AS fallbacks
       FROM task_events`,
    ).first<{
      started: number | null;
      completed: number | null;
      failed: number | null;
      mock: number | null;
      fallbacks: number | null;
    }>(),
    env.DB.prepare(
      `SELECT event_type, message, created_at FROM task_events
       ORDER BY created_at DESC LIMIT 5`,
    ).all<Record<string, unknown>>(),
  ]);

  const ai = getProviderStatus(env);
  const backup = getMetaStatus(env);
  const telegram = await getTelegramSummary(env);

  const lines = [
    "📈 LAPORAN OPERASI",
    "",
    `Tugas: ${Number(tasks?.total ?? 0)} jumlah · ${Number(tasks?.active ?? 0)} aktif · ${Number(tasks?.completed ?? 0)} selesai · ${Number(tasks?.failed ?? 0)} gagal · ${Number(tasks?.blocked ?? 0)} disekat`,
    `Pelaksanaan: ${Number(execution?.started ?? 0)} mula · ${Number(execution?.completed ?? 0)} selesai · ${Number(execution?.failed ?? 0)} gagal · ${Number(execution?.mock ?? 0)} mock · ${Number(execution?.fallbacks ?? 0)} fallback`,
    `Ejen: ${Number(agents?.active ?? 0)} aktif / ${Number(agents?.total ?? 0)}`,
    `CRM: ${Number(leads?.total ?? 0)} prospek · ${Number(leads?.new ?? 0)} baharu · ${Number(leads?.qualified ?? 0)} layak`,
    `Kelulusan: ${Number(approvals?.pending ?? 0)} menunggu / ${Number(approvals?.total ?? 0)} jumlah`,
    "",
    `AI utama: DeepSeek ${ai.mode.toUpperCase()} (${ai.model})`,
    `Backup: Muse Spark ${backup.available ? "tersedia" : "tidak tersedia"} (${backup.model})`,
    `Telegram: ${telegram.activeLinks} akaun aktif · ${telegram.lastUpdateAt ? `update terakhir ${telegram.lastUpdateAt}` : "belum ada update"}`,
  ];

  if (activity.results.length) {
    lines.push("", "Aktiviti terkini:");
    for (const row of activity.results) {
      lines.push(
        `• ${String(row.event_type ?? "")}: ${String(row.message ?? "").slice(0, 110)}`,
      );
    }
  }

  return lines.join("\n");
}

const NEGATION_RE =
  /\b(jangan|janganlah|jgn|jng|usah|usahlah|tidak|tak|tanpa|elak|elakkan)\b/i;

const NEGATABLE_ACTION_RE =
  /\b(hantar|menghantar|dihantar|kirim|mengirim|hubungi|menghubungi|telefon|menelefon|panggil|memanggil|sms|whatsapp|whatsappkan|email|emailkan|e[\s-]?mel|terbit|terbitkan|menerbitkan|publish|posting|siar|siarkan|laksana|laksanakan|melaksanakan|jalankan|menjalankan|mulakan|memulakan|aktifkan|mengaktifkan|bayar|membayar|pembayaran|beli|membeli|pembelian|langgan|melanggan|berlanggan|langganan|tempah|menempah|book|booking|tandatangan|menandatangani|sign)\b/i;

const SEND_ACTION_RE =
  /\b(hantar|menghantar|dihantar|kirim|mengirim|emailkan|whatsappkan)\b[^.!?;\n]{0,140}\b(kepada|whatsapp|email|e[\s-]?mel|sms|mesej|message|surat|invois|invoice|sebut harga|quotation|tawaran|kontrak|iklan|kempen|pelanggan|prospek|client|customer|lead|pembekal|vendor)\b/i;

const CONTACT_ACTION_RE =
  /\b(hubungi|menghubungi|telefon|menelefon|panggil|memanggil|sms|contact|call)\b[^.!?;\n]{0,100}\b(pelanggan|prospek|client|customer|lead|orang|nombor|kepada|pembekal|vendor)\b/i;

const PUBLISH_ACTION_RE =
  /\b(terbit|terbitkan|menerbitkan|diterbitkan|publish|publishing|posting|siar|siarkan|menyiarkan)\b/i;

const CAMPAIGN_ACTION_RE =
  /\b(laksana|laksanakan|melaksanakan|jalankan|menjalankan|mulakan|memulakan|aktifkan|mengaktifkan|launch)\b[^.!?;\n]{0,100}\b(kempen|campaign)\b/i;

const CAMPAIGN_REVERSE_RE =
  /\b(kempen|campaign)\b[^.!?;\n]{0,100}\b(laksana|laksanakan|melaksanakan|jalankan|menjalankan|mulakan|memulakan|aktifkan|mengaktifkan|launch)\b/i;

const PAYMENT_ACTION_RE =
  /\b(bayar|membayar|pembayaran|payment|beli|membeli|pembelian|purchase|langgan|melanggan|berlanggan|langganan|subscription|subscribe|tempah|menempah|booking)\b/i;

const COMMITMENT_ACTION_RE =
  /\b(tandatangan|menandatangani|ditandatangani|sign|signing)\b[^.!?;\n]{0,80}\b(kontrak|contract|perjanjian|agreement|tawaran|offer)\b/i;

function stripNegatedActionClauses(text: string): string {
  return text
    .split(/[.!?;,\n]+|\b(?:tetapi|tapi|namun|sebaliknya|kemudian)\b/i)
    .map((clause) => clause.trim())
    .filter((clause) => clause && !(NEGATION_RE.test(clause) && NEGATABLE_ACTION_RE.test(clause)))
    .join(" ");
}

export function isExternalAction(text: string): boolean {
  const normalized = String(text ?? "")
    .toLowerCase()
    .replace(/[’‘`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;

  const actionable = stripNegatedActionClauses(normalized);
  if (!actionable) return false;

  return (
    SEND_ACTION_RE.test(actionable) ||
    CONTACT_ACTION_RE.test(actionable) ||
    PUBLISH_ACTION_RE.test(actionable) ||
    CAMPAIGN_ACTION_RE.test(actionable) ||
    CAMPAIGN_REVERSE_RE.test(actionable) ||
    PAYMENT_ACTION_RE.test(actionable) ||
    COMMITMENT_ACTION_RE.test(actionable)
  );
}

function parseCommand(text: string): { command: string; args: string } | null {
  const first = text.split(/\s+/)[0] ?? "";
  if (!first.startsWith("/")) return null;
  const withoutSlash = first.slice(1);
  const at = withoutSlash.indexOf("@");
  const command = (at >= 0 ? withoutSlash.slice(0, at) : withoutSlash).toLowerCase();
  return { command, args: text.slice(first.length).trim() };
}

async function reply(env: Env, chatId: string | number, text: string, fetchImpl: typeof fetch): Promise<void> {
  try {
    await sendMessage(env, { chatId, text }, fetchImpl);
  } catch (error) {
    console.error(
      "telegram_send_failed",
      error instanceof TelegramError ? error.code : error instanceof Error ? error.message : "unknown",
    );
  }
}

async function handlePairing(
  env: Env,
  request: Request,
  message: TelegramMessage,
  rawCode: string,
  fetchImpl: typeof fetch,
): Promise<void> {
  const chatId = String(message.chat.id);
  const telegramUserId = String(message.from?.id ?? "");
  const code = normalizePairingCode(rawCode);

  if (!telegramUserId || message.chat.type !== "private") {
    await reply(env, chatId, "Pasangan hanya boleh dibuat melalui sembang peribadi dengan bot.", fetchImpl);
    return;
  }

  if (!limitStore(pairingRate, `pair:${telegramUserId}`, 5, 10 * 60 * 1000)) {
    await auditTelegramApi(env, request, null, "telegram.pairing.rate_limited", {
      telegramUserId,
      chatId,
    });
    await reply(env, chatId, "Terlalu banyak cubaan pasangan. Sila cuba selepas 10 minit.", fetchImpl);
    return;
  }

  if (code.length !== PAIRING_CODE_LENGTH) {
    await reply(env, chatId, "Kod pasangan tidak sah atau telah tamat tempoh.", fetchImpl);
    await auditTelegramApi(env, request, null, "telegram.pairing.failed", {
      telegramUserId,
      chatId,
      reason: "invalid_format",
    });
    return;
  }

  const codeHash = await hashCode(code);
  const row = await env.DB.prepare(
    `SELECT pc.id, pc.user_id, pc.expires_at, pc.used_at,
            u.name AS user_name, u.status AS user_status, r.name AS role
     FROM telegram_pairing_codes pc
     JOIN users u ON u.id = pc.user_id
     JOIN roles r ON r.id = u.role_id
     WHERE pc.code_hash = ?`,
  )
    .bind(codeHash)
    .first<{
      id: string;
      user_id: string;
      expires_at: string;
      used_at: string | null;
      user_name: string;
      user_status: string;
      role: string;
    }>();

  if (!row || row.used_at || row.expires_at <= nowIso()) {
    await reply(env, chatId, "Kod pasangan tidak sah atau telah tamat tempoh.", fetchImpl);
    await auditTelegramApi(env, request, null, "telegram.pairing.failed", {
      telegramUserId,
      chatId,
      reason: !row ? "not_found" : row.used_at ? "already_used" : "expired",
    });
    return;
  }

  if (row.role !== "admin" || row.user_status !== "active") {
    await reply(env, chatId, "Kod ini tidak terikat kepada pentadbir aktif. Akses ditolak.", fetchImpl);
    await auditTelegramApi(env, request, null, "telegram.pairing.failed", {
      telegramUserId,
      chatId,
      reason: "not_admin",
    });
    return;
  }

  const usedAt = nowIso();
  const consumed = await env.DB.prepare(
    `UPDATE telegram_pairing_codes
     SET used_at = ?, used_by_telegram_user_id = ?, used_by_chat_id = ?
     WHERE id = ? AND used_at IS NULL`,
  )
    .bind(usedAt, telegramUserId, chatId, row.id)
    .run();

  if (!consumed.meta.changes) {
    await reply(env, chatId, "Kod pasangan telah digunakan. Jana kod baharu di papan pemuka.", fetchImpl);
    await auditTelegramApi(env, request, null, "telegram.pairing.failed", {
      telegramUserId,
      chatId,
      reason: "race_already_used",
    });
    return;
  }

  await env.DB.prepare(
    "DELETE FROM telegram_accounts WHERE user_id = ? OR telegram_user_id = ? OR chat_id = ?",
  )
    .bind(row.user_id, telegramUserId, chatId)
    .run();

  await env.DB.prepare(
    `INSERT INTO telegram_accounts
       (id, user_id, telegram_user_id, chat_id, username, first_name, status, paired_at, last_message_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
  )
    .bind(
      newId(),
      row.user_id,
      telegramUserId,
      chatId,
      String(message.from?.username ?? "").slice(0, 100),
      String(message.from?.first_name ?? "").slice(0, 120),
      usedAt,
      usedAt,
    )
    .run();

  await audit(env, request, row.user_id, "telegram.pairing.success", "telegram", telegramUserId, {
    chatId,
    pairedAt: usedAt,
  });
  await reply(
    env,
    chatId,
    [
      `✅ Pasangan berjaya untuk ${row.user_name}.`,
      "",
      welcomeMessage(row.user_name),
    ].join("\n"),
    fetchImpl,
  );
}

async function resolveAccount(
  env: Env,
  telegramUserId: string,
  chatId: string,
): Promise<TelegramAccountRow | null> {
  return env.DB.prepare(
    `SELECT a.id, a.user_id, a.telegram_user_id, a.chat_id, a.username, a.first_name,
            a.status, a.paired_at, a.last_message_at,
            u.name AS user_name, u.status AS user_status, r.name AS role
     FROM telegram_accounts a
     JOIN users u ON u.id = a.user_id
     JOIN roles r ON r.id = u.role_id
     WHERE a.telegram_user_id = ? AND a.chat_id = ? AND a.status = 'active'`,
  )
    .bind(telegramUserId, chatId)
    .first<TelegramAccountRow>();
}

async function handleConfirm(
  env: Env,
  request: Request,
  user: AuthUser,
  args: string,
  runner: TelegramTaskRunner,
  chatId: string,
  telegramUserId: string,
): Promise<string> {
  const taskId = args.trim().split(/\s+/)[0] ?? "";
  if (!taskId) return "Sila hantar /confirm ID_TUGASAN.";

  const task = await env.DB.prepare(
    `SELECT id, title, description, created_by, metadata FROM tasks WHERE id = ?`,
  )
    .bind(taskId)
    .first<{
      id: string;
      title: string;
      description: string;
      created_by: string | null;
      metadata: string;
    }>();

  if (!task || task.created_by !== user.id) {
    return "Tugasan tidak dijumpai atau bukan milik akaun ini.";
  }

  let metadata: Record<string, unknown> = {};
  try {
    metadata = JSON.parse(task.metadata || "{}") as Record<string, unknown>;
  } catch {
    metadata = {};
  }
  if (metadata.source !== "telegram" || String(metadata.telegram_user_id ?? "") !== telegramUserId) {
    return "Tugasan ini bukan tugasan Telegram anda. Pengesahan ditolak.";
  }

  const existing = await env.DB.prepare(
    `SELECT id FROM approvals
     WHERE entity_type = 'task' AND entity_id = ? AND status = 'approved'
     ORDER BY decided_at DESC LIMIT 1`,
  )
    .bind(taskId)
    .first<{ id: string }>();

  if (!existing) {
    const decidedAt = nowIso();
    await env.DB.prepare(
      `INSERT INTO approvals
         (id, entity_type, entity_id, title, description, status, requested_by, decided_by,
          decision_note, created_at, updated_at, decided_at)
       VALUES (?, 'task', ?, ?, ?, 'approved', ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        newId(),
        taskId,
        `Pengesahan tindakan luaran: ${String(task.title).slice(0, 150)}`,
        "Disahkan secara eksplisit melalui Telegram.",
        user.id,
        user.id,
        "Disahkan melalui Telegram oleh pentadbir.",
        decidedAt,
        decidedAt,
        decidedAt,
      )
      .run();
    await env.DB.prepare(
      `INSERT INTO task_events (id, task_id, event_type, actor_user_id, from_status, to_status, message, metadata)
       VALUES (?, ?, 'approval_granted', ?, NULL, NULL, ?, ?)`,
    )
      .bind(
        newId(),
        taskId,
        user.id,
        "Pengesahan eksplisit diterima melalui Telegram.",
        JSON.stringify({ channel: "telegram", telegramUserId, chatId }),
      )
      .run();
    await audit(env, request, user.id, "telegram.task.confirm", "task", taskId, {
      telegramUserId,
      chatId,
    });
  }

  if (!limitStore(taskRate, `task:${user.id}`, 6, 10 * 60 * 1000)) {
    return "Had pelaksanaan tugasan dicapai. Sila cuba selepas 10 minit.";
  }

  const result = await runner(env, request, user, {
    taskId,
    requiresApproval: true,
    telegramUserId,
    chatId,
  });
  return result.reply;
}

async function handleAuthorizedMessage(
  env: Env,
  request: Request,
  user: AuthUser,
  message: TelegramMessage,
  text: string,
  runner: TelegramTaskRunner,
  chatId: string,
  telegramUserId: string,
  fetchImpl: typeof fetch,
): Promise<void> {
  const parsed = parseCommand(text);

  if (parsed) {
    switch (parsed.command) {
      case "start":
        await reply(env, chatId, welcomeMessage(user.name), fetchImpl);
        return;
      case "help":
        await reply(env, chatId, helpMessage(user.name), fetchImpl);
        return;
      case "status":
        await reply(env, chatId, await formatStatus(env), fetchImpl);
        return;
      case "tasks":
        await reply(env, chatId, await formatTasks(env), fetchImpl);
        return;
      case "agents":
        await reply(env, chatId, await formatAgents(env), fetchImpl);
        return;
      case "prospects":
        await reply(env, chatId, await formatProspects(env), fetchImpl);
        return;
      case "report":
        await reply(env, chatId, await formatReport(env), fetchImpl);
        return;
      case "confirm":
        await reply(
          env,
          chatId,
          await handleConfirm(env, request, user, parsed.args, runner, chatId, telegramUserId),
          fetchImpl,
        );
        return;
      case "pair":
        await reply(env, chatId, "Akaun ini sudah dipasangkan. Jana kod baharu jika perlu menukar akaun.", fetchImpl);
        return;
      default:
        await reply(env, chatId, `Arahan /${parsed.command} tidak dikenali.\n\n${helpMessage(user.name)}`, fetchImpl);
        return;
    }
  }

  const taskText = truncate(text, MAX_TASK_TEXT);
  if (taskText.length < 3) {
    await reply(env, chatId, "Sila hantar arahan atau tugasan yang lebih jelas.", fetchImpl);
    return;
  }

  if (!limitStore(taskRate, `task:${user.id}`, 6, 10 * 60 * 1000)) {
    await audit(env, request, user.id, "telegram.task.rate_limited", "telegram", telegramUserId, {
      chatId,
    });
    await reply(env, chatId, "Had pelaksanaan tugasan dicapai. Sila cuba selepas 10 minit.", fetchImpl);
    return;
  }

  const requiresApproval = isExternalAction(taskText);
  const result = await runner(env, request, user, {
    text: taskText,
    requiresApproval,
    telegramUserId,
    chatId,
  });
  await reply(env, chatId, result.reply, fetchImpl);
}

export async function handleTelegramWebhook(
  request: Request,
  env: Env,
  runner: TelegramTaskRunner,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  if (request.method !== "POST") {
    return json({ ok: false, error: { code: "method_not_allowed" } }, 405);
  }

  const botToken = (env.TELEGRAM_BOT_TOKEN ?? "").trim();
  const webhookSecret = (env.TELEGRAM_WEBHOOK_SECRET ?? "").trim();
  if (!botToken || !webhookSecret) {
    return json({ ok: false, error: { code: "telegram_not_configured" } }, 503);
  }

  const suppliedSecret = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!constantTimeEqual(suppliedSecret, webhookSecret)) {
    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    if (limitStore(invalidWebhookRate, `invalid:${ip}`, 20, 60 * 1000)) {
      await audit(env, request, null, "telegram.webhook.rejected", "telegram", "webhook", {
        reason: "invalid_secret",
      });
    }
    return json({ ok: false, error: { code: "invalid_webhook_secret" } }, 401);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return json({ ok: false, error: { code: "unsupported_media_type" } }, 415);
  }

  const raw = await request.text();
  if (raw.length > MAX_MESSAGE_BYTES) {
    return json({ ok: false, error: { code: "payload_too_large" } }, 413);
  }

  let update: TelegramUpdate;
  try {
    update = JSON.parse(raw) as TelegramUpdate;
  } catch {
    return json({ ok: false, error: { code: "invalid_json" } }, 400);
  }

  const updateId = Number(update?.update_id);
  if (!Number.isInteger(updateId) || updateId < 0) {
    return json({ ok: false, error: { code: "invalid_update" } }, 400);
  }

  const message = update.message;
  const telegramUserId = message?.from?.id ? String(message.from.id) : "";
  const chatId = message?.chat?.id ? String(message.chat.id) : "";
  const messageId = message?.message_id ? String(message.message_id) : null;

  const dedupe = await env.DB.prepare(
    `INSERT OR IGNORE INTO telegram_updates (update_id, telegram_user_id, chat_id, message_id)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(String(updateId), telegramUserId, chatId, messageId)
    .run();

  if (!dedupe.meta.changes) {
    return json({ ok: true, duplicate: true });
  }

  if (!message || !message.from || message.from.is_bot || !message.chat) {
    return json({ ok: true, ignored: true });
  }

  if (!limitStore(messageRate, `chat:${chatId}`, 30, 60 * 1000)) {
    await audit(env, request, null, "telegram.rate_limited", "telegram", chatId, {
      telegramUserId,
      reason: "messages",
    });
    await reply(env, chatId, "Had mesej dicapai. Sila cuba sebentar lagi.", fetchImpl);
    return json({ ok: true, rateLimited: true });
  }

  if (message.chat.type !== "private") {
    await reply(env, chatId, "Demi keselamatan, SARA hanya beroperasi dalam sembang peribadi.", fetchImpl);
    await audit(env, request, null, "telegram.unauthorized", "telegram", telegramUserId, {
      chatId,
      reason: "not_private_chat",
    });
    return json({ ok: true, rejected: true });
  }

  const text = String(message.text ?? "").trim();
  if (!text) {
    const account = await resolveAccount(env, telegramUserId, chatId);
    if (account) await reply(env, chatId, "SARA hanya menerima mesej teks buat masa ini.", fetchImpl);
    return json({ ok: true, ignored: true });
  }

  const parsed = parseCommand(text);
  if (parsed?.command === "pair") {
    await handlePairing(env, request, message, parsed.args, fetchImpl);
    return json({ ok: true, paired: true });
  }

  const account = await resolveAccount(env, telegramUserId, chatId);
  if (!account || account.user_status !== "active" || account.role !== "admin") {
    if (limitStore(unpairedRate, `unpaired:${telegramUserId}`, 3, 10 * 60 * 1000)) {
      await reply(env, chatId, pairingInstructions(await readSetting(env, "telegram_bot_username")), fetchImpl);
    }
    await audit(env, request, account?.user_id ?? null, "telegram.unauthorized", "telegram", telegramUserId, {
      chatId,
      reason: !account ? "unpaired" : account.user_status !== "active" ? "user_inactive" : "not_admin",
    });
    return json({ ok: true, rejected: true });
  }

  if (parsed?.command === "start" || parsed?.command === "help") {
    await reply(
      env,
      chatId,
      parsed.command === "start" ? welcomeMessage(account.user_name) : helpMessage(account.user_name),
      fetchImpl,
    );
    return json({ ok: true });
  }

  const updatedAt = nowIso();
  await env.DB.prepare(
    `UPDATE telegram_accounts
     SET username = ?, first_name = ?, last_message_at = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      String(message.from.username ?? "").slice(0, 100),
      String(message.from.first_name ?? "").slice(0, 120),
      updatedAt,
      updatedAt,
      account.id,
    )
    .run();

  await audit(env, request, account.user_id, "telegram.message", "telegram", String(updateId), {
    chatId,
    telegramUserId,
    command: parsed?.command ?? "natural_language",
  });

  const user: AuthUser = {
    id: account.user_id,
    email: "",
    name: account.user_name,
    role: account.role,
    status: account.user_status,
  };

  try {
    await handleAuthorizedMessage(
      env,
      request,
      user,
      message,
      text,
      runner,
      chatId,
      telegramUserId,
      fetchImpl,
    );
  } catch (error) {
    console.error(
      "telegram_processing_failed",
      error instanceof Error ? error.message : "unknown",
    );
    await audit(env, request, account.user_id, "telegram.message.error", "telegram", String(updateId), {
      chatId,
      code: error instanceof TelegramError ? error.code : "processing_failed",
    });
    await reply(env, chatId, "Maaf, permintaan tidak dapat diproses. Sila cuba lagi.", fetchImpl);
  }

  return json({ ok: true });
}

export async function handleTelegramBootstrap(
  request: Request,
  env: Env,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const expected = (env.TELEGRAM_BOOTSTRAP_TOKEN ?? "").trim();
  if (!expected) return json({ ok: false, error: { code: "not_found" } }, 404);
  if (request.method !== "POST") return json({ ok: false, error: { code: "method_not_allowed" } }, 405);

  const supplied = request.headers.get("x-telegram-bootstrap-token") ?? "";
  if (!constantTimeEqual(supplied, expected)) {
    return json({ ok: false, error: { code: "unauthorized" } }, 401);
  }

  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  if (!limitStore(bootstrapRate, `bootstrap:${ip}`, 10, 10 * 60 * 1000)) {
    return json({ ok: false, error: { code: "rate_limited" } }, 429);
  }

  const origin = new URL(request.url).origin;
  try {
    const registered = await registerTelegramWebhook(env, origin, fetchImpl);
    await auditTelegramApi(env, request, null, "telegram.webhook.register", {
      url: registered.url,
      source: "bootstrap",
    });
    return json({ ok: true, url: registered.url, webhook: registered.webhook });
  } catch (error) {
    const telegramError =
      error instanceof TelegramError
        ? error
        : new TelegramError("webhook_registration_failed", "Pendaftaran webhook gagal.", 502);
    await auditTelegramApi(env, request, null, "telegram.webhook.register_failed", {
      code: telegramError.code,
    });
    return json({ ok: false, error: { code: telegramError.code, message: telegramError.message } }, telegramError.status);
  }
}

export async function sendTelegramNotification(
  env: Env,
  chatId: string,
  text: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  try {
    await sendMessage(env, { chatId, text }, fetchImpl);
    return true;
  } catch {
    return false;
  }
}
