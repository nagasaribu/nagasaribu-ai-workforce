import type { DiscoveredProspect, ResearchInput } from "./research.ts";
import type { Env } from "./types.ts";
import { getProviderStatus, runDeepSeek } from "./providers/deepseek.ts";

export interface AiAnalysisItem {
  url: string;
  score: number;
  reason: string;
  missing: string[];
}

export interface AnalysisOutcome {
  prospects: DiscoveredProspect[];
  mode: "deepseek" | "rules";
  model?: string;
  reason?: string;
}

function safeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function parseAiAnalysis(content: string): AiAnalysisItem[] {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) return [];

  try {
    const parsed = JSON.parse(content.slice(start, end + 1)) as { results?: unknown };
    if (!Array.isArray(parsed.results)) return [];
    const items: AiAnalysisItem[] = [];
    for (const raw of parsed.results) {
      if (!raw || typeof raw !== "object") continue;
      const item = raw as Record<string, unknown>;
      if (typeof item.url !== "string" || !safeUrl(item.url)) continue;
      if (typeof item.score !== "number" || !Number.isFinite(item.score)) continue;
      const missing = Array.isArray(item.missing)
        ? item.missing.filter((entry): entry is string => typeof entry === "string").slice(0, 10)
        : [];
      items.push({
        url: item.url,
        score: Math.min(100, Math.max(0, Math.round(item.score))),
        reason: typeof item.reason === "string" ? item.reason.trim().slice(0, 800) : "",
        missing,
      });
    }
    return items;
  } catch {
    return [];
  }
}

export function applyAiAnalysis(
  prospects: DiscoveredProspect[],
  items: AiAnalysisItem[],
): DiscoveredProspect[] {
  const byUrl = new Map(items.map((item) => [item.url, item]));
  return prospects.map((prospect) => {
    const item = byUrl.get(prospect.sourceUrl);
    if (!item) return prospect;
    return {
      ...prospect,
      qualificationScore: item.score,
      qualificationNotes: [
        prospect.qualificationNotes,
        item.reason ? `Analisis DeepSeek: ${item.reason}` : "",
      ]
        .filter(Boolean)
        .join(" ")
        .slice(0, 1500),
      missingInfo: Array.from(new Set([...prospect.missingInfo, ...item.missing])).slice(0, 15),
      analysisMode: "deepseek",
      aiAnalysis: item.reason,
    };
  });
}

export async function analyseProspectsWithDeepSeek(
  env: Env,
  prospects: DiscoveredProspect[],
  input: ResearchInput,
): Promise<AnalysisOutcome> {
  if (!prospects.length) return { prospects, mode: "rules", reason: "no_results" };
  if (getProviderStatus(env).mode !== "live") {
    return { prospects, mode: "rules", reason: "ai_mock" };
  }

  const evidence = prospects.map((prospect, index) => ({
    index: index + 1,
    url: prospect.sourceUrl,
    title: prospect.evidence[0]?.title ?? "",
    summary: prospect.summary,
    hasEmail: Boolean(prospect.email),
    hasPhone: Boolean(prospect.phone),
    missing: prospect.missingInfo,
  }));

  const prompt = [
    "Analisis prospek perniagaan berikut untuk kelayakan outreach.",
    `Perkhidmatan: ${input.service}`,
    `Lokasi: ${input.location}`,
    `Jenis pelanggan: ${input.customerType}`,
    "",
    "Jangan cipta nama syarikat, e-mel, telefon, harga atau fakta baharu.",
    "Gunakan hanya bukti yang diberikan. Skor 0-100 berdasarkan relevan perkhidmatan, lokasi dan kualiti bukti.",
    "Senaraikan maklumat yang hilang atau belum disahkan.",
    "",
    'Balas HANYA dengan JSON sah: {"results":[{"url":"...","score":0,"reason":"...","missing":["..."]}]}',
    "",
    JSON.stringify(evidence).slice(0, 6000),
  ].join("\n");

  try {
    const result = await runDeepSeek(env, {
      systemPrompt:
        "Anda ialah penganalisis kelayakan prospek. Skor dan terangkan bukti tanpa mencipta data. Jawab dalam Bahasa Melayu.",
      prompt,
      maxTokens: 1000,
      temperature: 0.2,
    });
    const items = parseAiAnalysis(result.content);
    if (!items.length) {
      return { prospects, mode: "rules", reason: "invalid_ai_response" };
    }
    return {
      prospects: applyAiAnalysis(prospects, items),
      mode: "deepseek",
      model: result.model,
    };
  } catch {
    return { prospects, mode: "rules", reason: "ai_failed" };
  }
}
