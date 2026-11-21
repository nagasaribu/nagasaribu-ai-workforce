# Phase 3 — AI Workforce Activation

## Scope
1. Harden and verify authentication, roles, escalation guards and audit logging.
2. Register the six workforce agents.
3. Add SARA task orchestration and a secure DeepSeek provider adapter.
4. Execute tasks through agents, record results, events and audit logs.
5. Add approval gates for risky external actions.
6. Show real agent, task, execution and error status in the Malay dashboard.

## Security hardening
- `system_settings.bootstrap_completed` permanently closes first-admin setup after bootstrap.
  Removing every user does not reopen setup.
- Passwords remain PBKDF2-HMAC-SHA256 with per-user salts.
- Sessions are HMAC-SHA256 signed, 8-hour, `HttpOnly`, `SameSite=Strict` cookies.
- Disabled users immediately lose API access because the user row is checked on every request.
- Role escalation is blocked:
  - `agent` and `viewer` cannot create or modify users.
  - Administrators cannot demote or disable their own account.
  - The last active administrator cannot be removed.
- Foreign `Origin` headers are rejected on state-changing requests.
- Login failures and all operational actions are written to `audit_logs`.

## Registered agents

| Agent | Kind | Status | Capabilities |
| --- | --- | --- | --- |
| SARA | `orchestrator` | active | orchestration, routing, coordination, quality_gate, reporting |
| QS AI | `quantity_surveying` | active | quantity_surveying, cost_estimation, bill_of_quantities, tender_analysis, construction_measurement |
| Marketing AI | `customer_acquisition` | active | customer_acquisition, campaign_planning, content_strategy, lead_qualification, market_research |
| Finance AI | `financial_operations` | active | financial_operations, budgeting, cashflow, invoicing, financial_reporting |
| Technical AI | `engineering_automation` | active | engineering, automation, integration, cloud_infrastructure, quality_assurance |
| Creative Studio | `creative_production` | active | creative_production, copywriting, image_briefs, video_briefs, brand_consistency |

Marketing AI and Creative Studio carry `requiresApproval: true` in their agent config because
their work can lead to external publication. SARA routes unassigned tasks by capability and
falls back to itself as orchestrator.

Provision or refresh the agents idempotently:
```bash
npm run db:seed:agents:remote
```

## Central brain and DeepSeek adapter
- Adapter: `src/providers/deepseek.ts`.
- Orchestration: `src/orchestrator.ts`.
- Credentials are read from Cloudflare Secrets/vars:
  - `DEEPSEEK_API_KEY` (secret, optional)
  - `DEEPSEEK_BASE_URL` (optional, HTTPS only)
  - `DEEPSEEK_MODEL` (optional, default `deepseek-chat`)
  - `AI_MODE` (optional, `mock` forces mock mode)
- If `DEEPSEEK_API_KEY` is missing, the adapter runs in **mock mode only**.
- Mock results are prefixed with `[MOD MOCK]`, are stored as drafts, and the task is marked
  `blocked`. The system never claims that a mock execution is a live AI result.
- Live mode performs a `POST /chat/completions` call with a 20-second timeout and sanitized
  errors. API keys are never logged or returned.
- `GET /api/ai/status` reports mode, model and configuration state without exposing secrets.
- `GET /health` reports `checks.ai` as `mock` or `live`.

### Live-mode blocker
`DEEPSEEK_API_KEY` is not configured in production. Live DeepSeek execution has therefore
**not** been tested against the real provider. The adapter's live request/response path is
covered by unit tests with a stubbed HTTP transport. Do not claim live AI execution until a
real provider call succeeds.

To enable live mode:
```bash
printf '%s' 'your-deepseek-api-key' | npx wrangler secret put DEEPSEEK_API_KEY
```

