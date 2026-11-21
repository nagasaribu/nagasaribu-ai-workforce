# Phase 4 — Customer Acquisition Engine

## Scope
1. Modular public-web search through Exa.
2. Prospect research with evidence and retrieval dates.
3. Explainable lead qualification and missing-information tracking.
4. Administrator review before CRM import, with deduplication.
5. Marketing AI outreach drafts through DeepSeek Live.
6. Malay “Cari Prospek” interface.
7. Audit logging, rate limits and result limits.

## Search provider
- Adapter: `src/providers/exa.ts`.
- Credential: `EXA_API_KEY` as a Cloudflare Secret.
- Optional `EXA_BASE_URL` for testing (HTTPS only).
- If `EXA_API_KEY` is absent, search reports **unavailable** and no results are generated.
- The adapter never fabricates results and never exposes the API key.
- Result limit: 1–10 per search.
- Rate limit: 6 searches per user per 10 minutes.

### Required secret
```bash
printf '%s' 'your-exa-api-key' | npx wrangler secret put EXA_API_KEY
```

## Research and qualification
`POST /api/prospects/research` accepts:
- `service`
- `location`
- `customerType`
- `limit` (1–10, default 5)

The pipeline:
1. Builds a public-web query.
2. Calls Exa.
3. Extracts company name, website, source URL, summary and public business contact details.
4. Scores relevance (service 40, location 20, evidence 20, public contact 10, customer type 5).
5. Records evidence, retrieval date and missing information.
6. Deduplicates results by website domain or normalized company name.
7. Stores reviewed candidates in `prospect_candidates` with status `new`.

Unverified or incomplete records are shown as **Belum disahkan** and list what is missing.

## CRM import
`POST /api/prospects/:id/import`:
- Administrator/manager only.
- Requires a reviewed candidate with status `new`.
- Rejects duplicate companies by dedupe key, company name, website or source URL.
- Creates a `leads` record with source `source_exa`, evidence, retrieval date, score,
  verification state, missing information, follow-up date and any saved drafts.
- Defaults consent to `unknown`; the system does not assume consent.
- Sets candidate status to `imported`.

Candidates can be rejected with `POST /api/prospects/:id/reject`.

## Marketing AI drafts
`POST /api/prospects/:id/draft`:
- Requires DeepSeek **live** mode.
- Returns `503 ai_not_live` in mock mode; no fake drafts are produced.
- Generates analysis, WhatsApp draft, email subject/body and proposal draft.
- Instructs the model not to invent names, contacts, prices or facts.
- Stores drafts on the candidate and in the imported lead.
- **Never sends messages or publishes anything.**

Rate limit: 10 draft generations per user per 10 minutes.

## Dashboard
The Malay **Cari Prospek** tab is available to administrators and managers:
- Search by service, location and customer category.
- Shows source links, evidence, score, verification state and missing information.
- Requires review before **Import ke CRM** or **Tolak**.
- Shows a clear warning when Exa is unavailable or DeepSeek is not live.
- No fabricated results or display-only prospects.

## Database
`migrations/0004_prospect_research.sql` adds:
- Lead fields: website, source URL, evidence, retrieval date, score, qualification notes,
  missing information, verification, follow-up date, marketing draft, dedupe key.
- Unique dedupe index for CRM leads.
- `prospect_searches` and `prospect_candidates`.
- Exa lead source.

## Security and privacy
- Research, import, reject and draft endpoints require authenticated administrator/manager access.
- Viewer and agent roles are denied prospect management.
- Search and draft rate limits plus result-count limits.
- Public business contact details only; no unnecessary personal information.
- Audit actions: `prospect.search`, `prospect.draft`, `prospect.import`, `prospect.reject`.
- No outbound messaging endpoints exist.

## Tests
`npm test` covers 57 tests, including:
- Exa request shape, filtered results, sanitized errors, timeouts and missing-key behaviour.
- Qualification scoring, contact extraction, deduplication and ranking.
- Mock-transport research through the full Worker API.
- Administrator review, draft generation, CRM import and duplicate blocking.
- Audit log coverage and rate/result limits.

## Production status
- Exa search is **unavailable** until `EXA_API_KEY` is configured.
- No production leads or prospect candidates were created by deployment.
- DeepSeek remains live for task execution and is required for draft generation.
