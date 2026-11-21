import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { MockAgent } from "undici";

const ORIGIN = "https://occ.test";
const SESSION_SECRET = "prospect-test-secret-0123456789";

let mf;
let adminToken = null;
let viewerToken = null;
let searchId = null;
let alphaCandidateId = null;
let betaCandidateId = null;
let casinoCandidateId = null;
let importedLeadId = null;

const draftJson = {
  analysis: "Prospek relevan dengan perkhidmatan automasi AI dan terletak di Kuala Lumpur.",
  whatsapp:
    "Salam, kami melihat Alpha Construction aktif dalam projek binaan di Kuala Lumpur. Boleh kami kongsikan idea automasi ringkas untuk operasi anda? [perlu disahkan]",
  emailSubject: "Idea automasi untuk Alpha Construction",
  emailBody:
    "Salam Alpha Construction,\n\nKami melihat laman web anda dan ingin berkongsi idea automasi operasi. Tiada komitmen diperlukan.\n\nYang benar,\nNAGASARIBU",
  proposal:
    "Cadangan awal: sesi discovery 30 minit, semakan proses sedia ada dan cadangan automasi peringkat pertama. Harga akan disahkan selepas skop dipersetujui.",
};

before(async () => {
  const bundled = await build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es2022",
    write: false,
    logLevel: "silent",
  });

  const mock = new MockAgent();
  mock.disableNetConnect();
  const exaPayload = {
    requestId: "exa-test-request",
    results: [
      {
        title: "Alpha Construction Sdn Bhd | Kontraktor Binaan",
        url: "https://alpha-construction.test/about",
        publishedDate: "2026-01-01",
        text: "Kontraktor binaan di Kuala Lumpur. Automasi AI untuk operasi. E-mel info@alpha-construction.test. Telefon +60 3-1234 5678.",
      },
      {
        title: "Alpha Construction Contact",
        url: "https://alpha-construction.test/contact",
        text: "Kontraktor binaan Kuala Lumpur. Hubungi info@alpha-construction.test atau +60 3-1234 5678.",
      },
      {
        title: "Beta Renovation",
        url: "https://beta-renovation.test",
        text: "Renovation and construction in Kuala Lumpur. Email hello@beta-renovation.test.",
      },
      {
        title: "Online Casino",
        url: "https://casino.test",
        text: "Permainan dalam talian tanpa lokasi perniagaan.",
      },
    ],
  };
  mock.get("https://api.exa.test").intercept({ path: "/search", method: "POST" }).reply(200, exaPayload);
  mock.get("https://api.exa.test").intercept({ path: "/search", method: "POST" }).reply(200, exaPayload);
  mock
    .get("https://api.deepseek.test")
    .intercept({ path: "/chat/completions", method: "POST" })
    .reply(200, {
      id: "deepseek-draft-test",
      choices: [{ message: { content: JSON.stringify(draftJson) } }],
      usage: { prompt_tokens: 100, completion_tokens: 80, total_tokens: 180 },
    });

  mf = new Miniflare({
    modules: true,
    script: bundled.outputFiles[0].text,
    compatibilityDate: "2025-01-01",
    d1Databases: { DB: "prospect-test-db" },
    bindings: {
      APP_ENV: "test",
      SESSION_SECRET,
      EXA_API_KEY: "exa-test-key",
      EXA_BASE_URL: "https://api.exa.test",
      DEEPSEEK_API_KEY: "deepseek-test-key",
      DEEPSEEK_BASE_URL: "https://api.deepseek.test",
    },
    fetchMock: mock,
  });

  const db = await mf.getD1Database("DB");
  const migrationFiles = (await readdir("migrations")).filter((file) => file.endsWith(".sql")).sort();
  for (const file of migrationFiles) {
    const migration = await readFile(`migrations/${file}`, "utf8");
    const statements = migration
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of statements) await db.prepare(statement).run();
  }

  const setup = await call("/api/auth/setup", {
    method: "POST",
    body: {
      name: "Pentadbir Prospek",
      email: "prospects-admin@example.test",
      password: "CorrectHorseBattery1!",
    },
  });
  assert.equal(setup.status, 201);
  adminToken = tokenFromCookie(setup);

  const viewer = await call("/api/users", {
    method: "POST",
    token: adminToken,
    body: {
      name: "Pemerhati",
      email: "prospects-viewer@example.test",
      password: "ViewerPassword123!",
      role: "viewer",
    },
  });
  assert.equal(viewer.status, 201);
  const viewerLogin = await call("/api/auth/login", {
    method: "POST",
    body: { email: "prospects-viewer@example.test", password: "ViewerPassword123!" },
  });
  viewerToken = tokenFromCookie(viewerLogin);
});

