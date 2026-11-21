import {
  ProviderError,
  type ProviderInput,
  type ProviderResult,
  type ProviderUsage,
} from "./deepseek.ts";

export interface MetaBindings {
  META_MODEL_API_KEY?: string;
  META_BASE_URL?: string;
  META_MODEL?: string;
}

export interface MetaStatus {
  provider: "meta";
  configured: boolean;
  available: boolean;
  model: string;
  reason?: "missing_api_key";
}

const DEFAULT_BASE_URL = "https://api.meta.ai/v1";
const DEFAULT_MODEL = "muse-spark-1.3";
const DEFAULT_MAX_OUTPUT_TOKENS = 1400;

export function getMetaStatus(env: MetaBindings): MetaStatus {
  const configured = Boolean((env.META_MODEL_API_KEY ?? "").trim());
  return {
    provider: "meta",
    configured,
    available: configured,
    model: (env.META_MODEL ?? DEFAULT_MODEL).trim() || DEFAULT_MODEL,
    reason: configured ? undefined : "missing_api_key",
  };
}

function responsesEndpoint(baseUrl: string | undefined): string {
  const raw = (baseUrl ?? DEFAULT_BASE_URL).trim().replace(/\/+$/, "") || DEFAULT_BASE_URL;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ProviderError("invalid_base_url", "Konfigurasi endpoint Meta tidak sah.", 500, false, undefined, "meta");
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !local) {
    throw new ProviderError(
      "invalid_base_url",
      "Endpoint Meta mesti menggunakan HTTPS.",
      500,
      false,
      undefined,
      "meta",
    );
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}/responses`;
}

function readUsage(value: unknown): ProviderUsage | undefined {
  if (!value || typeof value !== "object") return undefined;
  const usage = value as Record<string, unknown>;
  const prompt = typeof usage.input_tokens === "number" ? usage.input_tokens : usage.prompt_tokens;
  const completion =
    typeof usage.output_tokens === "number" ? usage.output_tokens : usage.completion_tokens;
  const total = typeof usage.total_tokens === "number" ? usage.total_tokens : undefined;
  const result: ProviderUsage = {};
  if (typeof prompt === "number") result.prompt_tokens = prompt;
  if (typeof completion === "number") result.completion_tokens = completion;
  if (typeof total === "number") result.total_tokens = total;
  else if (typeof prompt === "number" && typeof completion === "number") {
    result.total_tokens = prompt + completion;
  }
  return Object.keys(result).length ? result : undefined;
}

function extractVisibleText(value: unknown): string {
  const data = value as Record<string, unknown>;
  let content = "";
  if (Array.isArray(data.output)) {
    for (const rawItem of data.output) {
      if (!rawItem || typeof rawItem !== "object") continue;
      const item = rawItem as Record<string, unknown>;
      if (item.type === "message" && typeof item.content === "string") {
        content += item.content;
        continue;
      }
      if (!Array.isArray(item.content)) continue;
      for (const rawPart of item.content) {
        if (!rawPart || typeof rawPart !== "object") continue;
        const part = rawPart as Record<string, unknown>;
        if (
          (part.type === "output_text" || part.type === "text") &&
          typeof part.text === "string"
        ) {
          content += part.text;
        }
      }
    }
  }
  if (!content && typeof data.output_text === "string") content = data.output_text;
  return content.trim();
}

export async function runMeta(
  env: MetaBindings,
  input: ProviderInput,
  fetchImpl: typeof fetch = fetch,
): Promise<ProviderResult> {
  const status = getMetaStatus(env);
  if (!status.available) {
    throw new ProviderError(
      "missing_api_key",
      "Muse Spark tidak tersedia kerana META_MODEL_API_KEY belum dikonfigurasikan.",
      503,
      false,
      undefined,
      "meta",
    );
  }

  const apiKey = (env.META_MODEL_API_KEY ?? "").trim();
  const endpoint = responsesEndpoint(env.META_BASE_URL);
  const controller = new AbortController();
  const timeoutMs = Math.min(Math.max(input.timeoutMs ?? 30_000, 1_000), 90_000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: status.model,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: input.systemPrompt }],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: input.prompt }],
          },
        ],
        reasoning: { effort: "high", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        store: false,
        stream: false,
        max_output_tokens: Math.min(
          Math.max(input.maxTokens ?? DEFAULT_MAX_OUTPUT_TOKENS, 64),
          4096,
        ),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new ProviderError(
          "provider_auth_error",
          "Pengesahan Muse Spark gagal. Semak META_MODEL_API_KEY.",
          502,
          false,
          response.status,
          "meta",
        );
      }
      if (response.status === 429) {
        throw new ProviderError(
          "provider_rate_limited",
          "Muse Spark mengehadkan permintaan (HTTP 429).",
          503,
          true,
          response.status,
          "meta",
        );
      }
      if (response.status >= 500) {
        throw new ProviderError(
          "provider_http_error",
          `Muse Spark memulangkan status ${response.status}.`,
          503,
          true,
          response.status,
          "meta",
        );
      }
      throw new ProviderError(
        "provider_request_error",
        `Muse Spark menolak permintaan (HTTP ${response.status}).`,
        502,
        false,
        response.status,
        "meta",
      );
    }

    const data = (await response.json()) as Record<string, unknown>;
    if (data.error && typeof data.error === "object") {
      const errorRecord = data.error as Record<string, unknown>;
      const code = typeof errorRecord.code === "string" ? errorRecord.code : "unknown";
      throw new ProviderError(
        "provider_response_error",
        `Muse Spark memulangkan ralat API (${code}).`,
        502,
        false,
        undefined,
        "meta",
      );
    }
    const content = extractVisibleText(data);
    if (!content) {
      const outputTypes = Array.isArray(data.output)
        ? data.output
            .map((item) =>
              item && typeof item === "object" && typeof (item as Record<string, unknown>).type === "string"
                ? String((item as Record<string, unknown>).type)
                : "unknown",
            )
            .slice(0, 6)
            .join("|")
        : "tiada";
      const status = typeof data.status === "string" ? data.status : "unknown";
      const incomplete =
        data.incomplete_details && typeof data.incomplete_details === "object"
          ? String((data.incomplete_details as Record<string, unknown>).reason ?? "")
          : "";
      throw new ProviderError(
        "provider_invalid_response",
        `Muse Spark tidak memulangkan teks yang boleh dibaca (status=${status}; output=${outputTypes || "tiada"}${incomplete ? "; sebab=" + incomplete : ""}).`,
        502,
        false,
        undefined,
        "meta",
      );
    }

    return {
      mode: "live",
      model: status.model,
      content,
      latencyMs: Date.now() - started,
      usage: readUsage(data.usage),
      requestId: typeof data.id === "string" ? data.id : undefined,
      provider: "meta",
    };
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderError(
        "provider_timeout",
        "Muse Spark tidak memberi respons dalam had masa.",
        504,
        true,
        undefined,
        "meta",
      );
    }
    throw new ProviderError(
      "provider_unreachable",
      "Muse Spark tidak dapat dihubungi.",
      502,
      true,
      undefined,
      "meta",
    );
  } finally {
    clearTimeout(timer);
  }
}
