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
- Muse Spark LIVE verified with minimal reasoning at a 1,024-token output limit; DeepSeek remains primary

## Phase 6 — Telegram Command Centre
- `POST /telegram/webhook` protected by `X-Telegram-Bot-Api-Secret-Token`
- One-time expiring pairing codes created only from the authenticated administrator dashboard
- Telegram user ID and private chat ID bound to the administrator; no automatic trust
- Bot API integration: `sendMessage`, `getMe`, `setWebhook`, `getWebhookInfo`
- Commands: `/start`, `/help`, `/status`, `/tasks`, `/agents`, `/prospects`, `/report`
- Natural-language tasks run through the existing SARA state machine and execution pipeline
- Explicit `/confirm` gate for external actions
- Duplicate `update_id` protection, rate limits, audit logging and dashboard connection status

## Phase 7 — Conversational Workspace V2
- Chat-first web workspace with persistent conversations in D1
- Shared web/Telegram execution pipeline, agent auto-routing and task references
- Persistent `human`, `simple` and `deep_thinking` response modes per user
- Safe HTML Telegram formatting, `/task`, `/mode` and `/report full`
- Web chat idempotency, approval confirmation, conversation history and responsive UI
- Telegram bot command menu registered with `setMyCommands`

## Phase 8 — Conversational Intelligence V3
- Explicit conversation, read-only status, internal work and external-action paths
- General conversation no longer creates a task for every message
- Recent D1 conversation history is passed to the model with a bounded context window
- Dedicated SARA personality prompt and deterministic intent classifier
- Real read-only status answers from D1, providers, agents, approvals, audit and Telegram
- Shared conversation identity, history and modes across Web and Telegram

See [`docs/PHASE-2.md`](docs/PHASE-2.md) for the schema and base API,
[`docs/PHASE-3.md`](docs/PHASE-3.md) for activation and orchestration,
[`docs/PHASE-4.md`](docs/PHASE-4.md) for the customer acquisition engine,
[`docs/PHASE-5.md`](docs/PHASE-5.md) for the provider router and Muse test result,
[`docs/PHASE-6.md`](docs/PHASE-6.md) for the Telegram command centre,
[`docs/PHASE-7.md`](docs/PHASE-7.md) for the conversational workspace,
and [`docs/PHASE-8.md`](docs/PHASE-8.md) for conversational intelligence V3.

## Architecture decision — Database strategy (locked)
- **Cloudflare D1 is the single primary production database.**
- **Supabase is not used.**
- **No second database and no duplicate authentication/CRM records.**
- All existing D1 migrations and production data must remain intact.
- Backend services run on Cloudflare Workers.
- Cloudflare R2 may be considered for future media storage only, not as a second record database.
- **Any future production migration requires explicit administrator approval.**

See [`docs/ADR-001-database-strategy.md`](docs/ADR-001-database-strategy.md) and
[`migrations/README.md`](migrations/README.md).

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
# Production migration requires explicit administrator approval before running:
npm run db:migrate:remote

npm run db:seed:agents:remote
npm run deploy
```

Set or rotate the session secret with:
```bash
printf '%s' 'a-long-random-secret' | npx wrangler secret put SESSION_SECRET
```

Verify `/health`, then open `/` to sign in.