after(async () => {
  await mf?.dispose();
});

async function call(path, options = {}) {
  const headers = new Headers();
  if (options.body !== undefined) headers.set("content-type", "application/json");
  if (options.token) headers.set("authorization", `Bearer ${options.token}`);
  for (const [key, value] of Object.entries(options.headers ?? {})) headers.set(key, value);
  const response = await mf.dispatchFetch(`${ORIGIN}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: response.status, data, headers: response.headers };
}

function tokenFromCookie(response) {
  const setCookie = response.headers?.get("set-cookie") ?? "";
  const match = /occ_session=([^;]+)/.exec(setCookie);
  return match ? decodeURIComponent(match[1]) : null;
}

test("prospect status reports configured search and live AI", async () => {
  const response = await call("/api/prospects/status", { token: adminToken });
  assert.equal(response.status, 200);
  assert.equal(response.data.search.provider, "exa");
  assert.equal(response.data.search.available, true);
  assert.equal(response.data.ai.mode, "live");
  assert.equal(response.data.ai.liveDrafts, true);
});

test("prospect research requires authenticated administrator access", async () => {
  const unauth = await call("/api/prospects/research", {
    method: "POST",
    body: { service: "automasi", location: "Kuala Lumpur", customerType: "kontraktor" },
  });
  assert.equal(unauth.status, 401);

  const viewer = await call("/api/prospects/research", {
    method: "POST",
    token: viewerToken,
    body: { service: "automasi", location: "Kuala Lumpur", customerType: "kontraktor" },
  });
  assert.equal(viewer.status, 403);
});

test("research stores evidence, deduplicates domains and ranks candidates", async () => {
  const response = await call("/api/prospects/research", {
    method: "POST",
    token: adminToken,
    body: {
      service: "automasi AI",
      location: "Kuala Lumpur",
      customerType: "kontraktor binaan",
      limit: 5,
    },
  });

  assert.equal(response.status, 201);
  assert.equal(response.data.search.status, "ok");
  searchId = response.data.search.id;
  assert.equal(response.data.candidates.length, 3, "same domain must be deduplicated");

  const alpha = response.data.candidates.find((candidate) =>
    candidate.company_name.startsWith("Alpha Construction"),
  );
  const beta = response.data.candidates.find((candidate) =>
    candidate.company_name.startsWith("Beta Renovation"),
  );
  const casino = response.data.candidates.find((candidate) => candidate.company_name === "Online Casino");
  assert.ok(alpha);
  assert.ok(beta);
  assert.ok(casino);
  alphaCandidateId = alpha.id;
  betaCandidateId = beta.id;
  casinoCandidateId = casino.id;

  assert.equal(alpha.website, "https://alpha-construction.test");
  assert.equal(alpha.source_url, "https://alpha-construction.test/about");
  assert.ok(alpha.retrieved_at);
  assert.ok(Array.isArray(alpha.evidence));
  assert.ok(alpha.evidence.length >= 1);
  assert.ok(Array.isArray(alpha.missingInfo));
  assert.equal(alpha.verified, true);
  assert.ok(alpha.qualification_score >= beta.qualification_score);
  assert.match(alpha.email, /@alpha-construction\.test$/);

  const listed = await call("/api/prospects?status=new", { token: adminToken });
  assert.equal(listed.status, 200);
  assert.equal(listed.data.candidates.length, 3);

  const leadsBefore = await call("/api/leads", { token: adminToken });
  assert.equal(leadsBefore.data.leads.length, 0, "research must not create CRM leads");
});

test("Marketing AI generates reviewed drafts without sending anything", async () => {
  const response = await call(`/api/prospects/${alphaCandidateId}/draft`, {
    method: "POST",
    token: adminToken,
    body: {},
  });
  assert.equal(response.status, 200);
  assert.equal(response.data.provider.mode, "live");
  assert.equal(response.data.provider.live, true);
  assert.match(response.data.draft.whatsapp, /Alpha Construction/);
  assert.match(response.data.draft.emailSubject, /automasi/i);
  assert.match(response.data.draft.proposal, /Cadangan/);

  const detail = await call(`/api/prospects/${alphaCandidateId}`, { token: adminToken });
  assert.equal(detail.status, 200);
  assert.equal(detail.data.candidate.draft_mode, "live");
  assert.match(detail.data.candidate.draft_email_body, /Salam Alpha Construction/);
});

test("reviewed candidates import into CRM once and duplicate companies are blocked", async () => {
  const imported = await call(`/api/prospects/${alphaCandidateId}/import`, {
    method: "POST",
    token: adminToken,
    body: { followUpAt: "2026-12-01" },
  });
  assert.equal(imported.status, 201);
  importedLeadId = imported.data.lead.id;
  assert.equal(imported.data.lead.company_name, "Alpha Construction Sdn Bhd");
  assert.equal(imported.data.lead.source_name, "Exa Web Search");
  assert.equal(imported.data.lead.website, "https://alpha-construction.test");
  assert.equal(imported.data.lead.source_url, "https://alpha-construction.test/about");
  assert.equal(imported.data.lead.verified, 1);
  assert.ok(imported.data.lead.qualification_score > 0);
  assert.ok(imported.data.lead.evidence);
  assert.ok(imported.data.lead.marketing_draft);
  assert.equal(imported.data.lead.dedupe_key, "domain:alpha-construction.test");

  const again = await call(`/api/prospects/${alphaCandidateId}/import`, {
    method: "POST",
    token: adminToken,
    body: {},
  });
  assert.equal(again.status, 409);
  assert.equal(again.data.error.code, "already_processed");

  const secondSearch = await call("/api/prospects/research", {
    method: "POST",
    token: adminToken,
    body: {
      service: "automasi AI",
      location: "Kuala Lumpur",
      customerType: "kontraktor binaan",
      limit: 5,
    },
  });
  assert.equal(secondSearch.status, 201);
  const secondAlpha = secondSearch.data.candidates.find((candidate) =>
    candidate.company_name.startsWith("Alpha Construction"),
  );
  assert.ok(secondAlpha);

  const duplicate = await call(`/api/prospects/${secondAlpha.id}/import`, {
    method: "POST",
    token: adminToken,
    body: {},
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.data.error.code, "duplicate_lead");
  assert.equal(duplicate.data.existingLeadId, importedLeadId);

  const leads = await call("/api/leads", { token: adminToken });
  assert.equal(leads.data.leads.length, 1);
});

test("prospects can be rejected and limits are enforced", async () => {
  const rejected = await call(`/api/prospects/${casinoCandidateId}/reject`, {
    method: "POST",
    token: adminToken,
    body: {},
  });
  assert.equal(rejected.status, 200);

  const rejectedList = await call("/api/prospects?status=rejected", { token: adminToken });
  assert.ok(rejectedList.data.candidates.some((candidate) => candidate.id === casinoCandidateId));

  const tooMany = await call("/api/prospects/research", {
    method: "POST",
    token: adminToken,
    body: { service: "automasi", location: "Kuala Lumpur", customerType: "kontraktor", limit: 50 },
  });
  assert.equal(tooMany.status, 400);

  const viewerImport = await call(`/api/prospects/${betaCandidateId}/import`, {
    method: "POST",
    token: viewerToken,
    body: {},
  });
  assert.equal(viewerImport.status, 403);
});

test("prospect workflows are recorded in the audit log", async () => {
  const logs = await call("/api/audit-logs?limit=200", { token: adminToken });
  assert.equal(logs.status, 200);
  const actions = logs.data.logs.map((entry) => entry.action);
  for (const action of ["prospect.search", "prospect.draft", "prospect.import", "prospect.reject"]) {
    assert.ok(actions.includes(action), `audit log should include ${action}`);
  }
});
