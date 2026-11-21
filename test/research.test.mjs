import test from "node:test";
import assert from "node:assert/strict";
import {
  buildProspectQuery,
  dedupeKey,
  extractEmail,
  extractPhone,
  normalizeCompanyName,
  prospectsFromSearch,
  scoreProspect,
} from "../src/research.ts";

const INPUT = {
  service: "automasi AI",
  location: "Kuala Lumpur",
  customerType: "kontraktor binaan",
};

test("prospect query includes service, customer type and location", () => {
  const query = buildProspectQuery(INPUT);
  assert.match(query, /automasi AI/);
  assert.match(query, /kontraktor binaan/);
  assert.match(query, /Kuala Lumpur/);
});

test("company names and dedupe keys are deterministic", () => {
  assert.equal(
    normalizeCompanyName("Alpha Construction Sdn Bhd | Laman Rasmi", "https://alpha.test"),
    "Alpha Construction Sdn Bhd",
  );
  assert.equal(dedupeKey("Alpha", "https://www.alpha.test/about"), "domain:alpha.test");
  assert.equal(dedupeKey("Alpha Sdn Bhd", ""), "name:alpha-sdn-bhd");
  assert.equal(dedupeKey("", ""), "");
});

test("public contact extraction never invents values", () => {
  assert.equal(extractEmail("Hubungi info@alpha.test untuk maklumat."), "info@alpha.test");
  assert.equal(extractEmail("Tiada e-mel di sini."), "");
  assert.equal(extractPhone("Telefon: +60 3-1234 5678"), "+60312345678");
  assert.equal(extractPhone("Tahun 2024"), "");
});

test("qualification scores relevant evidence higher and lists missing information", () => {
  const relevant = scoreProspect(
    {
      title: "Alpha Construction Sdn Bhd | Kontraktor Binaan Kuala Lumpur",
      url: "https://alpha-construction.test/about",
      text: "Kontraktor binaan di Kuala Lumpur. Automasi AI untuk operasi. E-mel info@alpha.test. Telefon +60 3-1234 5678.",
      publishedDate: "2026-01-01",
    },
    INPUT,
    "2026-11-21T00:00:00.000Z",
  );
  assert.ok(relevant.qualificationScore >= 60);
  assert.equal(relevant.verified, true);
  assert.equal(relevant.email, "info@alpha.test");
  assert.equal(relevant.phone, "+60312345678");
  assert.equal(relevant.missingInfo.some((item) => item.includes("E-mel")), false);

  const irrelevant = scoreProspect(
    {
      title: "Online Casino",
      url: "https://casino.test",
      text: "Permainan dalam talian.",
    },
    INPUT,
    "2026-11-21T00:00:00.000Z",
  );
  assert.ok(irrelevant.qualificationScore < relevant.qualificationScore);
  assert.ok(irrelevant.missingInfo.some((item) => item.includes("Lokasi")));
  assert.ok(irrelevant.missingInfo.some((item) => item.includes("E-mel")));
});

test("search results are deduplicated by domain and ranked by score", () => {
  const prospects = prospectsFromSearch(
    [
      {
        title: "Alpha Construction",
        url: "https://alpha.test/about",
        text: "Kontraktor binaan Kuala Lumpur. info@alpha.test",
      },
      {
        title: "Alpha Construction Contact",
        url: "https://alpha.test/contact",
        text: "Kontraktor binaan Kuala Lumpur. info@alpha.test +60 3-1234 5678",
      },
      {
        title: "Beta Renovation",
        url: "https://beta.test",
        text: "Renovation in Kuala Lumpur.",
      },
    ],
    INPUT,
    "2026-11-21T00:00:00.000Z",
  );

  assert.equal(prospects.length, 2);
  assert.equal(prospects[0].dedupeKey, "domain:alpha.test");
  assert.ok(prospects[0].evidence.length >= 1);
  for (let index = 1; index < prospects.length; index += 1) {
    assert.ok(prospects[index - 1].qualificationScore >= prospects[index].qualificationScore);
  }
});
