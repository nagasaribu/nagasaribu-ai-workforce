export interface AiBindings {
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
  DEEPSEEK_MODEL?: string;
  AI_MODE?: string;
}

export type AiMode = "live" | "mock";

export interface ProviderStatus {
  configured: boolean;
  mode: AiMode;
  model: string;
  reason?: "missing_api_key" | "forced_mock";
}

export interface ProviderInput {
  systemPrompt: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
}

export interface ProviderUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  reasoning_tokens?: number;
}

export type ProviderName = "deepseek" | "meta";

export interface ProviderResult {
  mode: AiMode;
  model: string;
  content: string;
  latencyMs: number;
  usage?: ProviderUsage;
  requestId?: string;
  provider?: ProviderName;
  responseStatus?: string;
}

export class ProviderError extends Error {
  code: string;
  status: number;
  retryable: boolean;
  providerStatus?: number;
  provider?: ProviderName;
  fallbackAttempted = false;
  fallbackReason?: string;

  constructor(
    code: string,
    message: string,
    status = 502,
    retryable = false,
    providerStatus?: number,
    provider?: ProviderName,
  ) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.providerStatus = providerStatus;
    this.provider = provider;
  }
}

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-chat";

export function getProviderStatus(env: AiBindings): ProviderStatus {
  const key = (env.DEEPSEEK_API_KEY ?? "").trim();
  const configured = key.length > 0;
  const forcedMock = (env.AI_MODE ?? "auto").trim().toLowerCase() === "mock";

  if (!configured) {
    return {
      configured: false,
      mode: "mock",
      model: (env.DEEPSEEK_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL,
      reason: "missing_api_key",
    };
  }

  if (forcedMock) {
    return {
      configured: true,
      mode: "mock",
      model: (env.DEEPSEEK_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL,
      reason: "forced_mock",
    };
  }

  return {
    configured: true,
    mode: "live",
    model: (env.DEEPSEEK_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL,
  };
}

function completionEndpoint(baseUrl: string | undefined): string {
  const raw = (baseUrl ?? DEFAULT_BASE_URL).trim().replace(/\/+$/, "") || DEFAULT_BASE_URL;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ProviderError("invalid_base_url", "Konfigurasi endpoint AI tidak sah.", 500);
  }

  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !local) {
    throw new ProviderError("invalid_base_url", "Endpoint AI mesti menggunakan HTTPS.", 500);
  }

  return `${url.origin}${url.pathname.replace(/\/+$/, "")}/chat/completions`;
}

function mockContent(status: ProviderStatus, input: ProviderInput): string {
  const reason =
    status.reason === "forced_mock"
      ? "Mod mock dipaksa melalui AI_MODE."
      : "Kunci DEEPSEEK_API_KEY belum dikonfigurasikan sebagai Cloudflare Secret.";

  return [
    "[MOD MOCK] Tiada panggilan kepada DeepSeek dibuat.",
    reason,
    "",
    "Ringkasan tugasan yang diterima:",
    input.prompt.slice(0, 800),
    "",
    "Tindakan diperlukan: tetapkan DEEPSEEK_API_KEY melalui Cloudflare Secrets sebelum pelaksanaan AI sebenar.",
  ].join("\n");
}

function readUsage(value: unknown): ProviderUsage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const usage = value as Record<string, unknown>;
  const result: ProviderUsage = {};
  for (const key of ["prompt_tokens", "completion_tokens", "total_tokens"] as const) {
    if (typeof usage[key] === "number") result[key] = usage[key] as number;
  }
  return Object.keys(result).length ? result : undefined;
}

export async function runDeepSeek(
  env: AiBindings,
  input: ProviderInput,
  fetchImpl: typeof fetch = fetch,
): Promise<ProviderResult> {
  const status = getProviderStatus(env);
  const started = Date.now();

  if (status.mode === "mock") {
    return {
      mode: "mock",
      model: status.model,
      content: mockContent(status, input),
      latencyMs: Date.now() - started,
      provider: "deepseek",
    };
  }

  const apiKey = (env.DEEPSEEK_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new ProviderError(
      "missing_api_key",
      "Kunci API DeepSeek belum dikonfigurasikan.",
      503,
      false,
      undefined,
      "deepseek",
    );
  }

  const endpoint = completionEndpoint(env.DEEPSEEK_BASE_URL);
  const controller = new AbortController();
  const timeoutMs = Math.min(Math.max(input.timeoutMs ?? 20_000, 1_000), 60_000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: status.model,
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: input.prompt },
        ],
        temperature: Math.min(Math.max(input.temperature ?? 0.2, 0), 1),
        max_tokens: Math.min(Math.max(input.maxTokens ?? 1400, 64), 4096),
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new ProviderError(
          "provider_auth_error",
          "Pengesahan DeepSeek gagal. Semak DEEPSEEK_API_KEY.",
          502,
          false,
          response.status,
          "deepseek",
        );
      }
      if (response.status === 429) {
        throw new ProviderError(
          "provider_rate_limited",
          "DeepSeek mengehadkan permintaan (HTTP 429).",
          503,
          true,
          response.status,
          "deepseek",
        );
      }
      if (response.status >= 500) {
        throw new ProviderError(
          "provider_http_error",
          `DeepSeek memulangkan status ${response.status}.`,
          503,
          true,
          response.status,
          "deepseek",
        );
      }
      throw new ProviderError(
        "provider_request_error",
        `DeepSeek menolak permintaan (HTTP ${response.status}).`,
        502,
        false,
        response.status,
        "deepseek",
      );
    }

    const data = (await response.json()) as {
      id?: unknown;
      choices?: Array<{ message?: { content?: unknown } }>;
      usage?: unknown;
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new ProviderError(
        "provider_invalid_response",
        "DeepSeek memulangkan respons kosong.",
        502,
        false,
        undefined,
        "deepseek",
      );
    }

    return {
      mode: "live",
      model: status.model,
      content: content.trim(),
      latencyMs: Date.now() - started,
      usage: readUsage(data.usage),
      requestId: typeof data.id === "string" ? data.id : undefined,
      provider: "deepseek",
    };
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderError(
        "provider_timeout",
        "DeepSeek tidak memberi respons dalam had masa.",
        504,
        true,
        undefined,
        "deepseek",
      );
    }
    throw new ProviderError(
      "provider_unreachable",
      "DeepSeek tidak dapat dihubungi.",
      502,
      true,
      undefined,
      "deepseek",
    );
  } finally {
    clearTimeout(timer);
  }
}