## Task state machine
Tasks expose `execution_state`:
`pending → assigned → running → completed | failed | blocked`, with `cancelled` as a terminal
exit. Valid transitions are enforced server-side; invalid transitions return
`409 invalid_transition`. The legacy `status` column is kept in sync for compatibility
(`running` maps to `in_progress`, `failed` maps to `blocked`).

`POST /api/tasks/:id/auto-assign` asks SARA to select an active agent by capability, falling
back to the orchestrator. Assignment and routing are recorded in `task_events` and `audit_logs`.

## Task execution
`POST /api/tasks/:id/execute`:
1. Requires an authenticated user with `tasks.write` permission.
2. Uses the assigned agent, or SARA routes by task capability.
3. Checks the approval gate when the task, agent or tool requires approval.
4. Transitions the task to `running` with optimistic concurrency protection.
5. Runs an allowlisted safe internal tool when the task specifies one.
6. Calls the provider adapter.
7. Records `execution_completed`, `execution_mock` or `execution_failed`.
8. Stores `result`, `last_error`, `execution_mode`, `last_execution_at` and `execution_count`.
9. Writes a `task.execute` audit log.

Mock executions are stored as `blocked`, return `success: false`, and can never be reported
as completed work. Only a live provider response can move a task to `completed`.

## Safe tools and approval gates
`POST /api/tasks/:id/tools/:tool` supports:
- Safe read-only tools: `registry_snapshot`, `task_context`, `lead_summary`.
- Risky tools: `external_publish`, `send_campaign`, `payment`.

Risky tools require an approved `approvals` row and are never executed in this phase because
no external integration is configured. They return `409 tool_not_configured`; the system does
not claim that content was published, messages were sent or payments were made. Every tool
attempt is recorded in `task_events` and `audit_logs`.

Approval gate:
- Triggered by task metadata `requiresApproval: true`, agent config `requiresApproval: true`,
  or an `external_action` capability.
- Requires an approved `approvals` row for `entity_type = 'task'` and the task ID.
- Blocked attempts record `approval_required` and a `task.execute_blocked` audit log.
- The task list exposes a **Mohon Kelulusan** action for flagged tasks.

## Dashboard
The Malay dashboard shows:
- Real task and agent counts and statuses.
- AI mode (mock/live), model, and whether a key is configured.
- Execution totals: started, completed, failed, mock-only, approval-blocked.
- Recent operational activity from `task_events`.
- Recent errors and blocked tasks from `tasks.last_error`.

No leads, tasks or activity are seeded for display purposes.

## Tests
`npm test` covers 40 tests:
- Password hashing, token signing, expiry, tampering and cookies.
- First-run setup, permanent bootstrap lock, login failures and disabled sessions.
- RBAC for admin, manager, agent and viewer roles.
- Privilege-escalation attempts and self-demotion guards.
- D1 CRUD for agents, tasks, task events, lead sources, leads and approvals.
- State-machine transitions, invalid transition rejection and legacy status mapping.
- SARA capability-based routing and assignment.
- Safe tool execution and risky-tool approval/not-configured behaviour.
- Approval gates and mock task execution with `success: false`.
- DeepSeek mock mode, live request shape (stubbed transport), sanitized errors and timeouts.
- Audit log coverage.

## Database migration
`migrations/0002_ai_execution.sql` adds:
- `system_settings` and the permanent `bootstrap_completed` flag.
- Task `result`, `last_error`, `last_execution_at`, `execution_mode`, `execution_count`.
- Execution indexes.

`migrations/0003_task_state_machine.sql` adds:
- `tasks.execution_state` with the enforced state values.
- Backfill from the legacy `status` column.
- A state index.

Apply:
```bash
npm run db:migrate:remote
npm run db:seed:agents:remote
npm run deploy
```

## Production status
- Six agents registered and active.
- Zero tasks, zero leads, zero approvals created during activation.
- Provider mode: **mock** (no `DEEPSEEK_API_KEY`).
- First-admin setup: closed (`409`).
- Unauthenticated administrative endpoints: `401`.
