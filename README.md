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
- Task results, execution history, audit logging and approval gates
- Permanent first-admin bootstrap lock and hardened RBAC
- Real AI activity, mock mode and error visibility in the Malay dashboard

See [`docs/PHASE-2.md`](docs/PHASE-2.md) for the schema and base API, and
[`docs/PHASE-3.md`](docs/PHASE-3.md) for activation, orchestration and the live-AI blocker.

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
