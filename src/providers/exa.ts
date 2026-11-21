export interface SearchBindings {
  EXA_API_KEY?: string;
  EXA_BASE_URL?: string;
}

export interface SearchStatus {
  provider: "exa";
  configured: boolean;
  available: boolean;
  reason?: "missing_api_key";
}

export interface ExaSearchResult {
  title: string;
  url: string;
  publishedDate?: string;
  author?: string;
  score?: number;
  text?: string;
  summary?: string;
  highlights?: string[];
}

export interface ExaSearchResponse {
  provider: "exa";
  query: string;
  requestId?: string;
  results: ExaSearchResult[];
}

export class SearchError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 502) {
    super(message);
    this.name = "SearchError";
    this.code = code;
    this.status = status;
  }
}

const DEFAULT_BASE_URL = "https://api.exa.ai";

export function getSearchStatus(env: SearchBindings): SearchStatus {
  const configured = Boolean((env.EXA_API_KEY ?? "").trim());
  return {
    provider: "exa",
    configured,
    available: configured,
    reason: configured ? undefined : "missing_api_key",
  };
}

function searchEndpoint(baseUrl: string | undefined): string {
  const raw = (baseUrl ?? DEFAULT_BASE_URL).trim().replace(/\/+$/, "") || DEFAULT_BASE_URL;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SearchError("invalid_base_url", "Konfigurasi endpoint carian tidak sah.", 500);
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !local) {
    throw new SearchError("invalid_base_url", "Endpoint carian mesti menggunakan HTTPS.", 500);
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}/search`;
}

function normalizeResult(raw: unknown): ExaSearchResult | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.url !== "string") return null;
  try {
    const url = new URL(item.url);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  } catch {
    return null;
  }

  const highlights = Array.isArray(item.highlights)
    ? item.highlights.filter((entry): entry is string => typeof entry === "string").slice(0, 5)
    : undefined;

  return {
    title: typeof item.title === "string" ? item.title.trim() : "",
    url: item.url,
    publishedDate: typeof item.publishedDate === "string" ? item.publishedDate : undefined,
    author: typeof item.author === "string" ? item.author : undefined,
    score: typeof item.score === "number" ? item.score : undefined,
    text: typeof item.text === "string" ? item.text : undefined,
    summary: typeof item.summary === "string" ? item.summary : undefined,
    highlights,
  };
}

export async function searchExa(
  env: SearchBindings,
  options: { query: string; numResults?: number; timeoutMs?: number },
  fetchImpl: typeof fetch = fetch,
): Promise<ExaSearchResponse> {
  const status = getSearchStatus(env);
  if (!status.available) {
    throw new SearchError(
      "search_unavailable",
      "Carian web tidak tersedia kerana EXA_API_KEY belum dikonfigurasikan.",
      503,
    );
  }

  const apiKey = (env.EXA_API_KEY ?? "").trim();
  const endpoint = searchEndpoint(env.EXA_BASE_URL);
  const numResults = Math.min(Math.max(options.numResults ?? 5, 1), 5);
  const controller = new AbortController();
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 20_000, 1_000), 60_000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        query: options.query,
        type: "auto",
        numResults,
        contents: {
          highlights: true,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new SearchError(
        "search_http_error",
        `Penyedia carian memulangkan status ${response.status}.`,
        502,
      );
    }

    const data = (await response.json()) as {
      requestId?: unknown;
      results?: unknown;
    };
    if (!Array.isArray(data.results)) {
      throw new SearchError("search_invalid_response", "Penyedia carian memulangkan respons tidak sah.", 502);
    }

    const results = data.results
      .map(normalizeResult)
      .filter((result): result is ExaSearchResult => result !== null);

    return {
      provider: "exa",
      query: options.query,
      requestId: typeof data.requestId === "string" ? data.requestId : undefined,
      results,
    };
  } catch (error) {
    if (error instanceof SearchError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new SearchError("search_timeout", "Penyedia carian tidak memberi respons dalam had masa.", 504);
    }
    throw new SearchError("search_unreachable", "Penyedia carian tidak dapat dihubungi.", 502);
  } finally {
    clearTimeout(timer);
  }
}
