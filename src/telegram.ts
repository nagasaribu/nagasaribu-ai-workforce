import type { AuthUser, Env } from "./types.ts";
import { tryConsume } from "./rate-limit.ts";
import { getProviderStatus } from "./providers/deepseek.ts";
import { getMetaStatus } from "./providers/meta.ts";
import {
  DEFAULT_RESPONSE_MODE,
  MODE_DESCRIPTIONS,
  MODE_ICONS,
  MODE_LABELS,
  RESPONSE_MODES,
  isResponseMode,
  normalizeResponseMode,
  type ResponseMode,
} from "./response-mode.ts";
import {
  agentVisual,
  escapeHtml,
  extractKeyPoints,
  extractSummary,
  formatAiContent,
  modeVisual,
  renderApprovalRequest,
  renderTaskResponse,
  splitHtmlMessage,
  statusVisual,
  taskRef,
} from "./telegram-format.ts";
import { getUserResponseMode, setUserResponseMode } from "./user-preferences.ts";

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
  responseMode: ResponseMode;
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

export interface TelegramConversationInput {
  text: string;
  chatId: string;
  telegramUserId: string;
  messageId: number;
  responseMode: ResponseMode;
}

export interface TelegramConversationResult {
  content: string;
  duplicate?: boolean;
}

export type TelegramConversationResponder = (
  env: Env,
  request: Request,
  user: AuthUser,
  input: TelegramConversationInput,
) => Promise<TelegramConversationResult>;

export const TELEGRAM_COMMANDS = [
  { command: "start", description: "Mulakan SARA" },
  { command: "help", description: "Panduan arahan" },
  { command: "human", description: "Mod jawapan mesra dan ringkas" },
  { command: "simple", description: "Mod jawapan sangat mudah" },
  { command: "deep_thinking", description: "Mod analisis strategik terperinci" },
  { command: "mode", description: "Lihat mod jawapan semasa" },
  { command: "status", description: "Ringkasan operasi" },
  { command: "tasks", description: "Tugasan terkini" },
  { command: "agents", description: "Status ejen AI" },
  { command: "prospects", description: "Ringkasan prospek" },
  { command: "report", description: "Laporan operasi" },
  { command: "confirm", description: "Sahkan tindakan luaran" },
] as const;

