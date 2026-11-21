import test from "node:test";
import assert from "node:assert/strict";
import { applyAiAnalysis, parseAiAnalysis } from "../src/analysis.ts";

const PROSPECT = {
  companyName: "Alpha Construction",
  website: "https://alpha.test",
  sourceUrl: "https://alpha.test/about",
  summary: "Kontraktor binaan di Kuala Lumpur.",
  contactName: "",
  email: "",
  phone: "",
  evidence: [{ title: "Alpha", url: "https://alpha.test/about", snippet: "Kontraktor binaan" }],
  retrievedAt: "2026-11-21T00:00:00.000Z",
  qualificationScore: 50,
  qualificationNotes: "Skor peraturan 50/100.",
  missingInfo: ["E-mel perniagaan awam tidak ditemui."],
  verified: true,
  dedupeKey: "domain:alpha.test",
  analysisMode: "rules",
  aiAnalysis: "",
};

test("AI analysis parsing validates URLs and clamps scores", () => {
  const items = parseAiAnalysis(
    JSON.stringify({
      results: [
        { url: "https://alpha.test/about", score: 140, reason: "Relevan", missing: ["E-mel"] },
        { url: "javascript:alert(1)", score: 90, reason: "Tidak sah" },
        { url: "https://beta.test", score: -5, reason: "Kurang relevan" },
        { url: "https://gamma.test", score: "high" },
      ],
    }),
  );

  assert.equal(items.length, 2);
  assert.equal(items[0].url, "https://alpha.test/about");
  assert.equal(items[0].score, 100);
  assert.equal(items[1].score, 0);
});

test("invalid AI responses return no analysis", () => {
  assert.deepEqual(parseAiAnalysis("not json"), []);
  assert.deepEqual(parseAiAnalysis('{"results": "no"}'), []);
});

test("AI analysis updates scores and reasons without inventing company data", () => {
  const [updated] = applyAiAnalysis(
    [PROSPECT],
    [{ url: "https://alpha.test/about", score: 88, reason: "Bukti kukuh.", missing: ["Harga"] }],
  );

  assert.equal(updated.qualificationScore, 88);
  assert.equal(updated.analysisMode, "deepseek");
  assert.equal(updated.aiAnalysis, "Bukti kukuh.");
  assert.match(updated.qualificationNotes, /Analisis DeepSeek/);
  assert.ok(updated.missingInfo.includes("Harga"));
  assert.equal(updated.companyName, PROSPECT.companyName);
  assert.equal(updated.email, PROSPECT.email);
  assert.equal(updated.phone, PROSPECT.phone);
});

test("unmatched AI URLs leave the deterministic score intact", () => {
  const [unchanged] = applyAiAnalysis(
    [PROSPECT],
    [{ url: "https://other.test", score: 10, reason: "Tidak berkaitan", missing: [] }],
  );
  assert.equal(unchanged.qualificationScore, 50);
  assert.equal(unchanged.analysisMode, "rules");
});
