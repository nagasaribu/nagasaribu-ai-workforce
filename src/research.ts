import type { ExaSearchResult } from "./providers/exa.ts";

export interface ResearchInput {
  service: string;
  location: string;
  customerType: string;
}

export interface ProspectEvidence {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
}

export interface DiscoveredProspect {
  companyName: string;
  website: string;
  sourceUrl: string;
  summary: string;
  contactName: string;
  email: string;
  phone: string;
  evidence: ProspectEvidence[];
  retrievedAt: string;
  qualificationScore: number;
  qualificationNotes: string;
  missingInfo: string[];
  verified: boolean;
  dedupeKey: string;
  analysisMode: "rules" | "deepseek";
  aiAnalysis: string;
}

const STOPWORDS = new Set([
  "dan",
  "atau",
  "untuk",
  "dengan",
  "yang",
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "company",
  "syarikat",
  "official",
  "website",
  "laman",
  "web",
  "contact",
  "hubungi",
]);

export function buildProspectQuery(input: ResearchInput): string {
  return [
    input.service,
    input.customerType,
    input.location,
    "company official website contact",
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

export function tokenize(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3 && !STOPWORDS.has(token)),
    ),
  );
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function websiteOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

export function normalizeCompanyName(title: string, url: string): string {
  const firstSegment = title
    .split(/[|–—]/)
    .map((part) => part.trim())
    .filter(Boolean)[0];

  const candidate = (firstSegment ?? title)
    .split(/\s+-\s+/)[0]
    .replace(/\s+/g, " ")
    .trim();

  if (candidate.length >= 2) return candidate;

  const domain = domainOf(url).split(".")[0] ?? "";
  if (!domain) return "";
  return domain
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .trim();
}

export function dedupeKey(companyName: string, website: string): string {
  const domain = domainOf(website);
  if (domain) return `domain:${domain}`;
  const normalized = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized ? `name:${normalized}` : "";
}

export function extractEmail(text: string): string {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : "";
}

export function extractPhone(text: string): string {
  const matches = text.match(/(?:\+?6?0\d[\d\s().-]{6,}\d|\+\d[\d\s().-]{7,}\d)/g) ?? [];
  for (const match of matches) {
    const digits = match.replace(/[^\d+]/g, "");
    if (digits.replace(/\D/g, "").length >= 8) return digits;
  }
  return "";
}

function overlapScore(tokens: string[], text: string, weight: number): number {
  if (!tokens.length) return 0;
  const haystack = text.toLowerCase();
  const hits = tokens.filter((token) => haystack.includes(token)).length;
  return Math.round((hits / tokens.length) * weight);
}

export function scoreProspect(
  result: ExaSearchResult,
  input: ResearchInput,
  retrievedAt: string,
): DiscoveredProspect {
  const combinedText = [result.title, result.text, result.summary, ...(result.highlights ?? [])]
    .filter(Boolean)
    .join(" ");

  const serviceTokens = tokenize(input.service);
  const customerTokens = tokenize(input.customerType);
  const locationTokens = tokenize(input.location);

  const serviceScore = overlapScore(serviceTokens, combinedText, 40);
  const locationScore = overlapScore(locationTokens, combinedText, 20);
  const evidenceScore =
    (result.url ? 8 : 0) +
    (combinedText.length >= 200 ? 7 : combinedText.length >= 60 ? 4 : 0) +
    (result.publishedDate ? 5 : 0);
  const email = extractEmail(combinedText);
  const phone = extractPhone(combinedText);
  const contactScore = (email ? 5 : 0) + (phone ? 5 : 0);
  const customerScore = overlapScore(customerTokens, combinedText, 5);

  const total = Math.min(100, serviceScore + locationScore + evidenceScore + contactScore + customerScore);
  const companyName = normalizeCompanyName(result.title, result.url);
  const website = websiteOf(result.url);
  const summary =
    (result.summary || result.text || result.title || "").replace(/\s+/g, " ").trim().slice(0, 600) ||
    "Tiada ringkasan awam tersedia.";

  const missingInfo: string[] = [];
  if (!companyName) missingInfo.push("Nama syarikat tidak dapat disahkan.");
  if (!result.title.trim()) missingInfo.push("Tajuk sumber tidak tersedia.");
  if (!email) missingInfo.push("E-mel perniagaan awam tidak ditemui.");
  if (!phone) missingInfo.push("Telefon perniagaan awam tidak ditemui.");
  if (!locationTokens.some((token) => combinedText.toLowerCase().includes(token))) {
    missingInfo.push("Lokasi tidak dapat disahkan daripada sumber.");
  }
  if (!customerTokens.some((token) => combinedText.toLowerCase().includes(token))) {
    missingInfo.push("Jenis pelanggan tidak dapat disahkan daripada sumber.");
  }

  const verified = Boolean(companyName && result.url && (result.title.trim() || result.text?.trim()));

  return {
    companyName,
    website,
    sourceUrl: result.url,
    summary,
    contactName: "",
    email,
    phone,
    evidence: [
      {
        title: result.title || "Sumber awam",
        url: result.url,
        snippet: (result.summary || result.text || result.title || "").replace(/\s+/g, " ").trim().slice(0, 500),
        publishedDate: result.publishedDate,
      },
    ],
    retrievedAt,
    qualificationScore: total,
    qualificationNotes: [
      `Skor ${total}/100.`,
      `Perkhidmatan ${serviceScore}/40;`,
      `lokasi ${locationScore}/20;`,
      `bukti ${evidenceScore}/20;`,
      `hubungan awam ${contactScore}/10;`,
      `jenis pelanggan ${customerScore}/5.`,
    ].join(" "),
    missingInfo,
    verified,
    dedupeKey: dedupeKey(companyName, website),
    analysisMode: "rules",
    aiAnalysis: "",
  };
}

export function prospectsFromSearch(
  results: ExaSearchResult[],
  input: ResearchInput,
  retrievedAt: string,
): DiscoveredProspect[] {
  const byKey = new Map<string, DiscoveredProspect>();

  for (const result of results) {
    const prospect = scoreProspect(result, input, retrievedAt);
    if (!prospect.dedupeKey) continue;
    const existing = byKey.get(prospect.dedupeKey);
    if (!existing) {
      byKey.set(prospect.dedupeKey, prospect);
      continue;
    }
    if (prospect.qualificationScore > existing.qualificationScore) {
      prospect.evidence = [...existing.evidence, ...prospect.evidence].slice(0, 5);
      byKey.set(prospect.dedupeKey, prospect);
    } else {
      existing.evidence = [...existing.evidence, ...prospect.evidence].slice(0, 5);
    }
  }

  return Array.from(byKey.values()).sort(
    (left, right) => right.qualificationScore - left.qualificationScore,
  );
}