interface TelegramAccountRow {
  id: string;
  user_id: string;
  telegram_user_id: string;
  chat_id: string;
  username: string;
  first_name: string;
  status: string;
  response_mode: string;
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

export async function setMyCommands(
  env: Env,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  return callTelegram<boolean>(
    env,
    "setMyCommands",
    {
      commands: TELEGRAM_COMMANDS.map((command) => ({ ...command })),
      scope: { type: "default" },
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
  const chunks =
    input.parseMode === "HTML"
      ? splitHtmlMessage(text)
      : splitMessage(text);
  for (const chunk of chunks) {
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
  commandsRegisteredAt: string | null;
  linkedAccounts: number;
  activeLinks: number;
  pendingPairingCodes: number;
  responseModes: Record<ResponseMode, number>;
  lastUpdateAt: string | null;
  lastMessageAt: string | null;
}

export async function getTelegramSummary(env: Env): Promise<TelegramSummary> {
  const now = nowIso();
  const [accountStats, modeRows, pendingCodes, lastUpdate, lastMessage, settings] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active
       FROM telegram_accounts`,
    ).first<{ total: number; active: number | null }>(),
    env.DB.prepare(
      `SELECT response_mode, COUNT(*) AS count FROM telegram_accounts
       WHERE status = 'active' GROUP BY response_mode`,
    ).all<{ response_mode: string; count: number }>(),
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
       WHERE key IN ('telegram_bot_username', 'telegram_webhook_url', 'telegram_webhook_checked_at', 'telegram_commands_registered_at')`,
    ).all<{ key: string; value: string }>(),
  ]);

  const setting = (key: string): string | null =>
    settings.results.find((row) => row.key === key)?.value ?? null;

  const botTokenConfigured = Boolean((env.TELEGRAM_BOT_TOKEN ?? "").trim());
  const webhookSecretConfigured = Boolean((env.TELEGRAM_WEBHOOK_SECRET ?? "").trim());
  const responseModes: Record<ResponseMode, number> = {
    human: 0,
    simple: 0,
    deep_thinking: 0,
  };
  for (const row of modeRows.results) {
    if (isResponseMode(row.response_mode)) {
      responseModes[row.response_mode] = Number(row.count);
    }
  }

  return {
    configured: botTokenConfigured && webhookSecretConfigured,
    botTokenConfigured,
    webhookSecretConfigured,
    botUsername: setting("telegram_bot_username"),
    webhookUrl: setting("telegram_webhook_url"),
    webhookCheckedAt: setting("telegram_webhook_checked_at"),
    commandsRegisteredAt: setting("telegram_commands_registered_at"),
    linkedAccounts: Number(accountStats?.total ?? 0),
    activeLinks: Number(accountStats?.active ?? 0),
    pendingPairingCodes: Number(pendingCodes?.count ?? 0),
    responseModes,
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
            a.status, a.response_mode, a.paired_at, a.last_message_at
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
): Promise<{ url: string; webhook: Record<string, unknown> | null; commandsRegistered: boolean }> {
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

  let commandsRegistered = false;
  try {
    commandsRegistered = await setMyCommands(env, fetchImpl);
    if (commandsRegistered) {
      await writeSetting(env, "telegram_commands_registered_at", nowIso());
    }
  } catch {
    commandsRegistered = false;
  }

  let webhook: Record<string, unknown> | null = null;
  try {
    webhook = sanitizeWebhook(await getWebhookInfo(env, fetchImpl), url);
  } catch {
    webhook = null;
  }

  return { url, webhook, commandsRegistered };
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

export async function setTelegramResponseMode(
  env: Env,
  userId: string,
  mode: ResponseMode,
): Promise<number> {
  await setUserResponseMode(env, userId, mode);
  const result = await env.DB.prepare(
    `UPDATE telegram_accounts SET response_mode = ?, updated_at = ?
     WHERE user_id = ? AND status = 'active'`,
  )
    .bind(mode, nowIso(), userId)
    .run();
  return Number(result.meta.changes ?? 0);
}

function modeLine(mode: ResponseMode): string {
  const visual = modeVisual(mode);
  return `${visual.icon} Mod: <b>${escapeHtml(visual.label)}</b>`;
}

function renderMode(mode: ResponseMode): string {
  const visual = modeVisual(mode);
  return [
    `${visual.icon} <b>Mod Jawapan: ${escapeHtml(visual.label)}</b>`,
    escapeHtml(MODE_DESCRIPTIONS[mode]),
    "",
    "<b>Tukar mod</b>",
    "/human — mesra dan ringkas",
    "/simple — sangat mudah, 3–5 poin",
    "/deep_thinking — analisis terperinci",
    "",
    "<i>Mod disimpan untuk akaun Telegram ini.</i>",
  ].join("\n");
}

function pairingInstructions(botUsername: string | null): string {
  const handle = botUsername ? `@${botUsername}` : "bot ini";
  return [
    "🔐 <b>Pasangan diperlukan</b>",
    "",
    "Akaun Telegram ini belum dipasangkan dengan pentadbir.",
    "",
    "1. Log masuk ke Pusat Kawalan Operasi.",
    "2. Buka panel Telegram dan jana kod pasangan (sah 10 minit).",
    "3. Hantar di sini: <code>/pair KOD</code>",
    "",
    `Tiada akses diberikan secara automatik. Bot: ${escapeHtml(handle)}`,
  ].join("\n");
}

function welcomeMessage(name: string, mode: ResponseMode): string {
  return [
    `🤖 <b>SARA sedia membantu, ${escapeHtml(name)}.</b>`,
    modeLine(mode),
    "",
    "Hantar tugasan biasa atau pilih arahan pantas:",
    "/status · /tasks · /agents · /prospects · /report",
    "/human · /simple · /deep_thinking · /mode",
    "",
    "🔐 Tindakan luaran memerlukan pengesahan melalui /confirm.",
  ].join("\n");
}

function helpMessage(mode: ResponseMode): string {
  const lines = [
    "🤖 <b>Panduan SARA</b>",
    modeLine(mode),
    "",
    "<b>Mod jawapan</b>",
    "/human — mesra dan ringkas",
    "/simple — 3–5 poin mudah",
    "/deep_thinking — analisis terperinci",
    "/mode — lihat mod semasa",
    "",
    "<b>Operasi</b>",
    "/status — ringkasan operasi",
    "/tasks — tugasan terkini",
    "/task &lt;ref&gt; — butiran penuh",
    "/agents — ejen AI",
    "/prospects — prospek",
    "/report — ringkasan laporan",
    "/report full — laporan terperinci",
    "",
    "<b>Kelulusan</b>",
    "/confirm &lt;ref&gt; — sahkan tindakan luaran",
  ];
  if (mode !== "simple") {
    lines.push("", "Alias: /deep dan /deep-thinking = /deep_thinking.");
  }
  return lines.join("\n");
}

function truncate(value: unknown, max = MAX_TASK_TEXT): string {
  return String(value ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
}

async function formatStatus(env: Env, mode: ResponseMode): Promise<string> {
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
  const active = Number(tasks?.active ?? 0);
  const completed = Number(tasks?.completed ?? 0);
  const failed = Number(tasks?.failed ?? 0);
  const blocked = Number(tasks?.blocked ?? 0);
  const agentsActive = Number(agents?.active ?? 0);
  const agentsTotal = Number(agents?.total ?? 0);
  const newProspects = Number(prospects?.count ?? 0);
  const approvalsPending = Number(approvals?.count ?? 0);
  const summary = `${active} tugasan aktif dan ${approvalsPending} kelulusan menunggu perhatian.`;

  const lines = [
    "📊 <b>Status Operasi</b>",
    escapeHtml(summary),
    "",
  ];

  if (mode === "deep_thinking") {
    lines.push(
      "<b>Tugas</b>",
      `• Jumlah: ${Number(tasks?.total ?? 0)}`,
      `• Aktif: ${active}`,
      `• Selesai: ${completed}`,
      `• Gagal: ${failed}`,
      `• Disekat: ${blocked}`,
      "",
      "<b>Ejen, CRM &amp; Prospek</b>",
      `• Ejen aktif: ${agentsActive}/${agentsTotal}`,
      `• Prospek baharu: ${newProspects}`,
      `• CRM: ${Number(leads?.total ?? 0)} prospek, ${Number(leads?.new ?? 0)} baharu, ${Number(leads?.qualified ?? 0)} layak`,
      `• Kelulusan menunggu: ${approvalsPending}`,
      "",
      "<b>AI</b>",
      `• DeepSeek: ${ai.mode.toUpperCase()} (${escapeHtml(ai.model)})`,
      `• Muse Spark: ${backup.available ? "tersedia" : "tidak tersedia"} (${escapeHtml(backup.model)})`,
      `• Telegram: ${telegramConfigured(env) ? "dikonfigurasikan" : "belum dikonfigurasikan"}`,
    );
  } else {
    const bullets =
      mode === "simple"
        ? [
            `⏳ Tugas aktif: ${active}`,
            `🔐 Kelulusan: ${approvalsPending}`,
            `🎯 Prospek baharu: ${newProspects}`,
            `🤖 Ejen aktif: ${agentsActive}`,
          ]
        : [
            `⏳ Tugas aktif: ${active}`,
            `✅ Selesai: ${completed}`,
            `⚠️ Gagal/disekat: ${failed + blocked}`,
            `🤖 Ejen aktif: ${agentsActive}/${agentsTotal}`,
            `🎯 Prospek baharu: ${newProspects}`,
            `🔐 Kelulusan menunggu: ${approvalsPending}`,
          ];
    lines.push(...bullets, "", `🤖 AI: DeepSeek ${ai.mode.toUpperCase()}`);
  }

  lines.push("", "➡️ /report untuk laporan penuh.");
  return lines.join("\n");
}

async function formatTasks(env: Env, mode: ResponseMode): Promise<string> {
  const result = await env.DB.prepare(
    `SELECT t.id, t.title, t.status, t.execution_state, t.priority, t.created_at,
            a.name AS agent_name
     FROM tasks t LEFT JOIN agent_registry a ON a.id = t.assigned_agent_id
     ORDER BY t.created_at DESC LIMIT 8`,
  ).all<Record<string, unknown>>();

  if (!result.results.length) {
    return "📊 <b>Tugasan</b>\n\nBelum ada tugasan dalam sistem.";
  }

  const Limit = mode === "simple" ? 3 : mode === "human" ? 5 : 8;
  const tasks = result.results.slice(0, Limit);
  const lines = [
    "📊 <b>Tugasan Terkini</b>",
    `${result.results.length} tugasan terkini dipaparkan.`,
    "",
  ];
  for (const task of tasks) {
    const state = String(task.execution_state ?? task.status ?? "pending");
    const visual = statusVisual(state);
    const ref = taskRef(String(task.id ?? ""));
    const agent = String(task.agent_name ?? "SARA (auto)");
    lines.push(
      `${visual.icon} <b>${escapeHtml(String(task.title ?? "").slice(0, 120))}</b>`,
      `${escapeHtml(agent)} · ${escapeHtml(visual.label)} · <code>${escapeHtml(ref)}</code>`,
    );
  }
  lines.push("", `➡️ /task <code>${escapeHtml(taskRef(String(tasks[0]?.id ?? "")))}</code> untuk butiran penuh.`);
  return lines.join("\n");
}

async function formatAgents(env: Env, mode: ResponseMode): Promise<string> {
  const result = await env.DB.prepare(
    `SELECT a.name, a.kind, a.status,
            COALESCE((SELECT COUNT(*) FROM tasks t
                      WHERE t.assigned_agent_id = a.id
                        AND t.execution_state NOT IN ('completed','cancelled')), 0) AS active_tasks
     FROM agent_registry a ORDER BY a.status ASC, a.name ASC LIMIT 20`,
  ).all<Record<string, unknown>>();

  if (!result.results.length) return "🤖 <b>Ejen AI</b>\n\nBelum ada ejen berdaftar.";

  const active = result.results.filter((agent) => agent.status === "active");
  const selected = mode === "simple" ? active.slice(0, 3) : mode === "human" ? active.slice(0, 6) : result.results;
  const lines = [
    "🤖 <b>Ejen AI</b>",
    `${active.length} ejen aktif daripada ${result.results.length} berdaftar.`,
    "",
  ];
  for (const agent of selected) {
    const name = String(agent.name ?? "");
    const status = String(agent.status ?? "");
    const activeTasks = Number(agent.active_tasks ?? 0);
    const kind = String(agent.kind ?? "general");
    lines.push(
      `${agentVisual(name)} <b>${escapeHtml(name)}</b> · ${escapeHtml(status)} · ${activeTasks} tugas aktif${mode === "deep_thinking" ? ` · ${escapeHtml(kind)}` : ""}`,
    );
  }
  lines.push("", "➡️ /tasks untuk senarai tugasan.");
  return lines.join("\n");
}

async function formatProspects(env: Env, mode: ResponseMode): Promise<string> {
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
    "🎯 <b>Prospek</b>",
    `${counts.new} prospek baharu menunggu semakan.`,
    "",
    `• Baharu: ${counts.new}`,
    `• Diimport: ${counts.imported}`,
    `• Ditolak: ${counts.rejected}`,
  ];
  if (latest.results.length) {
    const limit = mode === "simple" ? 2 : mode === "human" ? 3 : 5;
    lines.push("", "<b>Calon terkini</b>");
    for (const row of latest.results.slice(0, limit)) {
      lines.push(
        `• ${escapeHtml(String(row.company_name ?? "").slice(0, 80))} — skor ${Number(row.qualification_score ?? 0)}/100 (${escapeHtml(String(row.status ?? ""))})`,
      );
    }
  }
  lines.push("", "➡️ /report untuk ringkasan operasi.");
  return lines.join("\n");
}

async function formatReport(env: Env, mode: ResponseMode): Promise<string> {
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
  const active = Number(tasks?.active ?? 0);
  const completedTasks = Number(tasks?.completed ?? 0);
  const failedTasks = Number(tasks?.failed ?? 0);
  const blockedTasks = Number(tasks?.blocked ?? 0);
  const pendingApprovals = Number(approvals?.pending ?? 0);
  const summary = `${completedTasks} tugasan selesai, ${failedTasks} gagal dan ${pendingApprovals} kelulusan menunggu.`;

  const lines = [
    "📊 <b>Laporan Operasi</b>",
    escapeHtml(summary),
    "",
  ];

  if (mode === "deep_thinking") {
    lines.push(
      "<b>Tugas &amp; pelaksanaan</b>",
      `• Jumlah: ${Number(tasks?.total ?? 0)}`,
      `• Aktif: ${active}`,
      `• Selesai: ${completedTasks}`,
      `• Gagal: ${failedTasks}`,
      `• Disekat: ${blockedTasks}`,
      `• Pelaksanaan: ${Number(execution?.started ?? 0)} mula, ${Number(execution?.completed ?? 0)} selesai, ${Number(execution?.failed ?? 0)} gagal, ${Number(execution?.mock ?? 0)} mock, ${Number(execution?.fallbacks ?? 0)} fallback`,
      "",
      "<b>Ejen &amp; CRM</b>",
      `• Ejen aktif: ${Number(agents?.active ?? 0)}/${Number(agents?.total ?? 0)}`,
      `• CRM: ${Number(leads?.total ?? 0)} prospek, ${Number(leads?.new ?? 0)} baharu, ${Number(leads?.qualified ?? 0)} layak`,
      `• Kelulusan: ${pendingApprovals} menunggu / ${Number(approvals?.total ?? 0)} jumlah`,
      "",
      "<b>AI &amp; Telegram</b>",
      `• DeepSeek: ${ai.mode.toUpperCase()} (${escapeHtml(ai.model)})`,
      `• Muse Spark: ${backup.available ? "tersedia" : "tidak tersedia"} (${escapeHtml(backup.model)})`,
      `• Telegram: ${telegram.activeLinks} akaun aktif, mod ${RESPONSE_MODES.map((item) => `${MODE_LABELS[item]} ${telegram.responseModes[item]}`).join(" · ")}`,
    );
  } else {
    lines.push(
      `⏳ Tugas aktif: ${active}`,
      `✅ Selesai: ${completedTasks}`,
      `❌ Gagal: ${failedTasks}`,
      `⚠️ Disekat: ${blockedTasks}`,
      `🔐 Kelulusan menunggu: ${pendingApprovals}`,
      `🤖 Ejen aktif: ${Number(agents?.active ?? 0)}/${Number(agents?.total ?? 0)}`,
      `🎯 Prospek baharu: ${Number(leads?.new ?? 0)}`,
      `🤖 AI: DeepSeek ${ai.mode.toUpperCase()}`,
    );
  }

  if (activity.results.length) {
    lines.push("", "<b>Aktiviti terkini</b>");
    for (const row of activity.results.slice(0, mode === "simple" ? 3 : 5)) {
      lines.push(
        `• ${escapeHtml(String(row.event_type ?? ""))}: ${escapeHtml(String(row.message ?? "").slice(0, 120))}`,
      );
    }
  }

  lines.push("", "➡️ /status untuk ringkasan pantas.");
  return lines.join("\n");
}

async function resolveTaskId(env: Env, raw: string): Promise<string | null> {
  const ref = String(raw ?? "").trim().replace(/^#/, "");
  if (!/^[a-f0-9-]{1,36}$/i.test(ref)) return null;
  if (ref.length >= 36) {
    const row = await env.DB.prepare("SELECT id FROM tasks WHERE id = ?").bind(ref).first<{ id: string }>();
    return row?.id ?? null;
  }
  const result = await env.DB.prepare(
    "SELECT id FROM tasks WHERE id LIKE ? ORDER BY created_at DESC LIMIT 2",
  )
    .bind(`${ref}%`)
    .all<{ id: string }>();
  return result.results.length === 1 ? result.results[0].id : null;
}

async function formatTaskDetail(env: Env, taskId: string, mode: ResponseMode): Promise<string> {
  const task = await env.DB.prepare(
    `SELECT t.id, t.title, t.description, t.status, t.execution_state, t.priority, t.metadata,
            t.result, t.last_error, t.last_execution_at, t.execution_mode, t.execution_count,
            t.provider, t.provider_model, t.created_at, t.updated_at, t.completed_at,
            a.name AS agent_name, u.name AS assigned_user_name, c.name AS created_by_name,
            (SELECT ap.status FROM approvals ap
             WHERE ap.entity_type = 'task' AND ap.entity_id = t.id
             ORDER BY ap.created_at DESC LIMIT 1) AS approval_status,
            (SELECT ap.description FROM approvals ap
             WHERE ap.entity_type = 'task' AND ap.entity_id = t.id
             ORDER BY ap.created_at DESC LIMIT 1) AS approval_description
     FROM tasks t
     LEFT JOIN agent_registry a ON a.id = t.assigned_agent_id
     LEFT JOIN users u ON u.id = t.assigned_user_id
     LEFT JOIN users c ON c.id = t.created_by
     WHERE t.id = ?`,
  )
    .bind(taskId)
    .first<Record<string, unknown>>();
  if (!task) return "❌ <b>Tugasan tidak dijumpai.</b>";

  const events = await env.DB.prepare(
    `SELECT event_type, message, created_at FROM task_events
     WHERE task_id = ? ORDER BY created_at DESC LIMIT 5`,
  )
    .bind(taskId)
    .all<Record<string, unknown>>();

  let metadata: Record<string, unknown> = {};
  try {
    metadata = JSON.parse(String(task.metadata ?? "{}")) as Record<string, unknown>;
  } catch {
    metadata = {};
  }
  const state = String(task.execution_state ?? task.status ?? "pending");
  const visual = statusVisual(state);
  const ref = taskRef(taskId);
  const title = String(task.title ?? "Tugasan");
  const resultText = String(task.result ?? "").trim();
  const errorText = String(task.last_error ?? "").trim();
  const description = String(task.description ?? "").trim();
  const summary =
    extractSummary(resultText) ||
    extractSummary(description) ||
    extractSummary(errorText) ||
    "Butiran tugasan dipaparkan di bawah.";
  const agentName = String(task.agent_name ?? task.assigned_user_name ?? "SARA (auto)");
  const modeValue = normalizeResponseMode(metadata.responseMode ?? mode);
  const lines = [
    `${visual.icon} <b>${escapeHtml(title)}</b>`,
    escapeHtml(summary),
    "",
    "<b>Butiran</b>",
    `• Rujukan: <code>${escapeHtml(ref)}</code>`,
    `• Status: ${escapeHtml(visual.label)}`,
    `${agentVisual(agentName)} Ejen: ${escapeHtml(agentName)}`,
    `• Mod jawapan: ${escapeHtml(MODE_LABELS[modeValue])}`,
    `• Dicipta: ${escapeHtml(String(task.created_at ?? "").slice(0, 16).replace("T", " "))}`,
  ];
  if (task.provider) {
    lines.push(
      `• Penyedia: ${escapeHtml(String(task.provider))}${task.provider_model ? ` · ${escapeHtml(String(task.provider_model))}` : ""}`,
    );
  }
  if (task.approval_status) {
    lines.push(`• Kelulusan: ${escapeHtml(String(task.approval_status))}`);
    if (task.approval_description) {
      lines.push(`• Sebab: ${escapeHtml(String(task.approval_description).slice(0, 240))}`);
    }
  }
  if (description) {
    const max = mode === "deep_thinking" ? 3000 : 1200;
    lines.push("", "<b>Keterangan</b>", escapeHtml(description.slice(0, max)));
  }
  if (resultText) {
    lines.push("", "<b>Hasil</b>", formatAiContent(resultText));
  }
  if (errorText) {
    lines.push("", "⚠️ <b>Sekatan / ralat</b>", escapeHtml(errorText));
  }
  if (events.results.length) {
    lines.push("", "<b>Peristiwa terkini</b>");
    for (const event of events.results) {
      lines.push(
        `• ${escapeHtml(String(event.event_type ?? ""))}: ${escapeHtml(String(event.message ?? "").slice(0, 160))}`,
      );
    }
  }
  const needsApproval = metadata.requiresApproval === true && task.approval_status !== "approved";
  lines.push(
    "",
    needsApproval
      ? `➡️ Hantar <code>/confirm ${escapeHtml(ref)}</code> untuk memberi pengesahan.`
      : "➡️ /tasks untuk senarai tugasan.",
  );
  return lines.join("\n");
}

const NEGATION_RE =
  /\b(jangan|janganlah|jgn|jng|usah|usahlah|tidak|tak|tanpa|elak|elakkan|do\s+not|dont|never|avoid|without)\b/i;

const NON_ACTION_VERB_RE =
  /\b(analisis|analisa|kaji|sediakan|siapkan|bina|rancang|rancangkan|susun|kumpul|semak|nilai|kira|draf|tulis|ringkaskan|prepare|prepare|analyses|analyse|analyze|create|build|draft|review|calculate|plan)\b/i;

const SEND_ACTION_RE =
  /\b(hantar|menghantar|dihantar|kirim|mengirim|emailkan|whatsappkan|send|sending|email|e[\s-]?mail|text|texting|whatsapp)\b[^.!?;\n]{0,140}\b(kepada|to|whatsapp|email|e[\s-]?mel|sms|mesej|message|messages|surat|invois|invoice|sebut harga|quotation|tawaran|kontrak|iklan|ads?|advertisements?|kempen|campaign|pelanggan|prospek|client|customer|lead|pembekal|vendor|clients|customers|prospects|leads)\b/i;

const CONTACT_ACTION_RE =
  /\b(hubungi|menghubungi|telefon|menelefon|panggil|memanggil|sms|contact|contacting|call|calling)\b[^.!?;\n]{0,100}\b(pelanggan|prospek|client|customer|lead|orang|nombor|kepada|pembekal|vendor|clients|customers|prospects|leads)\b/i;

const PUBLISH_ACTION_RE =
  /\b(terbit|terbitkan|menerbitkan|diterbitkan|publish|publishing|posting|siar|siarkan|menyiarkan|advertise|advertising)\b/i;

const CAMPAIGN_ACTION_RE =
  /\b(laksana|laksanakan|melaksanakan|jalankan|menjalankan|mulakan|memulakan|aktifkan|mengaktifkan|launch|run|execute|start)\b[^.!?;\n]{0,100}\b(kempen|campaign)\b/i;

const CAMPAIGN_REVERSE_RE =
  /\b(kempen|campaign)\b[^.!?;\n]{0,100}\b(laksana|laksanakan|melaksanakan|jalankan|menjalankan|mulakan|memulakan|aktifkan|mengaktifkan|launch|run|execute|start)\b/i;

const PAYMENT_ACTION_RE =
  /\b(bayar|membayar|pembayaran|payment|pay|beli|membeli|pembelian|purchase|langgan|melanggan|berlanggan|langganan|subscription|subscribe|tempah|menempah|booking|book|buy)\b/i;

const COMMITMENT_ACTION_RE =
  /\b(tandatangan|menandatangani|ditandatangani|sign|signing)\b[^.!?;\n]{0,80}\b(kontrak|contract|perjanjian|agreement|tawaran|offer)\b/i;

const COORDINATOR_RE = /\b(atau|or)\b/i;

const ACTION_PATTERNS = [
  SEND_ACTION_RE,
  CONTACT_ACTION_RE,
  PUBLISH_ACTION_RE,
  CAMPAIGN_ACTION_RE,
  CAMPAIGN_REVERSE_RE,
  PAYMENT_ACTION_RE,
  COMMITMENT_ACTION_RE,
];

function matchIndices(pattern: RegExp, text: string): number[] {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const matcher = new RegExp(pattern.source, flags);
  const indices: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(text)) !== null) {
    indices.push(match.index);
    if (match[0].length === 0) matcher.lastIndex += 1;
  }
  return indices;
}

function externalActionIndices(text: string): number[] {
  const indices = ACTION_PATTERNS.flatMap((pattern) => matchIndices(pattern, text));
  return [...new Set(indices)].sort((a, b) => a - b);
}

function unitHasUnnegatedAction(unit: string): boolean {
  const actionIndices = externalActionIndices(unit);
  if (!actionIndices.length) return false;

  const negationIndices = matchIndices(NEGATION_RE, unit);
  if (!negationIndices.length) return true;

  const negated = new Set<number>();
  for (const negationIndex of negationIndices) {
    const firstActionPosition = actionIndices.findIndex((index) => index >= negationIndex);
    if (firstActionPosition < 0) continue;

    const firstActionIndex = actionIndices[firstActionPosition];
    const beforeFirstAction = unit.slice(negationIndex, firstActionIndex);
    if (NON_ACTION_VERB_RE.test(beforeFirstAction)) continue;

    const afterFirstAction = unit.slice(firstActionIndex);
    const coordinatedList = COORDINATOR_RE.test(afterFirstAction);
    const extendsAcrossComma = coordinatedList || !afterFirstAction.includes(",");
    const lastActionPosition = extendsAcrossComma
      ? actionIndices.length - 1
      : firstActionPosition;

    for (let i = firstActionPosition; i <= lastActionPosition; i += 1) {
      negated.add(actionIndices[i]);
    }
  }

  return actionIndices.some((index) => !negated.has(index));
}

function stripNegatedActionClauses(text: string): string {
  return text
    .split(/[.!?;\n]+|\b(?:tetapi|tapi|namun|sebaliknya|kemudian|but|however|then)\b/i)
    .map((unit) => unit.trim())
    .filter((unit) => unit && unitHasUnnegatedAction(unit))
    .join(" ");
}

export function isExternalAction(text: string): boolean {
  const normalized = String(text ?? "")
    .toLowerCase()
    .replace(/['’‘`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;
  return stripNegatedActionClauses(normalized).length > 0;
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
    await sendMessage(env, { chatId, text, parseMode: "HTML" }, fetchImpl);
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
       (id, user_id, telegram_user_id, chat_id, username, first_name, status, response_mode, paired_at, last_message_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', 'human', ?, ?)`,
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
      `✅ <b>Pasangan berjaya untuk ${escapeHtml(row.user_name)}.</b>`,
      "",
      welcomeMessage(row.user_name, DEFAULT_RESPONSE_MODE),
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
            a.status, COALESCE(p.response_mode, a.response_mode, 'human') AS response_mode,
            a.paired_at, a.last_message_at,
            u.name AS user_name, u.status AS user_status, r.name AS role
     FROM telegram_accounts a
     JOIN users u ON u.id = a.user_id
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN user_ai_preferences p ON p.user_id = a.user_id
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
  responseMode: ResponseMode,
): Promise<string> {
  const ref = args.trim().split(/\s+/)[0] ?? "";
  if (!ref) return "Sila hantar <code>/confirm REF</code>.";
  const taskId = await resolveTaskId(env, ref);
  if (!taskId) return "❌ <b>Tugasan tidak dijumpai atau rujukan tidak tepat.</b>";

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
    return "❌ <b>Tugasan tidak dijumpai atau bukan milik akaun ini.</b>";
  }

  let metadata: Record<string, unknown> = {};
  try {
    metadata = JSON.parse(task.metadata || "{}") as Record<string, unknown>;
  } catch {
    metadata = {};
  }
  if (metadata.source !== "telegram" || String(metadata.telegram_user_id ?? "") !== telegramUserId) {
    return "🔐 <b>Pengesahan ditolak.</b> Tugasan ini bukan tugasan Telegram anda.";
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
    return "⚠️ Had pelaksanaan tugasan dicapai. Sila cuba selepas 10 minit.";
  }

  const result = await runner(env, request, user, {
    taskId,
    requiresApproval: true,
    responseMode,
    telegramUserId,
    chatId,
  });
  return result.reply;
}

async function handleAuthorizedMessage(
  env: Env,
  request: Request,
  user: AuthUser,
  account: TelegramAccountRow,
  text: string,
  runner: TelegramTaskRunner,
  conversationResponder: TelegramConversationResponder,
  messageId: number,
  chatId: string,
  telegramUserId: string,
  fetchImpl: typeof fetch,
): Promise<void> {
  const parsed = parseCommand(text);
  const responseMode = normalizeResponseMode(account.response_mode);
  const modeCommands: Record<string, ResponseMode> = {
    human: "human",
    simple: "simple",
    deep_thinking: "deep_thinking",
    deep: "deep_thinking",
    "deep-thinking": "deep_thinking",
  };

  if (parsed) {
    const requestedMode = modeCommands[parsed.command];
    if (requestedMode) {
      await setUserResponseMode(env, user.id, requestedMode);
      await audit(env, request, user.id, "telegram.mode.change", "telegram", account.id, {
        from: responseMode,
        to: requestedMode,
      });
      await reply(env, chatId, renderMode(requestedMode), fetchImpl);
      return;
    }

    switch (parsed.command) {
      case "mode":
        await reply(env, chatId, renderMode(responseMode), fetchImpl);
        return;
      case "start":
        await reply(env, chatId, welcomeMessage(user.name, responseMode), fetchImpl);
        return;
      case "help":
        await reply(env, chatId, helpMessage(responseMode), fetchImpl);
        return;
      case "status":
        await reply(env, chatId, await formatStatus(env, responseMode), fetchImpl);
        return;
      case "tasks":
        await reply(env, chatId, await formatTasks(env, responseMode), fetchImpl);
        return;
      case "agents":
        await reply(env, chatId, await formatAgents(env, responseMode), fetchImpl);
        return;
      case "prospects":
        await reply(env, chatId, await formatProspects(env, responseMode), fetchImpl);
        return;
      case "report": {
        const reportMode: ResponseMode =
          parsed.args.trim().toLowerCase() === "full"
            ? "deep_thinking"
            : responseMode === "simple"
              ? "simple"
              : "human";
        await reply(env, chatId, await formatReport(env, reportMode), fetchImpl);
        return;
      }
      case "task": {
        const taskId = await resolveTaskId(env, parsed.args);
        if (!taskId) {
          await reply(
            env,
            chatId,
            "❌ <b>Tugasan tidak dijumpai.</b>\n\nGunakan rujukan seperti <code>/task #a1b2c3d4</code>.",
            fetchImpl,
          );
          return;
        }
        await reply(env, chatId, await formatTaskDetail(env, taskId, responseMode), fetchImpl);
        return;
      }
      case "confirm":
        await reply(
          env,
          chatId,
          await handleConfirm(
            env,
            request,
            user,
            parsed.args,
            runner,
            chatId,
            telegramUserId,
            responseMode,
          ),
          fetchImpl,
        );
        return;
      case "pair":
        await reply(
          env,
          chatId,
          "🔐 Akaun ini sudah dipasangkan. Jana kod baharu di papan pemuka jika perlu menukar akaun.",
          fetchImpl,
        );
        return;
      default:
        await reply(
          env,
          chatId,
          `❌ <b>Arahan /${escapeHtml(parsed.command)} tidak dikenali.</b>\n\n${helpMessage(responseMode)}`,
          fetchImpl,
        );
        return;
    }
  }

  const taskText = truncate(text, MAX_TASK_TEXT);
  if (taskText.length < 3) {
    await reply(env, chatId, "Sila hantar arahan atau tugasan yang lebih jelas.", fetchImpl);
    return;
  }

  const result = await conversationResponder(env, request, user, {
    text: taskText,
    chatId,
    telegramUserId,
    messageId,
    responseMode,
  });
  if (!result.duplicate && result.content) {
    await reply(env, chatId, escapeHtml(result.content), fetchImpl);
  }
}

export async function handleTelegramWebhook(
  request: Request,
  env: Env,
  runner: TelegramTaskRunner,
  conversationResponder: TelegramConversationResponder,
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
      account,
      text,
      runner,
      conversationResponder,
      message.message_id,
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
    await reply(env, chatId, "⚠️ Maaf, permintaan tidak dapat diproses. Sila cuba lagi.", fetchImpl);
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
      commandsRegistered: registered.commandsRegistered,
    });
    return json({
      ok: true,
      url: registered.url,
      webhook: registered.webhook,
      commandsRegistered: registered.commandsRegistered,
    });
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
