# NAGASARIBU AI WORKFORCE

Cloud-first operations platform for the NAGASARIBU AI Workforce.

## Phase 1 — Foundation
- Cloudflare Worker API foundation
- Health endpoint
- Safe-by-default architecture

## Phase 2 — Operations Control Centre
- Dedicated Cloudflare D1 database (`nagasaribu-ai-workforce-db`)
- Versioned SQL migrations
- Users and roles, agent registry, tasks and task events, leads and lead sources,
  approvals, and audit logs
- Authenticated API for tasks, agents, prospective customers and approval workflows
- Malay, responsive Operations Control Centre at `/`
- Free-tier only: no paid services or plan upgrades

## Phase 3 — AI Workforce Activation
- Six registered agents: SARA, QS AI, Marketing AI, Finance AI, Technical AI, Creative Studio
- SARA capability-based routing and task orchestration
- Secure DeepSeek provider adapter with Cloudflare Secrets
- Mock-only execution when `DEEPSEEK_API_KEY` is absent (no live AI claims)
- Live DeepSeek execution verified with a 100-token internal SARA task
- Task results, execution history, audit logging and approval gates
- Permanent first-admin bootstrap lock and hardened RBAC
- Real AI activity, mock mode and error visibility in the Malay dashboard

## Phase 4 — Customer Acquisition Engine
- Exa public-web search adapter with no-fake-results behaviour when unconfigured
- Explainable prospect qualification with DeepSeek-assisted scoring, evidence, retrieval dates and missing information
- Administrator review before CRM import with company/source deduplication
- Marketing AI outreach drafts through DeepSeek Live; no automatic sending
- Malay **Cari Prospek** interface with source links and approval controls
- Search/draft rate limits, result limits and audit logging

## Phase 5 — Multi-Model Router
- DeepSeek remains primary; Meta Muse Spark 1.3 is the single-attempt backup
- Automatic fallback only for timeouts, network failures, HTTP 429 and HTTP 5xx
- No fallback on authentication, configuration or invalid-request errors
- Provider/model/fallback recorded per task; token usage and provider errors in the dashboard
- Muse Spark is configured but not yet verified live at the 100-token high-reasoning limit

See [`docs/PHASE-2.md`](docs/PHASE-2.md) for the schema and base API,
[`docs/PHASE-3.md`](docs/PHASE-3.md) for activation and orchestration,
[`docs/PHASE-4.md`](docs/PHASE-4.md) for the customer acquisition engine,
and [`docs/PHASE-5.md`](docs/PHASE-5.md) for the provider router and Muse test result.

## Initial modules
- SARA — orchestration and operations
- QS AI — quantity surveying and construction
- Marketing AI — campaigns and lead generation
- Finance AI — budgeting and financial analysis
- Technical AI — engineering and system support
- Creative Studio — image, poster, and video workflow

## Development principles
- Keep BINARUMAH, BARANGVIRAL, and JUTAONE deployments isolated.
- Never change existing DNS, Pages projects, or production databases as part of this Worker setup.
- Store API keys and secrets as Cloudflare secrets; never commit secrets.
- Require explicit approval for payments, publishing, account changes, destructive actions, and external commitments.
- RM0-first means using free tiers where available; it does not mean unlimited free model or video generation.
- Do not create fake leads or send marketing messages.

## Local development
```bash
npm ci
npm run typecheck
npm test
npm run db:migrate:local
cp .dev.vars.example .dev.vars
# edit .dev.vars and set a random SESSION_SECRET
npm run dev
```

Open the local URL and complete the one-time administrator setup.

## Deploy
```bash
npm run db:migrate:remote
npm run db:seed:agents:remote
npm run deploy
```

Set or rotate the session secret with:
```bash
printf '%s' 'a-long-random-secret' | npx wrangler secret put SESSION_SECRET
```

Verify `/health`, then open `/` to sign in.
