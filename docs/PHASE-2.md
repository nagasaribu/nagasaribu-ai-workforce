# Phase 2 — Operations Control Centre

## Scope
1. Add a dedicated D1 database for the AI Workforce.
2. Add versioned schema migrations for users, roles, agents, tasks, leads and approvals.
3. Provide authenticated API endpoints for daily operations.
4. Provide a Malay, responsive Operations Control Centre at `/`.
5. Cover authentication, database operations and API behaviour with automated tests.
6. Deploy to the existing Worker without touching unrelated Cloudflare resources.

## Deployment configuration
- Repository: `nagasaribu/nagasaribu-ai-workforce`
- Branch: `main`
- Worker: `nagasaribu-ai-workforce`
- Worker URL: `https://nagasaribu-ai-workforce.nagasaribuconsultancy.workers.dev`
- D1 database: `nagasaribu-ai-workforce-db`
- D1 database ID: `20071e74-ddcd-4a1e-98ae-3524d9b1d079`
- D1 region: APAC
- Plan: free tier only (no paid upgrade, no paid services)

## Database schema (migration `0001_initial_schema.sql`)

| Table | Purpose |
| --- | --- |
| `roles` | Role definitions and permission lists |
| `users` | Accounts, PBKDF2 password hashes, role and status |
| `agent_registry` | Registered AI agents, capabilities and lifecycle status |
| `tasks` | Work items, priority, assignment and lifecycle state |
| `task_events` | Immutable task history (created, assigned, status changes, comments) |
| `lead_sources` | Reference sources for prospective customers |
| `leads` | Prospective customer records with consent and do-not-contact flags |
| `approvals` | Approval requests, decisions, notes and timestamps |
| `audit_logs` | Security and operations audit trail |

Reference data is seeded for roles (`admin`, `manager`, `agent`, `viewer`) and lead
sources. No customer or lead records are seeded.

## Authentication and authorisation
- Passwords are hashed with PBKDF2-HMAC-SHA256, 100,000 iterations, per-user random salt.
- Sessions are HMAC-SHA256 signed tokens stored in an `HttpOnly`, `SameSite=Strict` cookie.
- Session lifetime is 8 hours. The signing secret is the `SESSION_SECRET` Worker secret.
- The first visit offers a one-time administrator setup form. Setup is refused once any user exists.
- Roles: `admin`, `manager`, `agent`, `viewer`.
- Administrative endpoints return `401` without a valid session and `403` without permission.
- State-changing requests reject foreign `Origin` headers and non-JSON payloads.
- Login attempts are rate-limited per isolate and failures are written to the audit log.
- Passwords, password hashes and the session secret are never returned by the API.

## API overview
Public:
- `GET /` — Malay Operations Control Centre (`?format=json` for service metadata)
- `GET /health` — service and database health
- `GET /api/info` — service metadata
- `GET /api/auth/me` — session status and whether first-run setup is required
- `POST /api/auth/setup` — create the first administrator (one time only)
- `POST /api/auth/login`
- `POST /api/auth/logout`

Authenticated:
- `GET /api/dashboard`
- `GET|POST /api/tasks`
- `GET|PATCH /api/tasks/:id`
- `POST /api/tasks/:id/assign`
- `POST /api/tasks/:id/events`
- `GET|POST /api/agents`
- `GET|PATCH /api/agents/:id`
- `GET|POST /api/leads`
- `GET|PATCH /api/leads/:id`
- `GET|POST /api/lead-sources`
- `GET|POST /api/approvals`
- `GET /api/approvals/:id`
- `POST /api/approvals/:id/decision`
- `GET|POST /api/users` — `POST` is administrator-only
- `PATCH /api/users/:id` — administrator-only
- `GET /api/audit-logs` — administrator/manager only

## Privacy and safety
- Lead records contain contact details and are only available to authenticated,
  authorised users. Agents can only see their own leads; viewers cannot access leads.
- The system does not send email, SMS or marketing messages.
- The system does not create leads automatically. All leads are entered manually.
- No secrets are committed to the repository. `SESSION_SECRET` is stored as a Worker secret.
- Audit logs store the actor, action, entity, timestamp and request metadata, not request bodies.

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
Open the local URL and complete the first-run administrator setup.

## Deploy
```bash
npm run db:migrate:remote
npm run deploy
```
Set or rotate the session secret with:
```bash
printf '%s' 'a-long-random-secret' | npx wrangler secret put SESSION_SECRET
```

## Verification
- `npm run typecheck` — pass
- `npm test` — 22 tests pass (auth, database operations, API permissions and workflow)
- Production `GET /health` — 200, database `ok`, auth `configured`
- Production `GET /` — 200, HTML with the Malay Operations Control Centre
- Production administrative endpoints without a session — 401
